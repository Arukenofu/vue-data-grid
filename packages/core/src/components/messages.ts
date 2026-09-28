import type { SortDirection } from '@vue-data-grid/engine';
import { inject, type InjectionKey, provide } from 'vue';

/** One column of the sort, as an announcement names it. */
export interface SortMessageItem {
	/** The column's label, else its name. */
	label: string;
	direction: SortDirection;
}

/**
 * The strings of the grid's interface: accessible names of its controls, the empty and loading
 * states, and what it announces to screen readers. English by default; give `GridRoot` your own.
 */
export interface GridMessages {
	selectRow: string;
	selectAllRows: string;
	expandRow: string;
	collapseRow: string;
	expandGroup: (label: string) => string;
	collapseGroup: (label: string) => string;
	resizeColumn: (label: string) => string;
	/** The name of the drag handle of a row, from the name of the row. */
	dragRow: (label: string) => string;
	/** The width of a column as the screen reader says it. */
	columnWidth: (width: number) => string;
	empty: string;
	loading: string;
	/** The list of `selectEditor` when no choice matches what was typed. */
	noMatches: string;
	/** Announced when the sort changes; an empty list when the sort is cleared. */
	sorted: (sort: readonly SortMessageItem[]) => string;
	/** Announced when the number of selected rows changes. */
	selected: (count: number) => string;
}

const DIRECTIONS: Readonly<Record<SortDirection, string>> = { asc: 'ascending', desc: 'descending' };

export const DEFAULT_MESSAGES: GridMessages = Object.freeze({
	selectRow: 'Select row',
	selectAllRows: 'Select all rows',
	expandRow: 'Expand',
	collapseRow: 'Collapse',
	expandGroup: (label: string) => `Expand ${label}`,
	collapseGroup: (label: string) => `Collapse ${label}`,
	resizeColumn: (label: string) => `Resize ${label}`,
	dragRow: (label: string) => `Drag ${label}`,
	columnWidth: (width: number) => `${width} px`,
	empty: 'No rows',
	loading: 'Loading…',
	noMatches: 'No matches',
	sorted: (sort: readonly SortMessageItem[]) => (sort.length === 0
		? 'Not sorted'
		: `Sorted by ${sort.map(item => `${item.label} ${DIRECTIONS[item.direction]}`).join(', then ')}`),
	selected: (count: number) => (count === 1 ? '1 row selected' : `${count} rows selected`),
});

const MESSAGES: InjectionKey<GridMessages> = Symbol('@vue-data-grid/core messages');

/** Gives the parts below these messages, over the defaults. `GridRoot` calls it with its `messages`. */
export function createGridMessagesContext(messages: Partial<GridMessages> | undefined) {
	const resolved = messages ? { ...DEFAULT_MESSAGES, ...messages } : DEFAULT_MESSAGES;

	provide(MESSAGES, resolved);

	return resolved;
}

/** The messages of the grid a part is in; the defaults outside one. */
export function useGridMessagesContext(): GridMessages {
	return inject(MESSAGES, DEFAULT_MESSAGES);
}
