import type { RowChangeOptions } from './row-changes';
import { createRowKeyResolver } from './row-key';
import { type ChildrenField, createParentKeyResolver, getRowChildren } from './row-tree';

/** How rows make a tree: none, a field naming the parent, or children arrays inside rows. */
export type TreeKind = 'flat' | 'parents' | 'nested';

/**
 * Rows being changed by `applyRowChanges`: every row of the tree in data order, with its key and its
 * parent, in arrays at the same positions. A nested tree is flattened into them: where a child stands
 * does not matter, only the order of siblings among each other.
 */
export interface RowList<TRow> {
	kind: TreeKind;
	getKey: (row: TRow) => string;
	readParent: (row: TRow) => string | null;
	writeParent: (row: TRow, parent: string | null) => TRow;
	field: ChildrenField<TRow> | undefined;
	rows: TRow[];
	keys: string[];
	/**
	 * The parent a row names with `parentKey`, which may be a key no row has, or the one it is under in
	 * a nested tree; `null` at the top level and in a flat list.
	 */
	parents: (string | null)[];
	/** Positions of rows removed in place: they leave the arrays at the next splice, or at the end. */
	removed: Set<number>;
	/**
	 * Position by key, built when needed and dropped once rows shift: of the keys the changes name, so
	 * that a batch of a few changes to many rows indexes a few keys, or of every key once another one is
	 * asked for, such as an ancestor.
	 */
	positions: Map<string, number> | null;
	/**
	 * Positions of the children of every parent, in order, built when needed and dropped once rows
	 * shift or a parent changes; removed rows stay in it until then. A row whose parent no row has is
	 * also a child of the top level, where the tree shows it.
	 */
	children: Map<string | null, number[]> | null;
	named: ReadonlySet<string>;
	indexAll: boolean;
	/** Whether a change wrote anything: an untouched list comes back as the same array. */
	changed: boolean;
}

export interface ListTarget {
	parent: string | null;
	index: number;
}

function getTreeKind<TRow>(options: RowChangeOptions<TRow>): TreeKind {
	if (options.parentKey !== undefined) {
		return 'parents';
	}

	return options.childrenField === undefined ? 'flat' : 'nested';
}

function createParentWriter<TRow>(options: RowChangeOptions<TRow>) {
	const { parentKey, setParent } = options;

	if (setParent) {
		return setParent;
	}

	return (row: TRow, parent: string | null): TRow => {
		if (parentKey === undefined || typeof parentKey === 'function') {
			throw new Error(
				'[@vue-data-grid/engine] applyRowChanges() needs `setParent` to give a row a new parent when '
				+ '`parentKey` is a function.',
			);
		}

		return { ...row, [parentKey]: parent };
	};
}

function isIndexed<TRow>(list: RowList<TRow>, key: string) {
	return list.indexAll || list.named.has(key);
}

/** Adds an item to the list of a key in a map of lists. */
export function pushTo<TKey, TItem>(map: Map<TKey, TItem[]>, key: TKey, item: TItem) {
	const items = map.get(key);

	if (items) {
		items.push(item);
	} else {
		map.set(key, [item]);
	}
}

// Keys warned about: one warning for a key says it all.
const warnedKeys = new Set<string>();

/** Warns once in development that rows share a key, which changes reach only the first of. */
export function warnDuplicateKey(key: string) {
	if (__DEV__ && !warnedKeys.has(key)) {
		warnedKeys.add(key);
		// oxlint-disable-next-line no-console
		console.warn(
			`[@vue-data-grid/engine] applyRowChanges() found more than one row with the key "${key}": changes reach `
			+ 'only the first of them. Give every row a key of its own.',
		);
	}
}

function pushRow<TRow>(list: RowList<TRow>, row: TRow, parent: string | null) {
	const key = list.getKey(row);
	const position = list.rows.length;

	list.rows.push(row);
	list.keys.push(key);
	list.parents.push(parent);

	if (list.positions && isIndexed(list, key) && !list.positions.has(key)) {
		list.positions.set(key, position);
	}

	if (list.children) {
		addToChildIndex(list, list.children, position);
	}

	if (list.kind === 'nested') {
		pushChildren(list, row, key);
	}
}

