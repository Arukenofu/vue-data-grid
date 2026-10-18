import type { AddRowChange, RemoveRowChange, RowChange, RowChangeOptions, RowPlace, UpdateRowChange } from './row-changes';
import { createRowKeyResolver } from './row-key';
import { pushTo, warnDuplicateKey } from './row-list';
import { createParentKeyResolver } from './row-tree';

/** A change that says only what becomes of a row, not where it goes: what a stream sends most. */
type KeyedChange<TRow> = AddRowChange<TRow> | UpdateRowChange<TRow> | RemoveRowChange<TRow>;

/** What the changes of a batch did, without their undo. */
export interface KeyedBatch<TRow> {
	rows: readonly TRow[];
	applied: readonly RowChange<TRow>[];
	skipped: readonly RowChange<TRow>[];
}

/** What the changes so far made of one key. */
interface KeyState<TRow> {
	/** The row the key holds; `null` while it holds none. */
	current: { row: TRow } | null;
	/** The row stands where the row of the list stood. */
	inPlace: boolean;
	/** The index of the change that put the row at the end; `-1` when none did. */
	appendedAt: number;
	/** The position of the key's row in the list; `-1` for a key the list does not have. */
	position: number;
}

/** The neighbour a place names, `before` first; `null` for none. */
export function getNeighbour(place: RowPlace) {
	if (place.before !== undefined && place.before !== null) {
		return { key: place.before, after: false };
	}

	if (place.after !== undefined && place.after !== null) {
		return { key: place.after, after: true };
	}

	return null;
}

export function isUnplaced(place: RowPlace) {
	return getNeighbour(place) === null && place.parent === undefined && place.index === undefined;
}

function getKeyedChanges<TRow>(changes: readonly RowChange<TRow>[]) {
	const keyed: KeyedChange<TRow>[] = [];

	for (const change of changes) {
		if (change.type === 'move' || (change.type === 'add' && !isUnplaced(change))) {
			return null;
		}

		keyed.push(change);
	}

	return keyed;
}

function keyOf<TRow>(change: KeyedChange<TRow>, getKey: (row: TRow) => string) {
	return change.type === 'remove' ? change.key : getKey(change.row);
}

function listState<TRow>(row: TRow, position: number): KeyState<TRow> {
	return { current: { row }, inPlace: true, appendedAt: -1, position };
}

function absentState<TRow>(): KeyState<TRow> {
	return { current: null, inPlace: false, appendedAt: -1, position: -1 };
}

function isExpected<TRow>(state: KeyState<TRow>, expected: TRow | undefined) {
	return expected === undefined || state.current?.row === expected;
}

/** Applies one change to the state of its key, as `applyRowChanges` would in order: `false` when it is skipped. */
function step<TRow>(state: KeyState<TRow>, change: KeyedChange<TRow>, index: number) {
	switch (change.type) {
		case 'update':
			if (!state.current || !isExpected(state, change.expected)) {
				return false;
			}

			state.current = { row: change.row };

			return true;
		case 'remove':
			if (!state.current || !isExpected(state, change.expected)) {
				return false;
			}

			state.current = null;
			state.inPlace = false;
			state.appendedAt = -1;

			return true;
		case 'add':
			if (state.current) {
				if (change.existing !== 'replace') {
					return false;
				}

				state.current = { row: change.row };

				return true;
			}

			// A key the rows do not hold, or no longer hold, goes last, as an add without a place does.
			state.appendedAt = index;
			state.current = { row: change.row };

			return true;
		default: {
			const unknown: never = change;

			throw new Error(`[@vue-data-grid/engine] Unknown row change: ${String(unknown)}`);
		}
	}
}

/** Puts the row of a state where the row of the list stood, or leaves it out; whether it changed. */
function placeRow<TRow>(next: TRow[], row: TRow, state: KeyState<TRow>) {
	if (state.inPlace && state.current) {
		next.push(state.current.row);

		return state.current.row !== row;
	}

	return true;
}

