import { computed, type Ref, shallowRef } from 'vue';

import {
	type AnyColumn,
	clampColumnWidth,
	type ColumnPinSide,
	type RenderedColumn,
	resolveRowHeaders,
	toRuntimeColumn,
} from '../columns/column';
import { keepsFixedColumns, moveColumn } from '../columns/column-order';
import { resolveLayout, type TableLayout } from '../columns/layout';
import {
	getColumnSelector,
	getGeometryKey,
	getGrowVariable,
	getInsetVariable,
	getPinOffsets,
	getPinVariable,
	getWidthVariable,
	type GeometryLayer,
	type TableCellStyles,
} from '../render/geometry';
import { stableComputed } from '../shared/stable-computed';

const PIN_RANK: Record<ColumnPinSide | 'none', number> = { start: 0, none: 1, end: 2 };

const NO_LAYERS: readonly GeometryLayer[] = [];

const NO_WIDTHS: Readonly<Record<string, number>> = {};

const NO_NAMES: ReadonlySet<string> = new Set();

export interface ColumnsInsets {
	start: number;
	end: number;
}

interface ColumnsOptions {
	columns: Ref<readonly AnyColumn[]>;
	layout: Ref<TableLayout | null>;
	insets: Ref<ColumnsInsets>;
	cellStyles: TableCellStyles;
	/** Columns hidden by collapsed groups under this layout. */
	getCollapsedColumns?: (layout: TableLayout) => ReadonlySet<string>;
	/** Whether a move from `before` to `after` keeps `keepTogether` groups together. */
	keepsGroups?: (before: readonly string[], after: readonly string[]) => boolean;
}

interface ResolvedWidths {
	sizes: ReadonlyMap<string, number>;
	manual: ReadonlySet<string>;
}

interface ColumnCache {
	key: string;
	cellProps: RenderedColumn['cellProps'];
	headerProps: RenderedColumn['headerProps'];
}

interface ColumnsFrame {
	cache: ReadonlyMap<string, ColumnCache>;
	columns: readonly RenderedColumn[];
}

const EMPTY_FRAME: ColumnsFrame = { cache: new Map(), columns: [] };

function resolvePins(columns: readonly AnyColumn[], layout: TableLayout) {
	const result = new Map<string, ColumnPinSide>();

	for (const column of columns) {
		const side = column.pinnable ? layout.pinned[column.name] : column.pinned;

		if (side) {
			result.set(column.name, side);
		}
	}

	return result;
}

function orderColumns(
	columns: readonly AnyColumn[],
	layout: TableLayout,
	pins: ReadonlyMap<string, ColumnPinSide>,
) {
	const rank = new Map(layout.order.map((name, index) => [name, index]));
	const unknown = rank.size;

	return [...columns].sort((first, second) =>
		PIN_RANK[pins.get(first.name) ?? 'none'] - PIN_RANK[pins.get(second.name) ?? 'none']
		|| (rank.get(first.name) ?? unknown) - (rank.get(second.name) ?? unknown));
}

function filterVisible(ordered: readonly AnyColumn[], hidden: ReadonlySet<string>) {
	return ordered.filter(column => !hidden.has(column.name));
}

function isSameSet(current: ReadonlySet<string>, next: ReadonlySet<string>) {
	return current.size === next.size && [...next].every(name => current.has(name));
}

function isSameRenderedColumn(current: RenderedColumn, next: RenderedColumn) {
	return current.column === next.column
		&& current.key === next.key
		&& current.index === next.index
		&& current.pin === next.pin
		&& current.rowHeader === next.rowHeader
		&& current.cellProps === next.cellProps
		&& current.headerProps === next.headerProps;
}

function toNames(columns: readonly AnyColumn[]) {
	return columns.map(column => column.name);
}

