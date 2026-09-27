import type { TableScope } from '@vue-data-grid/core';
import { computed, type ComputedRef, getCurrentScope, hasInjectionContext, type MaybeRefOrGetter, onScopeDispose, shallowRef, toValue } from 'vue';

import { DEFAULT_MESSAGES, useTableMessagesContext } from '../components/messages';
import { isRtl } from '../keyboard/keys';
import { type AutosizeOptions, autosizeColumns } from './autosize-columns';

export interface ColumnResizeOptions {
	/** How far an arrow key changes the width, px; `16` by default. */
	step?: MaybeRefOrGetter<number | undefined>;
	/** How a double click fits the column to its content; `false` turns it off. */
	autosize?: MaybeRefOrGetter<AutosizeOptions | false | undefined>;
	/**
	 * The accessible name of a handle; the `resizeColumn` message of the table around, `Resize <label>`
	 * by default.
	 */
	label?: (column: { name: string; label?: string }) => string;
	/** The width as the screen reader says it; the `columnWidth` message, `<width> px` by default. */
	valueText?: (width: number) => string;
}

type Handlers = Readonly<Record<string, (event: never) => void>>;

const DEFAULT_STEP = 16;

const INLINE_STEPS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };

/**
 * How the width follows the pointer and the arrows: `1` where the handle is at the end edge and the
 * width grows towards the end, `-1` in a right-to-left table, and flipped for a column pinned to the
 * end, whose handle is at its start edge.
 */
function getDirection(scope: TableScope, name: string, handle: Element) {
	return (isRtl(handle) ? -1 : 1) * (scope.getPin(name) === 'end' ? -1 : 1);
}

/**
 * The width the column is drawn at: a `flex` column grows past its width until it is resized, and a
 * resize starts from where its edge is, not from its declared width.
 */
function getDrawnWidth(scope: TableScope, name: string, handle: Element) {
	const cell = handle.closest('[data-tc-column]');

	return cell ? cell.getBoundingClientRect().width : scope.getWidth(name);
}

/**
 * Resizing columns by a handle: a pointer drag with pointer capture, applied once per animation frame
 * and committed when the pointer is released or the handle goes away; a double click that fits the
 * column to its content; and the keys of a focusable `role="separator"`, which tells the screen reader
 * the width: ← and → change it by `step`, Home and End take it to its limits. In a right-to-left table
 * the drag and the arrows follow the reading direction.
 *
 * `getHandleProps(name)` gives everything the handle element needs, `data-tc-part="resize-handle"`
 * included, for which the structural styles make a grab area at the end edge of the header cell, or
 * at its start edge for a column pinned to the end, which the drag and the arrows then follow. A
 * drag starts from the width the column is drawn at, so a `flex` column does not jump. A click on
 * the handle is `preventDefault`-ed, so the header cell under it does not sort.
 *
 * A handle reads the width of its own column only, and during a pointer drag its `aria-valuenow`
 * holds the width the drag started from until the drag ends: the width changes every frame, and the
 * header should not render every frame. The keys update it on each press.
 */