/** Puts the rows the changes added at the end, in the order of their changes; whether there were any. */
function appendRows<TRow>(next: TRow[], states: Iterable<KeyState<TRow>>) {
	const appended: { at: number; row: TRow }[] = [];

	for (const state of states) {
		if (state.appendedAt !== -1 && state.current) {
			appended.push({ at: state.appendedAt, row: state.current.row });
		}
	}

	appended.sort((first, second) => first.at - second.at);

	for (const item of appended) {
		next.push(item.row);
	}

	return appended.length > 0;
}

/** The rows with every state in place, then the added ones: `rows` itself when nothing changed. */
function buildRows<TRow>(rows: readonly TRow[], keys: readonly string[], states: Map<string, KeyState<TRow>>) {
	const next: TRow[] = [];
	let changed = false;

	rows.forEach((row, position) => {
		const state = states.get(keys[position]);

		if (state?.position === position) {
			changed = placeRow(next, row, state) || changed;
		} else {
			next.push(row);
		}
	});

	changed = appendRows(next, states.values()) || changed;

	return changed ? next : rows;
}

function splitChanges<TRow>(changes: readonly RowChange<TRow>[], applied: readonly boolean[]) {
	return {
		applied: changes.filter((_change, index) => applied[index]),
		skipped: changes.filter((_change, index) => !applied[index]),
	};
}

/** The indexes of the changes of each key, in order. */
function groupByKey<TRow>(changes: readonly KeyedChange<TRow>[], getKey: (row: TRow) => string) {
	const byKey = new Map<string, number[]>();

	changes.forEach((change, index) => {
		pushTo(byKey, keyOf(change, getKey), index);
	});

	return byKey;
}

/**
 * The state of each key the changes name, from the first row with it; the keys of all rows by
 * position. The first row with a repeated key is the one changes reach, as in the tree.
 */
function readStates<TRow>(rows: readonly TRow[], getKey: (row: TRow) => string, named: ReadonlyMap<string, unknown>) {
	const keys: string[] = [];
	const states = new Map<string, KeyState<TRow>>();

	rows.forEach((row, position) => {
		const key = getKey(row);

		keys.push(key);

		if (!named.has(key)) {
			return;
		}

		if (states.has(key)) {
			warnDuplicateKey(key);
		} else {
			states.set(key, listState(row, position));
		}
	});

	return { keys, states };
}

/**
 * Changes of different keys do not touch each other in a list without subtrees: each key folds its
 * own changes in order, and the rows are walked twice with one lookup per row, as the queue of a
 * stream was before changes had places.
 */
function applyByKey<TRow>(rows: readonly TRow[], changes: readonly KeyedChange<TRow>[], getKey: (row: TRow) => string): KeyedBatch<TRow> {
	const byKey = groupByKey(changes, getKey);
	const states = new Map<string, KeyState<TRow>>();
	const applied = changes.map(() => false);
	const next: TRow[] = [];
	let changed = false;

	function fold(key: string, state: KeyState<TRow>) {
		for (const index of byKey.get(key) ?? []) {
			applied[index] = step(state, changes[index], index);
		}

		states.set(key, state);

		return state;
	}

	for (let position = 0; position < rows.length; position += 1) {
		const row = rows[position];
		const key = getKey(row);
		let state = byKey.has(key) ? states.get(key) : undefined;

		if (byKey.has(key) && state === undefined) {
			state = fold(key, listState(row, position));
		} else if (state !== undefined) {
			// The first row with a repeated key is the one changes reach, as in the tree.
			warnDuplicateKey(key);
		}

		if (state?.position === position) {
			changed = placeRow(next, row, state) || changed;
		} else {
			next.push(row);
		}
	}

	for (const key of byKey.keys()) {
		if (!states.has(key)) {
			fold(key, absentState());
		}
	}

	changed = appendRows(next, states.values()) || changed;

	return { rows: changed ? next : rows, ...splitChanges(changes, applied) };
}

/**
 * The rows under each parent, for removals in a tree by `parentKey`: built at the first removal from
 * the states of the keys so far, and kept up to date with the rows that come under a parent after it.
 */
