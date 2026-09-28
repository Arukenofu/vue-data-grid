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
	type ColumnName,
	type EditingCell,
	type GeometryLayer,
	type GridColumnsState,
	type GridColumnsStateOptions,
	type GridEngineOptions,
	type GridScope,
	type GridSort,
	type RowNode,
	type RowSelection,
	type RowTree,
	type RuntimeColumn,
	useGridColumnsState,
	useGridEngine,
	useGridGeometry,
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

import type { GridClipboard } from '../clipboard/use-clipboard';
import type { CellContext, CellEditor, EditorContext, EditorMove } from '../columns/column-fields';
import type { CellNavigation } from '../navigation/use-cell-navigation';
import {
	DEFAULT_INDEX_ATTRIBUTE,
	type GridProps,
	type GridPropsOptions,
	type GridRowRef,
	useGridProps,
} from '../props/use-grid-props';
import type { GridFill } from '../ranges/use-grid-fill';
import { useStickyOffset } from '../render/use-sticky-offset';
import type { GridColumns, GridRowsFeature, RowsGrid, SelectionGrid } from './features';

/** What the grid and its parts read of the `tree` feature; `useGridTree` gives it. */
export type GridTreeFeature<TRow = unknown> = Pick<
	RowTree<TRow>,
	'rows' | 'nodes' | 'leaves' | 'hasGroups' | 'getChildren' | 'getNode' | 'isExpanded' | 'setExpanded' | 'toggle'
>;

/** What the grid and its parts read of the `selection` feature; `useGridSelection` gives it. */
export type GridSelectionFeature = Pick<
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

/** What the grid and other features read of the `navigation` feature; `useGridNavigation` gives it. */
export type GridNavigationFeature = Pick<CellNavigation, 'focused' | 'focusCell' | 'cells'>;

/** What the grid and other features read of the `ranges` feature; `useGridRanges` gives it. */
export type GridRangesFeature = CellRanges;

/**
 * What the grid, its parts and other features read of the `editing` feature; `useGridEditing` gives
 * it. Methods, not properties: their parameters stay bivariant, so the editing of any rows fits.
 */
