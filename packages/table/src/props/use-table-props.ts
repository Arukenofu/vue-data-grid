import {
	type ColumnSpanCell,
	getCellColumns,
	type GridCell,
	type GridSection,
	type RangeRect,
	type RenderedColumn,
	type RenderedGroup,
	type RowNode,
	type SelectionMode,
	type SortDirection,
	type TableScope,
} from '@vue-stack/table-core';
import { computed, type MaybeRefOrGetter, type Ref, toValue } from 'vue';

import { BODY_SECTION, getGridCellAttributes, getGridRowAttributes } from '../navigation/grid-attributes';

/** The role of the table element: a static `table`, a `grid` to move through, or a `treegrid`. */
export type TableRole = 'grid' | 'treegrid' | 'table';

/** What the props read of a row selection; `useRowSelection` fits as it is. */
export interface TableRowSelection {
	isSelected: (key: string) => boolean;
	/** Rows it refuses get no `aria-selected`. */
	isSelectable?: (key: string) => boolean;
	/** `'multiple'` makes the grid `aria-multiselectable`. */
	selectionMode?: Readonly<Ref<SelectionMode>>;
}

export interface TablePropsOptions {
	/** `'treegrid'` with `nodes`, `'grid'` otherwise. */
	role?: MaybeRefOrGetter<TableRole | undefined>;
	/**
	 * Cells take part in `useGridNavigation`: body and header cells get `tabindex="-1"`, and header cells
	 * leave the tab order. Without it header cells with keys (`sortable`, `movable`, `resizable`) get
	 * `tabindex="0"`. Read once.
	 */
	navigation?: boolean;
	/** Whether the markup renders the row of column headers; `true` by default. */
	header?: MaybeRefOrGetter<boolean>;
	/** Footer rows under the body; `0` by default. */
	footerRows?: MaybeRefOrGetter<number>;
	/**
	 * Body rows in the whole set, when not all are in `scope.rows`, such as while loading page by page;
	 * `-1` when unknown. `scope.rows.length` by default.
	 */
	rowCount?: MaybeRefOrGetter<number | undefined>;
	/** Whether the table is loading or updating: it gets `aria-busy` meanwhile. */
	busy?: MaybeRefOrGetter<boolean>;
	/** The node of each body row, `useRowTree().nodes`: level, place among siblings, expand state. */
	nodes?: MaybeRefOrGetter<readonly RowNode[] | undefined>;
	/** The row selection, `useRowSelection()`: rows get `aria-selected`. */
	selection?: TableRowSelection;
	/**
	 * Cells can be selected, such as with `useCellRanges`: the grid is `aria-multiselectable`, and
	 * `getCellProps` takes `selected` for `aria-selected` of a cell. `TableCells` writes it to the cells
	 * itself; markup of your own passes it, and a row that reads `isSelected` renders as its cells enter
	 * or leave a range.
	 */
	cellSelection?: boolean;
	/** The engine's `indexAttribute`: rows carry it for measuring. `data-tc-index` by default. Read once. */
	indexAttribute?: string;
	/**
	 * How body rows are laid out: `'positioned'`, the default, stacks them by the `start` of the row
	 * window, so the markup sets their `top`; `'flow'` leaves them in normal flow. Read once.
	 */
	rowLayout?: 'positioned' | 'flow';
}

type Props = Readonly<Record<string, unknown>>;

/** What cached props were built from: they are rebuilt once any of it changes. */
interface CellEntry {
	index: number;
	role: string;
	tabindex: number | undefined;
	sort?: SortDirection;
	/** The rows a header covers, `data-tc-rowspan`; only above `1`. */
	rowspan?: number;
	props: Props;
	/** `props` with `aria-selected`, made on first use: a cell of a range keeps the same object. */
	selected?: Props;
	unselected?: Props;
}

/** A body row, such as a `VirtualItem` of the row window. */
export interface TableRowRef {
	/** Position in `scope.rows`. */
	index: number;
	/** The row key. */
	key: string;
	/**
	 * The row's node in a tree, `nodes[index]`. With it the row's props read its own node, not the
	 * whole `nodes` list, so a row component renders again only when its node changes.
	 */
	node?: RowNode;
}

