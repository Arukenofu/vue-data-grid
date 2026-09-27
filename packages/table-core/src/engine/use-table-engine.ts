import {
	computed,
	getCurrentScope,
	type MaybeRef,
	type MaybeRefOrGetter,
	onScopeDispose,
	type Ref,
	shallowRef,
	toValue,
	unref,
} from 'vue';

import {
	type ColumnGroup,
	type ColumnGroupsInput,
	isCollapsibleGroup,
	keepsGroupsTogether,
	resolveCollapsedColumns,
	resolveGroupPaths,
	toGroupList,
} from '../column-groups/column-groups';
import { useColumnGroups } from '../column-groups/use-column-groups';
import {
	type AnyColumn,
	clampColumnWidth,
	type ColumnsInput,
	getChangedFields,
	isFunctionOnlyChange,
	reconcileColumns,
	toColumnList,
} from '../columns/column';
import type { TableLayout } from '../columns/layout';
import { type TableSort, toggleSort } from '../columns/sort';
import { type TableColumnsState, useTableColumnsState } from '../columns/use-table-columns-state';
import { type ColumnSpanCell, resolveColumnSpan } from '../render/column-span';
import { FLEX_CELL_STYLES, type GeometryLayer, type TableCellStyles } from '../render/geometry';
import { createRowKeyResolver, type RowKey } from '../rows/row-key';
import { stableComputed } from '../shared/stable-computed';
import { type ColumnWindow, resolveColumnWindow } from '../virtual/column-window';
import { resolveScrollPosition, type ScrollAlign } from '../virtual/scroll';
import { useScrollViewport } from '../virtual/use-scroll-viewport';
import { useVirtualColumns } from '../virtual/use-virtual-columns';
import { useVirtualRows } from '../virtual/use-virtual-rows';
import { type FitColumn, fitColumnWidths } from './fit-columns';
import type { KeepRendered, RowRange, TableScope } from './scope';
import { type ColumnsInsets, useTableColumns } from './use-table-columns';

export interface VirtualOptions {
	rows?: boolean;
	columns?: boolean;
	/** Rows rendered past each edge of the viewport; `6` by default. */
	overscan?: number;
	/** Width rendered past each edge of the viewport, px, since columns differ in width; `200` by default. */
	bufferPx?: number;
	/**
	 * Rows rendered before the scroll container is mounted, on the server and in hydration; `24` by
	 * default.
	 */
	ssrRows?: number;
}

export interface TableEngineOptions<TRow = unknown> {
	/** Columns from `defineColumns`, as an object by name or an array. */
	columns: MaybeRefOrGetter<ColumnsInput | readonly AnyColumn[]>;
	/** Column groups from `defineColumnGroups`, as an object by name or an array. */
	groups?: MaybeRefOrGetter<ColumnGroupsInput | readonly ColumnGroup[] | undefined>;
	/** The rows to render, already sorted, grouped, flattened and filtered. */
	rows: MaybeRefOrGetter<readonly TRow[]>;
	/** The scroll container; `null` before mount, and the windows wait for it. */
	root: Ref<HTMLElement | null>;
	/** The row key: a field of the row or a function of it. Read once. */
	rowKey: RowKey<TRow>;
	/** Column state; without it the engine creates its own. Read once. */
	state?: TableColumnsState;
	/** Widths of your service columns at each edge of the row, px; pinned columns stick after them. */
	insets?: MaybeRefOrGetter<ColumnsInsets>;
	/** How geometry becomes cell, group and spacer styles; a flex row by default. Read once. */
	cellStyles?: TableCellStyles;
	virtual?: MaybeRefOrGetter<boolean | VirtualOptions>;
	/**
	 * Row height, or its estimate with `measureRows`, px: a number, a ref of one, or a function of the
	 * row and its index. A function is always a height function, never a getter of a number. There is
	 * no default: the row window computes offsets from it, and a made-up number would shift scrolling
	 * against the real rows.
	 */
	rowHeight: MaybeRef<number> | ((row: TRow, index: number) => number);
	/** Measure rows in the DOM; `rowHeight` is then only the initial estimate. */
	measureRows?: MaybeRefOrGetter<boolean>;
	/**
	 * The attribute with the row index that the markup puts on each row; `data-tc-index` by default. Read
	 * once.
	 */
	indexAttribute?: string;
	/** Height of the sticky top (header, pinned rows), px: the body starts below it. */
	scrollMargin?: MaybeRefOrGetter<number>;
	/**
	 * Height of the sticky bottom (footer, pinned rows), px: scrolling to a row keeps it clear of the
	 * bottom, as `scrollMargin` does at the top.
	 */
	scrollMarginEnd?: MaybeRefOrGetter<number>;
	/** Row indexes that must stay rendered, such as under a drag; see also `scope.keepRendered`. */
	keepRows?: MaybeRefOrGetter<readonly number[]>;
	/** Column names that must stay rendered. */
	keepColumns?: MaybeRefOrGetter<readonly string[]>;
}

