/**
 * How to get a row's key: a field of the row, or a function of it. The key must stay the same while
 * the row does, through sorting, streaming and filtering: focus, selection and measured heights hold
 * on to it.
 */
export type RowKey<TRow> = keyof TRow | ((row: TRow) => string);

/** A key getter from a `RowKey`: a function is returned as is, a field value becomes a string. */
export function createRowKeyResolver<TRow>(rowKey: RowKey<TRow>): (row: TRow) => string {
	return typeof rowKey === 'function' ? rowKey : (row: TRow) => String(row[rowKey]);
}