export interface GridEditingFeature<TRow = unknown> {
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

/** What the grid reads of the `history` feature; `useGridHistory` gives it. */
export type GridHistoryFeature<TRow = unknown> = ChangeHistory<TRow>;

/** What the grid and its parts read of the `fill` feature; `useGridFill` gives it. */
export type GridFillFeature<TRow = unknown> = Pick<GridFill<TRow>, 'preview' | 'dragging' | 'start' | 'fill' | 'fillDown' | 'fillRight'>;

/** What the grid reads of the `clipboard` feature; `useClipboard` gives it. */
export type GridClipboardFeature = GridClipboard;

/**
 * The handles of a grid's features, by name. A grid object names the handles it has in its second
 * type parameter; a handle left out is typed as here, such as `GridSelectionFeature | undefined`.
 */
export interface DataGridHandles<TRow = unknown> {
	grouping?: GridRowsFeature<TRow>;
	sorting?: GridRowsFeature<TRow>;
	tree?: GridTreeFeature<TRow>;
	selection?: GridSelectionFeature;
	navigation?: GridNavigationFeature;
	ranges?: GridRangesFeature;
	editing?: GridEditingFeature<TRow>;
	history?: GridHistoryFeature<TRow>;
	fill?: GridFillFeature<TRow>;
	clipboard?: GridClipboardFeature;
}

/** The name of a feature of `useDataGrid`. */
export type DataGridFeatureName = keyof DataGridHandles;

/**
 * The grid as the features after the engine see it: its elements and scope, and the handles of the
 * features the grid has built before, in the order of `DataGridFeatures`.
 */
export interface FeatureGrid<TRow = unknown> {
	scope: GridScope<TRow>;
	/** The sections of the grid's rows, as `useGridProps` gives them. */
	sections: GridProps['sections'];
	root: Readonly<Ref<HTMLElement | null>>;
	head: Readonly<Ref<HTMLElement | null>>;
	body: Readonly<Ref<HTMLElement | null>>;
	foot: Readonly<Ref<HTMLElement | null>>;
	exit: Readonly<Ref<HTMLElement | null>>;
	headHeight: Readonly<Ref<number>>;
	footHeight: Readonly<Ref<number>>;
	tree?: GridTreeFeature<TRow>;
	selection?: GridSelectionFeature;
	navigation?: GridNavigationFeature;
	ranges?: GridRangesFeature;
	editing?: GridEditingFeature<TRow>;
	history?: GridHistoryFeature<TRow>;
	fill?: GridFillFeature<TRow>;
}

/**
 * The features of a grid, each a function of the grid that builds it, as the factories give them:
 * `sorting()`, `editing({ onCommit })`. The grid builds them in this order, each on what the ones
 * before give: `grouping`, `sorting` and `tree` change the rows, `selection` selects them, then the
 * engine renders them, and `navigation`, `ranges`, `editing`, `history`, `fill` and `clipboard` work
 * on the rendered grid. A feature is in the bundle only when a grid uses it; a function of your own
 * in place of a factory builds a feature your own way.
 */
export interface DataGridFeatures<TRow, TColumns extends GridColumns = GridColumns> {
	grouping?: (grid: RowsGrid<TRow, TColumns>) => GridRowsFeature<TRow>;
	sorting?: (grid: RowsGrid<TRow, TColumns>) => GridRowsFeature<TRow>;
	tree?: (grid: RowsGrid<TRow, TColumns>) => GridTreeFeature<TRow>;
	selection?: (grid: SelectionGrid<TRow, TColumns>) => GridSelectionFeature;
	// Each of these takes the part of `FeatureGrid` it needs, which `DataGridFeatureChecks` holds against
	// the grid it is built with: any function that gives the handle fits here.
	navigation?: (grid: never) => GridNavigationFeature;
	ranges?: (grid: never) => GridRangesFeature;
	editing?: (grid: never) => GridEditingFeature<TRow>;
	history?: (grid: never) => GridHistoryFeature<TRow>;
	fill?: (grid: never) => GridFillFeature<TRow>;
	clipboard?: (grid: never) => GridClipboardFeature;
}

/** The features the grid builds before each feature that works on the rendered grid. */
interface FeaturesBefore {
	navigation: 'tree' | 'selection';
	ranges: 'tree' | 'selection' | 'navigation';
	editing: 'tree' | 'selection' | 'navigation' | 'ranges';
	history: 'tree' | 'selection' | 'navigation' | 'ranges' | 'editing';
	fill: 'tree' | 'selection' | 'navigation' | 'ranges' | 'editing' | 'history';
	clipboard: 'tree' | 'selection' | 'navigation' | 'ranges' | 'editing' | 'history' | 'fill';
}

/** The handle a feature of `TFeatures` gives, else what the grid may have there. */
type FeatureHandle<TRow, TFeatures, TName extends DataGridFeatureName> = TName extends keyof TFeatures
	? TFeatures[TName] extends (grid: never) => infer THandle ? THandle : DataGridHandles<TRow>[TName]
	: DataGridHandles<TRow>[TName];

/** The grid a feature is built with: the handles of the features before it, as `TFeatures` gives them. */
type GivenFeatureGrid<TRow, TFeatures, TName extends keyof FeaturesBefore> =
	Omit<FeatureGrid<TRow>, DataGridFeatureName>
	& { [THandle in FeaturesBefore[TName]]: FeatureHandle<TRow, TFeatures, THandle> };

/**
 * Each feature checked against the grid it is built with: a feature that needs one the grid does
 * not have, such as `fill` without `ranges`, does not compile.
 */
export type DataGridFeatureChecks<TRow, TColumns extends GridColumns, TFeatures> = {
	[TName in keyof TFeatures]: TName extends keyof FeaturesBefore
		? (grid: GivenFeatureGrid<TRow, TFeatures, TName>) => unknown
		: TName extends keyof DataGridFeatures<TRow, TColumns> ? DataGridFeatures<TRow, TColumns>[TName] : never;
};

/** The handles of a grid with `TFeatures`: the one each feature gives, `undefined` for the rest. */
export type DataGridHandlesOf<TFeatures> = {
	[TName in DataGridFeatureName]: TName extends keyof TFeatures
		? TFeatures[TName] extends (grid: never) => infer THandle ? THandle : undefined
		: undefined;
};

/** The features built on the rendered grid, as the grid calls them: with the grid so far. */
type LateFeatures<TRow> = {
	[TName in keyof FeaturesBefore]?: (grid: FeatureGrid<TRow>) => NonNullable<DataGridHandles<TRow>[TName]>;
};

/** The options of the grid's own column state, with the names in `sort` checked against the columns. */
export interface DataGridStateOptions<TColumns extends GridColumns = GridColumns>
	extends Omit<GridColumnsStateOptions, 'columns' | 'sort'> {
	/**
	 * The initial sort, its names checked against `columns`, or a ref of it as a model, such as
	 * `v-model:sort`: the state writes to it and follows it. The ref may hold any names, as a model of
	 * `defineModel` does.
	 */
	sort?: readonly GridSort<ColumnName<TColumns>>[] | Ref<readonly GridSort[]>;
}

/** Where the column state comes from: a state of your own, or the options to create one. */
export type DataGridStateSource<TColumns extends GridColumns = GridColumns> =
	| ({ state: GridColumnsState } & { [TName in keyof DataGridStateOptions]?: never })
	| ({ state?: undefined } & DataGridStateOptions<TColumns>);

export interface DataGridBaseOptions<TRow, TColumns extends GridColumns, TFeatures>
	extends
	Omit<GridEngineOptions<TRow>, 'columns' | 'rows' | 'root' | 'state' | 'scrollMargin' | 'scrollMarginEnd'>,
	Pick<GridPropsOptions, 'role' | 'footerRows' | 'rowCount' | 'rowLayout'> {
	/** Columns from `defineColumns`, as an object by name or an array. */
	columns: MaybeRefOrGetter<TColumns>;
	/** The source rows; features group, sort and flatten them before the engine renders them. */
	rows: MaybeRefOrGetter<readonly TRow[]>;
	/** The features of the grid, from their factories, such as `{ sorting: sorting() }`. */
	features?: TFeatures & DataGridFeatureChecks<TRow, TColumns, TFeatures>;
}

/**
 * The options of `useDataGrid`: the columns, the rows, the engine's options, the features, and the
 * column state, either `state` of your own or the options that create one (`sort`, `layout`,
 * `multiSort`, `persist`, `remember`), not both.
 */
export type DataGridOptions<TRow, TColumns extends GridColumns = GridColumns, TFeatures = object> =
	DataGridBaseOptions<TRow, TColumns, TFeatures> & DataGridStateSource<TColumns>;

/**
 * The handle `THandles` gives a feature, else what any grid may have there. An indexed intersection
 * rather than a conditional type keeps the grid covariant in `THandles`: a grid with more features
 * fits where one with fewer is taken.
 */
export type DataGridHandle<TRow, THandles, TName extends DataGridFeatureName> = (THandles & DataGridHandles<TRow>)[TName];

/** A body row for `getRowProps`: a `VirtualItem` of `items`, or its index and key with rows in flow. */
export type DataGridRowRef = GridRowRef & Partial<Pick<VirtualItem, 'start' | 'size'>>;

type Props = Readonly<Record<string, unknown>>;

/**
 * The grid object of `useDataGrid`. `THandles` names the handles of its features, such as
 * `DataGrid<Row, { selection: GridSelection }>` for a grid with a selection; a component that takes
 * any grid takes `DataGrid<TRow>`, where every handle may be `undefined`. The object is itself a
 * `GridProps`, its body and rows placed by the row window: pass it where prop-getters are taken.
 */
export interface DataGrid<TRow = unknown, THandles extends object = DataGridHandles<TRow>>
	extends Omit<GridProps, 'getBodyProps' | 'getRowProps'> {
	/** Props of the body block; with positioned rows it is as tall as the row window. */
	getBodyProps: () => Props;
	/** Props of a body row; with positioned rows also its offset below the header and its height. */
	getRowProps: (row: DataGridRowRef) => Props;
	/** The attribute with the index in `rows` that `getRowProps` puts on every body row. */
	indexAttribute: string;
	/** The scroll container of the grid; bind it with `:ref`. */
	root: ShallowRef<HTMLElement | null>;
	/** The sticky header, measured for the engine's `scrollMargin`; bind it with `:ref`. */
	head: ShallowRef<HTMLElement | null>;
	/** The body block, for what works on the rows, such as dragging them or cell ranges; `GridBody` binds it. */
	body: ShallowRef<HTMLElement | null>;
	/** The sticky footer, measured for `scrollMarginEnd`; bind it with `:ref` when there is one. */
	foot: ShallowRef<HTMLElement | null>;
	/** The height of the sticky header, px; `0` without one. */
	headHeight: Readonly<Ref<number>>;
	/** The height of the sticky footer, px, such as for a bar that stands above it; `0` without one. */
	footHeight: Readonly<Ref<number>>;
	/**
	 * The element right after the grid that Tab leaves the grid through, for the navigation: an element
	 * with `tabindex="0"`; `GridRoot` renders it.
	 */
	exit: ShallowRef<HTMLElement | null>;
	scope: GridScope<TRow>;
	/** The column state: the one passed in, or the grid's own. */
	state: GridColumnsState;
	/** The rows the grid renders, after every feature: `scope.rows`. */
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
	 * Counts footer rows that a component renders, such as `GridFooter`, into `aria-rowcount`, on top of
	 * the `footerRows` option; returns the function that takes them back.
	 */
	addFooterRows: (count: number) => () => void;
	/**
	 * Counts body rows that stand for no row, such as the one of `GridEmpty`, into `aria-rowcount`;
	 * returns the function that takes them back. Ignored with the `rowCount` option.
	 */
	addBodyRows: (count: number) => () => void;
	/**
	 * Writes geometry layers of your own next to the engine's until the returned function is called:
	 * styles of exactly the elements a selector finds, such as the cells of a column moved during a
	 * drag. They reach the elements that mount while they are written too.
	 */
	addLayers: (layers: MaybeRefOrGetter<readonly GeometryLayer[]>) => () => void;
	/** Marks the grid busy, `aria-busy`, until the returned function is called, as `GridLoading` does. */
	markBusy: () => () => void;
	/** Whether something marked the grid busy. */
	isBusy: ComputedRef<boolean>;
	grouping: DataGridHandle<TRow, THandles, 'grouping'>;
	sorting: DataGridHandle<TRow, THandles, 'sorting'>;
	tree: DataGridHandle<TRow, THandles, 'tree'>;
	selection: DataGridHandle<TRow, THandles, 'selection'>;
	navigation: DataGridHandle<TRow, THandles, 'navigation'>;
	ranges: DataGridHandle<TRow, THandles, 'ranges'>;
	editing: DataGridHandle<TRow, THandles, 'editing'>;
	history: DataGridHandle<TRow, THandles, 'history'>;
	fill: DataGridHandle<TRow, THandles, 'fill'>;
	clipboard: DataGridHandle<TRow, THandles, 'clipboard'>;
}

function warnIgnoredStateOptions(options: DataGridStateSource) {
	const given = ['sort', 'layout', 'multiSort', 'persist', 'remember'].filter(name => name in options);

	if (options.state && given.length > 0) {
		// oxlint-disable-next-line no-console
		console.warn(
			`[@vue-data-grid/core] useDataGrid() got \`state\` and ${given.map(name => `\`${name}\``).join(', ')}: the `
			+ 'state options are ignored. Pass them to `useGridColumnsState` of the state instead.',
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
 * A grid in one call: the column state, the row pipeline of the features, the engine with its
 * geometry, the sticky offsets of the header and the footer, and the markup props. What it gives is
 * the grid object: a root component takes it, or your own markup binds it:
 *
 * - `root`, `head` and `foot` are refs for the scroll container and the sticky header and footer, which
 *   are measured for the scroll margins;
 * - the prop-getters of `useGridProps`, with the body sized to the row window and every body row
 *   placed at its offset;
 * - `scope`, `state`, `items` and the rest of the engine, and the handle of each feature, typed by the
 *   feature: `grid.editing` of a grid without the `editing` feature is `undefined`.
 *
 * Call it in `setup`. It does not provide the scope: `GridRoot` does, or `createDataGridContext`.
 */
export function useDataGrid<
	TRow,
	TColumns extends GridColumns = GridColumns,
	const TFeatures extends DataGridFeatures<TRow, TColumns> = object,
>(options: DataGridOptions<TRow, TColumns, TFeatures>): DataGrid<TRow, DataGridHandlesOf<TFeatures>> {
	const features: DataGridFeatures<TRow, TColumns> = options.features ?? {};

	if (__DEV__) {
		warnIgnoredStateOptions(options);
	}

	const state = options.state ?? useGridColumnsState({
		sort: options.sort,
		layout: options.layout,
		multiSort: options.multiSort,
		persist: options.persist,
		remember: options.remember,
	});
	const source = computed(() => toValue(options.rows));

	function rowsGrid(rows: Readonly<Ref<readonly TRow[]>>): RowsGrid<TRow, TColumns> {
		return { rows, rowKey: options.rowKey, columns: options.columns, state };
	}

	const grouping = features.grouping?.(rowsGrid(source));
	const grouped = grouping?.rows ?? source;
	const sorting = features.sorting?.(rowsGrid(grouped));
	const sorted = sorting?.rows ?? grouped;
	const tree = features.tree?.(rowsGrid(sorted));
	const shown = tree?.rows ?? sorted;
	const selection = features.selection?.({ ...rowsGrid(shown), tree });

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

	const engine = useGridEngine<TRow>({
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

	useGridGeometry(root, computed(() => (addedLayers.value.length === 0
		? engine.layers.value
		: [...engine.layers.value, ...addedLayers.value.flatMap(layers => toValue(layers))])));

	const { scope } = engine;
	const positioned = (options.rowLayout ?? 'positioned') === 'positioned';

	const props = useGridProps(scope, {
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
	 * Props of a body row: those of `useGridProps`, and with positioned rows its offset below the header
	 * and its height. `row` is a `VirtualItem` of `items`.
	 */
	function getRowProps(row: DataGridRowRef) {
		const rowProps = props.getRowProps(row);

		return positioned && row.start !== undefined && row.size !== undefined
			? { ...rowProps, style: { top: `${row.start - headHeight.value}px`, height: `${row.size}px` } }
			: rowProps;
	}

	const grid: DataGrid<TRow> = {
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
	// `DataGridHandlesOf` says, which TypeScript cannot follow through the calls above.
	return grid as DataGrid<TRow, DataGridHandlesOf<TFeatures>>;
}
