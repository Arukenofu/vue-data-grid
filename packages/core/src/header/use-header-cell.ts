import type { TableScope } from '@vue-data-grid/engine';
import { getCurrentScope, nextTick, onScopeDispose } from 'vue';

import { isRtl } from '../keyboard/keys';

export interface HeaderCellOptions {
	/** How far Shift+←/→ changes the width, px; `16` by default. */
	resizeStep?: number;
}

/** The handlers of a column header cell, as `getHandlers` gives them. */
export interface HeaderCellHandlers {
	onClick: (event: MouseEvent) => void;
	onKeydown: (event: KeyboardEvent) => void;
	onKeyup: () => void;
	onFocusout: () => void;
}

const DEFAULT_RESIZE_STEP = 16;

const HORIZONTAL_STEPS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };

/** Controls inside a header cell whose clicks are their own, such as a menu button or a checkbox. */
const CONTROL_SELECTOR = [
	'a[href]',
	'button',
	'input',
	'label',
	'select',
	'textarea',
	'[role="button"]',
	'[role="checkbox"]',
	'[role="menuitem"]',
	'[role="separator"]',
	'[role="switch"]',
	'[tabindex]:not([tabindex="-1"])',
].join(', ');

function hasOnly(event: KeyboardEvent, modifier: 'alt' | 'shift') {
	return event.altKey === (modifier === 'alt')
		&& event.shiftKey === (modifier === 'shift')
		&& !event.ctrlKey
		&& !event.metaKey;
}

/** `1` toward the inline end, `-1` toward the start: ← and → swap in a right-to-left table. */
function getInlineStep(event: KeyboardEvent) {
	const step = HORIZONTAL_STEPS[event.key];

	if (step === undefined) {
		return undefined;
	}

	const element = event.currentTarget instanceof Element ? event.currentTarget : null;

	return isRtl(element) ? -step : step;
}

/** Whether a click comes from a control inside the cell rather than from the cell itself. */
function isFromControl(event: Event) {
	const { target, currentTarget } = event;

	if (!(target instanceof Element) || !(currentTarget instanceof Element)) {
		return false;
	}

	const control = target.closest(CONTROL_SELECTOR);

	return control !== null && control !== currentTarget && currentTarget.contains(control);
}

function requestFrame(callback: () => void) {
	if (typeof requestAnimationFrame === 'function') {
		const frame = requestAnimationFrame(callback);

		return () => cancelAnimationFrame(frame);
	}

	const timer = setTimeout(callback, 0);

	return () => clearTimeout(timer);
}

/**
 * What a column header cell does: a click sorts a `sortable` column, and Shift, Ctrl or ⌘ add it to
 * the sort; Enter or Space sort, Shift+Enter, Ctrl+Enter, ⌘+Enter and Shift+Space add the column to
 * the sort. Ctrl+Space and ⌘+Space are left to the grid navigation, which selects the column with
 * them. Alt+←/→ moves the column; Shift+←/→ changes its width. Each works only where the column's
 * rights allow it. A handled key is `preventDefault`-ed, so a grid navigation around the header skips
 * it.
 *
 * Clicks and keys of a control inside the cell, such as its resize handle or a menu button, are that
 * control's. Moves held on a key collect per animation frame, since each move re-renders the rows. A
 * width held on a key is one gesture, as a drag of the resize handle: it reaches the layout when the
 * key is released or focus leaves the cell.
 */
export function useHeaderCell(scope: TableScope, options: HeaderCellOptions = {}) {
	const handlers = new Map<string, HeaderCellHandlers>();
	let moveName: string | null = null;
	let moveSteps = 0;
	let cancelMove: (() => void) | null = null;
	let resizing: { name: string; width: number } | null = null;

	function flushMove() {
		const name = moveName;
		const steps = moveSteps;

		cancelMove = null;
		moveName = null;
		moveSteps = 0;

		const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

		if (name === null || !scope.moveColumnBy(name, steps)) {
			return;
		}

		scope.scrollToColumn(name);

		// Moving the cell in the DOM drops focus from it; the next arrow would go nowhere.
		void nextTick(() => {
			if (focused?.isConnected && document.activeElement !== focused) {
				focused.focus({ preventScroll: true });
			}
		});
	}

	function move(name: string, step: number) {
		if (moveName !== name) {
			cancelMove?.();
			flushMove();
		}

		moveName = name;
		moveSteps += step;
		cancelMove ??= requestFrame(flushMove);
	}

	function commitResize() {
		if (resizing) {
			resizing = null;
			scope.commitResize();
		}
	}

	function resize(event: KeyboardEvent, name: string, step: number) {
		if (resizing?.name !== name) {
			commitResize();

			const cell = event.currentTarget instanceof Element ? event.currentTarget : null;
			const rendered = cell?.getBoundingClientRect().width ?? 0;

			resizing = { name, width: rendered > 0 ? rendered : scope.getWidth(name) };
		}

		// The core keeps the width within the column's limits; a held key goes on from the width it gave.
		resizing.width = scope.resize(name, resizing.width + step * (options.resizeStep ?? DEFAULT_RESIZE_STEP));
	}

	function onClick(event: MouseEvent, name: string) {
		const column = scope.getColumn(name)?.column;

		if (column?.sortable && !event.defaultPrevented && !isFromControl(event)) {
			scope.toggleSort(name, event.shiftKey || event.ctrlKey || event.metaKey);
		}
	}

	function onKeydown(event: KeyboardEvent, name: string) {
		const column = scope.getColumn(name)?.column;

		// Keys of a control inside the cell, such as its resize handle, are that control's.
		if (!column || event.defaultPrevented || event.target !== event.currentTarget) {
			return;
		}

		const selectsColumn = event.key === ' ' && (event.ctrlKey || event.metaKey);

		if ((event.key === 'Enter' || event.key === ' ') && !event.altKey && !selectsColumn && column.sortable) {
			event.preventDefault();
			scope.toggleSort(name, event.shiftKey || event.ctrlKey || event.metaKey);

			return;
		}

		const step = getInlineStep(event);

		if (step === undefined) {
			return;
		}

		if (hasOnly(event, 'alt') && column.movable) {
			event.preventDefault();
			move(name, step);
		} else if (hasOnly(event, 'shift') && column.resizable) {
			event.preventDefault();
			resize(event, name, step);
		}
	}

	/**
	 * The handlers of the header cell of column `name`, to spread on it next to `getHeaderCellProps`:
	 * one frozen object per column, so the cell's props hold between renders.
	 */
	function getHandlers(name: string): HeaderCellHandlers {
		let result = handlers.get(name);

		if (!result) {
			result = Object.freeze({
				onClick: (event: MouseEvent) => onClick(event, name),
				onKeydown: (event: KeyboardEvent) => onKeydown(event, name),
				onKeyup: commitResize,
				onFocusout: commitResize,
			});
			handlers.set(name, result);
		}

		return result;
	}

	if (getCurrentScope()) {
		onScopeDispose(() => {
			cancelMove?.();
			commitResize();
		});
	}

	return { getHandlers };
}
