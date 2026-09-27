import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bindDragSource, type DragSourceOptions, isDragging, registerDropTarget } from '../src/drag-manager';
import { DRAG_ACTIVE_ATTRIBUTE, type DragPayload } from '../src/model';
import { createList, type Frames, place, pointer, stubFrames, stubLayout } from './support';

const cleanups: (() => void)[] = [];

let frames: Frames;

function payloadOf(key: string): DragPayload {
	return { kind: 'row', key, origin: Symbol('test'), group: null };
}

function setup(options: Partial<DragSourceOptions> = {}) {
	const list = createList(['a', 'b', 'c']);
	const events: string[] = [];

	cleanups.push(bindDragSource(list.container, {
		resolve: (hit) => {
			const element = hit.closest<HTMLElement>('[tabindex]');

			return element ? { element, payload: payloadOf(element.textContent ?? '') } : null;
		},
		...options,
	}));

	cleanups.push(registerDropTarget({
		element: list.container,
		accepts: payload => payload.kind === 'row',
		onStart: payload => events.push(`start ${payload.key}`),
		onEnter: () => events.push('enter'),
		onOver: (_payload, _point, hit) => events.push(`over ${hit.textContent}`),
		onLeave: () => events.push('leave'),
		onDrop: (payload) => {
			events.push(`drop ${payload.key}`);

			return null;
		},
		onEnd: payload => events.push(`end ${payload.key}`),
	}));

	return { ...list, events };
}

beforeEach(() => {
	stubLayout();
	frames = stubFrames();
});

afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	pointer('pointercancel', window, { x: 0, y: 0 });
	document.body.innerHTML = '';
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('bindDragSource — a mouse', () => {
	it('starts only after a few pixels of movement', () => {
		const { get, events } = setup();

		pointer('pointerdown', get('a'), { x: 50, y: 15 });
		pointer('pointermove', window, { x: 52, y: 16 });

		expect(events).toEqual([]);
		expect(isDragging()).toBe(false);

		pointer('pointermove', window, { x: 50, y: 25 });

		expect(events).toEqual(['start a']);
		expect(isDragging()).toBe(true);
		expect(document.documentElement.getAttribute(DRAG_ACTIVE_ATTRIBUTE)).toBe('row');
	});

	it('finds the target on the next frame and drops where the pointer is', () => {
		const { get, events } = setup();

		pointer('pointerdown', get('a'), { x: 50, y: 15 });
		pointer('pointermove', window, { x: 50, y: 75 });
		frames.run();
		pointer('pointerup', window, { x: 50, y: 75 });

		expect(events).toEqual(['start a', 'enter', 'over c', 'drop a', 'end a']);
		expect(isDragging()).toBe(false);
		expect(document.documentElement.hasAttribute(DRAG_ACTIVE_ATTRIBUTE)).toBe(false);
	});

	it('a target that does not accept the payload hears nothing', () => {
		const { get, container } = setup();
		const other: string[] = [];

		cleanups.push(registerDropTarget({ element: container, accepts: () => false, onStart: () => other.push('start') }));
		pointer('pointerdown', get('a'), { x: 50, y: 15 });
		pointer('pointermove', window, { x: 50, y: 45 });

		expect(other).toEqual([]);
	});

	it('Escape cancels: the gesture ends without a drop', () => {
		const { get, events } = setup();

		pointer('pointerdown', get('a'), { x: 50, y: 15 });
		pointer('pointermove', window, { x: 50, y: 45 });
		frames.run();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

		expect(events).toEqual(['start a', 'enter', 'over b', 'end a']);
	});

	it('losing the window cancels too', () => {
		const { get, events } = setup();

		pointer('pointerdown', get('a'), { x: 50, y: 15 });
		pointer('pointermove', window, { x: 50, y: 45 });
		window.dispatchEvent(new Event('blur'));

		expect(events.at(-1)).toBe('end a');
		expect(events).not.toContain('drop a');
	});

	it('the click that follows a drop is swallowed, a click without a drag is not', () => {
		const { get } = setup();
		const clicks = vi.fn();

		get('b').addEventListener('click', clicks);
		pointer('pointerdown', get('a'), { x: 50, y: 15 });
		pointer('pointermove', window, { x: 50, y: 45 });
		pointer('pointerup', window, { x: 50, y: 45 });
		get('b').dispatchEvent(new MouseEvent('click', { bubbles: true }));

		pointer('pointerdown', get('b'), { x: 50, y: 45 });
		pointer('pointerup', window, { x: 50, y: 45 });
		get('b').dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(clicks).toHaveBeenCalledTimes(1);
	});

	it('`ignore` and `handle` decide what starts a drag', () => {
		const { get, events } = setup({ handle: '.grip', ignore: '.resize' });
		const grip = document.createElement('span');
		const resize = document.createElement('span');

		grip.className = 'grip';
		resize.className = 'resize';
		get('a').append(grip, resize);

		pointer('pointerdown', get('a'), { x: 50, y: 15 });
		pointer('pointermove', window, { x: 50, y: 45 });
		pointer('pointerup', window, { x: 50, y: 45 });
		pointer('pointerdown', resize, { x: 50, y: 15 });
		pointer('pointermove', window, { x: 50, y: 45 });
		pointer('pointerup', window, { x: 50, y: 45 });

		expect(events).toEqual([]);

		pointer('pointerdown', grip, { x: 50, y: 15 });
		pointer('pointermove', window, { x: 50, y: 45 });

		expect(events).toEqual(['start a']);
	});

	it('a secondary button starts nothing', () => {
		const { get, events } = setup();

		pointer('pointerdown', get('a'), { x: 50, y: 15 }, { button: 2 });
		pointer('pointermove', window, { x: 50, y: 45 });

		expect(events).toEqual([]);
	});
});