const DEFAULT_INDEX_ATTRIBUTE = 'data-tc-index';

const DEFAULTS = { overscan: 6, bufferPx: 200, ssrRows: 24 };

const NO_INSETS: ColumnsInsets = { start: 0, end: 0 };

const NO_KEYS: readonly string[] = [];

const NO_KEEP_ROWS: readonly number[] = [];

const NO_KEEP_COLUMNS: readonly string[] = [];

const EMPTY_RANGE: RowRange = { start: 0, end: 0 };

const NO_COLUMNS: ReadonlySet<string> = new Set();

const RECREATION_LIMIT = 3;

// Spans asked for at once: one for each range. The cache keeps their cells the same objects, so it
// holds more spans than a selection has ranges.
const SPAN_CACHE_LIMIT = 256;

function getRowHeightOption<TRow>(option: TableEngineOptions<TRow>['rowHeight']) {
	return typeof option === 'function' ? option : unref(option);
}

function createRecreationWatcher() {
	const counts = new Map<string, number>();

	return (previous: readonly AnyColumn[], next: readonly AnyColumn[]) => {
		const known = new Map(previous.map(column => [column.name, column]));

		for (const column of next) {
			const before = known.get(column.name);

			if (!before || before === column) {
				continue;
			}

			const fields = getChangedFields(before, column);

			if (!isFunctionOnlyChange(before, column, fields)) {
				continue;
			}

			const count = (counts.get(column.name) ?? 0) + 1;

			counts.set(column.name, count);

			if (count === RECREATION_LIMIT) {
				// oxlint-disable-next-line no-console
				console.warn(
					`[@vue-stack/table-core] Column "${column.name}" was recreated ${count} times with nothing but new `
					+ `functions (${fields.join(', ')}), and every time all of its cells re-render. Declare columns `
					+ 'outside of `computed` or keep the previous function references.',
				);
			}
		}
	};
}

function createDuplicateKeyWatcher() {
	let warned = false;

	return (keys: readonly string[]) => {
		if (warned) {
			return;
		}

		const seen = new Set<string>();

		for (const key of keys) {
			if (seen.has(key)) {
				warned = true;
				// oxlint-disable-next-line no-console
				console.warn(
					`[@vue-stack/table-core] Row key "${key}" belongs to more than one row. Keys must be unique: row `
					+ 'rendering, `getRowIndex`, cell focus and measured heights find rows by them.',
				);

				return;
			}

			seen.add(key);
		}
	};
}

/**
 * Everything a table has apart from markup: the column model, row and column windows, group rows and
 * geometry as CSS variables. Call it in `setup`, pass `scope` to `createTableScopeContext` and `layers` to
 * `useTableGeometry`.
 */