const ARIA_SORT: Readonly<Record<SortDirection, string>> = { asc: 'ascending', desc: 'descending' };

const SECTIONS = { head: 'head', body: BODY_SECTION, foot: 'foot' } as const;

/** The section of the navigation of the group row at `level` of the header, from the top. */
function getGroupSection(level: number) {
	return `group-${level}`;
}

const PRESENTATION = { role: 'presentation' } as const;

const ROW = { role: 'row', 'data-tc-part': 'row' } as const;

/** The attribute of a body row with its index in `rows`, as the engine measures rows by it. */
export const DEFAULT_INDEX_ATTRIBUTE = 'data-tc-index';

const INSETS = {
	start: Object.freeze({ role: 'presentation', 'data-tc-inset': 'start' }),
	end: Object.freeze({ role: 'presentation', 'data-tc-inset': 'end' }),
} as const;

// Hidden from screen readers: a range is announced by `aria-selected` of its cells, not by a drawing.
const RANGE = { 'data-tc-part': 'range', 'aria-hidden': 'true' } as const;

/** The sides a piece of a range continues past, `data-tc-continues`; `undefined` for none. */
function getContinues(cell: ColumnSpanCell) {
	const { start, end } = cell.continues;

	if (start && end) {
		return 'start end';
	}

	if (start) {
		return 'start';
	}

	return end ? 'end' : undefined;
}

function isSameEntry(entry: CellEntry | undefined, next: Omit<CellEntry, 'props'>): entry is CellEntry {
	return entry !== undefined
		&& entry.index === next.index
		&& entry.role === next.role
		&& entry.tabindex === next.tabindex
		&& entry.sort === next.sort
		&& entry.rowspan === next.rowspan;
}

function isSameSections(
	current: readonly GridSection[] | undefined,
	next: readonly GridSection[],
): current is readonly GridSection[] {
	return current !== undefined
		&& current.length === next.length
		&& current.every((section, index) => section.name === next[index].name
			&& section.rows === next[index].rows
			&& section.cells === next[index].cells);
}

/**
 * The markup contract of a table in the WAI-ARIA grid and treegrid patterns, as prop-getters: roles,
 * row and column positions, sort, tree and selection state, the attributes of the grid navigation and
 * of measuring, in one set per element. Rows are counted from the top of the header, group rows
 * included, so `aria-rowindex` and `aria-rowcount` agree; in a multi-sort only the first column gets
 * `aria-sort`, since ARIA has no sort levels.
 *
 * Cell props are one frozen object per column, shared by all rows, as the core's `cellProps` are:
 * spreading them costs a row nothing. Row props read the selection of their own key only.
 */
