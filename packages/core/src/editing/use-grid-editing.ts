import {
	type CellAddress,
	type CellEditingOptions,
	type CellEditSource,
	type CellEditStart,
	type CellGrid,
	type CellRanges,
	type EditingCell,
	getCellColumns,
	getRangeCells,
	type GridScope,
	parseDelimited,
	type RangeBounds,
	resolvePaste,
	type RuntimeColumn,
	useCellEditing,
} from '@vue-data-grid/engine';
import {
	type ComponentPublicInstance,
	type MaybeRefOrGetter,
	onScopeDispose,
	type Ref,
	shallowReadonly,
	shallowRef,
	toValue,
	useId,
	watch,
} from 'vue';

import type { CellContext, CellEditor, EditorContext, EditorMode, EditorMove } from '../columns/column-fields';
import { toElement } from '../components/primitive';
import { isComposing, isRtl } from '../keyboard/keys';
import type { BodyCellFocus } from '../navigation/body-cell-focus';
import { BODY_SECTION, readGridPosition } from '../navigation/grid-attributes';
import { CONTROL_SELECTOR } from '../pointer/controls';
import { textEditor } from './editors';

/** What editing needs of a grid; the grid of `useDataGrid` fits, with its features. */
export interface EditingGrid<TRow = unknown> {
	scope: GridScope<TRow>;
	/** The grid element, where the keys are listened to. */
	root: Readonly<Ref<HTMLElement | null>>;
	/** The navigation: its `cells` is the focus a commit moves. */
	navigation?: { cells: BodyCellFocus };
	/** The cell ranges: what Delete, a paste and Ctrl+Enter work on; without them, the focused cell. */
	ranges?: Pick<CellRanges, 'bounds' | 'grid' | 'selectBounds'>;
}

export interface GridEditingOptions<TRow = unknown> extends CellEditingOptions<TRow> {
	/**
	 * Focus of the body cells, which a commit moves as Enter and Tab say; the grid's navigation by
	 * default. Without either, focus goes back to the grid element.
	 */
	focus?: BodyCellFocus;
	/** The editor of an `editable` column without its own `editor`; `textEditor()` by default. */
	editor?: CellEditor;
	/**
	 * Where Enter goes after it saves: `'down'`, the default, as in a spreadsheet, `'right'`, or `'none'`
	 * to stay; Shift+Enter goes the other way. After Tab moved along a row, Enter goes down to the
	 * column where Tab started.
	 */
	enterMove?: 'down' | 'right' | 'none';
	/** `true` by default. */
	enabled?: MaybeRefOrGetter<boolean>;
}

/** Where a run of Tab started in its row, for Enter to go back to, and the cell it went to last. */
interface TabRun extends CellAddress {
	next: string;
}

const OPPOSITE_MOVES: Readonly<Record<EditorMove, EditorMove>> = {
	down: 'up',
	up: 'down',
	right: 'left',
	left: 'right',
	next: 'previous',
	previous: 'next',
	none: 'none',
};

const ARROW_MOVES: Readonly<Record<string, EditorMove>> = {
	ArrowDown: 'down',
	ArrowUp: 'up',
	ArrowRight: 'right',
	ArrowLeft: 'left',
};

const MIRRORED_MOVES: Readonly<Record<string, EditorMove>> = { right: 'left', left: 'right' };

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password']);

// Editors focused once: a render calls the ref again, and focus must not move the caret back.
const focusedEditors = new WeakSet<Element>();

function focusEditor(element: unknown) {
	if (!(element instanceof HTMLElement) || focusedEditors.has(element)) {
		return;
	}

	focusedEditors.add(element);
	element.focus({ preventScroll: true });

	// Typing that started editing goes on at the end of what was typed.
	if (element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(element.type))) {
		element.setSelectionRange(element.value.length, element.value.length);
	}
}

function isModified(event: KeyboardEvent) {
	return event.ctrlKey || event.metaKey || event.altKey;
}

/** Whether a key types a character: without Ctrl, ⌘ and Alt, or with AltGr, which types characters on some keyboards. */
function isCharacter(event: KeyboardEvent) {
	const altGraph = typeof event.getModifierState === 'function' && event.getModifierState('AltGraph');

	return /^.$/u.test(event.key) && event.key !== ' ' && (altGraph || !isModified(event));
}