export function useTableEngine<TRow = unknown>(options: TableEngineOptions<TRow>) {
	const state = options.state ?? useTableColumnsState();
	const rows = computed<readonly TRow[]>(() => toValue(options.rows));
	const getKeyOf = createRowKeyResolver(options.rowKey);
	const watchDuplicateKeys = __DEV__ ? createDuplicateKeyWatcher() : null;

	const rowKeys = stableComputed<readonly string[]>(NO_KEYS, (previous) => {
		const list = rows.value;
		let next: string[] | null = list.length === previous.length ? null : [];

		for (const [index, row] of list.entries()) {
			const key = getKeyOf(row);

			if (next) {
				next.push(key);
			} else if (key !== previous[index]) {
				next = [...previous.slice(0, index), key];
			}
		}

		if (!next) {
			return previous;
		}

		watchDuplicateKeys?.(next);

		return next;
	});

	const rowIndexes = computed(() => {
		const indexes = new Map<string, number>();

		rowKeys.value.forEach((key, index) => {
			if (!indexes.has(key)) {
				indexes.set(key, index);
			}
		});

		return indexes;
	});

	const insets = computed<ColumnsInsets>(() => toValue(options.insets) ?? NO_INSETS);
	const cellStyles = options.cellStyles ?? FLEX_CELL_STYLES;
	const watchRecreation = __DEV__ ? createRecreationWatcher() : null;

	const columnList = stableComputed<readonly AnyColumn[]>([], (previous) => {
		const next = reconcileColumns(previous, toColumnList(toValue(options.columns)));

		if (watchRecreation && next !== previous) {
			watchRecreation(previous, next);
		}

		return next;
	});

	const groupList = computed(() => toGroupList(toValue(options.groups)));
	const groupsByName = computed(() => new Map(groupList.value.map(group => [group.name, group])));
	const groupPaths = computed(() => resolveGroupPaths(groupList.value));
	const collapsible = computed(() => groupList.value.some(isCollapsibleGroup));

	function isCollapsedIn(layout: TableLayout | null, group: ColumnGroup) {
		return layout?.collapsed?.[group.name] ?? group.collapsedByDefault ?? false;
	}

	const columns = useTableColumns({
		columns: columnList,
		layout: state.layout,
		insets,
		cellStyles,
		getCollapsedColumns: layout => (collapsible.value
			? resolveCollapsedColumns(groupPaths.value, group => isCollapsedIn(layout, group))
			: NO_COLUMNS),
		keepsGroups: (before, after) => keepsGroupsTogether(groupPaths.value, before, after),
	});

	const virtual = computed<Required<VirtualOptions>>(() => {
		const value = toValue(options.virtual) ?? false;
		const given = typeof value === 'object' ? value : { rows: value, columns: value };

		return {
			rows: given.rows ?? true,
			columns: given.columns ?? true,
			overscan: given.overscan ?? DEFAULTS.overscan,
			bufferPx: given.bufferPx ?? DEFAULTS.bufferPx,
			ssrRows: given.ssrRows ?? DEFAULTS.ssrRows,
		};
	});

	// Rows can shrink a frame before the window does: never resolve the key of a missing row.
	function getRowKey(index: number) {
		const row = rows.value[index];

		return row === undefined ? String(index) : getKeyOf(row);
	}

	function getRowHeight(index: number) {
		const height = getRowHeightOption(options.rowHeight);

		return typeof height === 'number' ? height : height(rows.value[index], index);
	}

	const uniformHeight = computed(() => {
		const height = getRowHeightOption(options.rowHeight);

		return typeof height === 'number' && !toValue(options.measureRows) ? height : null;
	});

	const keepSources = shallowRef<readonly KeepRendered[]>([]);

	function keepRendered(source: KeepRendered) {
		keepSources.value = [...keepSources.value, source];

		function release() {
			keepSources.value = keepSources.value.filter(item => item !== source);
		}

		if (getCurrentScope()) {
			onScopeDispose(release);
		}

		return release;
	}

	const keptRows = computed<readonly number[]>(() => {
		const own = toValue(options.keepRows) ?? NO_KEEP_ROWS;

		return keepSources.value.length === 0
			? own
			: [...own, ...keepSources.value.flatMap(source => source.rows?.() ?? [])];
	});

	const keptColumns = computed<readonly string[]>(() => {
		const own = toValue(options.keepColumns) ?? NO_KEEP_COLUMNS;

		return keepSources.value.length === 0
			? own
			: [...own, ...keepSources.value.flatMap(source => source.columns?.() ?? [])];
	});

	const viewport = useScrollViewport(options.root);

	const rowWindow = useVirtualRows({
		viewport,
		count: () => rows.value.length,
		enabled: () => virtual.value.rows,
		overscan: () => virtual.value.overscan,
		scrollMargin: () => toValue(options.scrollMargin) ?? 0,
		scrollMarginEnd: () => toValue(options.scrollMarginEnd) ?? 0,
		estimateSize: getRowHeight,
		uniformSize: () => uniformHeight.value,
		measured: () => toValue(options.measureRows) ?? false,
		getItemKey: getRowKey,
		getItemKeys: () => rowKeys.value,
		keep: () => keptRows.value,
		ssrCount: () => virtual.value.ssrRows,
		indexAttribute: options.indexAttribute ?? DEFAULT_INDEX_ATTRIBUTE,
	});

	const columnWindow = useVirtualColumns({
		viewport,
		columns: () => columns.columns.value,
		enabled: () => virtual.value.columns,
		getWidth: columns.getWidth,
		inset: () => insets.value.start,
		bufferPx: () => virtual.value.bufferPx,
		keep: () => keptColumns.value,
	});

	const columnsWindow = stableComputed<ColumnWindow, null>(
		null,
		previous => resolveColumnWindow(
			columns.columns.value,
			columnWindow.range.value,
			columns.getWidth,
			previous,
			cellStyles.spacer,
		),
	);

	const renderedColumns = computed(() => columnsWindow.value.rendered);

	const windowed = computed(() => renderedColumns.value !== columns.columns.value);

	function isGroupCollapsed(name: string) {
		const group = groupsByName.value.get(name);

		return group !== undefined && isCollapsibleGroup(group) && isCollapsedIn(state.layout.value, group);
	}

	function toggleGroup(name: string) {
		const group = groupsByName.value.get(name);

		if (group && isCollapsibleGroup(group)) {
			columns.setGroupCollapsed(name, !isCollapsedIn(columns.currentLayout(), group));
		}
	}

	const headerGroups = useColumnGroups({
		paths: () => groupPaths.value,
		isCollapsed: group => isCollapsedIn(state.layout.value, group),
		visible: () => columns.columns.value,
		rendered: () => renderedColumns.value,
		getPinOffset: columns.getPinOffset,
		getGrow: columns.getGrow,
		cellStyles,
	});

	const declaredNames = computed(() => new Set(columnList.value.map(column => column.name)));

	// A stored or initial sort may name columns that are gone: they neither sort nor count in positions.
	const activeSort = computed<readonly TableSort[]>(() => {
		const sort = state.sort.value;

		return sort.every(item => declaredNames.value.has(item.name))
			? sort
			: sort.filter(item => declaredNames.value.has(item.name));
	});

	const sortIndexes = computed(() => new Map(activeSort.value.map((item, index) => [item.name, index])));
	const multiSort = computed(() => state.multiSort.value);

	function toggleColumn(name: string) {
		columns.toggleColumn(name);

		if (columns.currentLayout().hidden.includes(name)) {
			state.sort.value = state.sort.value.filter(item => item.name !== name);
		}
	}

	function getResizable(names: readonly string[] | undefined) {
		const shown = columns.columns.value.flatMap(item => (item.column?.resizable ? [item.column] : []));

		if (!names) {
			return shown;
		}

		const wanted = new Set(names);

		return shown.filter(column => wanted.has(column.name));
	}

	function fitColumns(names?: readonly string[]) {
		const root = options.root.value;
		const targets = new Set(getResizable(names).map(column => column.name));

		if (!root || targets.size === 0) {
			return false;
		}

		const fitted: FitColumn[] = [];
		let fixed = insets.value.start + insets.value.end;

		for (const { column } of columns.columns.value) {
			if (column && targets.has(column.name)) {
				fitted.push({
					name: column.name,
					width: columns.getWidth(column.name),
					minWidth: column.minWidth,
					maxWidth: column.maxWidth,
				});
			} else if (column) {
				fixed += columns.getWidth(column.name);
			}
		}

		return columns.setWidths(fitColumnWidths(fitted, root.clientWidth - fixed));
	}

	function scrollToColumn(name: string, align: ScrollAlign = 'auto') {
		const root = options.root.value;
		const rendered = columns.getColumn(name);

		if (!root || !rendered || rendered.pin) {
			return;
		}

		const rtl = getComputedStyle(root).direction === 'rtl';

		let pinnedStart = insets.value.start;
		let pinnedEnd = insets.value.end;

		for (const item of columns.columns.value) {
			const width = columns.getWidth(item.column?.name ?? '');

			if (item.pin === 'start') {
				pinnedStart += width;
			} else if (item.pin === 'end') {
				pinnedEnd += width;
			}
		}

		const offsets = columns.offsets.value;
		const left = resolveScrollPosition({
			start: offsets[rendered.index],
			end: offsets[rendered.index + 1],
			insetStart: pinnedStart,
			insetEnd: pinnedEnd,
			viewport: root.clientWidth,
			scroll: Math.abs(root.scrollLeft),
			max: root.scrollWidth - root.clientWidth,
			align,
		});

		if (left !== null) {
			root.scrollLeft = rtl && left > 0 ? -left : left;
		}
	}

	const pendingWidths = new Map<string, number>();
	let resizeFrame: number | null = null;

	function flushResize() {
		resizeFrame = null;

		for (const [name, width] of pendingWidths) {
			columns.resize(name, width);
		}

		pendingWidths.clear();
	}

	function resize(name: string, width: number) {
		const column = columnList.value.find(item => item.name === name);

		if (!column?.resizable) {
			return columns.getWidth(name);
		}

		pendingWidths.set(name, width);

		if (typeof requestAnimationFrame !== 'function') {
			flushResize();
		} else {
			resizeFrame ??= requestAnimationFrame(flushResize);
		}

		return clampColumnWidth(column, width);
	}

	function commitResize() {
		if (resizeFrame !== null) {
			cancelAnimationFrame(resizeFrame);
		}

		flushResize();
		columns.commitResize();
	}

	const spans = new Map<string, readonly ColumnSpanCell[]>();

	function getColumnSpan(start: number, end: number) {
		const key = `${start}:${end}`;
		const previous = spans.get(key);
		const next = resolveColumnSpan(columns.columns.value, start, end, {
			insets: insets.value,
			getPinOffset: columns.getPinOffset,
			getGrow: columns.getGrow,
			cellStyles,
		}, previous);

		if (next !== previous) {
			if (spans.size >= SPAN_CACHE_LIMIT) {
				spans.clear();
			}

			spans.set(key, next);
		}

		return next;
	}

	const rowRange = stableComputed<RowRange>(EMPTY_RANGE, (previous) => {
		const items = rowWindow.items.value;
		const last = items[items.length - 1];

		if (last === undefined) {
			return EMPTY_RANGE;
		}

		const start = items[0].index;
		const end = last.index + 1;

		return previous.start === start && previous.end === end ? previous : { start, end };
	});

	const scope: TableScope<TRow> = {
		root: options.root,
		rows,
		rowKeys,
		getRowKey: getKeyOf,
		getRowIndex: key => rowIndexes.value.get(key) ?? -1,
		rowRange,
		visibleRange: rowWindow.visibleRange,
		getPageStep: rowWindow.getPageStep,
		getRowOffset: rowWindow.getOffset,
		columns: columns.columns,
		renderedColumns,
		orderedColumns: columns.orderedColumns,
		headerGroups,
		offsets: columns.offsets,
		sort: activeSort,
		getColumn: columns.getColumn,
		getPin: columns.getPin,
		isColumnHidden: columns.isColumnHidden,
		getWidth: columns.getWidth,
		getColumnSpan,
		toggleColumn,
		pinColumn: columns.pinColumn,
		moveColumnTo: columns.moveColumnTo,
		moveColumnBefore: columns.moveColumnBefore,
		canMoveColumnTo: columns.canMoveColumnTo,
		moveColumnBy: columns.moveColumnBy,
		canMoveColumnBy: columns.canMoveColumnBy,
		batch: columns.batch,
		getSortDirection: name => activeSort.value[sortIndexes.value.get(name) ?? -1]?.direction,
		getSortIndex: (name) => {
			const index = sortIndexes.value.get(name);

			return index !== undefined && activeSort.value.length > 1 ? index + 1 : undefined;
		},
		multiSort,
		toggleSort: (name, additive) => {
			const column = columnList.value.find(item => item.name === name);

			if (column?.sortable) {
				state.sort.value = toggleSort(activeSort.value, name, additive && multiSort.value, column.sortOrder);
			}
		},
		isGroupCollapsed,
		toggleGroup,
		resize,
		commitResize,
		previewWidths: columns.previewWidths,
		setWidths: columns.setWidths,
		fitColumns,
		scrollToRow: rowWindow.scrollToIndex,
		scrollToColumn,
		keepRendered,
	};

	onScopeDispose(() => {
		if (resizeFrame !== null) {
			cancelAnimationFrame(resizeFrame);
		}
	});

	const layers = computed<readonly GeometryLayer[]>(() => [
		{ selector: null, style: columns.variables.value },
		...columns.overlay.value,
	]);

	return {
		scope,
		/** The state the engine works on: the one passed in, or its own. */
		state,
		/** The `virtual` options with defaults filled in. */
		virtual,
		uniformHeight,
		windowed,
		hiddenColumns: columns.hiddenColumns,
		layers,
		/** Total width of the shown columns without insets; `live` includes a resize in progress. */
		contentWidth: columns.contentWidth,
		/** The row window: what to render, how tall the body is, and how to measure a row. */
		items: rowWindow.items,
		totalSize: rowWindow.totalSize,
		measureElement: rowWindow.measureElement,
	};
}
