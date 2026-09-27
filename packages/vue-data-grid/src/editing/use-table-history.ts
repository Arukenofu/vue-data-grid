import { type CellEditing, type ChangeHistoryOptions, useChangeHistory } from '@vue-data-grid/core';
import { type MaybeRefOrGetter, type Ref, toValue, watch } from 'vue';

import { isComposing, isShortcutLetter } from '../keyboard/keys';

/** What undo and redo need of a table; the table of `useDataTable` fits, with its `editing`. */
export interface HistoryTable<TRow = unknown> {
	/** The table element, where the keys are listened to. */
	root: Readonly<Ref<HTMLElement | null>>;
	/** The editing whose commits are the steps. */
	editing: Pick<CellEditing<TRow>, 'lastCommit' | 'write'>;
}

export interface TableHistoryOptions extends ChangeHistoryOptions {
	/** `true` by default. */
	enabled?: MaybeRefOrGetter<boolean>;
}

/**
 * Undo and redo of the table's edits with their keys: `useChangeHistory` over the editing, and on a
 * cell Ctrl+Z or ⌘+Z undoes, Ctrl+Y, Ctrl+Shift+Z or ⌘+Shift+Z redoes. In an editor the keys stay the
 * editor's, for its own text.
 */
export function useTableHistory<TRow = unknown>(table: HistoryTable<TRow>, options: TableHistoryOptions = {}) {
	const { enabled, ...historyOptions } = options;

	if (!table.editing) {
		throw new Error('[vue-data-grid] useTableHistory() needs the `editing` of the table: add the `editing` feature, or pass `useCellEditing()`.');
	}

	const history = useChangeHistory(table.editing, historyOptions);

	function isEnabled() {
		return toValue(enabled) ?? true;
	}

	/** What a key on a cell does to the history: `'undo'`, `'redo'` or nothing. */
	function getCommand(event: KeyboardEvent) {
		const onCell = event.target instanceof HTMLElement && event.target.hasAttribute('data-tc-column');

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

	watch(() => table.root.value, (root, _previous, onCleanup) => {
		if (root) {
			root.addEventListener('keydown', handleKeydown, { capture: true });
			onCleanup(() => root.removeEventListener('keydown', handleKeydown, { capture: true }));
		}
	}, { immediate: true, flush: 'sync' });

	return history;
}

/** Undo and redo of a table as `useTableHistory` gives them. */
export type TableHistory<TRow = unknown> = ReturnType<typeof useTableHistory<TRow>>;
