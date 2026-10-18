import { applyKeyedChanges, getNeighbour, isUnplaced } from './row-batch';
import { createRowKeyResolver, type RowKey } from './row-key';
import {
	appendRow,
	buildRow,
	compact,
	createRowList,
	descendantsOf,
	finishRows,
	getChildIndex,
	insertAt,
	isSameRow,
	isUnder,
	isWithin,
	type ListTarget,
	listPosition,
	moveTo,
	parentAt,
	positionOf,
	removeAt,
	replaceAt,
	type RowList,
	siblingIndex,
	siblingsOf,
	withParent,
} from './row-list';
import { type ChildrenField, getRowChildren, type ParentKey } from './row-tree';

/**
 * Where a row goes: right before or after a row, among its siblings; or `index`-th among the children
 * of `parent`, counted once the row is taken out, as a drop of a row says. `before` comes first, then
 * `after`, then `parent` and `index`; a neighbour that is `null` is not given, so `{ after: focused }`
 * puts a row after the focused one, or without one where `parent` and `index` say. `parent` left out
 * keeps the parent the row has, or for a new row the one its `parentKey` names; `null` is the top
 * level. `index` left out, or past the end, puts the row last. Without `parentKey` and
 * `childrenField` every row is a sibling of every other, and `parent` is ignored.
 */
export interface RowPlace {
	before?: string | null;
	after?: string | null;
	parent?: string | null;
	index?: number;
}

/**
 * Adds a row at a place, the last at the top level by default. A key that is there already skips the
 * change, unless `existing` is `'replace'`.
 */
export interface AddRowChange<TRow> extends RowPlace {
	type: 'add';
	row: TRow;
	/**
	 * What a key that is there already does: `'skip'` the change, by default, or `'replace'` the row
	 * where it stands, as for a stream that sends whole rows.
	 */
	existing?: 'skip' | 'replace';
}

/** Replaces the row with the same key, in place. */
export interface UpdateRowChange<TRow> {
	type: 'update';
	row: TRow;
	/** Replace only while the key holds this row, and skip the change otherwise. */
	expected?: NoInfer<TRow>;
}

/** Removes the row with this key, and the rows under it in a tree. */
export interface RemoveRowChange<TRow> {
	type: 'remove';
	key: string;
	/** Remove only while the key holds this row, and skip the change otherwise. */
	expected?: NoInfer<TRow>;
	/**
	 * Remove only while exactly these rows are under it, by key in any order, and skip the change
	 * otherwise: the undo of an add carries it, so that it never takes rows that came under the row
	 * since.
	 */
	subtree?: readonly string[];
}

/**
 * Moves the row with this key to a place, the rows under it in a tree along with it. A key no row has
 * skips the change. A drop of a row says it: `event.change` of `useGridRowDrag`.
 */
export interface MoveRowChange<TRow> extends RowPlace {
	type: 'move';
	key: string;
	/** The row to put at the place instead of the one the key holds, such as a copy with a new field. */
	row?: TRow;
	/** Move only while the key holds this row, and skip the change otherwise. */
	expected?: NoInfer<TRow>;
	/** Move only while the row is under this parent, `null` for the top level, and skip the change otherwise. */
	from?: string | null;
}

/** One change of rows by key: add, update, remove or move a row. */
export type RowChange<TRow> = AddRowChange<TRow> | UpdateRowChange<TRow> | RemoveRowChange<TRow> | MoveRowChange<TRow>;

