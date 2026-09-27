import {
	type CellAddress,
	type CellMove,
	type FocusedCell,
	type GridPosition,
	type GridSection,
	resolveGridMove,
	type RowNode,
	type TableScope,
	useGridFocus,
} from '@vue-data-grid/core';
import { computed, type MaybeRefOrGetter, nextTick, toValue, watch } from 'vue';

import { isComposing, isRtl, isShortcutLetter } from '../keyboard/keys';
import type { BodyCellFocus } from './body-cell-focus';
import { BODY_SECTION, findGridCell, GRID_CELL_SELECTOR, GRID_ROW_SELECTOR, readGridPosition } from './grid-attributes';

export interface GridNavigationOptions {
	/**
	 * The `role="grid"` element with `tabindex="0"`: it takes focus first, and a key on it moves focus
	 * into a cell. Cells have `tabindex="-1"`.
	 */
	grid: MaybeRefOrGetter<HTMLElement | null>;
	/**
	 * A focusable element right after the grid, with `tabindex="0"`. Tab from a cell leaves the grid
	 * through it, and Shift+Tab from past the grid comes back into it.
	 */
	exit: MaybeRefOrGetter<HTMLElement | null>;
	/** Sections of the grid from the top, as `resolveGridMove` takes them. */
	sections: MaybeRefOrGetter<readonly GridSection[]>;
	/** The section whose rows are the rows of the scope, held by row key; `'body'` by default. */
	body?: string;
	/** The scroll container; the root of the scope by default. */
	scroller?: MaybeRefOrGetter<HTMLElement | null>;
	/** `true` by default. */
	enabled?: MaybeRefOrGetter<boolean>;
	/** Sticky blocks at the top and the bottom of the scroller: a cell under them is not in view. */
	stickyStart?: MaybeRefOrGetter<HTMLElement | null>;
	stickyEnd?: MaybeRefOrGetter<HTMLElement | null>;
	/**
	 * Space on a cell, such as selecting its row. A cell whose whole content is one checkbox or switch
	 * toggles it instead, as Enter does.
	 */
	onSpace?: (position: GridPosition, event: KeyboardEvent) => void;
	/**
	 * The tree of the body rows, `useRowTree()`: in the tree column → expands a collapsed group, ←
	 * collapses an expanded one and goes from a child row to its parent.
	 */
	tree?: GridNavigationTree;
	/**
	 * The column the keys of the tree work in: the column of `treeColumn()` by default, else the row
	 * header column.
	 */
	treeColumn?: MaybeRefOrGetter<string | undefined>;
	/** The row selection, `useRowSelection()`: Shift+Space toggles the row, Ctrl+A or ⌘+A selects all. */
	selection?: GridNavigationSelection;
	/** Ctrl+Space or ⌘+Space on a cell: select its column, such as with a cell range. */
	onSelectColumn?: (position: GridPosition, event: KeyboardEvent) => void;
	/** Focus landed on a cell: by a key, a pointer or `focusCell`. */
	onFocus?: (position: GridPosition) => void;
}

/** What the navigation needs of a tree; `useRowTree` fits. */
export interface GridNavigationTree {
	getNode: (key: string) => RowNode | undefined;
	isExpanded: (key: string) => boolean;
	setExpanded: (key: string, value: boolean) => void;
}

/** What the navigation needs of a row selection; `useRowSelection` fits. */
export interface GridNavigationSelection {
	toggle: (key: string) => void;
	setAll: (value: boolean) => void;
}

interface KeyMove {
	plain: CellMove;
	jump: CellMove;
	page?: boolean;
}

const KEY_MOVES: Readonly<Record<string, KeyMove>> = {
	ArrowLeft: { plain: 'left', jump: 'rowStart' },
	ArrowRight: { plain: 'right', jump: 'rowEnd' },
	ArrowUp: { plain: 'up', jump: 'columnStart' },
	ArrowDown: { plain: 'down', jump: 'columnEnd' },
	PageUp: { plain: 'up', jump: 'up', page: true },
	PageDown: { plain: 'down', jump: 'down', page: true },
	Home: { plain: 'rowStart', jump: 'first' },
	End: { plain: 'rowEnd', jump: 'last' },
};