describe('bindDragSource — a finger', () => {
	function touchMove(target: EventTarget) {
		const event = new TouchEvent('touchmove', { bubbles: true, cancelable: true });

		target.dispatchEvent(event);

		return event;
	}

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
	});

	it('on an item, a long press starts the drag, and scrolling is blocked only after it', () => {
		const { get, events } = setup();

		pointer('pointerdown', get('a'), { x: 50, y: 15 }, { pointerType: 'touch' });
		pointer('pointermove', window, { x: 52, y: 17 }, { pointerType: 'touch' });

		expect(touchMove(get('a')).defaultPrevented).toBe(false);
		expect(events).toEqual([]);

		vi.advanceTimersByTime(250);

		expect(events).toEqual(['start a']);
		expect(touchMove(get('a')).defaultPrevented).toBe(true);
	});

	it('a finger that moves before the long press ends is scrolling', () => {
		const { get, events } = setup();

		pointer('pointerdown', get('a'), { x: 50, y: 15 }, { pointerType: 'touch' });
		pointer('pointermove', window, { x: 50, y: 40 }, { pointerType: 'touch' });
		vi.advanceTimersByTime(500);

		expect(events).toEqual([]);
		expect(isDragging()).toBe(false);
	});

	it('the long press is configurable', () => {
		const { get, events } = setup({ touchDelay: 600 });

		pointer('pointerdown', get('a'), { x: 50, y: 15 }, { pointerType: 'touch' });
		vi.advanceTimersByTime(300);

		expect(events).toEqual([]);

		vi.advanceTimersByTime(300);

		expect(events).toEqual(['start a']);
	});

	it('on a handle, the drag starts at once and the page never scrolls under it', () => {
		const { get, events } = setup({ handle: '.grip' });
		const grip = document.createElement('span');

		grip.className = 'grip';
		get('a').append(grip);
		place(grip, { left: 0, top: 0, right: 20, bottom: 30 });

		pointer('pointerdown', grip, { x: 10, y: 15 }, { pointerType: 'touch' });

		expect(touchMove(grip).defaultPrevented).toBe(true);

		pointer('pointermove', window, { x: 10, y: 25 }, { pointerType: 'touch' });

		expect(events).toEqual(['start a']);
	});

	it('the browser taking over the touch cancels a pending long press', () => {
		const { get, events } = setup();

		pointer('pointerdown', get('a'), { x: 50, y: 15 }, { pointerType: 'touch' });
		pointer('pointercancel', window, { x: 50, y: 15 }, { pointerType: 'touch' });
		vi.advanceTimersByTime(500);

		expect(events).toEqual([]);
	});

	it('unbinding releases the touch listener: nothing is blocked any more', () => {
		const { get } = setup();

		pointer('pointerdown', get('a'), { x: 50, y: 15 }, { pointerType: 'touch' });
		vi.advanceTimersByTime(250);
		cleanups.splice(0).forEach(cleanup => cleanup());

		expect(touchMove(get('a')).defaultPrevented).toBe(false);
	});
});

describe('registerDropTarget', () => {
	it('the deepest registered target under the pointer wins', () => {
		const { get, container } = setup();
		const inner = document.createElement('div');
		const heard: string[] = [];

		container.append(inner);
		place(inner, { left: 200, top: 0, right: 300, bottom: 100 });
		cleanups.push(registerDropTarget({
			element: inner,
			accepts: () => true,
			onEnter: () => heard.push('inner'),
		}));

		pointer('pointerdown', get('a'), { x: 50, y: 15 });
		pointer('pointermove', window, { x: 250, y: 50 });
		frames.run();

		expect(heard).toEqual(['inner']);
	});
});
