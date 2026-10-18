import {
	type ChangeHistoryOptions,
	type HistoryCellEditing,
	type HistoryRowEditing,
	useChangeHistory,
} from '@vue-data-grid/engine';
import { type MaybeRefOrGetter, type Ref, toValue, watch } from 'vue';

import { isComposing, isShortcutLetter } from '../keyboard/keys';

interface HistoryGridBase<TRow> {
	/** The grid element, where the keys are listened to. */
	root: Readonly<Ref<HTMLElement | null>>;
	/** The editing of cells whose commits are steps. */
	editing?: HistoryCellEditing<TRow>;
	/** The editing of rows whose commits are steps. */
	rowEditing?: HistoryRowEditing<TRow>;
}

/**
 * What undo and redo need of a grid: its `editing`, its `rowEditing` or both. The grid of
 * `useDataGrid` with either feature fits.
 */
export type HistoryGrid<TRow = unknown> =
	| (HistoryGridBase<TRow> & { editing: HistoryCellEditing<TRow> })
	| (HistoryGridBase<TRow> & { rowEditing: HistoryRowEditing<TRow> });

export interface GridHistoryOptions extends Omit<ChangeHistoryOptions, 'cells' | 'rows'> {
	/** `true` by default. */
	enabled?: MaybeRefOrGetter<boolean>;
}

function present<TItem>(item: TItem | undefined): item is TItem {
	return item !== undefined;
}

function isGridList<TRow>(grids: HistoryGrid<TRow> | readonly HistoryGrid<TRow>[]): grids is readonly HistoryGrid<TRow>[] {
	return Array.isArray(grids);
}

/**
 * Undo and redo of the grid's edits of cells and changes of rows with their keys: `useChangeHistory`
 * over its `editing` and `rowEditing`, and on a cell Ctrl+Z or ⌘+Z undoes, Ctrl+Y, Ctrl+Shift+Z or
 * ⌘+Shift+Z redoes. In an editor the keys stay the editor's, for its own text. Give it several grids,
 * such as the grids of a drag `group`, for one history they share: a row dropped from one on another
 * is then one step, and the keys of each undo it.
 */
export function useGridHistory<TRow = unknown>(grids: HistoryGrid<TRow> | readonly HistoryGrid<TRow>[], options: GridHistoryOptions = {}) {
	const { enabled, ...historyOptions } = options;
	const list = isGridList(grids) ? grids : [grids];
	const cells = list.map(grid => grid.editing).filter(present);
	const rows = list.map(grid => grid.rowEditing).filter(present);

	if (cells.length === 0 && rows.length === 0) {
		throw new Error(
			'[@vue-data-grid/core] useGridHistory() needs the `editing` or the `rowEditing` of the grid: add the `editing` '
			+ 'or `rowEditing` feature, or pass `useCellEditing()` or `useRowEditing()`.',
		);
	}

	const history = useChangeHistory<TRow>({ ...historyOptions, cells, rows });

	function isEnabled() {
		return toValue(enabled) ?? true;
	}

	/** What a key on a cell does to the history: `'undo'`, `'redo'` or nothing. */
	function getCommand(event: KeyboardEvent) {
		const onCell = event.target instanceof HTMLElement && event.target.hasAttribute('data-dg-column');

		if (!onCell || !(event.ctrlKey || event.metaKey) || event.altKey || event.defaultPrevented || isComposing(event)) {
			return null;
		}

		if (isShortcutLetter(event, 'z')) {
			return event.shiftKey ? 'redo' : 'undo';
		}

		return !event.shiftKey && isShortcutLetter(event, 'y') ? 'redo' : null;
	}

	function handleKeydown(event: KeyboardEvent) {
		const command = isEnabled() ? getCommand(event) : null;

		if (command === 'undo') {
			event.preventDefault();
			history.undo();
		} else if (command === 'redo') {
			event.preventDefault();
			history.redo();
		}
	}

	for (const grid of list) {
		watch(() => grid.root.value, (root, _previous, onCleanup) => {
			if (root) {
				root.addEventListener('keydown', handleKeydown, { capture: true });
				onCleanup(() => root.removeEventListener('keydown', handleKeydown, { capture: true }));
			}
		}, { immediate: true, flush: 'sync' });
	}

	return history;
}

/** Undo and redo of a grid as `useGridHistory` gives them. */
export type GridHistory<TRow = unknown> = ReturnType<typeof useGridHistory<TRow>>;
