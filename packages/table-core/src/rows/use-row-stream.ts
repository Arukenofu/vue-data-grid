import { computed, type MaybeRefOrGetter, onScopeDispose, shallowRef, toValue, watch } from 'vue';

import { createRowKeyResolver, type RowKey } from './row-key';
import { applyRowQueue, queueTransaction, type RowQueue, type RowTransaction } from './row-stream';

export interface RowStreamOptions<TRow> {
	/**
	 * A snapshot of rows. A new snapshot restarts the stream and drops pending changes, which were made
	 * against the old one.
	 */
	rows?: MaybeRefOrGetter<readonly TRow[]>;
	rowKey: RowKey<TRow>;
	/**
	 * How long to collect changes, ms. Without it they are applied once per animation frame; a hidden
	 * tab has no frames, so changes collect, one per key, until it is visible again.
	 */
	wait?: MaybeRefOrGetter<number | undefined>;
}

/**
 * Rows updated by a stream: changes collect and are applied in one batch per frame, or per `wait`. A
 * row no change touched stays the same object, which `useSortedRows` with `delta` relies on.
 */
export function useRowStream<TRow>(options: RowStreamOptions<TRow>) {
	const getRowKey = createRowKeyResolver(options.rowKey);
	const rows = shallowRef<readonly TRow[]>(toValue(options.rows) ?? []);
	const queue: RowQueue<TRow> = new Map();

	let byKey: Map<string, TRow> | null = null;
	let cancel: (() => void) | null = null;

	function getIndex() {
		byKey ??= new Map(rows.value.map(row => [getRowKey(row), row]));

		return byKey;
	}

	function syncIndex() {
		if (!byKey) {
			return;
		}

		for (const [key, queued] of queue) {
			if (queued.row === null) {
				byKey.delete(key);
			} else if (queued.add || byKey.has(key)) {
				byKey.set(key, queued.row);
			}
		}
	}

	/** Applies pending changes now. */
	function flush() {
		cancel?.();
		cancel = null;

		const next = applyRowQueue(rows.value, queue, getRowKey);

		syncIndex();
		queue.clear();

		if (next !== rows.value) {
			rows.value = next;
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

	/**
	 * The row by key, including pending changes; `undefined` once removed, and for a pending `update`
	 * of a key that no row has, which the next batch drops.
	 */
	function getRow(key: string) {
		const queued = queue.get(key);

		if (!queued) {
			return getIndex().get(key);
		}

		return queued.row !== null && (queued.add || getIndex().has(key)) ? queued.row : undefined;
	}

	function apply(transaction: RowTransaction<TRow>) {
		queueTransaction(queue, transaction, getRowKey);
		schedule();
	}

	/**
	 * Replaces the row with `{ ...previous, ...fields }`, so it suits plain-object rows only. `false`
	 * when there is no row with that key.
	 */
	function patch(key: string, fields: Partial<TRow>) {
		const base = getRow(key);

		if (base === undefined) {
			return false;
		}

		queue.set(key, { row: { ...base, ...fields }, add: queue.get(key)?.add ?? false });
		schedule();

		return true;
	}

	function reset(next: readonly TRow[]) {
		cancel?.();
		cancel = null;
		queue.clear();
		byKey = null;
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
