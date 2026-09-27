import type { SortDirection } from './sort';

export type ColumnAlign = 'left' | 'center' | 'right';

export type ColumnPinSide = 'start' | 'end';

export type AggregateName = 'sum' | 'avg' | 'min' | 'max' | 'count';

/**
 * What a column holds: `'data'` is a value of the row; `'service'` is the table's own furniture, such
 * as a checkbox, a row number or actions. CSV, cell ranges, cell changes and autosize skip service
 * columns unless told otherwise.
 */
export type ColumnKind = 'data' | 'service';

/** A column's `aggregate`: a built-in by name, or a reduction of the values and the rows. */
export type ColumnAggregate<TRow, TValue> =
	| AggregateName
	| ((values: readonly TValue[], rows: readonly TRow[]) => unknown);

/**
 * What an `aggregate` gives: `number | null` for `sum` and `avg`, the value or `null` for `min` and
 * `max`, a number for `count`, the return type of a function, and `undefined` without one.
 */
export type AggregateResult<TValue, TAggregate> = TAggregate extends 'sum' | 'avg'
	? number | null
	: TAggregate extends 'min' | 'max'
		? TValue | null
		: TAggregate extends 'count'
			? number
			: TAggregate extends (...args: never[]) => infer TResult
				? TResult
				: undefined;

/**
 * What a column's `aggregate` gives, read from its `value` and `aggregate` types as `AggregateResult`
 * does; `never` for a column without `aggregate`.
 */
export type ColumnAggregateResult<TColumn> = TColumn extends {
	value: (row: never) => infer TValue;
	aggregate?: infer TAggregate;
}
	// `unknown` when the type has no `aggregate` at all, `never` once `undefined` is taken out of none.
	? unknown extends TAggregate
		? never
		: [NonNullable<TAggregate>] extends [never] ? never : AggregateResult<TValue, NonNullable<TAggregate>>
	: never;

/**
 * Aggregates of columns by name, each typed by its column's `aggregate`: what a group row is built
 * from. Columns without `aggregate` are left out. Columns given as an array have no names to type
 * by, and give a record of `unknown`.
 */
export type ColumnAggregates<TColumns> = TColumns extends readonly unknown[]
	? Readonly<Record<string, unknown>>
	: {
		readonly [TName in keyof TColumns as [ColumnAggregateResult<TColumns[TName]>] extends [never]
			? never
			: TName]: ColumnAggregateResult<TColumns[TName]>;
	};

/** The column fields geometry depends on: width, its limits and alignment. */
export interface ColumnGeometry {
	name: string;
	width: number;
	minWidth: number;
	maxWidth?: number;
	flex: number;
	align: ColumnAlign;
	resizable: boolean;
}

/** The column fields layout depends on: default visibility and pinning. */
export interface ColumnLayout {
	name: string;
	hiddenByDefault: boolean;
	pinned?: ColumnPinSide;
	pinnable: boolean;
}

/** The column fields reordering depends on. */
export interface ColumnOrder {
	name: string;
	movable: boolean;
}

export function clampColumnWidth(column: Pick<ColumnGeometry, 'minWidth' | 'maxWidth'>, width: number) {
	return Math.min(column.maxWidth ?? Number.POSITIVE_INFINITY, Math.max(column.minWidth, Math.round(width)));
}

export interface ColumnRights {
	sortable?: boolean;
	resizable?: boolean;
	movable?: boolean;
	hideable?: boolean;
	pinnable?: boolean;
}

/**
 * Fields a layer on top of the core adds to every column, such as how its cells render. The core
 * declares none. A layer declares its own by augmenting this interface; they then type-check in
 * `defineColumn` and `defineColumns` and reach `RenderedColumn.column` typed:
 *
 * ```ts
 * declare module '@vue-stack/table-core' {
 * 	interface ColumnExtension<TRow, TValue, TAggregate> {
 * 		cell?: (context: { row: TRow; value: TValue }) => VNodeChild;
 * 	}
 * }
 * ```
 *
 * `TAggregate` is the column's `aggregate`, for a field that reads its result through
 * `AggregateResult`. Fields must be optional, and `TRow` and `TValue` belong in argument positions, as
 * in `AnyColumnInput`. The core keeps the fields on the column and compares them in
 * `reconcileColumns`.
 */
// oxlint-disable-next-line no-unused-vars
export interface ColumnExtension<TRow, TValue, TAggregate> {}