export function useTableProps(scope: TableScope, options: TablePropsOptions = {}) {
	const navigation = options.navigation ?? false;
	const indexAttribute = options.indexAttribute ?? DEFAULT_INDEX_ATTRIBUTE;
	const headProps = Object.freeze({ role: 'rowgroup', 'data-tc-part': 'head' });
	const bodyProps = Object.freeze({ role: 'rowgroup', 'data-tc-part': 'body', 'data-tc-row-layout': options.rowLayout ?? 'positioned' });
	const footProps = Object.freeze({ role: 'rowgroup', 'data-tc-part': 'foot' });
	const cells = new WeakMap<object, CellEntry>();
	const headers = new WeakMap<object, CellEntry>();
	const groups = new WeakMap<RenderedGroup, Props>();
	const spacers = new WeakMap<object, Props>();
	const rangeCells = new WeakMap<ColumnSpanCell, Props>();

	const role = computed<TableRole>(() => toValue(options.role) ?? (toValue(options.nodes) ? 'treegrid' : 'grid'));
	const hasHeader = computed(() => toValue(options.header) ?? true);
	const footerRows = computed(() => toValue(options.footerRows) ?? 0);
	const headerRows = computed(() => scope.headerGroups.value.length + (hasHeader.value ? 1 : 0));

	/**
	 * How many rows each column header covers where it is more than its own: the group rows right above
	 * it in which it has no group, from the bottom up, for the structural styles to span.
	 */
	const rowSpans = computed(() => {
		const levels = scope.headerGroups.value;
		const spans = new Map<string, number>();

		for (let level = levels.length - 1; level >= 0; level -= 1) {
			for (const cell of levels[level]) {
				if (cell.group !== null || cell.spacer) {
					continue;
				}

				for (const name of cell.columns) {
					const span = spans.get(name) ?? 1;

					// Only a run of empty cells from the header up: a group in between ends it.
					if (span === levels.length - level) {
						spans.set(name, span + 1);
					}
				}
			}
		}

		return spans;
	});
	const bodyRows = computed(() => toValue(options.rowCount) ?? scope.rows.value.length);
	const interactive = computed(() => role.value !== 'table');

	function getSpacerProps(props: Props) {
		let result = spacers.get(props);

		if (!result) {
			result = Object.freeze({ ...props, ...PRESENTATION });
			spacers.set(props, result);
		}

		return result;
	}

	/** Props of the table element: its role, row and column counts, multiple selection, busy state. */
	function getGridProps(): Props {
		const body = bodyRows.value;

		return {
			role: role.value,
			'data-tc-part': 'table',
			'aria-rowcount': body < 0 ? -1 : headerRows.value + body + footerRows.value,
			'aria-colcount': scope.columns.value.length,
			'aria-multiselectable': interactive.value && (options.selection || options.cellSelection)
				? options.cellSelection || (options.selection?.selectionMode?.value ?? 'multiple') === 'multiple'
				: undefined,
			'aria-busy': toValue(options.busy) ? 'true' : undefined,
		};
	}

	/** Props of the header block: every header row, stuck to the top of the table. */
	function getHeadProps(): Props {
		return headProps;
	}

	/** Props of the body block, which holds the body rows: positioned ones unless `rowLayout` is `'flow'`. */
	function getBodyProps(): Props {
		return bodyProps;
	}

	/** Props of the footer block, stuck to the bottom of the table. */
	function getFootProps(): Props {
		return footProps;
	}

	/** Props of a group row of the header, `level` counted from the top as in `scope.headerGroups`. */
	function getGroupRowProps(level: number): Props {
		return { ...ROW, 'aria-rowindex': level + 1, ...getGridRowAttributes(getGroupSection(level), 0) };
	}

	/** Props of the row of column headers: the `head` section of the navigation. */
	function getHeaderRowProps(): Props {
		return {
			...ROW,
			'aria-rowindex': scope.headerGroups.value.length + 1,
			...getGridRowAttributes(SECTIONS.head, 0),
		};
	}

	/**
	 * Props of a body row: `aria-rowindex` after the header rows, the index attribute for measuring and
	 * the `body` section of the navigation; in a tree its level, place among siblings and expand state,
	 * with a selection `aria-selected`.
	 */
	function getRowProps(row: TableRowRef): Props {
		const props: Record<string, unknown> = {
			...ROW,
			'aria-rowindex': headerRows.value + row.index + 1,
			[indexAttribute]: row.index,
			...getGridRowAttributes(SECTIONS.body, row.index),
		};
		const node = role.value === 'treegrid' ? row.node ?? toValue(options.nodes)?.[row.index] : undefined;
		const { selection } = options;

		if (node) {
			props['aria-level'] = node.level + 1;
			props['aria-posinset'] = node.position + 1;
			props['aria-setsize'] = node.setSize;

			// Only a row that can expand says whether it is: a leaf with `aria-expanded` reads as a group.
			if (node.group) {
				props['aria-expanded'] = node.expanded;
			}
		}

		if (selection && interactive.value && (selection.isSelectable?.(row.key) ?? true)) {
			props['aria-selected'] = selection.isSelected(row.key);
		}

		return props;
	}

	/** Props of a footer row, `index` counted from the first footer row: the `foot` section. */
	function getFooterRowProps(index = 0): Props {
		const body = bodyRows.value < 0 ? scope.rows.value.length : bodyRows.value;

		return {
			...ROW,
			'aria-rowindex': headerRows.value + body + index + 1,
			...getGridRowAttributes(SECTIONS.foot, index),
		};
	}

	/**
	 * Props of a cell in an inset of the row, `insets.start` or `insets.end` of the engine: decoration
	 * outside the columns, sized by `--tc-inset-start` or `--tc-inset-end`.
	 */
	function getInsetCellProps(side: 'start' | 'end'): Props {
		return INSETS[side];
	}

	/**
	 * Props of a range drawn over the body, a rectangle of `useCellRanges().rects`: a row across the
	 * table at the rows of the range, hidden from screen readers. Put it in the body after the rows and
	 * its `cells` in it, through `getRangeCellProps`.
	 */
	function getRangeProps(rect: RangeRect): Props {
		return { ...RANGE, style: `top:${rect.top}px;height:${rect.height}px` };
	}

	/**
	 * Props of a cell of a drawn range: its `props`, and for a cell in the range the `range-cell` part
	 * with the sides it continues past into another pin side, `data-tc-continues`. The same object for
	 * the same cell.
	 */
	function getRangeCellProps(cell: ColumnSpanCell): Props {
		let result = rangeCells.get(cell);

		if (!result) {
			result = cell.inside
				? Object.freeze({ ...cell.props, 'data-tc-part': 'range-cell', 'data-tc-continues': getContinues(cell) })
				: cell.props;
			rangeCells.set(cell, result);
		}

		return result;
	}

	/** Props of a group cell of the header: its `props`, the role, `aria-colindex` and `aria-colspan`. */
	function getGroupCellProps(cell: RenderedGroup): Props {
		if (cell.spacer) {
			return getSpacerProps(cell.props);
		}

		let result = groups.get(cell);

		if (!result) {
			result = Object.freeze({
				...cell.props,
				...getGridCellAttributes(cell.key),
				role: 'columnheader',
				'aria-colindex': cell.index + 1,
				'aria-colspan': cell.span,
				// An empty cell over columns without a group is passed over by the keys, so it takes no focus.
				tabindex: navigation && cell.group ? -1 : undefined,
			});
			groups.set(cell, result);
		}

		return result;
	}

	function getFirstSort(name: string) {
		const [first] = scope.sort.value;

		return first?.name === name ? first.direction : undefined;
	}

	function getHeaderTabIndex(column: NonNullable<RenderedColumn['column']>) {
		if (navigation) {
			return -1;
		}

		return column.sortable || column.movable || column.resizable ? 0 : undefined;
	}

	/**
	 * Props of a column header cell: `headerProps`, `role="columnheader"`, `aria-colindex`, `aria-sort`
	 * of the first sort column, `tabindex`, and `data-tc-rowspan` for a column without a group in the
	 * group rows right above it. A spacer of the column window gets `role="presentation"`.
	 */
	function getHeaderCellProps(rendered: RenderedColumn): Props {
		const { column } = rendered;

		if (!column) {
			return getSpacerProps(rendered.headerProps);
		}

		const next = {
			index: rendered.index,
			role: 'columnheader',
			tabindex: getHeaderTabIndex(column),
			sort: getFirstSort(column.name),
			rowspan: rowSpans.value.get(column.name),
		};
		const cached = headers.get(rendered.headerProps);

		if (isSameEntry(cached, next)) {
			return cached.props;
		}

		const props = Object.freeze({
			...rendered.headerProps,
			role: next.role,
			'aria-colindex': next.index + 1,
			'aria-sort': next.sort ? ARIA_SORT[next.sort] : undefined,
			tabindex: next.tabindex,
			'data-tc-rowspan': next.rowspan,
		});

		headers.set(rendered.headerProps, { ...next, props });

		return props;
	}

	function getCellRole(rendered: RenderedColumn) {
		if (rendered.rowHeader) {
			return 'rowheader';
		}

		return interactive.value ? 'gridcell' : 'cell';
	}

	/**
	 * Props of a body or footer cell: `cellProps`, the role (`rowheader` for a row header column),
	 * `aria-colindex`, and `tabindex="-1"` with `navigation`. One frozen object per column, and with
	 * `state.selected` one more for each answer, with `aria-selected`, for a cell selection. A spacer
	 * gets `role="presentation"`.
	 */
	function getCellProps(rendered: RenderedColumn, state?: { selected?: boolean }): Props {
		if (!rendered.column) {
			return getSpacerProps(rendered.cellProps);
		}

		const next = { index: rendered.index, role: getCellRole(rendered), tabindex: navigation ? -1 : undefined };
		let entry = cells.get(rendered.cellProps);

		if (!isSameEntry(entry, next)) {
			entry = {
				...next,
				props: Object.freeze({
					...rendered.cellProps,
					role: next.role,
					'aria-colindex': next.index + 1,
					tabindex: next.tabindex,
				}),
			};
			cells.set(rendered.cellProps, entry);
		}

		if (state?.selected === undefined || !interactive.value) {
			return entry.props;
		}

		if (state.selected) {
			entry.selected ??= Object.freeze({ ...entry.props, 'aria-selected': true });

			return entry.selected;
		}

		entry.unselected ??= Object.freeze({ ...entry.props, 'aria-selected': false });

		return entry.unselected;
	}

	/** The cells of the rows of column headers, the body and the footer: every shown column. */
	const columnCells = computed<readonly GridCell[]>((previous) => {
		const next = getCellColumns(scope.columns.value, () => true).map(column => ({ key: column.name }));
		const same = previous !== undefined
			&& previous.length === next.length
			&& previous.every((cell, index) => cell.key === next[index].key);

		return same ? previous : next;
	});

	/**
	 * The cells of each group row, over every shown column: a group cell, the empty cell of columns
	 * without a group, which the keys pass over, and a cell of its own for each column outside the
	 * column window. The same arrays while they hold.
	 */
	const groupCells = computed<readonly (readonly GridCell[])[]>((previous) => {
		const next = scope.headerGroups.value.map(level => resolveGroupCells(level, columnCells.value));
		const same = previous !== undefined
			&& previous.length === next.length
			&& previous.every((cells, level) => isSameCells(cells, next[level]));

		return same ? previous : next;
	});

	/**
	 * The sections of `useGridNavigation` these props put rows in: the group rows and the row of column
	 * headers, the body and the footer rows. The same array while they hold.
	 */
	const sections = computed<readonly GridSection[]>((previous) => {
		const shared = columnCells.value;
		const groupRows = hasHeader.value
			? groupCells.value.map((cells, level) => ({ name: getGroupSection(level), rows: 1, cells }))
			: [];
		const next: GridSection[] = [
			...groupRows,
			...(hasHeader.value ? [{ name: SECTIONS.head, rows: 1, cells: shared }] : []),
			{ name: SECTIONS.body, rows: scope.rows.value.length, cells: shared },
			...(footerRows.value > 0 ? [{ name: SECTIONS.foot, rows: footerRows.value, cells: shared }] : []),
		];

		return isSameSections(previous, next) ? previous : next;
	});

	return {
		getGridProps,
		getHeadProps,
		getBodyProps,
		getFootProps,
		getGroupRowProps,
		getHeaderRowProps,
		getRowProps,
		getFooterRowProps,
		getGroupCellProps,
		getHeaderCellProps,
		getCellProps,
		getInsetCellProps,
		getRangeProps,
		getRangeCellProps,
		sections,
		/** How many rows the header has: group rows and the row of column headers. */
		headerRows,
	};
}

/** The prop-getters of a table, as `useTableProps` returns them. */
export type TableProps = ReturnType<typeof useTableProps>;

function isSameCells(current: readonly GridCell[], next: readonly GridCell[]) {
	return current.length === next.length
		&& current.every((cell, index) => cell.key === next[index].key
			&& cell.span === next[index].span
			&& cell.skip === next[index].skip);
}

/** The cells of a group row for the navigation, from its rendered cells, over every shown column. */
function resolveGroupCells(level: readonly RenderedGroup[], columns: readonly GridCell[]): GridCell[] {
	const byColumn = new Map<string, RenderedGroup>();

	for (const cell of level) {
		for (const name of cell.columns) {
			byColumn.set(name, cell);
		}
	}

	const cells: GridCell[] = [];

	for (const column of columns) {
		const cell = byColumn.get(column.key);

		if (!cell) {
			cells.push({ key: column.key, skip: true });
		} else if (cell.columns[0] === column.key) {
			cells.push({ key: cell.key, span: cell.span, skip: cell.group === null ? true : undefined });
		}
	}

	return cells;
}
