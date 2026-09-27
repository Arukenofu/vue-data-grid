import {
	type AggregateName,
	type AnyColumn,
	type AnyColumnInput,
	type ColumnAlign,
	type ColumnInput,
	type ColumnKind,
	type ColumnRights,
	normalizeColumn,
} from './column';

interface ResolvedFields {
	kind: ColumnKind;
	width: number;
	minWidth: number;
	flex: number;
	align: ColumnAlign;
	hiddenByDefault: boolean;
	sortable: boolean;
	resizable: boolean;
	movable: boolean;
	hideable: boolean;
	pinnable: boolean;
}

/** Columns returned by `defineColumns`: the input plus the defaults it fills in, typed as present. */
export type Columns<TInput> = {
	readonly [TName in keyof TInput]: TInput[TName] & ResolvedFields & { name: TName & string };
};

/**
 * Fields every column of a builder starts with, and each column can override: the kind, rights,
 * geometry and the order of sort directions.
 */
export type ColumnDefaults = ColumnRights & Pick<
	ColumnInput<unknown, unknown>,
	'kind' | 'width' | 'minWidth' | 'maxWidth' | 'flex' | 'align' | 'sortOrder' | 'editable'
>;

/**
 * The `aggregate` a builder call was given: a built-in by name, a function by what it returns,
 * `undefined` without one.
 */
export type ColumnBuilderAggregate<TRow, TValue, TName, TResult> = [TResult] extends [never]
	? [TName] extends [never] ? undefined : TName
	: (values: readonly TValue[], rows: readonly TRow[]) => TResult;

/**
 * The fields of a builder call after `value`. `aggregate` is spelled out rather than taken from
 * `ColumnInput`, so that its name or its function's result can be inferred and type the
 * `ColumnExtension` fields that read it, such as a footer.
 */
export type ColumnBuilderFields<TRow, TValue, TMeta, TName extends AggregateName, TResult> = Omit<
	ColumnInput<TRow, TValue, TMeta, ColumnBuilderAggregate<TRow, TValue, TName, TResult>>,
	'value' | 'aggregate'
> & {
	aggregate?: TName | ((values: readonly TValue[], rows: readonly TRow[]) => TResult);
};

export type ColumnBuilder<TRow, TMeta = unknown> = <TValue, TName extends AggregateName = never, TResult = never>(
	value: (row: TRow) => TValue,
	rest?: ColumnBuilderFields<TRow, TValue, TMeta, TName, TResult>,
) => ColumnInput<TRow, TValue, TMeta, NoInfer<ColumnBuilderAggregate<TRow, TValue, TName, TResult>>>;

/**
 * A column builder bound to a row type. The value type is inferred from `value` at the builder call,
 * and then types `equals`, `format`, `compare` and the functions of `ColumnExtension`. The inferred
 * `aggregate` reaches `ColumnExtension` too; a function `aggregate` does so for the fields after it
 * in the object. `defaults` go into every column the builder makes, such as the same rights for the
 * whole table.
 */
export function defineColumn<TRow, TMeta = unknown>(defaults?: ColumnDefaults): ColumnBuilder<TRow, TMeta> {
	return ((value, rest) => ({ ...defaults, ...rest, value })) as ColumnBuilder<TRow, TMeta>;
}

/**
 * Columns by name. The object key becomes the column name, so names are unique and typed as
 * literals. Fields the core does not know are kept and compared by `reconcileColumns`; put your own
 * data in `meta` so it cannot clash with fields of the core or of a layer on top.
 */
export function defineColumns<TInput extends Record<string, AnyColumnInput>>(input: TInput): Columns<TInput> {
	const result: Record<string, AnyColumn> = {};

	for (const name of Object.keys(input)) {
		result[name] = normalizeColumn(name, input[name]);
	}

	return Object.freeze(result) as unknown as Columns<TInput>;
}