const MIRRORED_KEYS: Readonly<Record<string, string>> = { ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' };

const ENTRY_KEYS = new Set([...Object.keys(KEY_MOVES), 'Enter']);

const RENDER_ATTEMPTS = 5;

/** `focusVisible` of the HTML standard, which not every typing of the DOM knows yet. */
interface VisibleFocusOptions extends FocusOptions {
	focusVisible?: boolean;
}

// A cell focused by a key or by `focusCell` shows its ring even when a click came last, such as a click
// on a button of the app that calls `focusCell`: the browser would take the focus for the pointer's.
const VISIBLE_FOCUS: VisibleFocusOptions = { preventScroll: true, focusVisible: true };

/** Content of a cell that Enter and F2 move into; `tabindex="-1"` inside is the cell's own furniture. */
const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]',
].map(selector => `${selector}:not([tabindex="-1"])`).join(', ');

const ACTIVATABLE_SELECTOR = [
	'a[href]',
	'button',
	'input[type="checkbox"]',
	'input[type="radio"]',
	'[role="button"]',
	'[role="link"]',
	'[role="checkbox"]',
	'[role="switch"]',
].join(', ');

/** Controls that Space toggles from their cell, as it would with focus on them. */
const TOGGLE_SELECTOR = 'input[type="checkbox"], [role="checkbox"], [role="switch"]';

/** Widgets that need arrow keys themselves: the navigation does not take focus out of them. */
const ARROW_OWNER_SELECTOR = [
	'[role="slider"]',
	'[role="separator"][tabindex]',
	'[role="spinbutton"]',
	'[role="combobox"]',
	'[role="listbox"]',
	'[role="menu"]',
	'[role="menubar"]',
	'[role="radiogroup"]',
	'[role="tablist"]',
	'[role="toolbar"]',
	'[role="tree"]',
	'[role="textbox"]',
].join(', ');

const TEXT_INPUT_TYPES = new Set([
	'text',
	'search',
	'email',
	'url',
	'tel',
	'password',
	'number',
	'date',
	'datetime-local',
	'month',
	'time',
	'week',
	'range',
	'radio',
]);

function ownsArrowKeys(element: HTMLElement) {
	if (element.isContentEditable || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
		return true;
	}

	if (element instanceof HTMLInputElement) {
		return TEXT_INPUT_TYPES.has(element.type);
	}

	return element.closest(ARROW_OWNER_SELECTOR) !== null;
}

function isFocusVisible(element: Element) {
	try {
		return element.matches(':focus-visible');
	} catch {
		return false;
	}
}

function nextFrame() {
	return new Promise<void>((resolve) => {
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => resolve());
		} else {
			setTimeout(resolve, 0);
		}
	});
}

/** The shift that brings `[from, to]` inside `[min, max]`; the start wins when both do not fit. */
function getShift(from: number, to: number, min: number, max: number) {
	if (from < min) {
		return from - min;
	}

	return to > max ? Math.min(to - max, from - min) : 0;
}

function isSamePosition(first: GridPosition, second: GridPosition) {
	return first.section === second.section && first.row === second.row && first.cell === second.cell;
}

/**
 * Keyboard navigation of a grid, from the header to the footer, in the WAI-ARIA grid pattern: arrows,
 * Home and End, PageUp and PageDown, Ctrl or ⌘ for the edges; Enter and F2 go into the content of a
 * cell and Escape comes back, while Enter and Space press a cell's only button or checkbox at once;
 * Tab leaves the grid rather than walking the buttons of its cells.
 *
 * Where focus is lives in `useGridFocus` of the core: it holds a body cell by row key, keeps the cell
 * rendered under the row and column windows and scrolls to it. The navigation reads the cell a key
 * comes from out of the attributes of `getGridRowAttributes` and `getGridCellAttributes`, moves DOM
 * focus with `element.focus()` once the cell is rendered, and brings it out from under sticky blocks
 * and pinned cells. Row templates should not read `focused`: DOM focus and `:focus-visible` do the
 * highlighting without waking the rows.
 */