/** Adds the subtree of a nested row at the end of the list. */
function pushChildren<TRow>(list: RowList<TRow>, row: TRow, key: string) {
	for (const child of getRowChildren(row, list.field) ?? []) {
		pushRow(list, child, key);
	}
}

/** The rows as a list to change; `named` are the keys the changes name. */
export function createRowList<TRow>(rows: readonly TRow[], options: RowChangeOptions<TRow>, named: ReadonlySet<string>): RowList<TRow> {
	const kind = getTreeKind(options);
	const readParent = options.parentKey === undefined ? () => null : createParentKeyResolver(options.parentKey);
	const getKey = createRowKeyResolver(options.rowKey);
	const list: RowList<TRow> = {
		kind,
		getKey,
		readParent,
		writeParent: createParentWriter(options),
		field: options.childrenField,
		rows: [],
		keys: [],
		parents: [],
		removed: new Set(),
		positions: null,
		children: null,
		named,
		indexAll: false,
		changed: false,
	};

	if (kind === 'nested') {
		for (const row of rows) {
			pushRow(list, row, null);
		}

		return list;
	}

	list.rows = rows.slice();
	list.keys = rows.map(row => getKey(row));
	list.parents = rows.map(row => readParent(row));

	return list;
}

function isLive<TRow>(list: RowList<TRow>, position: number) {
	return list.removed.size === 0 || !list.removed.has(position);
}

function indexPositions<TRow>(list: RowList<TRow>) {
	const positions = new Map<string, number>();

	// The first row with a repeated key is the one the tree shows.
	list.keys.forEach((key, position) => {
		if (!isIndexed(list, key) || !isLive(list, position)) {
			return;
		}

		if (positions.has(key)) {
			warnDuplicateKey(key);
		} else {
			positions.set(key, position);
		}
	});

	return positions;
}

/** The position of the row with this key; `-1` for none. */
export function positionOf<TRow>(list: RowList<TRow>, key: string) {
	if (!isIndexed(list, key)) {
		list.indexAll = true;
		list.positions = null;
	}

	list.positions ??= indexPositions(list);

	return list.positions.get(key) ?? -1;
}

/** The parent of the row at `position`; a row that names itself is at the top level. */
export function parentAt<TRow>(list: RowList<TRow>, position: number) {
	const parent = list.parents[position];

	return parent === list.keys[position] ? null : parent;
}

/** Whether the row at `position` names a parent that is not a row: the top level shows it. */
function isOrphan<TRow>(list: RowList<TRow>, position: number, keys: ReadonlySet<string>) {
	const parent = parentAt(list, position);

	return list.kind === 'parents' && parent !== null && !keys.has(parent);
}

function addToChildIndex<TRow>(list: RowList<TRow>, children: Map<string | null, number[]>, position: number) {
	// An appended row may be the parent rows named before it: the index is built again then.
	if (list.kind === 'parents') {
		list.children = null;

		return;
	}

	pushTo(children, parentAt(list, position), position);
}

/** Positions of the children of every parent, in order: the index of the list, built when needed. */
export function getChildIndex<TRow>(list: RowList<TRow>) {
	if (list.children) {
		return list.children;
	}

	const children = new Map<string | null, number[]>();
	const keys = new Set<string>();

	list.keys.forEach((key, position) => {
		if (isLive(list, position)) {
			keys.add(key);
		}
	});

	list.keys.forEach((_key, position) => {
		if (!isLive(list, position)) {
			return;
		}

		pushTo(children, parentAt(list, position), position);

		if (isOrphan(list, position, keys)) {
			pushTo(children, null, position);
		}
	});

	list.children = children;

	return children;
}

/**
 * Whether the row at `position` is a child of `parent`: the one it names, or the top level for a row
 * whose parent is not a row.
 */
export function isUnder<TRow>(list: RowList<TRow>, position: number, parent: string | null) {
	const named = parentAt(list, position);

	return named === parent || (parent === null && list.kind === 'parents' && named !== null && positionOf(list, named) === -1);
}

/** Positions of the children of `parent` in order, without the row at `exclude`. */
export function siblingsOf<TRow>(list: RowList<TRow>, parent: string | null, exclude: number) {
	const children = getChildIndex(list).get(parent) ?? [];

	return children.filter(position => position !== exclude && isLive(list, position));
}

