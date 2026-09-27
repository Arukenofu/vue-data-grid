import {
	type CellAddress,
	type CellCommit,
	type CellEditSource,
	type CellEditStart,
	type CellRanges,
	type CellTextWrite,
	type CellWrite,
	type CellWriteResult,
	type ChangeHistory,
	type EditingCell,
	type GeometryLayer,
	type RowNode,
	type RowSelection,
	type RowTree,
	type RuntimeColumn,
	type TableColumnsState,
	type TableColumnsStateOptions,
	type TableEngineOptions,
	type TableScope,
	useTableColumnsState,
	useTableEngine,
	useTableGeometry,
	type VirtualItem,
} from '@vue-data-grid/engine';
import {
	type ComponentPublicInstance,
	computed,
	type ComputedRef,
	type MaybeRefOrGetter,
	type Ref,
	type ShallowRef,
	shallowRef,
	toValue,
} from 'vue';

import type { TableClipboard } from '../clipboard/use-clipboard';
import type { CellContext, CellEditor, EditorContext, EditorMove } from '../columns/column-fields';
import type { GridNavigation } from '../navigation/use-grid-navigation';
import {
	DEFAULT_INDEX_ATTRIBUTE,
	type TableProps,
	type TablePropsOptions,
	type TableRowRef,
	useTableProps,
} from '../props/use-table-props';
import type { TableFill } from '../ranges/use-table-fill';
import { useStickyOffset } from '../render/use-sticky-offset';
import type { RowsTable, SelectionTable, TableColumns, TableRowsFeature } from './features';

/** What the table and its parts read of the `tree` feature; `useTableTree` gives it. */
export type TableTreeFeature<TRow = unknown> = Pick<
	RowTree<TRow>,
	'rows' | 'nodes' | 'leaves' | 'hasGroups' | 'getChildren' | 'getNode' | 'isExpanded' | 'setExpanded' | 'toggle'
>;

/** What the table and its parts read of the `selection` feature; `useTableSelection` gives it. */
export type TableSelectionFeature = Pick<
	RowSelection,
	| 'selectionMode'
	| 'selectedCount'
	| 'isSelected'
	| 'isPartlySelected'
	| 'isSelectable'
	| 'isAllSelected'
	| 'isSomeSelected'
	| 'toggle'
	| 'extend'
	| 'toggleAll'
	| 'setAll'
>;

/** What the table and other features read of the `navigation` feature; `useTableNavigation` gives it. */
export type TableNavigationFeature = Pick<GridNavigation, 'focused' | 'focusCell' | 'cells'>;

/** What the table and other features read of the `ranges` feature; `useTableRanges` gives it. */
export type TableRangesFeature = CellRanges;

/**
 * What the table, its parts and other features read of the `editing` feature; `useTableEditing` gives
 * it. Methods, not properties: their parameters stay bivariant, so the editing of any rows fits.
 */
export interface TableEditingFeature<TRow = unknown> {
	cell: Readonly<Ref<EditingCell<TRow> | null>>;
	lastCommit: Readonly<Ref<CellCommit<TRow> | null>>;
	isEditing(cell: CellAddress): boolean;
	getEditingColumn(key: string): string | undefined;
	canEdit(cell: CellAddress): boolean;
	getEditor(column: RuntimeColumn): CellEditor | null;
	getEditorContext(cell: CellContext<TRow, unknown>): EditorContext<TRow, unknown> | null;
	start(cell: CellAddress, init?: CellEditStart): boolean;
	commit(move?: EditorMove): boolean;
	cancel(): void;
	write(writes: readonly CellWrite[], source: CellEditSource): CellWriteResult<TRow>;
	writeText(cells: readonly CellTextWrite[], source: CellEditSource): CellWriteResult<TRow>;
	hasSelection(): boolean;
	paste(text: string): CellWriteResult<TRow> | null;
	clear(source?: CellEditSource): CellWriteResult<TRow>;
}

/** What the table reads of the `history` feature; `useTableHistory` gives it. */
export type TableHistoryFeature<TRow = unknown> = ChangeHistory<TRow>;

