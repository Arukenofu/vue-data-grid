import { type CellEditing, type ChangeHistoryOptions, useChangeHistory } from '@vue-data-grid/engine';
import { type MaybeRefOrGetter, type Ref, toValue, watch } from 'vue';

import { isComposing, isShortcutLetter } from '../keyboard/keys';

/** What undo and redo need of a grid; the grid of `useDataGrid` fits, with its `editing`. */
export interface HistoryGrid<TRow = unknown> {
	/** The grid element, where the keys are listened to. */
	root: Readonly<Ref<HTMLElement | null>>;
	/** The editing whose commits are the steps. */
	editing: Pick<CellEditing<TRow>, 'lastCommit' | 'write'>;
}

export interface GridHistoryOptions extends ChangeHistoryOptions {
	/** `true` by default. */
	enabled?: MaybeRefOrGetter<boolean>;
}

/**
 * Undo and redo of the grid's edits with their keys: `useChangeHistory` over the editing, and on a
 * cell Ctrl+Z or ⌘+Z undoes, Ctrl+Y, Ctrl+Shift+Z or ⌘+Shift+Z redoes. In an editor the keys stay the
 * editor's, for its own text.
 */
export function useGridHistory<TRow = unknown>(grid: HistoryGrid<TRow>, options: GridHistoryOptions = {}) {
	const { enabled, ...historyOptions } = options;

	if (!grid.editing) {
		throw new Error('[@vue-data-grid/core] useGridHistory() needs the `editing` of the grid: add the `editing` feature, or pass `useCellEditing()`.');
	}

	const history = useChangeHistory(grid.editing, historyOptions);

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

	watch(() => grid.root.value, (root, _previous, onCleanup) => {
		if (root) {
			root.addEventListener('keydown', handleKeydown, { capture: true });
			onCleanup(() => root.removeEventListener('keydown', handleKeydown, { capture: true }));
		}
	}, { immediate: true, flush: 'sync' });

	return history;
}

/** Undo and redo of a grid as `useGridHistory` gives them. */
export type GridHistory<TRow = unknown> = ReturnType<typeof useGridHistory<TRow>>;
