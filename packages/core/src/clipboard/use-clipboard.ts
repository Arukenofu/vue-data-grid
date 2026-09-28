import { type CellEditSource, type CellRanges, type GridScope, type RangeTextOptions, toCsv } from '@vue-data-grid/engine';
import { type MaybeRefOrGetter, type Ref, toValue, watch } from 'vue';

import type { BodyCellFocus } from '../navigation/body-cell-focus';
import { TEXT_FIELD_SELECTOR } from '../pointer/controls';

/** What the clipboard needs of a grid; the grid of `useDataGrid` fits, with its features. */
export interface ClipboardGrid {
	scope: GridScope;
	/** The grid element: its `copy`, `cut` and `paste` events are listened to. */
	root: Readonly<Ref<HTMLElement | null>>;
	/** The cell ranges to copy; the `ranges` feature. */
	ranges?: Pick<CellRanges, 'getText'>;
	/** The navigation: without a range, the focused cell is copied. */
	navigation?: { cells: BodyCellFocus };
	/** The editing: with it, a cut clears what it copied and a paste writes into the cells. */
	editing?: ClipboardEditing;
}

/** What the clipboard needs of the editing; the `editing` feature fits. */
export interface ClipboardEditing {
	/** The cell being edited: its editor keeps the clipboard meanwhile. */
	cell: Readonly<Ref<unknown>>;
	/** Whether there are cells to paste over or clear. */
	hasSelection: () => boolean;
	paste: (text: string) => unknown;
	clear: (source: CellEditSource) => unknown;
}

export interface ClipboardOptions {
	/** Start the text with a line of column headers; `false` by default. */
	headers?: MaybeRefOrGetter<boolean>;
	/** Focus of the body cells, whose cell is copied when there is no range; the grid's navigation by default. */
	focus?: BodyCellFocus;
	/** `true` by default. */
	enabled?: MaybeRefOrGetter<boolean>;
}

/**
 * The clipboard of a grid, the one owner of its `copy`, `cut` and `paste` events. Ctrl+C or ⌘+C, and
 * Copy of the browser's menu, put the last cell range on the clipboard as tab-separated text through
 * each column's `format`, the way a spreadsheet pastes it; without a range, the focused cell. With the
 * editing, a cut clears the cells it copied, and a paste writes the clipboard's rows over the
 * selection. `copy()` copies from a button.
 *
 * The events write and read the clipboard at once and need no permission; `copy()` goes through
 * `navigator.clipboard`, which a browser allows from a click. The clipboard of a text field inside a
 * cell, an editor included, and of text selected in the grid, is left to the browser.
 */
export function useClipboard(grid: ClipboardGrid, options: ClipboardOptions = {}) {
	const { scope } = grid;
	const focus = options.focus ?? grid.navigation?.cells;

	function isEnabled() {
		return toValue(options.enabled) ?? true;
	}

	function getHeaders() {
		return toValue(options.headers) ?? false;
	}

	function getFocusedText() {
		const cell = focus?.focused.value;
		const column = cell ? scope.getColumn(cell.column)?.column : undefined;

		if (!cell || !column) {
			return '';
		}

		return toCsv({
			columns: [column],
			includeService: true,
			rows: [scope.rows.value[cell.index]],
			delimiter: '\t',
			headers: getHeaders(),
			escapeFormulas: false,
		});
	}

	/** What a copy puts on the clipboard now: the last range, else the focused cell; `''` for nothing. */
	function getText() {
		const text: RangeTextOptions = { headers: getHeaders() };
		const ranged = grid.ranges?.getText(text) ?? '';

		return ranged === '' ? getFocusedText() : ranged;
	}

	/**
	 * Copies through `navigator.clipboard`, such as from a button; `false` when there was nothing to
	 * copy, or the browser refused. Any other error is thrown.
	 */
	async function copy() {
		const text = getText();

		if (text === '' || typeof navigator === 'undefined' || !navigator.clipboard) {
			return false;
		}

		try {
			await navigator.clipboard.writeText(text);

			return true;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'NotAllowedError') {
				return false;
			}

			throw error;
		}
	}

	/** Whether the event is the browser's: in a text field, or with text selected in the grid. */
	function isBrowserClipboard(event: ClipboardEvent) {
		const root = grid.root.value;
		const selection = typeof document === 'undefined' ? null : document.getSelection();
		const selected = selection !== null && !selection.isCollapsed && root !== null && root.contains(selection.anchorNode);

		return selected || (event.target instanceof Element && event.target.closest(TEXT_FIELD_SELECTOR) !== null);
	}

	function isOurs(event: ClipboardEvent) {
		return isEnabled() && event.clipboardData !== null && !isBrowserClipboard(event) && (grid.editing?.cell.value ?? null) === null;
	}

	function handleCopy(event: ClipboardEvent) {
		const text = isOurs(event) ? getText() : '';

		if (text !== '') {
			event.preventDefault();
			event.clipboardData?.setData('text/plain', text);
		}
	}

	function handleCut(event: ClipboardEvent) {
		const { editing } = grid;
		const text = editing && isOurs(event) ? getText() : '';

		if (editing && text !== '') {
			event.preventDefault();
			event.clipboardData?.setData('text/plain', text);
			editing.clear('cut');
		}
	}

	function handlePaste(event: ClipboardEvent) {
		const { editing } = grid;
		const text = editing && isOurs(event) && editing.hasSelection() ? event.clipboardData?.getData('text/plain') ?? '' : '';

		// Without a selection the grid has nowhere to paste, and the paste stays the page's.
		if (editing && text !== '') {
			event.preventDefault();
			editing.paste(text);
		}
	}

	watch(() => grid.root.value, (root, _previous, onCleanup) => {
		if (!root) {
			return;
		}

		root.addEventListener('copy', handleCopy);
		root.addEventListener('cut', handleCut);
		root.addEventListener('paste', handlePaste);
		onCleanup(() => {
			root.removeEventListener('copy', handleCopy);
			root.removeEventListener('cut', handleCut);
			root.removeEventListener('paste', handlePaste);
		});
	}, { immediate: true, flush: 'sync' });

	return { copy, getText };
}

/** The clipboard of a grid as `useClipboard` gives it. */
export type GridClipboard = ReturnType<typeof useClipboard>;