export function useTableColumns(options: ColumnsOptions) {
	const draft = shallowRef<Record<string, number>>({});
	// Widths shown without being written to the layout, such as the frames of a transition.
	const preview = shallowRef<Record<string, number>>({});

	let pending: TableLayout | null = null;
	let depth = 0;

	const resolved = computed(() => resolveLayout(options.columns.value, options.layout.value));
	const hidden = computed(() => new Set(resolved.value.hidden));

	function concealFrom(layout: TableLayout, layoutHidden: ReadonlySet<string>) {
		const collapsed = options.getCollapsedColumns?.(layout);

		return !collapsed || collapsed.size === 0 ? layoutHidden : new Set([...layoutHidden, ...collapsed]);
	}

	// Hidden by the user or by a collapsed group; `hidden` is the user's part only.
	const concealed = computed(() => concealFrom(resolved.value, hidden.value));
	const pins = computed(() => resolvePins(options.columns.value, resolved.value));

	function getPin(name: string) {
		return pins.value.get(name);
	}

	const ordered = computed(() => orderColumns(options.columns.value, resolved.value, pins.value));
	const visible = computed(() => filterVisible(ordered.value, concealed.value));
	const pinOffsets = computed(() => getPinOffsets(visible.value, getPin));

	function getPinOffset(name: string) {
		return pinOffsets.value.get(name) ?? 0;
	}

	function getColumnEntry(column: AnyColumn, pin: ColumnPinSide | undefined, offset: number, previous: ColumnCache | undefined) {
		const key = getGeometryKey(column, pin, offset);

		if (previous?.key === key) {
			return previous;
		}

		const { cell, header } = options.cellStyles;
		const style = cell(column, pin, offset);
		const headerStyle = header ? header(column, pin, offset) : style;
		// Left is the default, so only the other sides get the attribute CSS aligns by.
		const align = column.align === 'left' ? undefined : column.align;

		return {
			key,
			cellProps: Object.freeze({
				key: column.name,
				'data-dg-column': column.name,
				'data-dg-pinned': pin,
				'data-dg-align': align,
				style,
			}),
			headerProps: Object.freeze({
				key: column.name,
				'data-dg-column': column.name,
				'data-dg-pinned': pin,
				'data-dg-align': align,
				style: headerStyle,
			}),
		};
	}

	/**
	 * The rendered columns. A column whose place, pin and styles hold stays the same object, and the
	 * list the same array, so a layout write that changes only widths, such as the end of a resize,
	 * renders no row.
	 */
	const frame = stableComputed<ColumnsFrame>(EMPTY_FRAME, (previous) => {
		const cache = new Map<string, ColumnCache>();
		const rowHeaders = resolveRowHeaders(visible.value);
		let reused = previous.columns.length === visible.value.length;

		const result = visible.value.map((column, index): RenderedColumn => {
			const pin = getPin(column.name);
			const entry = getColumnEntry(column, pin, getPinOffset(column.name), previous.cache.get(column.name));
			const next: RenderedColumn = {
				column: toRuntimeColumn(column),
				key: column.name,
				index,
				pin,
				rowHeader: rowHeaders.has(column.name),
				cellProps: entry.cellProps,
				headerProps: entry.headerProps,
			};
			const before = previous.columns[index];

			cache.set(column.name, entry);

			if (before && isSameRenderedColumn(before, next)) {
				return before;
			}

			reused = false;

			return next;
		});

		return reused ? previous : { cache, columns: result };
	});

	const columns = computed(() => frame.value.columns);

	const byName = computed(() => new Map(columns.value.map(column => [column.column?.name ?? '', column])));

	const declaredByName = computed(() => new Map(options.columns.value.map(column => [column.name, column])));

	// `manual` holds columns with a user-set width: only their grow is turned off.
	function resolveWidths(overrides: Readonly<Record<string, number>>): ResolvedWidths {
		const sizes = new Map<string, number>();
		const manual = new Set<string>();

		for (const column of options.columns.value) {
			const stored = column.resizable ? overrides[column.name] ?? resolved.value.widths[column.name] : undefined;

			if (stored !== undefined) {
				manual.add(column.name);
			}

			sizes.set(column.name, clampColumnWidth(column, stored ?? column.width));
		}

		return { sizes, manual };
	}

	const committed = computed(() => resolveWidths(NO_WIDTHS));

	// A resize draws over a preview: the edge under the pointer wins.
	const live = computed(() => (Object.keys(draft.value).length === 0 && Object.keys(preview.value).length === 0
		? committed.value
		: resolveWidths({ ...preview.value, ...draft.value })));

	function getWidth(name: string) {
		return live.value.sizes.get(name) ?? 0;
	}

	/** The columns with a set width, the same set while they hold: a frame of a resize wakes no reader of grow. */
	const manualColumns = stableComputed<ReadonlySet<string>>(NO_NAMES, (previous) => {
		const next = live.value.manual;

		return isSameSet(previous, next) ? previous : next;
	});

	const offsets = computed<readonly number[]>(() => {
		const result = [options.insets.value.start];

		for (const column of columns.value) {
			result.push(result[result.length - 1] + getWidth(column.column?.name ?? ''));
		}

		return result;
	});

	function buildColumnStyles({ sizes, manual }: ResolvedWidths) {
		const result = new Map<string, Record<string, string>>();
		const width = (name: string) => sizes.get(name) ?? 0;

		let startOffset = 0;
		let endOffset = 0;

		function put(name: string, variable: string, value: string) {
			const style = result.get(name);

			if (style) {
				style[variable] = value;
			} else {
				result.set(name, { [variable]: value });
			}
		}

		for (const rendered of columns.value) {
			const { column } = rendered;

			if (!column) {
				continue;
			}

			if (column.resizable) {
				put(column.name, getWidthVariable(column.name), `${width(column.name)}px`);

				if (column.flex > 0 && manual.has(column.name)) {
					put(column.name, getGrowVariable(column.name), '0');
				}
			}

			if (rendered.pin === 'start') {
				put(column.name, getPinVariable('start', column.name), `${startOffset}px`);
				startOffset += width(column.name);
			}
		}

		for (let index = columns.value.length - 1; index >= 0; index -= 1) {
			const rendered = columns.value[index];
			const name = rendered.column?.name;

			if (name && rendered.pin === 'end') {
				put(name, getPinVariable('end', name), `${endOffset}px`);
				endOffset += width(name);
			}
		}

		return result;
	}

	const committedStyles = computed(() => buildColumnStyles(committed.value));

	function getGrow(name: string) {
		const column = byName.value.get(name)?.column;

		return column && !manualColumns.value.has(name) ? column.flex : 0;
	}

	const liveStyles = computed(() => buildColumnStyles(live.value));

	const variables = computed(() => {
		const style: Record<string, string> = {
			[getInsetVariable('start')]: `${options.insets.value.start}px`,
			[getInsetVariable('end')]: `${options.insets.value.end}px`,
		};

		for (const columnStyle of committedStyles.value.values()) {
			Object.assign(style, columnStyle);
		}

		return style;
	});

	const overlay = computed<readonly GeometryLayer[]>(() => {
		if (live.value === committed.value) {
			return NO_LAYERS;
		}

		const layers: GeometryLayer[] = [];

		for (const [name, style] of liveStyles.value) {
			const before = committedStyles.value.get(name);
			const diff: Record<string, string> = {};
			let changed = false;

			for (const [variable, value] of Object.entries(style)) {
				if (before?.[variable] !== value) {
					diff[variable] = value;
					changed = true;
				}
			}

			if (changed) {
				layers.push({ selector: getColumnSelector(name), style: diff });
			}
		}

		return layers;
	});

	function totalWidth(sizes: ReadonlyMap<string, number>) {
		let total = 0;

		for (const rendered of columns.value) {
			total += rendered.column ? sizes.get(rendered.column.name) ?? 0 : 0;
		}

		return total;
	}

	const contentWidth = {
		committed: computed(() => totalWidth(committed.value.sizes)),
		live: computed(() => totalWidth(live.value.sizes)),
	};

	// Inside `batch`, actions build on the pending layout.
	function current() {
		return pending ?? resolved.value;
	}

	function patch(next: Partial<TableLayout>) {
		if (depth > 0) {
			pending = { ...current(), ...next };
		} else {
			options.layout.value = { ...resolved.value, ...next };
		}
	}

	function batch(run: () => void) {
		depth += 1;

		try {
			run();
		} finally {
			depth -= 1;

			if (depth === 0 && pending) {
				const next = pending;

				pending = null;
				options.layout.value = next;
			}
		}
	}

	function resize(name: string, width: number) {
		const column = declaredByName.value.get(name);

		if (column?.resizable) {
			draft.value = { ...draft.value, [name]: clampColumnWidth(column, width) };
		}
	}

	function commitResize() {
		if (Object.keys(draft.value).length === 0) {
			return;
		}

		patch({ widths: { ...current().widths, ...draft.value } });
		draft.value = {};
	}

	function previewWidths(next: Readonly<Record<string, number>> | null) {
		preview.value = next ? { ...next } : {};
	}

	function setWidths(next: Readonly<Record<string, number>>) {
		const clamped: Record<string, number> = {};

		for (const column of options.columns.value) {
			const width = next[column.name];

			if (column.resizable && width !== undefined) {
				clamped[column.name] = clampColumnWidth(column, width);
			}
		}

		if (Object.keys(clamped).length === 0) {
			return false;
		}

		if (Object.keys(draft.value).some(name => name in clamped)) {
			draft.value = Object.fromEntries(Object.entries(draft.value).filter(([name]) => !(name in clamped)));
		}

		patch({ widths: { ...current().widths, ...clamped } });

		return true;
	}

	function setGroupCollapsed(name: string, collapsed: boolean) {
		patch({ collapsed: { ...current().collapsed, [name]: collapsed } });
	}

	function toggleColumn(name: string) {
		if (!declaredByName.value.get(name)?.hideable) {
			return;
		}

		const next = new Set(current().hidden);

		if (!next.delete(name)) {
			next.add(name);
		}

		patch({ hidden: [...next] });
	}

	function pinColumn(name: string, side: ColumnPinSide | null) {
		if (!declaredByName.value.get(name)?.pinnable) {
			return;
		}

		const { [name]: _dropped, ...rest } = current().pinned;

		patch({ pinned: side ? { ...rest, [name]: side } : rest });
	}

	function currentColumns() {
		const layout = current();

		if (layout === resolved.value) {
			return { pins: pins.value, ordered: ordered.value, hidden: concealed.value, visible: visible.value };
		}

		const declared = options.columns.value;
		const layoutPins = resolvePins(declared, layout);
		const layoutOrdered = orderColumns(declared, layout, layoutPins);
		const layoutHidden = concealFrom(layout, new Set(layout.hidden));

		return {
			pins: layoutPins,
			ordered: layoutOrdered,
			hidden: layoutHidden,
			visible: filterVisible(layoutOrdered, layoutHidden),
		};
	}

	// `index` is among the shown columns, counted after this column is taken out of the row.
	function resolveMove(name: string, index: number) {
		const view = currentColumns();
		const side = view.pins.get(name);
		const shown = view.visible.filter(column => column.name !== name);
		const group = shown.filter(column => view.pins.get(column.name) === side);
		const start = group.length === 0 ? -1 : shown.indexOf(group[0]);

		if (start === -1 || index < start || index > start + group.length) {
			return null;
		}

		const anchor = shown[index];
		const last = group[group.length - 1];
		const before = anchor?.name ?? view.ordered[view.ordered.indexOf(last) + 1]?.name ?? null;
		const next = moveColumn(view.ordered, name, before);

		if (!next) {
			return null;
		}

		const after = filterVisible(next, view.hidden);
		const keepsGroups = options.keepsGroups?.(toNames(view.visible), toNames(after)) ?? true;

		return keepsFixedColumns(view.visible, after) && keepsGroups ? next : null;
	}

	function moveColumnTo(name: string, index: number) {
		const next = resolveMove(name, index);

		if (next) {
			patch({ order: next.map(column => column.name) });
		}
	}

	/**
	 * The index `moveColumnTo` takes for a move by `delta` places: allowed places only are counted, so a
	 * move steps over a `keepTogether` group as over one place. A move stays on the column's pinned side
	 * and stops at its edge. The farthest allowed place when there are fewer than `|delta|`; `null` when
	 * there is none.
	 */
	function resolveMoveBy(name: string, delta: number) {
		const view = currentColumns();
		const from = view.visible.findIndex(column => column.name === name);
		const direction = Math.sign(delta);
		let target: number | null = null;
		let left = Math.abs(delta);

		if (from === -1 || direction === 0 || !view.visible[from].movable) {
			return null;
		}

		// `resolveMove` allows no place off the column's pinned side: the scan checks that side alone, as
		// each check is linear in the columns.
		const side = view.pins.get(name);
		const shown = view.visible.filter(column => column.name !== name);
		const first = shown.findIndex(column => view.pins.get(column.name) === side);
		const last = first === -1 ? -1 : first + shown.filter(column => view.pins.get(column.name) === side).length;

		for (let index = from + direction; left > 0 && index >= first && index <= last; index += direction) {
			if (resolveMove(name, index)) {
				target = index;
				left -= 1;
			}
		}

		return target;
	}

	function moveColumnBy(name: string, delta: number) {
		const target = resolveMoveBy(name, delta);

		if (target !== null) {
			moveColumnTo(name, target);
		}

		return target !== null;
	}

	function moveColumnBefore(name: string, before: string | null) {
		const shown = currentColumns().visible.filter(column => column.name !== name);
		const index = before === null ? shown.length : shown.findIndex(column => column.name === before);

		if (index !== -1) {
			moveColumnTo(name, index);
		}
	}

	return {
		columns,
		orderedColumns: ordered,
		offsets,
		variables,
		overlay,
		contentWidth,
		hiddenColumns: concealed,
		getColumn: (name: string) => byName.value.get(name),
		getPin,
		getPinOffset,
		getGrow,
		isColumnHidden: (name: string) => hidden.value.has(name),
		getWidth,
		resize,
		commitResize,
		previewWidths,
		setWidths,
		setGroupCollapsed,
		currentLayout: current,
		toggleColumn,
		pinColumn,
		moveColumnTo,
		moveColumnBefore,
		canMoveColumnTo: (name: string, index: number) => resolveMove(name, index) !== null,
		moveColumnBy,
		canMoveColumnBy: (name: string, delta: number) => resolveMoveBy(name, delta) !== null,
		batch,
	};
}