/** What the table and its parts read of the `fill` feature; `useTableFill` gives it. */
export type TableFillFeature<TRow = unknown> = Pick<TableFill<TRow>, 'preview' | 'dragging' | 'start' | 'fill' | 'fillDown' | 'fillRight'>;

/** What the table reads of the `clipboard` feature; `useClipboard` gives it. */
export type TableClipboardFeature = TableClipboard;

/**
 * The handles of a table's features, by name. A table object names the handles it has in its second
 * type parameter; a handle left out is typed as here, such as `TableSelectionFeature | undefined`.
 */
export interface DataTableHandles<TRow = unknown> {
	grouping?: TableRowsFeature<TRow>;
	sorting?: TableRowsFeature<TRow>;
	tree?: TableTreeFeature<TRow>;
	selection?: TableSelectionFeature;
	navigation?: TableNavigationFeature;
	ranges?: TableRangesFeature;
	editing?: TableEditingFeature<TRow>;
	history?: TableHistoryFeature<TRow>;
	fill?: TableFillFeature<TRow>;
	clipboard?: TableClipboardFeature;
}

/** The name of a feature of `useDataTable`. */
export type DataTableFeatureName = keyof DataTableHandles;

/**
 * The table as the features after the engine see it: its elements and scope, and the handles of the
 * features the table has built before, in the order of `DataTableFeatures`.
 */
export interface FeatureTable<TRow = unknown> {
	scope: TableScope<TRow>;
	/** The sections of the table's rows, as `useTableProps` gives them. */
	sections: TableProps['sections'];
	root: Readonly<Ref<HTMLElement | null>>;
	head: Readonly<Ref<HTMLElement | null>>;
	body: Readonly<Ref<HTMLElement | null>>;
	foot: Readonly<Ref<HTMLElement | null>>;
	exit: Readonly<Ref<HTMLElement | null>>;
	headHeight: Readonly<Ref<number>>;
	footHeight: Readonly<Ref<number>>;
	tree?: TableTreeFeature<TRow>;
	selection?: TableSelectionFeature;
	navigation?: TableNavigationFeature;
	ranges?: TableRangesFeature;
	editing?: TableEditingFeature<TRow>;
	history?: TableHistoryFeature<TRow>;
	fill?: TableFillFeature<TRow>;
}

/**
 * The features of a table, each a function of the table that builds it, as the factories give them:
 * `sorting()`, `editing({ onCommit })`. The table builds them in this order, each on what the ones
 * before give: `grouping`, `sorting` and `tree` change the rows, `selection` selects them, then the
 * engine renders them, and `navigation`, `ranges`, `editing`, `history`, `fill` and `clipboard` work
 * on the rendered table. A feature is in the bundle only when a table uses it; a function of your own
 * in place of a factory builds a feature your own way.
 */
export interface DataTableFeatures<TRow, TColumns extends TableColumns = TableColumns> {
	grouping?: (table: RowsTable<TRow, TColumns>) => TableRowsFeature<TRow>;
	sorting?: (table: RowsTable<TRow, TColumns>) => TableRowsFeature<TRow>;
	tree?: (table: RowsTable<TRow, TColumns>) => TableTreeFeature<TRow>;
	selection?: (table: SelectionTable<TRow, TColumns>) => TableSelectionFeature;
	// Each of these takes the part of `FeatureTable` it needs, which `DataTableFeatureChecks` holds against
	// the table it is built with: any function that gives the handle fits here.
	navigation?: (table: never) => TableNavigationFeature;
	ranges?: (table: never) => TableRangesFeature;
	editing?: (table: never) => TableEditingFeature<TRow>;
	history?: (table: never) => TableHistoryFeature<TRow>;
	fill?: (table: never) => TableFillFeature<TRow>;
	clipboard?: (table: never) => TableClipboardFeature;
}

/** The features the table builds before each feature that works on the rendered table. */
interface FeaturesBefore {
	navigation: 'tree' | 'selection';
	ranges: 'tree' | 'selection' | 'navigation';
	editing: 'tree' | 'selection' | 'navigation' | 'ranges';
	history: 'tree' | 'selection' | 'navigation' | 'ranges' | 'editing';
	fill: 'tree' | 'selection' | 'navigation' | 'ranges' | 'editing' | 'history';
	clipboard: 'tree' | 'selection' | 'navigation' | 'ranges' | 'editing' | 'history' | 'fill';
}