function createSubtrees<TRow>(
	rows: readonly TRow[],
	keys: readonly string[],
	states: Map<string, KeyState<TRow>>,
	readParent: (row: TRow) => string | null,
) {
	// Positions of the rows of the list under each parent, and keys of the rows the changes added.
	let children: Map<string, number[]> | null = null;
	const added = new Map<string, string[]>();

	function getState(key: string, position: number) {
		let state = states.get(key);

		if (!state) {
			state = position === -1 ? absentState() : listState(rows[position], position);
			states.set(key, state);
		}

		return state;
	}

	/** Puts the row of a key under the parent it names now. */
	function track(key: string, state: KeyState<TRow>) {
		const parent = state.current && readParent(state.current.row);

		if (!children || parent === null || parent === key) {
			return;
		}

		if (state.inPlace) {
			pushTo(children, parent, state.position);
		} else {
			pushTo(added, parent, key);
		}
	}

	function build() {
		const index = new Map<string, number[]>();

		rows.forEach((row, position) => {
			const state = states.get(keys[position]);
			const current = state?.position === position ? state.current : { row };
			const parent = current && (state?.inPlace ?? true) ? readParent(current.row) : null;

			if (parent !== null && parent !== keys[position]) {
				pushTo(index, parent, position);
			}
		});

		children = index;

		for (const [key, state] of states) {
			if (state.appendedAt !== -1) {
				track(key, state);
			}
		}

		return index;
	}

	/** Removes the rows under `parent` that still name it, and the rows under them. */
	function removeUnder(parent: string) {
		const index = children ?? build();
		const under: { key: string; position: number }[] = [
			...(index.get(parent) ?? []).map(position => ({ key: keys[position], position })),
			...(added.get(parent) ?? []).map(key => ({ key, position: -1 })),
		];

		for (const { key, position } of under) {
			const state = getState(key, position);

			// An entry stays when its row moves to another parent: it counts only while the row names this one.
			if (state.current && readParent(state.current.row) === parent) {
				state.current = null;
				state.inPlace = false;
				state.appendedAt = -1;
				removeUnder(key);
			}
		}
	}

	return { getState, track, removeUnder };
}

/**
 * A removal in a tree by `parentKey` takes the rows under the row as they are at that change: the
 * changes go in order over the states of their keys, and the children come from one index of the
 * rows by parent, built at the first removal and kept up to date after it.
 */
function applyWithSubtrees<TRow>(
	rows: readonly TRow[],
	changes: readonly KeyedChange<TRow>[],
	getKey: (row: TRow) => string,
	readParent: (row: TRow) => string | null,
): KeyedBatch<TRow> {
	const { keys, states } = readStates(rows, getKey, groupByKey(changes, getKey));
	const subtrees = createSubtrees(rows, keys, states, readParent);
	const applied = changes.map(() => false);

	changes.forEach((change, index) => {
		const key = keyOf(change, getKey);
		const state = subtrees.getState(key, -1);
		const before = state.current;

		applied[index] = step(state, change, index);

		if (!applied[index]) {
			return;
		}

		if (change.type === 'remove') {
			subtrees.removeUnder(key);
		} else if (state.appendedAt === index || (before && readParent(before.row) !== readParent(change.row))) {
			subtrees.track(key, state);
		}
	});

	return { rows: buildRows(rows, keys, states), ...splitChanges(changes, applied) };
}

/**
 * A batch of changes that only say what becomes of rows by key — updates, removals and adds without
 * a place — applied in one pass over the rows, without the working list of `applyRowChanges`, to the
 * same rows it gives; `null` for any other batch, for a removal guarded by its subtree, and for a
 * nested tree.
 */
export function applyKeyedChanges<TRow>(
	rows: readonly TRow[],
	changes: readonly RowChange<TRow>[],
	options: RowChangeOptions<TRow>,
): KeyedBatch<TRow> | null {
	const keyed = getKeyedChanges(changes);

	if (!keyed || (options.parentKey === undefined && options.childrenField !== undefined)) {
		return null;
	}

	// A removal guarded by the rows under it needs them as they are at it.
	if (keyed.some(change => change.type === 'remove' && change.subtree !== undefined)) {
		return null;
	}

	const getKey = createRowKeyResolver(options.rowKey);

	if (options.parentKey === undefined || keyed.every(change => change.type !== 'remove')) {
		return applyByKey(rows, keyed, getKey);
	}

	return applyWithSubtrees(rows, keyed, getKey, createParentKeyResolver(options.parentKey));
}