function isSameCell(first: CellAddress, second: CellAddress) {
	return first.key === second.key && first.column === second.column;
}

/**
 * Editing the cells of a grid: `useCellEditing` with its keys and the grid's parts. On a cell,
 * Enter, F2 or a double click starts editing with the value, and a typed character starts it with
 * that character, in the `'quick'` mode, where the arrows save and go on, as in a spreadsheet;
 * Delete and Backspace clear the selected cells. `paste` writes rows of text over the selection, as a
 * spreadsheet lays them, and selects what it wrote; the clipboard feature calls it on a paste.
 *
 * `GridCells` renders the column's `editor` in the cell being edited, the `editor` option without
 * one; a column with `editor: false` is edited by a control of its cell through `write`. In the
 * editor Enter saves and goes down (`enterMove`), Shift+Enter up, Tab and Shift+Tab to the next or
 * the previous cell that can be edited, on to the next row at the end of one, Ctrl+Enter or ⌘+Enter
 * writes the draft into every selected cell, F2 switches the mode, Escape cancels, and leaving it
 * saves. Keys of an input method's composition are left to it. Call it in `setup`.
 */
export function useGridEditing<TRow = unknown>(grid: EditingGrid<TRow>, options: GridEditingOptions<TRow>) {
	const { editor: defaultEditor = textEditor(), enterMove, enabled, focus: givenFocus, ...editingOptions } = options;
	const { scope } = grid;
	const editing = useCellEditing(scope, editingOptions);
	const focus = givenFocus ?? grid.navigation?.cells;
	const mode = shallowRef<EditorMode>('full');
	const idPrefix = useId();
	let tabRun: TabRun | null = null;
	let sessions = 0;
	let errorId = '';
	// Elements of the editor outside its element, such as a calendar in a portal: given to `ownFocus`
	// for the editing session.
	const ownedElements = new Set<HTMLElement>();

	function isEnabled() {
		return toValue(enabled) ?? true;
	}

	/** The cells moves go across, and a selection counts in: the grid of the ranges, else the rows and data columns. */
	function getCellGrid(): CellGrid {
		return grid.ranges?.grid.value ?? {
			keys: scope.rowKeys.value,
			columns: getCellColumns(scope.columns.value).map(column => column.name),
		};
	}

	/** The editor of a column's cells; `null` for a column whose cells edit themselves, `editor: false`. */
	function getEditor(column: RuntimeColumn): CellEditor | null {
		if (column.editor === false) {
			return null;
		}

		return column.editor ?? defaultEditor;
	}

	function getColumnEditor(name: string) {
		const column = scope.getColumn(name)?.column;

		return column ? getEditor(column) : null;
	}

	/** What a character typed on a cell of the column does: the column's `typing`, else its editor's. */
	function getTyping(name: string) {
		const column = scope.getColumn(name)?.column;

		return column?.typing ?? getColumnEditor(name)?.typing ?? 'text';
	}

	function focusCell(cell: CellAddress) {
		if (focus) {
			focus.focus(cell);
		} else {
			grid.root.value?.focus({ preventScroll: true });
		}
	}

	/** The next or the previous cell along the rows, going on to the next row at the end of one. */
	function getNextCell(from: CellAddress, step: 1 | -1, cellGrid: CellGrid): CellAddress {
		const count = cellGrid.columns.length;
		const index = cellGrid.keys.indexOf(from.key) * count + cellGrid.columns.indexOf(from.column) + step;

		if (index < 0 || index >= cellGrid.keys.length * count) {
			return from;
		}

		return { key: cellGrid.keys[Math.floor(index / count)], column: cellGrid.columns[index % count] };
	}

	/** The cell a move goes to from a cell of row `index`, within `getCellGrid()`. */
	function getNeighbour(from: CellAddress & { index: number }, move: EditorMove): CellAddress {
		const cellGrid = getCellGrid();
		const { keys, columns } = cellGrid;
		const column = columns.indexOf(from.column);

		switch (move) {
			case 'down':
				return { key: keys[Math.min(from.index + 1, keys.length - 1)] ?? from.key, column: from.column };
			case 'up':
				return { key: keys[Math.max(from.index - 1, 0)] ?? from.key, column: from.column };
			case 'right':
				return { key: from.key, column: columns[Math.min(column + 1, columns.length - 1)] ?? from.column };
			case 'left':
				return { key: from.key, column: columns[Math.max(column - 1, 0)] ?? from.column };
			case 'next':
			case 'previous': {
				const step = move === 'next' ? 1 : -1;

				return editing.findEditable(from, step, cellGrid) ?? getNextCell(from, step, cellGrid);
			}
			case 'none':
				return from;
			default: {
				const unknown: never = move;

				throw new Error(`[@vue-data-grid/core] Unknown editor move: ${String(unknown)}`);
			}
		}
	}

	/** Commits the cell being edited and moves focus by `move`, to the cell itself by default; `false` while its draft is invalid. */
	function commit(move: EditorMove = 'none') {
		const cell = editing.cell.value;

		if (!cell) {
			return true;
		}

		if (!editing.commit()) {
			return false;
		}

		const run = tabRun?.key === cell.key && tabRun.next === cell.column ? tabRun : null;
		const from = { key: cell.key, index: cell.index, column: move === 'down' && run ? run.column : cell.column };
		const to = getNeighbour(from, move);

		tabRun = move === 'next' || move === 'previous'
			? { key: cell.key, column: run?.column ?? cell.column, next: to.column }
			: null;
		focusCell(to);

		return true;
	}

	/**
	 * Commits the cell being edited when focus leaves its editor for somewhere else, and leaves focus
	 * there: a click on another cell or outside the grid must not bring it back.
	 */
	function commitOnLeave() {
		tabRun = null;
		editing.commit();
	}

	/** Whether focus going to `target` stays in the editor: its element, or an element of `ownFocus`. */
	function isInEditor(target: EventTarget | null) {
		if (!(target instanceof Element)) {
			return false;
		}

		const input = target.closest('[data-dg-part="editor"]');

		if (input && grid.root.value?.contains(input)) {
			return true;
		}

		for (const element of ownedElements) {
			if (element.contains(target)) {
				return true;
			}
		}

		return false;
	}

	// `focusout` rather than `blur`: it bubbles, so an editor of several fields sees focus leave it,
	// not move between its fields.
	function leaveEditor(event: FocusEvent) {
		if (!isInEditor(event.relatedTarget)) {
			commitOnLeave();
		}
	}

	function ownFocus(value: Element | ComponentPublicInstance | null) {
		const element = toElement(value);

		if (element && !ownedElements.has(element)) {
			ownedElements.add(element);
			element.addEventListener('focusout', leaveEditor);
		}
	}

	function releaseOwnedElements() {
		for (const element of ownedElements) {
			element.removeEventListener('focusout', leaveEditor);
		}

		ownedElements.clear();
	}

	/** Ends editing without a write, and puts focus back on the cell. */
	function cancel() {
		const cell = editing.cell.value;

		editing.cancel();

		if (cell) {
			focusCell(cell);
		}
	}

	/** Puts focus back into the editor that stays open with an invalid draft, so that it is seen. */
	function focusOpenEditor() {
		grid.root.value?.querySelector<HTMLElement>('[data-dg-part="editor"]')?.focus();
	}

	/**
	 * Starts editing a cell with its value, or with `text` in the `'quick'` mode, as a typed character
	 * does, or with a `draft`. `false` when the cell cannot be edited, or the cell being edited cannot
	 * be committed; focus then goes back to its editor.
	 */
	function start(cell: CellAddress, init: CellEditStart = {}) {
		if (!editing.start(cell, init)) {
			focusOpenEditor();

			return false;
		}

		mode.value = init.text === undefined ? 'full' : 'quick';

		return true;
	}

	/** The focused body cell as bounds of `cellGrid`; `null` without one there. */
	function getFocusedBounds(cellGrid: CellGrid): RangeBounds | null {
		const cell = focus?.focused.value;
		const row = cell ? cellGrid.keys.indexOf(cell.key) : -1;
		const column = cell ? cellGrid.columns.indexOf(cell.column) : -1;

		return row === -1 || column === -1 ? null : { rowStart: row, rowEnd: row + 1, columnStart: column, columnEnd: column + 1 };
	}

	/** The selected cells as bounds of `cellGrid`: the ranges, else the focused cell. */
	function getSelection(cellGrid: CellGrid): readonly RangeBounds[] {
		const bounds = grid.ranges?.bounds.value ?? [];

		if (bounds.length > 0) {
			return bounds;
		}

		const focused = getFocusedBounds(cellGrid);

		return focused ? [focused] : [];
	}

	/** Whether there are cells to paste over or clear: the ranges, else the focused cell. */
	function hasSelection() {
		return getSelection(getCellGrid()).length > 0;
	}

	/**
	 * Writes the draft of the cell being edited into it and every selected cell as one commit, as
	 * Ctrl+Enter does in a spreadsheet: typed text through each column's `parse`, a value as it is.
	 * `false` while the draft is invalid.
	 */
	function fillSelection() {
		const cell = editing.cell.value;

		if (!cell || cell.error !== null) {
			return commit('none');
		}

		const cellGrid = getCellGrid();
		const cells = getRangeCells(getSelection(cellGrid), cellGrid);

		if (!cells.some(item => isSameCell(item, cell))) {
			cells.push({ key: cell.key, column: cell.column });
		}

		const { text, draft } = cell;

		editing.cancel();
		tabRun = null;

		if (text === undefined) {
			editing.write(cells.map(item => ({ ...item, value: draft })), 'edit');
		} else {
			editing.writeText(cells.map(item => ({ ...item, text })), 'edit');
		}

		focusCell(cell);

		return true;
	}

	/** Clears the selected cells: each gets the value of empty text, through its column's `parse`. */
	function clear(source: CellEditSource = 'clear') {
		const cellGrid = getCellGrid();

		return editing.writeText(getRangeCells(getSelection(cellGrid), cellGrid).map(cell => ({ ...cell, text: '' })), source);
	}

	/**
	 * Writes rows of tab-separated text, such as a spreadsheet puts on the clipboard, over the last
	 * range or the focused cell, as a spreadsheet lays them, and selects the cells it covers; `null`
	 * without a selection.
	 */
	function paste(text: string) {
		const cellGrid = getCellGrid();
		const target = getSelection(cellGrid).at(-1);

		if (!target) {
			return null;
		}

		const { writes, bounds } = resolvePaste(target, parseDelimited(text, { delimiter: '\t' }), cellGrid);

		if (bounds) {
			grid.ranges?.selectBounds(bounds);
		}

		return editing.writeText(writes, 'paste');
	}

	function getArrowMove(event: KeyboardEvent) {
		const move = ARROW_MOVES[event.key];

		return move && isRtl(grid.root.value) ? MIRRORED_MOVES[move] ?? move : move;
	}

	function getEnterMove(event: KeyboardEvent) {
		const forward = enterMove ?? 'down';

		return event.shiftKey ? OPPOSITE_MOVES[forward] : forward;
	}

	/** The key of an editor as a command of editing; `null` for a key the editor keeps. */
	function getEditorCommand(event: KeyboardEvent): (() => void) | null {
		const modified = event.ctrlKey || event.metaKey;

		if (event.key === 'Enter' && modified && !event.altKey) {
			return fillSelection;
		}

		if (event.key === 'Enter' && !isModified(event)) {
			return () => commit(getEnterMove(event));
		}

		if (event.key === 'Tab' && !isModified(event)) {
			return () => commit(event.shiftKey ? 'previous' : 'next');
		}

		if (event.key === 'Escape') {
			return cancel;
		}

		if (event.key === 'F2' && !isModified(event) && !event.shiftKey) {
			return () => {
				mode.value = mode.value === 'quick' ? 'full' : 'quick';
			};
		}

		const move = mode.value === 'quick' && !modified && !event.altKey && !event.shiftKey ? getArrowMove(event) : undefined;

		return move ? () => commit(move) : null;
	}

	// The editor's own keys come first and keep a key with `preventDefault`, as a list keeps ↑ and ↓.
	function handleEditorKeydown(event: KeyboardEvent) {
		const command = event.defaultPrevented || isComposing(event) ? null : getEditorCommand(event);

		if (command) {
			event.preventDefault();
			command();
		}
	}

	const inputProps = Object.freeze({
		'data-dg-part': 'editor',
		autocomplete: 'off',
		ref: focusEditor,
		onKeydown: handleEditorKeydown,
		onFocusout: leaveEditor,
	});

	// A new id for each editing session: an error message of one cell never answers for another.
	watch(() => editing.cell.value !== null && `${editing.cell.value.key}\u0000${editing.cell.value.column}`, (id) => {
		releaseOwnedElements();

		if (id) {
			sessions += 1;
			errorId = `${idPrefix}-editor-error-${sessions}`;
		}
	}, { flush: 'sync', immediate: true });

	onScopeDispose(releaseOwnedElements);

	/**
	 * What the editor of a cell renders from, while that cell is edited; `null` for any other cell.
	 * `GridCells` calls it for the cell being edited.
	 */
	function getEditorContext<TValue>(cell: CellContext<TRow, TValue>): EditorContext<TRow, TValue> | null {
		const current: EditingCell<TRow> | null = editing.cell.value;

		if (!current || !isSameCell(current, { key: cell.key, column: cell.column.name })) {
			return null;
		}

		const own = {
			'aria-label': cell.column.label ?? cell.column.name,
			'data-dg-state': mode.value,
		};

		return {
			...cell,
			mode: mode.value,
			// The draft is of the column's value, which the column's `setValue` and `parse` agree on.
			draft: current.draft as TValue,
			text: current.text,
			error: current.error,
			errorId,
			setDraft: editing.setDraft,
			setText: editing.setText,
			commit,
			cancel,
			ownFocus,
			inputProps: current.error === null
				? { ...inputProps, ...own }
				: { ...inputProps, ...own, 'aria-invalid': 'true', 'aria-describedby': errorId },
		};
	}

	/** The body cell a key or an event is on, when it is a cell itself rather than content inside it. */
	function readCell(target: EventTarget | null): CellAddress | null {
		const element = target instanceof HTMLElement && target.hasAttribute('data-dg-column') ? target : null;
		const position = element ? readGridPosition(element) : null;
		const key = position?.section === BODY_SECTION ? scope.rowKeys.value[position.row] : undefined;

		return position && key !== undefined ? { key, column: position.cell } : null;
	}

	/** Whether a key or a double click on the cell may start its editor. */
	function canStartEditor(cell: CellAddress) {
		return getColumnEditor(cell.column) !== null && editing.canEdit(cell);
	}

	/** The keys that start editing a cell: Enter, F2 and a character, by the column's `typing`. */
	function handleStartKey(event: KeyboardEvent, cell: CellAddress) {
		if (!canStartEditor(cell)) {
			return;
		}

		if ((event.key === 'Enter' || event.key === 'F2') && !isModified(event) && !event.shiftKey) {
			event.preventDefault();
			start(cell);
		} else if (isCharacter(event)) {
			event.preventDefault();
			start(cell, getTyping(cell.column) === 'value' ? {} : { text: event.key });
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		const cell = isEnabled() && !event.defaultPrevented && !isComposing(event) ? readCell(event.target) : null;

		if (!cell) {
			return;
		}

		if ((event.key === 'Delete' || event.key === 'Backspace') && !isModified(event)) {
			event.preventDefault();
			clear();
		} else {
			handleStartKey(event, cell);
		}
	}

	function handleDoubleClick(event: MouseEvent) {
		const target = event.target instanceof Element ? event.target : null;
		// A control in the cell keeps its double click, such as the toggle of a tree, pressed twice.
		const inControl = target?.closest(CONTROL_SELECTOR) !== null;
		const cell = isEnabled() && target && !inControl ? readCell(target.closest('[data-dg-column]')) : null;

		if (cell && canStartEditor(cell)) {
			start(cell);
		}
	}

	watch(() => grid.root.value, (root, _previous, onCleanup) => {
		if (!root) {
			return;
		}

		root.addEventListener('keydown', handleKeydown, { capture: true });
		root.addEventListener('dblclick', handleDoubleClick);
		onCleanup(() => {
			root.removeEventListener('keydown', handleKeydown, { capture: true });
			root.removeEventListener('dblclick', handleDoubleClick);
		});
	}, { immediate: true, flush: 'sync' });

	return {
		...editing,
		start,
		commit,
		cancel,
		/** How the editing in progress started: `'quick'` from a typed character, `'full'` otherwise; F2 switches. */
		mode: shallowReadonly(mode),
		getEditor,
		getEditorContext,
		hasSelection,
		fillSelection,
		clear,
		paste,
	};
}

/** Grid editing as `useGridEditing` gives it. */
export type GridEditing<TRow = unknown> = ReturnType<typeof useGridEditing<TRow>>;
