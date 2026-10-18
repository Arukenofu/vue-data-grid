import { computed, type MaybeRefOrGetter, onScopeDispose, shallowRef, toValue, watch } from 'vue';

import { applyRowChanges, type RowChange, type RowChangeOptions } from './row-changes';
import { createRowKeyResolver } from './row-key';
import { getQueuedChanges, type IndexedRow, indexRows, type QueuedRow, queueRowChanges, type RowQueue } from './row-stream';
import { createParentKeyResolver } from './row-tree';

export interface RowStreamOptions<TRow> extends RowChangeOptions<TRow> {
	/**
	 * A snapshot of rows. A new snapshot restarts the stream and drops pending changes, which were made
	 * against the old one.
	 */
	rows?: MaybeRefOrGetter<readonly TRow[]>;
	/**
	 * How long to collect changes, ms. Without it they are applied once per animation frame; a hidden
	 * tab has no frames, so changes collect until it is visible again: changes by key fold into one per
	 * key, while moves and adds at a place are kept one by one.
	 */
	wait?: MaybeRefOrGetter<number | undefined>;
}

/**
 * Rows updated by a stream: changes collect and are applied in one batch per frame, or per `wait`,
 * through `applyRowChanges`. Updates, removals and adds without a place fold by key, so a hot row
 * costs one change per batch; moves and adds at a place keep their order among them. A row no change
 * touched stays the same object, which `useSortedRows` with `delta` relies on. With `parentKey` or
 * `childrenField` the rows are a tree, as in `applyRowChanges`; `rowKey`, `parentKey`, `setParent`
 * and `childrenField` are read once.
 */
export function useRowStream<TRow>(options: RowStreamOptions<TRow>) {
	const getRowKey = createRowKeyResolver(options.rowKey);
	const readParent = options.parentKey === undefined ? null : createParentKeyResolver(options.parentKey);
	const childrenField = options.parentKey === undefined ? options.childrenField : undefined;
	const isTree = readParent !== null || childrenField !== undefined;
	const rows = shallowRef<readonly TRow[]>(toValue(options.rows) ?? []);
	const queue: RowQueue<TRow> = [];

	// The rows after the first `baseCount` items of the queue, which no later change alters: what
	// `getRow` reads, and what the next batch starts from. Each settled item is applied to it once.
	let base = rows.value;
	let baseCount = 0;
	let index: Map<string, IndexedRow<TRow>> | null = null;
	let cancel: (() => void) | null = null;

	function getIndex() {
		index ??= indexRows(base, getRowKey, childrenField);

		return index;
	}

	function getLastRun() {
		const last = queue.at(-1);

		return last instanceof Map ? last : undefined;
	}

	function countSettled() {
		return getLastRun() ? queue.length - 1 : queue.length;
	}

	function getParent(entry: IndexedRow<TRow>) {
		return readParent ? readParent(entry.row) : entry.parent;
	}

	/**
	 * Keeps the index in step with what a batch did, rather than build it again: by key in a flat list,
	 * and in a tree by `parentKey` while the batch neither removes nor moves, which reach rows it does
	 * not name.
	 */
	function syncIndex(applied: readonly RowChange<TRow>[]) {
		if (!index) {
			return;
		}

		const structural = applied.some(change => change.type === 'remove' || change.type === 'move');

		if (childrenField !== undefined || (readParent !== null && structural)) {
			index = null;

			return;
		}

		for (const change of applied) {
			if (change.type === 'remove') {
				index.delete(change.key);
			} else if (change.row !== undefined) {
				index.set(getRowKey(change.row), { row: change.row, parent: null });
			}
		}
	}

	function applyToBase(changes: readonly RowChange<TRow>[]) {
		const result = applyRowChanges(base, changes, options);

		base = result.rows;
		syncIndex(result.applied);
	}

	/** Applies the items of the queue that no later change alters to the base, once each. */
	function settle() {
		const settled = countSettled();

		if (baseCount < settled) {
			const changes = getQueuedChanges(queue.slice(baseCount, settled));

			baseCount = settled;
			applyToBase(changes);
		}
	}

	/** Applies pending changes now. */
	function flush() {
		cancel?.();
		cancel = null;

		if (queue.length === 0) {
			return;
		}

		// The queue is taken first: changes that throw are not tried again every frame.
		const changes = getQueuedChanges(queue.slice(baseCount));

		queue.length = 0;
		baseCount = 0;
		applyToBase(changes);

		if (base !== rows.value) {
			rows.value = base;
		}
	}

	function schedule() {
		if (cancel) {
			return;
		}

		const wait = toValue(options.wait);

		if (wait === undefined && typeof requestAnimationFrame === 'function') {
			const frame = requestAnimationFrame(flush);

			cancel = () => cancelAnimationFrame(frame);
		} else {
			const timer = setTimeout(flush, wait ?? 0);

			cancel = () => clearTimeout(timer);
		}
	}

	/** The row a key ends with after the last run: `undefined` for none. */
	function resolveQueued(settled: IndexedRow<TRow> | undefined, queued: QueuedRow<TRow> | undefined) {
		if (!queued) {
			return settled?.row;
		}

		if (!settled) {
			return queued.absent ?? undefined;
		}

		return queued.present === undefined ? settled.row : queued.present ?? undefined;
	}

	/** Whether a removal in the last run takes the row as one under a row it removes. */
	function isRemovedWithParent(entry: IndexedRow<TRow>, run: Map<string, QueuedRow<TRow>>) {
		const rowsByKey = getIndex();
		let parent = getParent(entry);

		// Parents that form a cycle end the walk.
		for (let steps = 0; parent !== null && steps < rowsByKey.size; steps += 1) {
			if (run.get(parent)?.removes) {
				return true;
			}

			const above = rowsByKey.get(parent);

			parent = above ? getParent(above) : null;
		}

		return false;
	}

	/**
	 * The row by key, including pending changes; `undefined` once removed, and for a pending `update`
	 * of a key that no row has, which the next batch drops.
	 */
	function getRow(key: string) {
		settle();

		const run = getLastRun();
		const settled = getIndex().get(key);
		const row = resolveQueued(settled, run?.get(key));

		if (row === undefined || !run || !isTree) {
			return row;
		}

		// By `parentKey` the parent is in the row as it ends; in a nested tree, where the index puts it.
		const entry = readParent || !settled ? { row, parent: null } : settled;

		return isRemovedWithParent(entry, run) ? undefined : row;
	}

	/** Queues changes for the next batch, after the pending ones. */
	function apply(changes: readonly RowChange<TRow>[]) {
		queueRowChanges(queue, changes, getRowKey);
		schedule();
	}

	/**
	 * Replaces the row with `{ ...previous, ...fields }`, so it suits plain-object rows only. `false`
	 * when there is no row with that key.
	 */
	function patch(key: string, fields: Partial<TRow>) {
		const previous = getRow(key);

		if (previous === undefined) {
			return false;
		}

		apply([{ type: 'update', row: { ...previous, ...fields } }]);

		return true;
	}

	function reset(next: readonly TRow[]) {
		cancel?.();
		cancel = null;
		queue.length = 0;
		base = next;
		baseCount = 0;
		index = null;
		rows.value = next;
	}

	if (options.rows !== undefined) {
		watch(() => toValue(options.rows) ?? [], reset);
	}

	onScopeDispose(() => cancel?.());

	return {
		/** The applied rows; a new array only when a batch changed something. */
		rows: computed(() => rows.value),
		apply,
		patch,
		flush,
		reset,
		getRow,
	};
}