export interface ColumnInput<
	TRow,
	TValue,
	TMeta = unknown,
	TAggregate extends ColumnAggregate<TRow, TValue> | undefined = ColumnAggregate<TRow, TValue> | undefined,
> extends ColumnRights, ColumnExtension<TRow, TValue, TAggregate> {
	/** The column's name for people: the header text, the CSV header, a settings panel. */
	label?: string;
	/** `'data'` by default. */
	kind?: ColumnKind;
	/**
	 * The column names the row for assistive technology, and the column window keeps it rendered. The
	 * first shown data column is the row header when no column sets `true`; `false` on it turns that off.
	 */
	rowHeader?: boolean;
	/**
	 * The width, px, and the basis a `flex` column grows from: `120` by default, or `minWidth` when
	 * that is wider, within `maxWidth`.
	 */
	width?: number;
	/** The narrowest a resize takes the column, px: the default width, or `width` when it is narrower, by default. */
	minWidth?: number;
	/** The widest a resize takes the column, px; no limit by default. */
	maxWidth?: number;
	/** The share of the room left in the row the column grows into, as in CSS; `0` by default. */
	flex?: number;
	/**
	 * How the cell content is aligned. The core only marks the cells: `data-tc-align` on `cellProps` and
	 * `headerProps` for `center` and `right`, and CSS lays them out, such as `@vue-stack/table/style.css`.
	 */
	align?: ColumnAlign;
	pinned?: ColumnPinSide;
	hiddenByDefault?: boolean;
	/**
	 * Cell value. Sorting, grouping, aggregation and cell text read it, and markup memoizes the cell on
	 * it.
	 */
	value: (row: TRow) => TValue;
	/** Equality for values that arrive as objects; `Object.is` by default. */
	equals?: (current: TValue, next: TValue) => boolean;
	/**
	 * The value as text, read by CSV, copying, search and autosize by text. `String(value)` by default,
	 * `''` for `null` and `undefined`.
	 */
	format?: (value: TValue, row: TRow) => string;
	/**
	 * Order of values when sorting rows: negative puts `a` first. The direction is applied separately,
	 * and empty values (`null`, `undefined`, `NaN`) never reach it: they always sort last.
	 */
	compare?: (a: TValue, b: TValue) => number;
	/** Directions a header click steps through before clearing the sort; `['desc', 'asc']` by default. */
	sortOrder?: readonly SortDirection[];
	/** Reduces the column's values over the rows of a group or the footer. */
	aggregate?: TAggregate;
	/**
	 * Whether the cells can be edited, or which of them: a function of the row. `false` by default. An
	 * editable column needs `setValue`.
	 */
	editable?: boolean | ((row: TRow) => boolean);
	/**
	 * The value from text, such as a paste or a text editor gives; the text itself by default. Text it
	 * cannot read is for `validate` to refuse, such as `NaN` of a number.
	 */
	parse?: (text: string, row: TRow) => TValue;
	/**
	 * The row with a new value in this column, as a new object: rows stay immutable, so memoized rows,
	 * `useRowStream` and `delta` sorting see the change.
	 */
	setValue?: (row: TRow, value: TValue) => TRow;
	/** What is wrong with a value, in words for the person; nothing when it is right. */
	validate?: (value: TValue, row: TRow) => string | null | undefined | void;
	/**
	 * Your data; the core never reads it. `reconcileColumns` compares it one level deep, so a literal
	 * rebuilt in a `computed` with the same values does not replace the column.
	 */
	meta?: TMeta;
}

/**
 * A column input with the value type erased: `never` in argument positions makes any
 * `ColumnInput<TRow, TValue>` assignable to it.
 */
export interface AnyColumnInput extends ColumnRights, ColumnExtension<never, never, never> {
	label?: string;
	kind?: ColumnKind;
	rowHeader?: boolean;
	width?: number;
	minWidth?: number;
	maxWidth?: number;
	flex?: number;
	align?: ColumnAlign;
	pinned?: ColumnPinSide;
	hiddenByDefault?: boolean;
	value: (row: never) => unknown;
	equals?: (current: never, next: never) => boolean;
	format?: (value: never, row: never) => string;
	compare?: (a: never, b: never) => number;
	sortOrder?: readonly SortDirection[];
	aggregate?: AggregateName | ((values: readonly never[], rows: readonly never[]) => unknown);
	editable?: boolean | ((row: never) => boolean);
	parse?: (text: string, row: never) => unknown;
	setValue?: (row: never, value: never) => unknown;
	validate?: (value: never, row: never) => string | null | undefined | void;
	meta?: unknown;
}

