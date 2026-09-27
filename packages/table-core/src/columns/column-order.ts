import type { ColumnOrder } from './column';

/** Whether every column that is not movable kept its position in `next`. */
export function keepsFixedColumns(columns: readonly ColumnOrder[], next: readonly ColumnOrder[]) {
	return columns.every((column, index) => column.movable || next[index]?.name === column.name);
}

/**
 * Moves column `name` before column `before`, or to the end with `null`. Returns `null` when the
 * column is missing or not movable, the target is missing, or nothing would change.
 */
export function moveColumn<TColumn extends ColumnOrder>(
	columns: readonly TColumn[],
	name: string,
	before: string | null,
): TColumn[] | null {
	const column = columns.find(item => item.name === name);

	if (!column?.movable || before === name) {
		return null;
	}

	const rest = columns.filter(item => item.name !== name);
	const toIndex = before === null ? rest.length : rest.findIndex(item => item.name === before);

	if (toIndex === -1) {
		return null;
	}

	const next = [...rest];

	next.splice(toIndex, 0, column);

	return next.every((item, index) => item === columns[index]) ? null : next;
}