/** The place of a row among the children of the parent it names, without the row at `exclude`. */
export function siblingIndex<TRow>(list: RowList<TRow>, position: number, exclude: number) {
	// Every row of a flat list is a sibling: no need to go through them, which a stream that removes
	// many rows at once would do for each.
	if (list.kind === 'flat' && exclude === -1) {
		return position - countRemovedBefore(list, position);
	}

	let index = 0;

	for (const sibling of getChildIndex(list).get(parentAt(list, position)) ?? []) {
		if (sibling >= position) {
			break;
		}

		if (sibling !== exclude && isLive(list, sibling)) {
			index += 1;
		}
	}

	return index;
}

function countRemovedBefore<TRow>(list: RowList<TRow>, position: number) {
	let count = 0;

	for (const removed of list.removed) {
		if (removed < position) {
			count += 1;
		}
	}

	return count;
}

/** Positions of the rows under the row at `position`, parents before their children. */
export function descendantsOf<TRow>(list: RowList<TRow>, position: number) {
	const result: number[] = [];

	if (list.kind === 'flat') {
		return result;
	}

	const children = getChildIndex(list);
	// Parents that form a cycle lead back to rows already taken.
	const seen = new Set([position]);

	function visit(key: string) {
		for (const child of children.get(key) ?? []) {
			if (!seen.has(child) && isLive(list, child)) {
				seen.add(child);
				result.push(child);
				visit(list.keys[child]);
			}
		}
	}

	visit(list.keys[position]);

	return result;
}

/** Whether the row with key `key` is `ancestor` or under it. Parents that form a cycle end the walk. */
export function isWithin<TRow>(list: RowList<TRow>, key: string, ancestor: string) {
	let current: string | null = key;

	for (let steps = 0; current !== null && steps <= list.keys.length; steps += 1) {
		if (current === ancestor) {
			return true;
		}

		const position: number = positionOf(list, current);

		current = position === -1 ? null : parentAt(list, position);
	}

	return false;
}

/** The last position of the row at `position` and the rows under it, without the row at `exclude`. */
function subtreeEnd<TRow>(list: RowList<TRow>, position: number, exclude: number) {
	let end = position;

	for (const descendant of descendantsOf(list, position)) {
		if (descendant !== exclude && descendant > end) {
			end = descendant;
		}
	}

	return end;
}

/**
 * The position in the list for the `index`-th child of `parent`, with the row at `exclude` taken out:
 * before the sibling that stands there, after the last one and the rows under it, or right after the
 * parent without siblings. Rows of a list that are in tree order stay in tree order.
 */
export function listPosition<TRow>(list: RowList<TRow>, target: ListTarget, exclude: number) {
	const siblings = siblingsOf(list, target.parent, exclude);
	const index = Math.max(0, target.index);

	if (index < siblings.length) {
		return siblings[index];
	}

	const last = siblings.at(-1);

	if (last !== undefined) {
		return subtreeEnd(list, last, exclude) + 1;
	}

	const parent = target.parent === null ? -1 : positionOf(list, target.parent);

	return parent === -1 ? list.rows.length : parent + 1;
}