export interface RowChangeOptions<TRow> {
	rowKey: RowKey<TRow>;
	/**
	 * The parent of each row of a flat list, as the tree reads it: a row given a new parent gets it in
	 * this field, or through `setParent`. The children of a parent are the rows that name it, also when
	 * no row has its key, as for rows split into lists by a field; such rows, and rows that name
	 * themselves, are at the top level too, as the tree shows them. Takes precedence over
	 * `childrenField`.
	 */
	parentKey?: ParentKey<TRow>;
	/**
	 * Gives a row a new parent: what a `parentKey` that is a function needs. By default the parent is
	 * written into the `parentKey` field of a copy of the row.
	 */
	setParent?: (row: TRow, parent: string | null) => TRow;
	/**
	 * The field holding an array of children, for a nested tree: a row whose children change becomes a
	 * copy with a new array, and so do the rows above it. Children change only through changes of their
	 * own: an update takes the fields of the new row and keeps the children the tree has.
	 */
	childrenField?: ChildrenField<TRow>;
}

/** What changes of rows did. */
export interface RowChangeResult<TRow> {
	/** The rows after the changes; the same array when nothing changed. */
	rows: readonly TRow[];
	/** The changes made, in order. */
	applied: readonly RowChange<TRow>[];
	/**
	 * The changes left out: an unknown key or neighbour, a key an add finds there already, a parent no
	 * row has in a nested tree, a failed `expected`, `from` or `subtree`, or a move into the row's own
	 * subtree.
	 */
	skipped: readonly RowChange<TRow>[];
	/**
	 * The changes that undo `applied`, in the order to apply them, each guarded by `expected`, `from`
	 * or `subtree`, so that it is skipped once its row changed again. Worked out on the first read for a
	 * batch of updates, removals and adds without a place, which a stream never reads.
	 */
	undo: readonly RowChange<TRow>[];
}

const LAST = Number.POSITIVE_INFINITY;

/** The keys the changes name, as rows, neighbours and parents: the ones a batch looks up. */
function collectNamedKeys<TRow>(changes: readonly RowChange<TRow>[], getKey: (row: TRow) => string) {
	const named = new Set<string>();

	function add(key: string | null | undefined) {
		if (key !== null && key !== undefined) {
			named.add(key);
		}
	}

	for (const change of changes) {
		if (change.type === 'remove') {
			add(change.key);
			continue;
		}

		if (change.row !== undefined) {
			add(getKey(change.row));
		}

		if (change.type === 'update') {
			continue;
		}

		if (change.type === 'move') {
			add(change.key);
		}

		add(change.parent);
		add(change.before);
		add(change.after);
	}

	return named;
}

/**
 * The parent and index a place stands for, with the row at `exclude` taken out; `null` for an unknown
 * neighbour, or a parent no row has in a nested tree. `parent` is the one a place without it keeps.
 */
function resolvePlace<TRow>(list: RowList<TRow>, place: RowPlace, exclude: number, parent: string | null): ListTarget | null {
	const neighbour = getNeighbour(place);

	if (neighbour) {
		const position = positionOf(list, neighbour.key);

		if (position === -1 || position === exclude) {
			return null;
		}

		const index = siblingIndex(list, position, exclude);

		return { parent: parentAt(list, position), index: neighbour.after ? index + 1 : index };
	}

	if (list.kind === 'flat') {
		return { parent: null, index: place.index ?? LAST };
	}

	const target = place.parent === undefined ? parent : place.parent;

	// A nested row needs a row to hold it; a parent key is a value of a field like any other.
	if (target !== null && list.kind === 'nested' && positionOf(list, target) === -1) {
		return null;
	}

	return { parent: target, index: place.index ?? LAST };
}

/**
 * In a nested tree, the change that makes `parent` a leaf again once the row going into it leaves:
 * without it, the parent would keep an empty children array and stay a group.
 */
function restoreLeaf<TRow>(list: RowList<TRow>, parent: string | null, exclude: number): RowChange<TRow>[] {
	const position = parent === null || list.kind !== 'nested' ? -1 : positionOf(list, parent);

	if (position === -1) {
		return [];
	}

	const row = list.rows[position];
	const isLeaf = getRowChildren(row, list.field) === undefined && siblingsOf(list, parent, exclude).length === 0;

	return isLeaf ? [{ type: 'update', row, expected: row }] : [];
}