/** The handle a feature of `TFeatures` gives, else what the table may have there. */
type FeatureHandle<TRow, TFeatures, TName extends DataTableFeatureName> = TName extends keyof TFeatures
	? TFeatures[TName] extends (table: never) => infer THandle ? THandle : DataTableHandles<TRow>[TName]
	: DataTableHandles<TRow>[TName];

/** The table a feature is built with: the handles of the features before it, as `TFeatures` gives them. */
type GivenFeatureTable<TRow, TFeatures, TName extends keyof FeaturesBefore> =
	Omit<FeatureTable<TRow>, DataTableFeatureName>
	& { [THandle in FeaturesBefore[TName]]: FeatureHandle<TRow, TFeatures, THandle> };

/**
 * Each feature checked against the table it is built with: a feature that needs one the table does
 * not have, such as `fill` without `ranges`, does not compile.
 */
export type DataTableFeatureChecks<TRow, TColumns extends TableColumns, TFeatures> = {
	[TName in keyof TFeatures]: TName extends keyof FeaturesBefore
		? (table: GivenFeatureTable<TRow, TFeatures, TName>) => unknown
		: TName extends keyof DataTableFeatures<TRow, TColumns> ? DataTableFeatures<TRow, TColumns>[TName] : never;
};

/** The handles of a table with `TFeatures`: the one each feature gives, `undefined` for the rest. */
export type DataTableHandlesOf<TFeatures> = {
	[TName in DataTableFeatureName]: TName extends keyof TFeatures
		? TFeatures[TName] extends (table: never) => infer THandle ? THandle : undefined
		: undefined;
};

/** The features built on the rendered table, as the table calls them: with the table so far. */
type LateFeatures<TRow> = {
	[TName in keyof FeaturesBefore]?: (table: FeatureTable<TRow>) => NonNullable<DataTableHandles<TRow>[TName]>;
};

/** Where the column state comes from: a state of your own, or the options to create one. */
export type DataTableStateSource =
	| ({ state: TableColumnsState } & { [TName in keyof Omit<TableColumnsStateOptions, 'columns'>]?: never })
	| ({ state?: undefined } & Omit<TableColumnsStateOptions, 'columns'>);

export interface DataTableBaseOptions<TRow, TColumns extends TableColumns, TFeatures>
	extends
	Omit<TableEngineOptions<TRow>, 'columns' | 'rows' | 'root' | 'state' | 'scrollMargin' | 'scrollMarginEnd'>,
	Pick<TablePropsOptions, 'role' | 'footerRows' | 'rowCount' | 'rowLayout'> {
	/** Columns from `defineColumns`, as an object by name or an array. */
	columns: MaybeRefOrGetter<TColumns>;
	/** The source rows; features group, sort and flatten them before the engine renders them. */
	rows: MaybeRefOrGetter<readonly TRow[]>;
	/** The features of the table, from their factories, such as `{ sorting: sorting() }`. */
	features?: TFeatures & DataTableFeatureChecks<TRow, TColumns, TFeatures>;
}

/**
 * The options of `useDataTable`: the columns, the rows, the engine's options, the features, and the
 * column state, either `state` of your own or the options that create one (`sort`, `layout`,
 * `multiSort`, `persist`, `remember`), not both.
 */
export type DataTableOptions<TRow, TColumns extends TableColumns = TableColumns, TFeatures = object> =
	DataTableBaseOptions<TRow, TColumns, TFeatures> & DataTableStateSource;

/**
 * The handle `THandles` gives a feature, else what any table may have there. An indexed intersection
 * rather than a conditional type keeps the table covariant in `THandles`: a table with more features
 * fits where one with fewer is taken.
 */
export type DataTableHandle<TRow, THandles, TName extends DataTableFeatureName> = (THandles & DataTableHandles<TRow>)[TName];

/** A body row for `getRowProps`: a `VirtualItem` of `items`, or its index and key with rows in flow. */
export type DataTableRowRef = TableRowRef & Partial<Pick<VirtualItem, 'start' | 'size'>>;