/** Whether two rows are the same: in a nested tree, apart from their children, which the changes rebuild. */
export function isSameRow<TRow>(list: RowList<TRow>, current: TRow, expected: TRow) {
	if (current === expected) {
		return true;
	}

	if (list.kind !== 'nested' || !isRecord(current) || !isRecord(expected)) {
		return false;
	}

	const ownNames = (row: Record<string, unknown>) => Object.keys(row).filter(name => name !== list.field);
	const names = ownNames(current);

	return names.length === ownNames(expected).length
		&& names.every(name => Object.hasOwn(expected, name) && Object.is(current[name], expected[name]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isSameList<TItem>(current: readonly TItem[], next: readonly TItem[]) {
	return current.length === next.length && current.every((item, index) => item === next[index]);
}

/**
 * Whether a row is under `parent` as it is: it names it, or for the top level it names itself or a
 * parent that is not a row, as the tree shows it.
 */
function namesParent<TRow>(list: RowList<TRow>, row: TRow, parent: string | null) {
	const named = list.readParent(row);

	if (named === parent) {
		return true;
	}

	return parent === null && named !== null && (named === list.getKey(row) || positionOf(list, named) === -1);
}

/** The row with its parent written in, when it is under another one. */
export function withParent<TRow>(list: RowList<TRow>, row: TRow, parent: string | null) {
	if (list.kind !== 'parents' || namesParent(list, row, parent)) {
		return row;
	}

	return list.writeParent(row, parent);
}

/** The parent a row stands under in the list: the one it names, or in a nested tree the one it goes to. */
function listParent<TRow>(list: RowList<TRow>, row: TRow, parent: string | null) {
	return list.kind === 'nested' ? parent : list.readParent(row);
}

/** Takes removed rows out of the arrays, before positions shift. */
export function compact<TRow>(list: RowList<TRow>) {
	if (list.removed.size === 0) {
		return;
	}

	const rows: TRow[] = [];
	const keys: string[] = [];
	const parents: (string | null)[] = [];

	list.rows.forEach((row, position) => {
		if (!list.removed.has(position)) {
			rows.push(row);
			keys.push(list.keys[position]);
			parents.push(list.parents[position]);
		}
	});

	list.rows = rows;
	list.keys = keys;
	list.parents = parents;
	list.removed.clear();
	list.positions = null;
	list.children = null;
}

/** Puts a row at the end of the list, which is last among the children of its parent. */
export function appendRow<TRow>(list: RowList<TRow>, row: TRow, parent: string | null) {
	list.changed = true;
	pushRow(list, row, listParent(list, row, parent));
}

/** Inserts a row at a position of a compacted list. */
export function insertAt<TRow>(list: RowList<TRow>, position: number, row: TRow, parent: string | null) {
	const key = list.getKey(row);

	list.rows.splice(position, 0, row);
	list.keys.splice(position, 0, key);
	list.parents.splice(position, 0, listParent(list, row, parent));
	list.positions = null;
	list.children = null;
	list.changed = true;

	if (list.kind === 'nested') {
		pushChildren(list, row, key);
	}
}

/** Moves a row of a compacted list from one position to another, counted before it is taken out. */
export function moveTo<TRow>(list: RowList<TRow>, from: number, to: number, row: TRow, parent: string | null) {
	const [key] = list.keys.splice(from, 1);
	const at = to > from ? to - 1 : to;

	list.rows.splice(from, 1);
	list.parents.splice(from, 1);
	list.rows.splice(at, 0, row);
	list.keys.splice(at, 0, key);
	list.parents.splice(at, 0, listParent(list, row, parent));
	list.positions = null;
	list.children = null;
	list.changed = true;
}

export function replaceAt<TRow>(list: RowList<TRow>, position: number, row: TRow) {
	list.rows[position] = row;
	list.changed = true;

	if (list.kind !== 'parents') {
		return;
	}

	const parent = list.readParent(row);

	if (parent !== list.parents[position]) {
		list.parents[position] = parent;
		list.children = null;
	}
}

/** Removes rows in place: other positions stay as they are until the list is compacted. */
export function removeAt<TRow>(list: RowList<TRow>, positions: readonly number[]) {
	for (const position of positions) {
		const key = list.keys[position];

		list.removed.add(position);

		if (list.positions?.get(key) === position) {
			list.positions.delete(key);
		}
	}

	list.changed = true;
}

/** The row at `position` with the children it has now, a copy when they changed. */
export function buildRow<TRow>(list: RowList<TRow>, position: number, children: Map<string | null, number[]>): TRow {
	const row = list.rows[position];
	const field = list.field;

	if (field === undefined) {
		return row;
	}

	const built: TRow[] = [];

	for (const child of children.get(list.keys[position]) ?? []) {
		if (isLive(list, child)) {
			built.push(buildRow(list, child, children));
		}
	}

	const current = getRowChildren(row, field);

	if (current === undefined ? built.length === 0 : isSameList(current, built)) {
		return row;
	}

	return { ...row, [field]: built };
}

/** The rows as the list holds them now: `rows` itself when nothing changed. */
export function finishRows<TRow>(list: RowList<TRow>, rows: readonly TRow[]): readonly TRow[] {
	if (!list.changed) {
		return rows;
	}

	compact(list);

	if (list.kind !== 'nested') {
		return isSameList(rows, list.rows) ? rows : list.rows;
	}

	const children = getChildIndex(list);
	const top = (children.get(null) ?? []).map(position => buildRow(list, position, children));

	return isSameList(rows, top) ? rows : top;
}