/**
 * A normalized column with the value type erased, so columns of any value type fit one list. Its
 * functions cannot be called through this type; `RuntimeColumn` is for calling them.
 */
export interface AnyColumn
	extends ColumnGeometry, ColumnLayout, ColumnOrder, Required<ColumnRights>, ColumnExtension<never, never, never> {
	label?: string;
	kind: ColumnKind;
	rowHeader?: boolean;
	meta?: unknown;
	value: (row: never) => unknown;
	equals?: (current: never, next: never) => boolean;
	format?: (value: never, row: never) => string;
	compare?: (a: never, b: never) => number;
	sortOrder?: readonly SortDirection[];
	aggregate?: AggregateName | ((values: readonly never[], rows: readonly never[]) => unknown);
	editable?: boolean | ((row: never) => boolean);
	parse?: (text: string, row: never) => unknown;
	setValue?: (row: never, value: never) => unknown;
	validate?: (value: never, row: never) => string | null | undefined | void;
}

type RuntimeFunctionField = 'value' | 'equals' | 'format' | 'compare' | 'aggregate' | 'editable' | 'parse' | 'setValue' | 'validate';

type ExtensionField = keyof ColumnExtension<never, never, never>;

/** `AnyColumn` typed for calling its functions, the ones from `ColumnExtension` included. */
export interface RuntimeColumn
	extends Omit<AnyColumn, RuntimeFunctionField | ExtensionField>,
	ColumnExtension<unknown, unknown, ColumnAggregate<unknown, unknown>> {
	value: (row: unknown) => unknown;
	equals?: (current: unknown, next: unknown) => boolean;
	format?: (value: unknown, row: unknown) => string;
	compare?: (a: unknown, b: unknown) => number;
	aggregate?: AggregateName | ((values: readonly unknown[], rows: readonly unknown[]) => unknown);
	editable?: boolean | ((row: unknown) => boolean);
	parse?: (text: string, row: unknown) => unknown;
	setValue?: (row: unknown, value: unknown) => unknown;
	validate?: (value: unknown, row: unknown) => string | null | undefined | void;
}

export interface RenderedColumn {
	/** `null` for a column-window spacer, which has no declaration. */
	column: RuntimeColumn | null;
	/** The column name, or the key of a spacer: unique in the row, for `v-for`. */
	key: string;
	/**
	 * Position among the shown columns, from `0`; `-1` for a spacer. The column's `aria-colindex` is
	 * one more.
	 */
	index: number;
	pin?: ColumnPinSide;
	/** Which side of the column window a spacer stands on; `undefined` for a column. */
	spacer?: ColumnPinSide;
	/** The column is a row header: see `ColumnInput.rowHeader`. The column window always renders it. */
	rowHeader?: boolean;
	/**
	 * Props of the column's body cells: `key`, `data-tc-column`, `data-tc-pinned`, `data-tc-align` and the
	 * geometry as a `style` string. One frozen object per column, shared by all rows, so `patchProps` stops at
	 * reference equality.
	 */
	cellProps: Readonly<Record<string, unknown>>;
	/** Props of the column's header cell, as `cellProps`. */
	headerProps: Readonly<Record<string, unknown>>;
}

export type ColumnsInput = Readonly<Record<string, AnyColumn>>;

export const DEFAULT_COLUMN_WIDTH = 120;

export function toRuntimeColumn(column: AnyColumn) {
	return column as unknown as RuntimeColumn;
}

/**
 * The cell value as text: through the column's `format`, otherwise `String(value)`; `''` for `null` and
 * `undefined`.
 */
export function getCellText(column: AnyColumn | RuntimeColumn, row: unknown) {
	const runtime = column as RuntimeColumn;
	const value = runtime.value(row);

	if (runtime.format) {
		return runtime.format(value, row);
	}

	return value === null || value === undefined ? '' : String(value);
}

/** The width of a column that declares none: the default, or its `minWidth` when that is wider, within `maxWidth`. */
function getDefaultWidth(input: Pick<AnyColumnInput, 'minWidth' | 'maxWidth'>) {
	return Math.min(input.maxWidth ?? Number.POSITIVE_INFINITY, Math.max(DEFAULT_COLUMN_WIDTH, input.minWidth ?? 0));
}