type Props = Readonly<Record<string, unknown>>;

/**
 * The table object of `useDataTable`. `THandles` names the handles of its features, such as
 * `DataTable<Row, { selection: TableSelection }>` for a table with a selection; a component that takes
 * any table takes `DataTable<TRow>`, where every handle may be `undefined`. The object is itself a
 * `TableProps`, its body and rows placed by the row window: pass it where prop-getters are taken.
 */
export interface DataTable<TRow = unknown, THandles extends object = DataTableHandles<TRow>>
	extends Omit<TableProps, 'getBodyProps' | 'getRowProps'> {
	/** Props of the body block; with positioned rows it is as tall as the row window. */
	getBodyProps: () => Props;
	/** Props of a body row; with positioned rows also its offset below the header and its height. */
	getRowProps: (row: DataTableRowRef) => Props;
	/** The attribute with the index in `rows` that `getRowProps` puts on every body row. */
	indexAttribute: string;
	/** The scroll container of the table; bind it with `:ref`. */
	root: ShallowRef<HTMLElement | null>;
	/** The sticky header, measured for the engine's `scrollMargin`; bind it with `:ref`. */
	head: ShallowRef<HTMLElement | null>;
	/** The body block, for what works on the rows, such as dragging them or cell ranges; `TableBody` binds it. */
	body: ShallowRef<HTMLElement | null>;
	/** The sticky footer, measured for `scrollMarginEnd`; bind it with `:ref` when there is one. */
	foot: ShallowRef<HTMLElement | null>;
	/** The height of the sticky header, px; `0` without one. */
	headHeight: Readonly<Ref<number>>;
	/** The height of the sticky footer, px, such as for a bar that stands above it; `0` without one. */
	footHeight: Readonly<Ref<number>>;
	/**
	 * The element right after the table that Tab leaves the grid through, for the navigation: an element
	 * with `tabindex="0"`; `TableRoot` renders it.
	 */
	exit: ShallowRef<HTMLElement | null>;
	scope: TableScope<TRow>;
	/** The column state: the one passed in, or the table's own. */
	state: TableColumnsState;
	/** The rows the table renders, after every feature: `scope.rows`. */
	rows: ComputedRef<readonly TRow[]>;
	/** The rows footers aggregate: the leaves of the tree, collapsed ones included, or `rows`. */
	leaves: ComputedRef<readonly TRow[]>;
	/** The tree node of the shown row at `index`; `undefined` without a tree. */
	getNodeAt: (index: number) => RowNode | undefined;
	/** The row window: what to render. */
	items: ComputedRef<readonly VirtualItem[]>;
	/** The height of all body rows, px. */
	totalSize: ComputedRef<number>;
	/** Measures a body row, with `measureRows`: bind it to the row with `:ref`. */
	measureElement: (element: Element | ComponentPublicInstance | null) => void;
	/** Whether the column window leaves columns out. */
	windowed: ComputedRef<boolean>;
	/**
	 * Counts footer rows that a component renders, such as `TableFooter`, into `aria-rowcount`, on top of
	 * the `footerRows` option; returns the function that takes them back.
	 */
	addFooterRows: (count: number) => () => void;
	/**
	 * Counts body rows that stand for no row, such as the one of `TableEmpty`, into `aria-rowcount`;
	 * returns the function that takes them back. Ignored with the `rowCount` option.
	 */
	addBodyRows: (count: number) => () => void;
	/**
	 * Writes geometry layers of your own next to the engine's until the returned function is called:
	 * styles of exactly the elements a selector finds, such as the cells of a column moved during a
	 * drag. They reach the elements that mount while they are written too.
	 */
	addLayers: (layers: MaybeRefOrGetter<readonly GeometryLayer[]>) => () => void;
	/** Marks the table busy, `aria-busy`, until the returned function is called, as `TableLoading` does. */
	markBusy: () => () => void;
	/** Whether something marked the table busy. */
	isBusy: ComputedRef<boolean>;
	grouping: DataTableHandle<TRow, THandles, 'grouping'>;
	sorting: DataTableHandle<TRow, THandles, 'sorting'>;
	tree: DataTableHandle<TRow, THandles, 'tree'>;
	selection: DataTableHandle<TRow, THandles, 'selection'>;
	navigation: DataTableHandle<TRow, THandles, 'navigation'>;
	ranges: DataTableHandle<TRow, THandles, 'ranges'>;
	editing: DataTableHandle<TRow, THandles, 'editing'>;
	history: DataTableHandle<TRow, THandles, 'history'>;
	fill: DataTableHandle<TRow, THandles, 'fill'>;
	clipboard: DataTableHandle<TRow, THandles, 'clipboard'>;
}

