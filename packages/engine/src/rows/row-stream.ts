import { isUnplaced } from './row-batch';
import type { AddRowChange, RemoveRowChange, RowChange, UpdateRowChange } from './row-changes';
import { type ChildrenField, getRowChildren } from './row-tree';

/**
 * All pending changes to one key in a run of changes by key, folded into what they make of it: of a
 * key that has a row when they apply, and of one that has none. Updates and removals reach only a
 * row that is there, and an add only a key that has none, so the two can differ.
 */
export interface QueuedRow<TRow> {
	/** What a key with a row ends with: `undefined` for the row it has, `null` for none. */
	present: TRow | null | undefined;
	/** What a key without a row ends with; `null` for none. */
	absent: TRow | null;
	/** A removal is among the changes: in a tree it takes the rows under the key too. */
	removes: boolean;
}

/**
 * Pending changes in order. A run of changes by key, updates, removals and adds without a place or a
 * guard, is one map that folds the changes of each key; a change with a place or a guard, a move or
 * an add at a place, stands alone, and the changes after it start a new run.
 */
export type RowQueue<TRow> = (Map<string, QueuedRow<TRow>> | RowChange<TRow>)[];

type KeyedChange<TRow> = AddRowChange<TRow> | UpdateRowChange<TRow> | RemoveRowChange<TRow>;

/** Whether a change joins a run by key: it says only what the row becomes, not where it goes or what it expects. */
function isKeyed<TRow>(change: RowChange<TRow>): change is KeyedChange<TRow> {
	switch (change.type) {
		case 'update':
			return change.expected === undefined;
		case 'remove':
			return change.expected === undefined && change.subtree === undefined;
		case 'add':
			return isUnplaced(change);
		case 'move':
			return false;
		default: {
			const unknown: never = change;

			throw new Error(`[@vue-data-grid/engine] Unknown row change: ${String(unknown)}`);
		}
	}
}

/** What a change makes of the pending changes of its key. */
function foldChange<TRow>(queued: QueuedRow<TRow>, change: KeyedChange<TRow>): QueuedRow<TRow> {
	switch (change.type) {
		case 'update':
			return {
				present: queued.present === null ? null : change.row,
				absent: queued.absent === null ? null : change.row,
				removes: queued.removes,
			};
		case 'remove':
			return { present: null, absent: null, removes: true };
		case 'add':
			if (change.existing === 'replace') {
				return { present: change.row, absent: change.row, removes: queued.removes };
			}

			return {
				present: queued.present === null ? change.row : queued.present,
				absent: queued.absent ?? change.row,
				removes: queued.removes,
			};
		default: {
			const unknown: never = change;

			throw new Error(`[@vue-data-grid/engine] Unknown row change: ${String(unknown)}`);
		}
	}
}

function getChangeKey<TRow>(change: KeyedChange<TRow>, getRowKey: (row: TRow) => string) {
	return change.type === 'remove' ? change.key : getRowKey(change.row);
}

/** Queues changes after the pending ones; changes by key fold into the last run. */
export function queueRowChanges<TRow>(
	queue: RowQueue<TRow>,
	changes: readonly RowChange<TRow>[],
	getRowKey: (row: TRow) => string,
) {
	for (const change of changes) {
		if (!isKeyed(change)) {
			queue.push(change);
			continue;
		}

		const last = queue.at(-1);
		const run = last instanceof Map ? last : new Map<string, QueuedRow<TRow>>();

		if (run !== last) {
			queue.push(run);
		}

		const key = getChangeKey(change, getRowKey);

		run.set(key, foldChange(run.get(key) ?? { present: undefined, absent: null, removes: false }, change));
	}
}

/**
 * The changes that make what a queued key ends with, in order: one change in most cases, and an
 * update then an add when a row that is there and a new one end differently.
 */
function getKeyChanges<TRow>(key: string, queued: QueuedRow<TRow>): RowChange<TRow>[] {
	const { present, absent } = queued;

	// A removal leaves both without a row, and only an add brings one back, to both.
	if (present === null) {
		return [{ type: 'remove', key }];
	}

	if (present === undefined) {
		return absent === null ? [] : [{ type: 'add', row: absent }];
	}

	if (absent === null) {
		return [{ type: 'update', row: present }];
	}

	if (absent === present) {
		return [{ type: 'add', row: present, existing: 'replace' }];
	}

	return [{ type: 'update', row: present }, { type: 'add', row: absent }];
}

/** The changes of a queue in order, for `applyRowChanges`. */
export function getQueuedChanges<TRow>(queue: RowQueue<TRow>) {
	const changes: RowChange<TRow>[] = [];

	for (const item of queue) {
		if (!(item instanceof Map)) {
			changes.push(item);
			continue;
		}

		for (const [key, queued] of item) {
			// A removal then an add takes the rows under the key in a tree: it stays in the batch.
			if (queued.removes && queued.present !== null) {
				changes.push({ type: 'remove', key });
			}

			changes.push(...getKeyChanges(key, queued));
		}
	}

	return changes;
}

/** A row of an index of rows by key, with the key of the row it is under in a nested tree. */
export interface IndexedRow<TRow> {
	row: TRow;
	/** The key of the row it is under in a nested tree; `null` at the top level and outside one. */
	parent: string | null;
}

/** Every row by key, the children of a nested tree included. */
export function indexRows<TRow>(rows: readonly TRow[], getRowKey: (row: TRow) => string, childrenField?: ChildrenField<TRow>) {
	const index = new Map<string, IndexedRow<TRow>>();

	function visit(list: readonly TRow[], parent: string | null) {
		for (const row of list) {
			const key = getRowKey(row);

			if (!index.has(key)) {
				index.set(key, { row, parent });
			}

			visit(getRowChildren(row, childrenField) ?? [], key);
		}
	}

	visit(rows, null);

	return index;
}