/**
 * Replaces the row at `position`. In a tree by `parentKey` a row that names another parent changes
 * place too, so its undo is a move back to where it stood among its siblings.
 */
function replaceRow<TRow>(list: RowList<TRow>, position: number, row: TRow): RowChange<TRow>[] {
	const previous = list.rows[position];

	if (previous === row) {
		return [];
	}

	const from = parentAt(list, position);
	const index = siblingIndex(list, position, -1);

	replaceAt(list, position, row);

	const to = parentAt(list, position);

	if (to === from) {
		return [{ type: 'update', row: previous, expected: row }];
	}

	return [{ type: 'move', key: list.keys[position], row: previous, expected: row, from: to, parent: from, index }];
}

/**
 * The undo of an add: the row removed while the rows under it are the ones the add brought, which
 * in a nested tree are its children and in a tree by `parentKey` none.
 */
function removeAdded<TRow>(list: RowList<TRow>, key: string, row: TRow): RowChange<TRow> {
	if (list.kind === 'flat') {
		return { type: 'remove', key, expected: row };
	}

	const brought = list.kind === 'nested' ? descendantsOf(list, positionOf(list, key)) : [];

	return { type: 'remove', key, expected: row, subtree: brought.map(position => list.keys[position]) };
}

function insertRow<TRow>(list: RowList<TRow>, key: string, row: TRow, place: RowPlace): RowChange<TRow>[] | null {
	if (isUnplaced(place)) {
		appendRow(list, row, null);

		return [removeAdded(list, key, row)];
	}

	compact(list);

	const target = resolvePlace(list, place, -1, list.readParent(row));

	if (!target) {
		return null;
	}

	const stored = withParent(list, row, target.parent);
	const leaf = restoreLeaf(list, target.parent, -1);

	insertAt(list, listPosition(list, target, -1), stored, target.parent);

	return [removeAdded(list, key, stored), ...leaf];
}

function addRow<TRow>(list: RowList<TRow>, change: AddRowChange<TRow>) {
	const key = list.getKey(change.row);
	const position = positionOf(list, key);

	if (position === -1) {
		return insertRow(list, key, change.row, change);
	}

	return change.existing === 'replace' ? replaceRow(list, position, change.row) : null;
}

function isExpected<TRow>(list: RowList<TRow>, position: number, expected: TRow | undefined) {
	return expected === undefined || isSameRow(list, list.rows[position], expected);
}

function updateRow<TRow>(list: RowList<TRow>, change: UpdateRowChange<TRow>) {
	const position = positionOf(list, list.getKey(change.row));

	if (position === -1 || !isExpected(list, position, change.expected)) {
		return null;
	}

	return replaceRow(list, position, change.row);
}

/** The changes that put the removed rows back: the row first, then the rows under it, each at its place. */
function restoreRemoved<TRow>(list: RowList<TRow>, position: number, descendants: readonly number[]): RowChange<TRow>[] {
	const restore = (at: number, row: TRow): RowChange<TRow> => ({
		type: 'add',
		row,
		parent: parentAt(list, at),
		index: siblingIndex(list, at, -1),
	});

	// A nested row carries its subtree back; rows of a flat list come back one by one.
	if (list.kind === 'nested') {
		return [restore(position, buildRow(list, position, getChildIndex(list)))];
	}

	return [position, ...descendants].map(at => restore(at, list.rows[at]));
}

function hasSubtree<TRow>(list: RowList<TRow>, descendants: readonly number[], subtree: readonly string[]) {
	const keys = new Set(subtree);

	return descendants.length === keys.size && descendants.every(position => keys.has(list.keys[position]));
}

function removeRow<TRow>(list: RowList<TRow>, change: RemoveRowChange<TRow>) {
	const position = positionOf(list, change.key);

	if (position === -1 || !isExpected(list, position, change.expected)) {
		return null;
	}

	const descendants = descendantsOf(list, position);

	if (change.subtree !== undefined && !hasSubtree(list, descendants, change.subtree)) {
		return null;
	}

	const undo = restoreRemoved(list, position, descendants);

	removeAt(list, [position, ...descendants]);

	return undo;
}