function warnIgnoredStateOptions(options: DataTableStateSource) {
	const given = ['sort', 'layout', 'multiSort', 'persist', 'remember'].filter(name => name in options);

	if (options.state && given.length > 0) {
		// oxlint-disable-next-line no-console
		console.warn(
			`[@vue-data-grid/core] useDataTable() got \`state\` and ${given.map(name => `\`${name}\``).join(', ')}: the `
			+ 'state options are ignored. Pass them to `useTableColumnsState` of the state instead.',
		);
	}
}

/** Adds `count` to a counter until the returned function is called, once. */
function hold(counter: Ref<number>, count: number) {
	let held = true;

	counter.value += count;

	return () => {
		if (held) {
			held = false;
			counter.value -= count;
		}
	};
}

/**
 * A table in one call: the column state, the row pipeline of the features, the engine with its
 * geometry, the sticky offsets of the header and the footer, and the markup props. What it gives is
 * the table object: a root component takes it, or your own markup binds it:
 *
 * - `root`, `head` and `foot` are refs for the scroll container and the sticky header and footer, which
 *   are measured for the scroll margins;
 * - the prop-getters of `useTableProps`, with the body sized to the row window and every body row
 *   placed at its offset;
 * - `scope`, `state`, `items` and the rest of the engine, and the handle of each feature, typed by the
 *   feature: `table.editing` of a table without the `editing` feature is `undefined`.
 *
 * Call it in `setup`. It does not provide the scope: `TableRoot` does, or `createDataTableContext`.
 */
export function useDataTable<
	TRow,
	TColumns extends TableColumns = TableColumns,
	const TFeatures extends DataTableFeatures<TRow, TColumns> = object,
>(options: DataTableOptions<TRow, TColumns, TFeatures>): DataTable<TRow, DataTableHandlesOf<TFeatures>> {
	const features: DataTableFeatures<TRow, TColumns> = options.features ?? {};

	if (__DEV__) {
		warnIgnoredStateOptions(options);
	}

	const state = options.state ?? useTableColumnsState({
		sort: options.sort,
		layout: options.layout,
		multiSort: options.multiSort,
		persist: options.persist,
		remember: options.remember,
	});
	const source = computed(() => toValue(options.rows));

	function rowsTable(rows: Readonly<Ref<readonly TRow[]>>): RowsTable<TRow, TColumns> {
		return { rows, rowKey: options.rowKey, columns: options.columns, state };
	}

	const grouping = features.grouping?.(rowsTable(source));
	const grouped = grouping?.rows ?? source;
	const sorting = features.sorting?.(rowsTable(grouped));
	const sorted = sorting?.rows ?? grouped;
	const tree = features.tree?.(rowsTable(sorted));
	const shown = tree?.rows ?? sorted;
	const selection = features.selection?.({ ...rowsTable(shown), tree });

	const root = shallowRef<HTMLElement | null>(null);
	const head = shallowRef<HTMLElement | null>(null);
	const body = shallowRef<HTMLElement | null>(null);
	const foot = shallowRef<HTMLElement | null>(null);
	const exit = shallowRef<HTMLElement | null>(null);
	const addedFooterRows = shallowRef(0);
	const addedBodyRows = shallowRef(0);
	const busy = shallowRef(0);
	const headHeight = useStickyOffset(head);
	const footHeight = useStickyOffset(foot);

	const engine = useTableEngine<TRow>({
		columns: options.columns,
		groups: options.groups,
		rows: shown,
		root,
		rowKey: options.rowKey,
		state,
		insets: options.insets,
		cellStyles: options.cellStyles,
		virtual: options.virtual,
		rowHeight: options.rowHeight,
		measureRows: options.measureRows,
		indexAttribute: options.indexAttribute,
		scrollMargin: headHeight,
		scrollMarginEnd: footHeight,
		keepRows: options.keepRows,
		keepColumns: options.keepColumns,
	});

	const addedLayers = shallowRef<readonly MaybeRefOrGetter<readonly GeometryLayer[]>[]>([]);

	useTableGeometry(root, computed(() => (addedLayers.value.length === 0
		? engine.layers.value
		: [...engine.layers.value, ...addedLayers.value.flatMap(layers => toValue(layers))])));

	const { scope } = engine;
	const positioned = (options.rowLayout ?? 'positioned') === 'positioned';

	const props = useTableProps(scope, {
		role: options.role,
		navigation: features.navigation !== undefined,
		footerRows: () => (toValue(options.footerRows) ?? 0) + addedFooterRows.value,
		rowCount: () => toValue(options.rowCount) ?? engine.scope.rows.value.length + addedBodyRows.value,
		busy: () => busy.value > 0,
		rowLayout: options.rowLayout,
		nodes: tree ? () => tree.nodes.value : undefined,
		selection,
		cellSelection: features.ranges !== undefined,
		indexAttribute: options.indexAttribute,
	});

	const elements = { scope, sections: props.sections, root, head, body, foot, exit, headHeight, footHeight };
	const late = features as LateFeatures<TRow>;
	const navigation = late.navigation?.({ ...elements, tree, selection });
	const ranges = late.ranges?.({ ...elements, tree, selection, navigation });
	const editing = late.editing?.({ ...elements, tree, selection, navigation, ranges });
	const history = late.history?.({ ...elements, tree, selection, navigation, ranges, editing });
	const fill = late.fill?.({ ...elements, tree, selection, navigation, ranges, editing, history });
	const clipboard = late.clipboard?.({ ...elements, tree, selection, navigation, ranges, editing, history, fill });
	const leaves = computed(() => tree?.leaves.value ?? scope.rows.value);

	/** Props of the body block, as tall as the row window with positioned rows. */
	function getBodyProps() {
		return positioned
			? { ...props.getBodyProps(), style: { height: `${engine.totalSize.value}px` } }
			: props.getBodyProps();
	}

	/**
	 * Props of a body row: those of `useTableProps`, and with positioned rows its offset below the header
	 * and its height. `row` is a `VirtualItem` of `items`.
	 */
	function getRowProps(row: DataTableRowRef) {
		const rowProps = props.getRowProps(row);

		return positioned && row.start !== undefined && row.size !== undefined
			? { ...rowProps, style: { top: `${row.start - headHeight.value}px`, height: `${row.size}px` } }
			: rowProps;
	}

	const table: DataTable<TRow> = {
		...props,
		getBodyProps,
		getRowProps,
		indexAttribute: options.indexAttribute ?? DEFAULT_INDEX_ATTRIBUTE,
		addFooterRows: count => hold(addedFooterRows, count),
		addBodyRows: count => hold(addedBodyRows, count),
		addLayers: (layers) => {
			addedLayers.value = [...addedLayers.value, layers];

			return () => {
				addedLayers.value = addedLayers.value.filter(item => item !== layers);
			};
		},
		markBusy: () => hold(busy, 1),
		isBusy: computed(() => busy.value > 0),
		root,
		head,
		body,
		foot,
		headHeight,
		footHeight,
		exit,
		scope,
		state,
		rows: scope.rows,
		leaves,
		getNodeAt: index => tree?.nodes.value[index],
		items: engine.items,
		totalSize: engine.totalSize,
		measureElement: engine.measureElement,
		windowed: engine.windowed,
		grouping,
		sorting,
		tree,
		selection,
		navigation,
		ranges,
		editing,
		history,
		fill,
		clipboard,
	};

	// Each handle is what its feature of `TFeatures` returned, and the rest are `undefined`: what
	// `DataTableHandlesOf` says, which TypeScript cannot follow through the calls above.
	return table as DataTable<TRow, DataTableHandlesOf<TFeatures>>;
}
