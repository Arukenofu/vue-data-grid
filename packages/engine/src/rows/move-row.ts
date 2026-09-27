import { createRowKeyResolver, type RowKey } from './row-key';
import { createParentKeyResolver } from './row-tree';

/** Where a row goes: `index` among the children of `parent`, counted once the row is taken out. */
export interface RowMove<TRow> {
	key: string;
	/** The row itself: the one in `rows`, or a row from elsewhere, such as another table. */
	row: TRow;
	/** Key of the new parent; `null` for the top level. Ignored without `parentKey`. */
	parent: string | null;
	index: number;
}

export interface MoveRowOptions<TRow> {
	rowKey: RowKey<TRow>;
	/**
	 * The field with the key of the parent, for rows of a tree: the moved row gets its new parent
	 * there. Without it the rows are flat, and every row is a sibling of every other.
	 */
	parentKey?: keyof TRow;
}

/**
 * The rows with one row moved: taken out of `rows` if it is there, and put `index`-th among the
 * children of `parent`, before the sibling that stands there, or after the last one. A row from
 * elsewhere is inserted the same way. The moved row is a new object only when its parent changes;
 * every other row keeps its reference.
 */
export function moveRow<TRow>(rows: readonly TRow[], move: RowMove<TRow>, options: MoveRowOptions<TRow>): TRow[] {
	const getKey = createRowKeyResolver(options.rowKey);
	const { parentKey } = options;
	const getParent = parentKey === undefined ? null : createParentKeyResolver(parentKey);
	const rest = rows.filter(row => getKey(row) !== move.key);
	const parent = getParent ? move.parent : null;
	const moved = getParent && parentKey !== undefined && getParent(move.row) !== parent
		? { ...move.row, [parentKey]: parent }
		: move.row;
	const siblings = getParent ? rest.filter(row => getParent(row) === parent) : rest;
	const anchor = siblings[move.index];
	const last = siblings.at(-1);
	const position = anchor === undefined
		? last === undefined ? rest.length : rest.indexOf(last) + 1
		: rest.indexOf(anchor);

	rest.splice(position, 0, moved);

	return rest;
}