export function useGridNavigation(scope: TableScope, options: GridNavigationOptions) {
	const body = options.body ?? BODY_SECTION;
	const focus = useGridFocus(scope, { sections: options.sections, body });
	// Focus goes to the grid or the exit to let Tab continue past the grid: that is leaving, not entering.
	let leaving = false;
	let request = 0;
	// Where focus was last put inside the grid: a removed row's cell gives its place to the next one.
	let lastPosition: GridPosition | null = null;

	function isEnabled() {
		return toValue(options.enabled) ?? true;
	}

	function getGrid() {
		return isEnabled() ? toValue(options.grid) : null;
	}

	function getScroller() {
		return toValue(options.scroller) ?? scope.root.value;
	}

	function getFirstPosition(): GridPosition | null {
		for (const section of toValue(options.sections)) {
			const cell = section.rows > 0 ? section.cells.find(item => !item.skip) : undefined;

			if (cell) {
				return { section: section.name, row: 0, cell: cell.key };
			}
		}

		return null;
	}

	async function findElement(position: GridPosition) {
		for (let attempt = 0; attempt < RENDER_ATTEMPTS; attempt += 1) {
			await nextTick();

			const grid = getGrid();
			const element = grid && findGridCell(grid, position);

			if (element) {
				return element;
			}

			await nextFrame();
		}

		return null;
	}

	function getStickyHeight(element: HTMLElement | null | undefined) {
		return element?.getBoundingClientRect().height ?? 0;
	}

	// `scrollIntoView` knows nothing about sticky blocks and pinned columns: a cell it "shows" ends up
	// under the header or a pinned column. The visible part is counted from them.
	function reveal(cell: HTMLElement) {
		const scroller = getScroller();
		const row = cell.closest(GRID_ROW_SELECTOR);

		if (!scroller || !row || typeof scroller.scrollBy !== 'function') {
			return;
		}

		const stickyStart = toValue(options.stickyStart);
		const stickyEnd = toValue(options.stickyEnd);
		const bounds = scroller.getBoundingClientRect();
		const rect = cell.getBoundingClientRect();
		const rtl = isRtl(scroller);
		const sticky = Boolean(stickyStart?.contains(row) || stickyEnd?.contains(row));
		let left = bounds.left;
		let right = bounds.right;

		for (const pinned of row.querySelectorAll('[data-tc-pinned]')) {
			const edge = pinned.getBoundingClientRect();

			if ((pinned.getAttribute('data-tc-pinned') === 'start') !== rtl) {
				left = Math.max(left, edge.right);
			} else {
				right = Math.min(right, edge.left);
			}
		}

		const top = sticky
			? 0
			: getShift(rect.top, rect.bottom, bounds.top + getStickyHeight(stickyStart), bounds.bottom - getStickyHeight(stickyEnd));
		const shift = cell.hasAttribute('data-tc-pinned') ? 0 : getShift(rect.left, rect.right, left, right);

		if (top !== 0 || shift !== 0) {
			scroller.scrollBy({ top, left: shift });
		}
	}

	/**
	 * Focuses a cell, rendering it first if it is outside the windows. Key repeat asks again before a
	 * cell arrives, so only the latest request wins. `false` when the grid has no such cell or it never
	 * rendered.
	 */
	async function focusCell(position: GridPosition) {
		request += 1;

		const current = request;

		// The model keeps the cell rendered and scrolls to it; the element comes with the next render.
		if (!focus.focus(position)) {
			return false;
		}

		const element = await findElement(position);

		if (!element || current !== request) {
			return false;
		}

		element.focus(VISIBLE_FOCUS);
		reveal(element);

		return true;
	}

	async function enter() {
		const cell = focus.focused.value;
		const position = cell ? { section: cell.section, row: cell.row, cell: cell.cell } : getFirstPosition();

		if (position) {
			await focusCell(position);
		}
	}

	function leave(backward: boolean) {
		const guard = toValue(backward ? options.grid : options.exit);

		if (!guard) {
			return;
		}

		leaving = true;
		guard.focus({ preventScroll: true });
		leaving = false;
	}

	// A page of body rows by their heights, from the core: from the header the first page down, from the
	// footer the last page up.
	function getPageStep(current: GridPosition, move: CellMove) {
		const direction = move === 'up' ? 'up' : 'down';

		if (current.section === body) {
			return scope.getPageStep(current.row, direction);
		}

		return scope.getPageStep(direction === 'up' ? Math.max(scope.rows.value.length - 1, 0) : 0, direction);
	}

	function resolveTarget(event: KeyboardEvent, current: GridPosition) {
		const keyMove = KEY_MOVES[isGridRtl() ? MIRRORED_KEYS[event.key] ?? event.key : event.key];

		if (!keyMove || event.altKey) {
			return null;
		}

		const move = event.ctrlKey || event.metaKey ? keyMove.jump : keyMove.plain;

		return resolveGridMove(toValue(options.sections), current, move, keyMove.page ? getPageStep(current, move) : 1);
	}

	/** The one control of a cell that holds nothing else to focus; `null` for none or several. */
	function getOnlyControl(cell: HTMLElement) {
		const controls = cell.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

		return controls.length === 1 ? controls[0] : null;
	}

	/**
	 * A cell whose whole content is one link or button acts as it: Enter presses it at once. Several
	 * controls, or one that takes input, get focus instead, as F2 does.
	 */
	function enterCell(event: KeyboardEvent, cell: HTMLElement) {
		const first = cell.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);

		if (!first) {
			return;
		}

		event.preventDefault();

		const only = event.key === 'Enter' ? getOnlyControl(cell) : null;

		if (only?.matches(ACTIVATABLE_SELECTOR)) {
			only.click();
		} else {
			first.focus();
		}
	}

	function isGridRtl() {
		return isRtl(getGrid());
	}

	function hasModifier(event: KeyboardEvent) {
		return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
	}

	function getTreeColumn() {
		const shown = scope.columns.value;

		return toValue(options.treeColumn)
			?? shown.find(item => item.column?.tree)?.column?.name
			?? shown.find(item => item.rowHeader)?.column?.name;
	}

	/** → and ← in the tree column; `true` when the key did something of the tree. */
	function handleTreeKey(event: KeyboardEvent, current: GridPosition) {
		const { tree } = options;

		if (!tree || current.section !== body || hasModifier(event) || current.cell !== getTreeColumn()) {
			return false;
		}

		const key = scope.rowKeys.value[current.row];
		const node = key === undefined ? undefined : tree.getNode(key);

		if (key === undefined || !node) {
			return false;
		}

		const logical = isGridRtl() ? MIRRORED_KEYS[event.key] ?? event.key : event.key;
		const expanded = node.group && tree.isExpanded(key);

		if (logical === 'ArrowRight' && node.group && !expanded) {
			tree.setExpanded(key, true);

			return true;
		}

		if (logical === 'ArrowLeft' && expanded) {
			tree.setExpanded(key, false);

			return true;
		}

		const parent = logical === 'ArrowLeft' && node.parent !== null ? scope.getRowIndex(node.parent) : -1;

		if (parent !== -1) {
			void focusCell({ section: body, row: parent, cell: current.cell });

			return true;
		}

		return false;
	}

	/**
	 * Space, with Shift for the row and with Ctrl or ⌘ for the column. Alone it toggles the cell's only
	 * checkbox, as it would with focus on the checkbox.
	 */
	function handleSpace(event: KeyboardEvent, cell: HTMLElement, current: GridPosition) {
		const key = current.section === body ? scope.rowKeys.value[current.row] : undefined;

		if (event.shiftKey) {
			if (key !== undefined) {
				options.selection?.toggle(key);
			}
		} else if (event.ctrlKey || event.metaKey) {
			options.onSelectColumn?.(current, event);
		} else {
			const only = getOnlyControl(cell);

			if (only?.matches(TOGGLE_SELECTOR)) {
				only.click();
			} else {
				options.onSpace?.(current, event);
			}
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		const { target } = event;
		const grid = getGrid();

		if (!(target instanceof HTMLElement) || !grid || event.defaultPrevented || isComposing(event)) {
			return;
		}

		if (event.key === 'Escape') {
			const cell = target.closest<HTMLElement>(GRID_CELL_SELECTOR);

			if (cell && cell !== target && grid.contains(cell)) {
				event.preventDefault();
				cell.focus();
			}

			return;
		}

		if (event.key === 'Tab') {
			if (!event.altKey && !event.ctrlKey && !event.metaKey && (target === grid || target.matches(GRID_CELL_SELECTOR))) {
				leave(event.shiftKey);
			}

			return;
		}

		if (target === grid) {
			if (ENTRY_KEYS.has(event.key)) {
				event.preventDefault();
				void enter();
			}

			return;
		}

		const isCell = target.matches(GRID_CELL_SELECTOR);
		const cell = isCell ? target : target.closest<HTMLElement>(GRID_CELL_SELECTOR);
		const current = cell && readGridPosition(cell);

		if (!cell || !current) {
			return;
		}

		// From a button, a link or a checkbox inside a cell the arrows move through the grid, as from the
		// cell itself; Enter and Space stay theirs. F2 is a switch: from the content it returns to the cell.
		// On the cell, Enter presses its only button or checkbox and Space its only checkbox.
		if (!isCell) {
			if (event.key === 'F2') {
				event.preventDefault();
				cell.focus();

				return;
			}

			if (ownsArrowKeys(target)) {
				return;
			}
		} else if (event.key === 'Enter' || event.key === 'F2') {
			enterCell(event, target);

			return;
		} else if (event.key === ' ') {
			event.preventDefault();
			handleSpace(event, target, current);

			return;
		} else if ((event.ctrlKey || event.metaKey) && !event.altKey && isShortcutLetter(event, 'a') && options.selection) {
			event.preventDefault();
			options.selection.setAll(true);

			return;
		} else if (handleTreeKey(event, current)) {
			event.preventDefault();

			return;
		}

		const next = resolveTarget(event, current);

		if (next) {
			event.preventDefault();

			if (!isSamePosition(next, current)) {
				void focusCell(next);
			}
		}
	}

	function setTabbable(tabbable: boolean) {
		const index = tabbable ? 0 : -1;
		const grid = toValue(options.grid);
		const exit = toValue(options.exit);

		if (grid) {
			grid.tabIndex = index;
		}

		if (exit) {
			exit.tabIndex = index;
		}
	}

	// While focus is inside, the grid and the exit leave the tab order: otherwise Shift+Tab from the
	// first cell would stop at the grid, and an arrow there would bring focus back into the cell.
	function handleFocusIn(event: FocusEvent) {
		const grid = getGrid();
		const { target, relatedTarget } = event;

		if (!grid || !(target instanceof HTMLElement)) {
			return;
		}

		if (target === grid) {
			const fromInside = relatedTarget instanceof Node && grid.contains(relatedTarget);

			if (!leaving && !fromInside && isFocusVisible(grid)) {
				void enter();
			}

			return;
		}

		setTabbable(false);

		// Focus on a control inside a cell, such as a click on its checkbox, puts the model on that cell
		// too, so the cell stays rendered while focus is in it.
		const isCell = target.matches(GRID_CELL_SELECTOR);
		const cell = isCell ? target : target.closest<HTMLElement>(GRID_CELL_SELECTOR);
		const position = cell && grid.contains(cell) ? readGridPosition(cell) : null;

		if (position) {
			lastPosition = position;
			focus.focus(position, { reveal: false });

			if (isCell) {
				options.onFocus?.(position);
			}
		}
	}

	function handleFocusOut(event: FocusEvent) {
		const grid = getGrid();
		const next = event.relatedTarget;

		if (grid && !(next instanceof Node && grid.contains(next))) {
			setTabbable(true);
		}
	}

	// The exit is reached two ways. Shift+Tab from past the grid enters it: focus goes into a cell. Tab
	// from the last control inside a cell returns to that cell, or focus would hang out of sight.
	function handleExitFocus(event: FocusEvent) {
		if (leaving) {
			return;
		}

		const grid = getGrid();
		const from = event.relatedTarget instanceof Element
			? event.relatedTarget.closest<HTMLElement>(GRID_CELL_SELECTOR)
			: null;

		if (from && grid?.contains(from)) {
			from.focus();
		} else {
			void enter();
		}
	}

	function listen<TEvent extends Event>(
		getTarget: () => HTMLElement | null,
		type: string,
		handler: (event: TEvent) => void,
	) {
		watch(getTarget, (target, _previous, onCleanup) => {
			if (!target) {
				return;
			}

			const listener = handler as EventListener;

			target.addEventListener(type, listener);
			onCleanup(() => target.removeEventListener(type, listener));
		}, { immediate: true, flush: 'sync' });
	}

	/** The focused cell, or the cell that now stands where a removed one was. */
	function getRestorePosition(): GridPosition | null {
		const cell = focus.focused.value;

		if (cell) {
			return { section: cell.section, row: cell.row, cell: cell.cell };
		}

		const was = lastPosition;
		const section = was ? toValue(options.sections).find(item => item.name === was.section) : undefined;

		if (!was || !section || section.rows === 0 || section.cells.length === 0) {
			return null;
		}

		const cellKey = section.cells.some(item => item.key === was.cell) ? was.cell : section.cells[0].key;

		return { section: section.name, row: Math.min(was.row, section.rows - 1), cell: cellKey };
	}

	// Vue moves a keyed row, or a cell of a moved column, by taking it out of the document, and the
	// browser drops focus from it to the page; a removed row takes focus with it. Focus that was inside
	// the grid before the rows or the columns changed comes back after the render, without scrolling.
	let hadFocus = false;

	watch([scope.rowKeys, scope.columns], () => {
		const grid = getGrid();
		const active = typeof document === 'undefined' ? null : document.activeElement;

		hadFocus = grid !== null && active !== grid && grid.contains(active);
	}, { flush: 'pre' });

	watch([scope.rowKeys, scope.columns], async () => {
		const grid = getGrid();

		if (!hadFocus || !grid || grid.contains(document.activeElement)) {
			hadFocus = false;

			return;
		}

		hadFocus = false;

		const position = getRestorePosition();

		if (!position || !focus.focus(position, { reveal: false })) {
			return;
		}

		const element = await findElement(position);

		if (element && !grid.contains(document.activeElement)) {
			element.focus({ preventScroll: true });
		}
	}, { flush: 'post' });

	listen(getGrid, 'keydown', handleKeyDown);
	listen(getGrid, 'focusin', handleFocusIn);
	listen(getGrid, 'focusout', handleFocusOut);
	listen(() => (isEnabled() ? toValue(options.exit) : null), 'focus', handleExitFocus);

	const bodyFocused = computed<FocusedCell | null>(() => {
		const cell = focus.focused.value;

		return cell?.section === body && cell.key !== undefined ? { key: cell.key, column: cell.cell, index: cell.row } : null;
	});

	/** Focus of the body cells by address, for what works on cells: range selection, editing, the clipboard. */
	const cells: BodyCellFocus = {
		focused: bodyFocused,
		focus: (cell: CellAddress) => {
			const row = scope.getRowIndex(cell.key);

			return row !== -1 && focusCell({ section: body, row, cell: cell.column });
		},
	};

	return {
		focusCell,
		/**
		 * The cell focus is on, or was on when it left the grid, with the row key of a body cell; `null`
		 * once its row or column is gone. Reactive: read it outside the row templates.
		 */
		focused: focus.focused,
		cells,
	};
}

/** The grid navigation as `useGridNavigation` gives it. */
export type GridNavigation = ReturnType<typeof useGridNavigation>;