function moveRow<TRow>(list: RowList<TRow>, change: MoveRowChange<TRow>): RowChange<TRow>[] | null {
	compact(list);

	const position = positionOf(list, change.key);

	if (position === -1 || !isExpected(list, position, change.expected)) {
		return null;
	}

	if (change.from !== undefined && !isUnder(list, position, change.from)) {
		return null;
	}

	const from = parentAt(list, position);
	const target = resolvePlace(list, change, position, from);

	if (!target || (target.parent !== null && isWithin(list, target.parent, change.key))) {
		return null;
	}

	const previous = list.rows[position];
	const index = siblingIndex(list, position, -1);
	const row = withParent(list, change.row ?? previous, target.parent);
	const leaf = restoreLeaf(list, target.parent, position);

	moveTo(list, position, listPosition(list, target, position), row, target.parent);

	const back: MoveRowChange<TRow> = { type: 'move', key: change.key, expected: row, from: target.parent, parent: from, index };

	return [row === previous ? back : { ...back, row: previous }, ...leaf];
}

/** The changes a change makes undone, or `null` when it is skipped. */
function applyChange<TRow>(list: RowList<TRow>, change: RowChange<TRow>) {
	switch (change.type) {
		case 'add':
			return addRow(list, change);
		case 'update':
			return updateRow(list, change);
		case 'remove':
			return removeRow(list, change);
		case 'move':
			return moveRow(list, change);
		default: {
			const unknown: never = change;

			throw new Error(`[@vue-data-grid/engine] Unknown row change: ${String(unknown)}`);
		}
	}
}

/** Applies the changes on the working list of the rows, with their undo. */
function applyInOrder<TRow>(
	rows: readonly TRow[],
	changes: readonly RowChange<TRow>[],
	options: RowChangeOptions<TRow>,
): RowChangeResult<TRow> {
	const list = createRowList(rows, options, collectNamedKeys(changes, createRowKeyResolver(options.rowKey)));
	const applied: RowChange<TRow>[] = [];
	const skipped: RowChange<TRow>[] = [];
	const undo: RowChange<TRow>[][] = [];

	for (const change of changes) {
		const inverse = applyChange(list, change);

		if (inverse === null) {
			skipped.push(change);
		} else {
			applied.push(change);
			undo.push(inverse);
		}
	}

	return { rows: finishRows(list, rows), applied, skipped, undo: undo.reverse().flat() };
}

/**
 * Applies changes of rows by key, in order, each to the rows the ones before it left, and returns the
 * new rows with what was applied, what was skipped, and the changes that undo it. Rows nothing
 * touched keep their objects and places; in a nested tree only the rows above a change become new
 * objects. A row of a tree is removed and moved with the rows under it. Rows are copied with a
 * spread, so they should be plain objects. Keys are unique: of rows with the same key, changes reach
 * the first, and development builds warn.
 *
 * A batch of updates, removals and adds without a place, outside a nested tree, takes one pass over
 * the rows, as a stream needs every frame; an add at a place and a move go through the rows each.
 */
export function applyRowChanges<TRow>(
	rows: readonly TRow[],
	changes: readonly RowChange<TRow>[],
	options: RowChangeOptions<TRow>,
): RowChangeResult<TRow> {
	const batch = applyKeyedChanges(rows, changes, options);

	if (!batch) {
		return applyInOrder(rows, changes, options);
	}

	let undo: readonly RowChange<TRow>[] | null = null;

	return {
		...batch,
		// The undo needs the place of every removed row at its change, which the pass does not track:
		// it is worked out on the first read, and a stream never reads it.
		get undo() {
			undo ??= applyInOrder(rows, changes, options).undo;

			return undo;
		},
	};
}
