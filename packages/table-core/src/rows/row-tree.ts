/** A field of the row holding its children, an array of rows of the same type. */
export type ChildrenField<TRow> = {
	[K in keyof TRow]-?: TRow[K] extends readonly TRow[] | undefined ? K : never;
}[keyof TRow];

/**
 * How to find a row's parent in a flat list: a field of the row with the parent's key, or a function
 * of the row. `null`, `undefined`, `''` and a key that no row has put the row at the top level.
 */
export type ParentKey<TRow> = keyof TRow | ((row: TRow) => string | null | undefined);

/** A row's place in the tree. In a flat list every row is a leaf of the root. */
export interface RowNode {
	key: string;
	level: number;
	/** Key of the group holding the row; `null` at the top level. */
	parent: string | null;
	/** The row has a children array, even an empty one, or other rows name it as their parent. */
	group: boolean;
	expanded: boolean;
	/** Leaves under the group on all levels; `0` for a leaf. */
	count: number;
	/** Place among the rows under the same parent, in their order, from `0`. */
	position: number;
	/** How many rows are under the same parent, this one included. */
	setSize: number;
}

export function getRowChildren<TRow>(row: TRow, field: ChildrenField<TRow> | undefined) {
	const children = field === undefined ? undefined : row[field];

	return Array.isArray(children) ? children as readonly TRow[] : undefined;
}

/** A parent key getter from a `ParentKey`: `null` for the top level. */
export function createParentKeyResolver<TRow>(parentKey: ParentKey<TRow>): (row: TRow) => string | null {
	const read = typeof parentKey === 'function' ? parentKey : (row: TRow) => row[parentKey] as unknown;

	return (row) => {
		const parent = read(row);

		return parent === null || parent === undefined || parent === '' ? null : String(parent);
	};
}