export function useColumnResize(scope: TableScope, options: ColumnResizeOptions = {}) {
	const messages = hasInjectionContext() ? useTableMessagesContext() : DEFAULT_MESSAGES;
	/** The column a drag or a key is resizing now; `null` between gestures. */
	const resizing = shallowRef<string | null>(null);
	const handlers = new Map<string, Handlers>();
	const widths = new Map<string, ComputedRef<number>>();
	// One pointer resizes at a time: events of another pointer, such as a second finger, are ignored.
	let gesture: { name: string; pointer: number; start: number; width: number; sign: number } | null = null;
	// A width held on a key: applied once per frame, so the next press goes on from this, not the DOM.
	let keyed: { name: string; width: number } | null = null;

	// A computed wakes its readers only when its own value changes, not on every width of the table.
	function getWidth(name: string) {
		let width = widths.get(name);

		if (!width) {
			width = computed(() => scope.getWidth(name));
			widths.set(name, width);
		}

		return width.value;
	}

	function end() {
		if (resizing.value !== null) {
			gesture = null;
			keyed = null;
			resizing.value = null;
			scope.commitResize();
		}
	}

	function isGesturePointer(event: PointerEvent) {
		return gesture !== null && gesture.pointer === event.pointerId;
	}

	function startDrag(event: PointerEvent, name: string) {
		const handle = event.currentTarget instanceof Element ? event.currentTarget : null;

		if (event.button !== 0 || !handle || gesture) {
			return;
		}

		end();
		event.preventDefault();
		handle.setPointerCapture?.(event.pointerId);
		gesture = {
			name,
			pointer: event.pointerId,
			start: event.clientX,
			width: getDrawnWidth(scope, name, handle),
			sign: getDirection(scope, name, handle),
		};
		resizing.value = name;
	}

	function drag(event: PointerEvent) {
		if (gesture && isGesturePointer(event)) {
			scope.resize(gesture.name, gesture.width + (event.clientX - gesture.start) * gesture.sign);
		}
	}

	function endDrag(event: PointerEvent) {
		if (isGesturePointer(event)) {
			end();
		}
	}

	// A key released, or focus gone, ends a resize by keys; a pointer drag goes on until the pointer is up.
	function endKeys() {
		if (keyed && !gesture) {
			end();
		}
	}

	function onKeydown(event: KeyboardEvent, name: string) {
		const column = scope.getColumn(name)?.column;
		const handle = event.currentTarget instanceof Element ? event.currentTarget : null;

		if (!column || !handle || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}

		const step = INLINE_STEPS[event.key];
		const current = keyed?.name === name ? keyed.width : getDrawnWidth(scope, name, handle);
		let width: number | null = null;

		if (step !== undefined) {
			width = current + step * getDirection(scope, name, handle) * (toValue(options.step) ?? DEFAULT_STEP);
		} else if (event.key === 'Home') {
			width = column.minWidth;
		} else if (event.key === 'End' && column.maxWidth !== undefined) {
			width = column.maxWidth;
		}

		if (width !== null) {
			// The grid navigation around the handle skips a key it sees handled.
			event.preventDefault();
			resizing.value = name;
			keyed = { name, width: scope.resize(name, width) };
		}
	}

	function autosize(name: string) {
		const autosizeOptions = toValue(options.autosize);

		if (autosizeOptions !== false) {
			autosizeColumns(scope, [name], autosizeOptions);
		}
	}

	function getHandlers(name: string) {
		let result = handlers.get(name);

		if (!result) {
			result = Object.freeze({
				onPointerdown: (event: PointerEvent) => startDrag(event, name),
				onPointermove: drag,
				onPointerup: endDrag,
				onPointercancel: endDrag,
				onLostpointercapture: endDrag,
				onKeydown: (event: KeyboardEvent) => onKeydown(event, name),
				onKeyup: endKeys,
				onBlur: endKeys,
				onDblclick: () => autosize(name),
				onClick: (event: MouseEvent) => event.preventDefault(),
			});
			handlers.set(name, result);
		}

		return result;
	}

	/**
	 * Props of the handle of column `name`: `role="separator"` with the width in `aria-valuenow`, its
	 * limits and text, `tabindex="0"`, `data-tc-part="resize-handle"`, and the handlers of the gestures.
	 * Nothing for a column that is not `resizable`.
	 */
	function getHandleProps(name: string): Readonly<Record<string, unknown>> {
		const column = scope.getColumn(name)?.column;

		if (!column?.resizable) {
			return {};
		}

		// `resizing` renders the handle as the drag starts, so from then on it reads the start width alone.
		const width = gesture?.name === name && resizing.value === name ? gesture.width : getWidth(name);

		return {
			role: 'separator',
			'aria-orientation': 'vertical',
			'aria-label': options.label?.(column) ?? messages.resizeColumn(column.label ?? column.name),
			'aria-valuenow': width,
			'aria-valuemin': column.minWidth,
			'aria-valuemax': column.maxWidth ?? Number.MAX_SAFE_INTEGER,
			'aria-valuetext': options.valueText?.(width) ?? messages.columnWidth(width),
			tabindex: 0,
			'data-tc-part': 'resize-handle',
			'data-tc-state': resizing.value === name ? 'resizing' : 'idle',
			...getHandlers(name),
		};
	}

	if (getCurrentScope()) {
		onScopeDispose(end);
	}

	return {
		resizing,
		getHandleProps,
		/** Fits the column to its content, as a double click on its handle does. */
		autosize,
		/** Ends a gesture in progress and writes the width to the layout. */
		end,
	};
}

/** Resizing columns by their handles as `useColumnResize` gives it. */
export type ColumnResize = ReturnType<typeof useColumnResize>;
