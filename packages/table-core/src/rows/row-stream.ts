export interface RowTransaction<TRow> {
	/** Rows with a new key are appended; a row with a known key replaces the old one in place. */
	add?: readonly TRow[];
	/** Rows that replace the ones with the same key; unknown keys are skipped. */
	update?: readonly TRow[];
	/** Keys of the rows to remove. */
	remove?: readonly string[];
}

/** All pending changes to one key: what the row becomes, and whether it may be added. */
export interface QueuedRow<TRow> {
	/** `null` when the row is removed. */
	row: TRow | null;
	/** The row came through `add`, so its key may be new. */
	add: boolean;
}

export type RowQueue<TRow> = Map<string, QueuedRow<TRow>>;

/** Queues a transaction on top of earlier changes to the same keys; the last change wins. */
export function queueTransaction<TRow>(
	queue: RowQueue<TRow>,
	transaction: RowTransaction<TRow>,
	getRowKey: (row: TRow) => string,
) {
	for (const row of transaction.add ?? []) {
		queue.set(getRowKey(row), { row, add: true });
	}

	for (const row of transaction.update ?? []) {
		const key = getRowKey(row);

		queue.set(key, { row, add: queue.get(key)?.add ?? false });
	}

	for (const key of transaction.remove ?? []) {
		queue.set(key, { row: null, add: false });
	}
}

/**
 * Rows after the queue. Untouched rows stay the same objects in the same places, and without any
 * change `rows` comes back as is.
 */
export function applyRowQueue<TRow>(rows: readonly TRow[], queue: RowQueue<TRow>, getRowKey: (row: TRow) => string) {
	if (queue.size === 0) {
		return rows;
	}

	const result: TRow[] = [];
	const seen = new Set<string>();
	let changed = false;

	for (const row of rows) {
		const key = getRowKey(row);
		const queued = queue.get(key);

		if (!queued) {
			result.push(row);
			continue;
		}

		seen.add(key);

		if (queued.row === null) {
			changed = true;
			continue;
		}

		changed ||= queued.row !== row;
		result.push(queued.row);
	}

	for (const [key, queued] of queue) {
		if (queued.add && queued.row !== null && !seen.has(key)) {
			result.push(queued.row);
			changed = true;
		}
	}

	return changed ? result : rows;
}