/** A column with defaults filled in. Fields the core does not know, such as `ColumnExtension` ones, are kept. */
export function normalizeColumn(name: string, input: AnyColumnInput): AnyColumn {
	const width = input.width ?? getDefaultWidth(input);

	return {
		...input,
		name,
		label: input.label,
		kind: input.kind ?? 'data',
		rowHeader: input.rowHeader,
		width,
		minWidth: input.minWidth ?? Math.min(width, DEFAULT_COLUMN_WIDTH),
		maxWidth: input.maxWidth,
		flex: input.flex ?? 0,
		align: input.align ?? 'left',
		pinned: input.pinned,
		hiddenByDefault: input.hiddenByDefault ?? false,
		sortable: input.sortable ?? false,
		resizable: input.resizable ?? false,
		movable: input.movable ?? false,
		hideable: input.hideable ?? false,
		pinnable: input.pinnable ?? false,
		value: input.value,
		equals: input.equals,
		format: input.format,
		compare: input.compare,
		sortOrder: input.sortOrder,
		aggregate: input.aggregate,
		editable: input.editable ?? false,
		parse: input.parse,
		setValue: input.setValue,
		validate: input.validate,
		meta: input.meta,
	};
}

type Fields = Readonly<Record<string, unknown>>;

function isPlainObject(value: unknown): value is Fields {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const prototype: unknown = Object.getPrototypeOf(value);

	return prototype === Object.prototype || prototype === null;
}

function getFieldNames(current: Fields, next: Fields) {
	return new Set([...Object.keys(current), ...Object.keys(next)]);
}

function isSameMeta(current: unknown, next: unknown) {
	if (Object.is(current, next)) {
		return true;
	}

	if (!isPlainObject(current) || !isPlainObject(next)) {
		return false;
	}

	for (const name of getFieldNames(current, next)) {
		if (!Object.is(current[name], next[name])) {
			return false;
		}
	}

	return true;
}

function isSameField(name: string, current: Fields, next: Fields) {
	return name === 'meta' ? isSameMeta(current.meta, next.meta) : Object.is(current[name], next[name]);
}

function isSameColumn(column: AnyColumn, other: AnyColumn) {
	if (column === other) {
		return true;
	}

	const current = column as unknown as Fields;
	const next = other as unknown as Fields;

	for (const name of getFieldNames(current, next)) {
		if (!isSameField(name, current, next)) {
			return false;
		}
	}

	return true;
}

/** Fields in which `other` differs from `column`, by the same rules as `reconcileColumns`. */
export function getChangedFields(column: AnyColumn, other: AnyColumn) {
	const current = column as unknown as Fields;
	const next = other as unknown as Fields;

	return [...getFieldNames(current, next)].filter(name => !isSameField(name, current, next));
}

/**
 * Whether all changed `fields` are functions: new arrows for the same column, usually rebuilt in a
 * `computed`.
 */
export function isFunctionOnlyChange(column: AnyColumn, other: AnyColumn, fields: readonly string[]) {
	const current = column as unknown as Fields;
	const next = other as unknown as Fields;

	return fields.length > 0
		&& fields.every(name => typeof current[name] === 'function' && typeof next[name] === 'function');
}

/**
 * Reconciles a new column set against the current one, keeping references: an unchanged column stays
 * the same object, and an unchanged set stays the same array. Every field is compared, including
 * ones the core does not know: functions by reference, `meta` one level deep.
 */
export function reconcileColumns(current: readonly AnyColumn[], next: readonly AnyColumn[]): readonly AnyColumn[] {
	const known = new Map(current.map(column => [column.name, column]));
	let same = current.length === next.length;

	const result = next.map((column, index) => {
		const previous = known.get(column.name);
		const resolved = previous && isSameColumn(previous, column) ? previous : column;

		same &&= resolved === current[index];

		return resolved;
	});

	return same ? current : result;
}

/**
 * Names of the row header columns among `columns`, the shown ones in display order: every column with
 * `rowHeader: true`; without one, the first data column unless it says `rowHeader: false`.
 */
export function resolveRowHeaders(columns: readonly Pick<AnyColumn, 'name' | 'kind' | 'rowHeader'>[]) {
	const marked = columns.filter(column => column.rowHeader === true);

	if (marked.length > 0) {
		return new Set(marked.map(column => column.name));
	}

	const first = columns.find(column => column.kind === 'data');

	return new Set(first && first.rowHeader !== false ? [first.name] : []);
}

/** Columns as an array, from an object by name or an array. */
export function toColumnList(columns: ColumnsInput | readonly AnyColumn[]): readonly AnyColumn[] {
	return Array.isArray(columns) ? columns : Object.values(columns as ColumnsInput);
}
