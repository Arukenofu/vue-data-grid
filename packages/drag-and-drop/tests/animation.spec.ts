import { effectScope, nextTick, shallowRef } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type MotionEngine, type MotionTransition, playMotion } from '@vue-stack/flip';

import type { DragTree } from '../src/drop-position';
import {
	DRAG_GHOST_ATTRIBUTE,
	DRAG_LANDING_ATTRIBUTE,
	type DragDropEvent,
	type DragPoint,
	DROP_INDICATOR_ATTRIBUTE,
	DROP_LEVEL_PROPERTY,
} from '../src/model';
import { type DragListOptions, useDragList } from '../src/use-drag-list';
import { useDropTarget } from '../src/use-drop-target';
import {
	at,
	createList,
	type Frames,
	key,
	place,
	type PlayedAnimation,
	pointer,
	stubAnimations,
	stubFrames,
	stubLayout,
} from './support';

const scopes: ReturnType<typeof effectScope>[] = [];

let frames: Frames;
let played: PlayedAnimation[];

function setup(keys: readonly string[], options: Partial<DragListOptions> = {}, left = 0) {
	const list = createList(keys, true, left);
	const drops: DragDropEvent[] = [];
	const scope = effectScope();
	const drag = scope.run(() => useDragList({
		kind: 'row',
		axis: 'vertical',
		keys,
		container: list.container,
		onDrop: event => drops.push(event),
		...options,
	}));

	if (!drag) {
		throw new Error('useDragList returned nothing');
	}

	scopes.push(scope);

	for (const [name, element] of list.items) {
		drag.list.register(element, name);
	}

	return { ...list, drag, drops };
}

function shiftOf(element: HTMLElement) {
	return element.style.getPropertyValue('translate');
}

function drag(from: HTMLElement, to: DragPoint) {
	pointer('pointerdown', from, at(from));
	pointer('pointermove', window, to);
	frames.run();
}

function moveTo(point: DragPoint) {
	pointer('pointermove', window, point);
	frames.run();
}

/** Lets every pending promise run: settling waits for the re-render, the ghost for the settling. */
function flush() {
	return new Promise(resolve => setTimeout(resolve, 0));
}

function slidesOf(element: Element) {
	return played.filter(animation => animation.element === element).map(animation => animation.keyframes);
}

beforeEach(() => {
	stubLayout();
	frames = stubFrames();
	played = stubAnimations();
});

afterEach(() => {
	pointer('pointercancel', window, { x: 0, y: 0 });
	scopes.splice(0).forEach(scope => scope.stop());
	document.body.innerHTML = '';
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('indicator: gap', () => {
	it('items between make room, and the dragged one stands in the gap', () => {
		const { get } = setup(['a', 'b', 'c', 'd', 'e'], { indicator: 'gap' });

		drag(get('a'), at(get('d'), 0.25));

		expect(shiftOf(get('b'))).toBe('0px -30px');
		expect(shiftOf(get('c'))).toBe('0px -30px');
		expect(shiftOf(get('a'))).toBe('0px 60px');
		expect(shiftOf(get('d'))).toBe('');
		expect(shiftOf(get('e'))).toBe('');
	});

	it('`shift` draws the items instead of their `translate`, all that moved in one call, and puts them back after the gesture', async () => {
		const shift = vi.fn();
		const { get } = setup(['a', 'b', 'c', 'd'], { indicator: 'gap', shift });

		drag(get('a'), at(get('c'), 0.75));

		expect(shift).toHaveBeenCalledOnce();
		expect(Object.fromEntries(shift.mock.calls[0][0])).toEqual({ a: { x: 0, y: 60 }, b: { x: 0, y: -30 }, c: { x: 0, y: -30 } });
		expect(shift.mock.calls[0][1]).toBeTypeOf('function');
		expect(shiftOf(get('b'))).toBe('');

		shift.mockClear();
		pointer('pointerup', window, at(get('c'), 0.75));
		await nextTick();

		expect(shift).toHaveBeenCalledOnce();
		expect(Object.fromEntries(shift.mock.calls[0][0])).toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, c: { x: 0, y: 0 } });
		expect(shift.mock.calls[0][1]).toBeNull();
	});

	it('reads where every item is drawn before it moves any of them', () => {
		const { get } = setup(['a', 'b', 'c', 'd', 'e'], { indicator: 'gap' });
		const order: string[] = [];
		const readStyle = window.getComputedStyle.bind(window);
		const setProperty = CSSStyleDeclaration.prototype.setProperty;

		drag(get('a'), at(get('b'), 0.75));
		vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
			order.push('read');

			return readStyle(element, pseudo);
		});
		vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty').mockImplementation(function write(
			this: CSSStyleDeclaration,
			name: string,
			value: string | null,
			priority?: string,
		) {
			if (name === 'translate') {
				order.push('write');
			}

			setProperty.call(this, name, value, priority);
		});
		moveTo(at(get('d'), 0.75));

		expect(order.filter(step => step === 'write').length).toBeGreaterThan(1);
		expect(order.lastIndexOf('read')).toBeLessThan(order.indexOf('write'));
	});

	it('dragged back, the items in between move the other way', () => {
		const { get } = setup(['a', 'b', 'c', 'd', 'e'], { indicator: 'gap' });

		drag(get('e'), at(get('b'), 0.25));

		expect(['a', 'b', 'c', 'd'].map(name => shiftOf(get(name)))).toEqual(['', '0px 30px', '0px 30px', '0px 30px']);
		expect(shiftOf(get('e'))).toBe('0px -90px');
	});

	it('the place is found where items are laid out, so the gap does not run from the pointer', () => {
		const { get, drag: list } = setup(['a', 'b', 'c', 'd', 'e'], { indicator: 'gap' });

		drag(get('a'), at(get('d'), 0.25));
		// Drawn here is the dragged item, standing in the gap; laid out here is the top of `c`.
		moveTo({ x: 150, y: 70 });

		expect(list.target.value).toMatchObject({ key: 'c', position: 'before', index: 1 });
		expect(shiftOf(get('b'))).toBe('0px -30px');
		expect(shiftOf(get('c'))).toBe('');
		expect(shiftOf(get('a'))).toBe('0px 30px');

		moveTo({ x: 150, y: 71 });

		expect(list.target.value).toMatchObject({ key: 'c', position: 'before' });
	});

	it('items slide into their new places, from wherever they are drawn', () => {
		const { get } = setup(['a', 'b', 'c', 'd', 'e'], { indicator: 'gap' });

		drag(get('a'), at(get('d'), 0.25));

		expect(slidesOf(get('b'))).toEqual([[{ translate: '0px 30px' }, { translate: '0px 0px' }]]);
		expect(slidesOf(get('a'))).toEqual([[{ translate: '0px -60px' }, { translate: '0px 0px' }]]);

		moveTo(at(get('c'), 0.25));

		expect(slidesOf(get('c'))).toEqual([
			[{ translate: '0px 30px' }, { translate: '0px 0px' }],
			[{ translate: '0px -30px' }, { translate: '0px 0px' }],
		]);
	});

	it('a pointer that strays from the list keeps the gap, and a drop there goes to it', () => {
		const { get, drops } = setup(['a', 'b', 'c'], { indicator: 'gap' });

		drag(get('a'), at(get('c'), 0.75));
		moveTo({ x: 500, y: 50 });

		expect(['a', 'b', 'c'].map(name => shiftOf(get(name)))).toEqual(['0px 60px', '0px -30px', '0px -30px']);

		pointer('pointerup', window, { x: 500, y: 50 });

		expect(drops).toEqual([expect.objectContaining({ key: 'a', index: 2 })]);
	});

	it('another target that takes the pointer closes the gap, and takes the drop', async () => {
		const { get, drops } = setup(['a', 'b', 'c'], { indicator: 'gap' });
		const bin = document.createElement('div');
		const dropped: string[] = [];
		const scope = effectScope();

		document.body.append(bin);
		place(bin, { left: 400, top: 0, right: 500, bottom: 100 });
		scope.run(() => useDropTarget(bin, { kinds: ['row'], onDrop: payload => dropped.push(payload.key) }));
		scopes.push(scope);
		await nextTick();

		drag(get('a'), at(get('c'), 0.75));
		moveTo({ x: 600, y: 50 });
		moveTo({ x: 450, y: 50 });

		expect(['a', 'b', 'c'].map(name => shiftOf(get(name)))).toEqual(['', '', '']);

		pointer('pointerup', window, { x: 450, y: 50 });

		expect(drops).toEqual([]);
		expect(dropped).toEqual(['a']);
	});

	it('a place that `canDrop` refuses keeps the last place', () => {
		const { get, drops } = setup(['a', 'b', 'c'], { indicator: 'gap', canDrop: (_key, target) => target.key !== 'c' });

		drag(get('a'), at(get('b'), 0.75));
		moveTo(at(get('c'), 0.75));

		expect(shiftOf(get('b'))).toBe('0px -30px');

		pointer('pointerup', window, at(get('c'), 0.75));

		expect(drops).toEqual([expect.objectContaining({ key: 'a', index: 1 })]);
	});

	it('back over its own place, the item closes the gap', () => {
		const { get, drops } = setup(['a', 'b', 'c'], { indicator: 'gap' });

		drag(get('a'), at(get('c'), 0.75));
		moveTo({ x: 50, y: 15 });

		expect(['a', 'b', 'c'].map(name => shiftOf(get(name)))).toEqual(['', '', '']);

		pointer('pointerup', window, { x: 50, y: 15 });

		expect(drops).toEqual([]);
	});

	it('finds the item across the list from the pointer, beside it', () => {
		const { get, drops } = setup(['a', 'b', 'c']);

		place(get('c'), { left: 0, top: 60, right: 100, bottom: 90 });
		drag(get('a'), { x: 200, y: 85 });
		pointer('pointerup', window, { x: 200, y: 85 });

		expect(drops).toEqual([expect.objectContaining({ key: 'a', index: 2 })]);
	});

	it('an item that mounts mid-drag takes its place at once, without sliding in', () => {
		const { get, drag: list } = setup(['a', 'b', 'c', 'd'], { indicator: 'gap' });

		drag(get('a'), at(get('d'), 0.25));

		const fresh = document.createElement('div');

		get('c').replaceWith(fresh);
		place(fresh, { left: 0, top: 60, right: 300, bottom: 90 });
		list.list.register(fresh, 'c');

		expect(shiftOf(fresh)).toBe('0px -30px');
		expect(slidesOf(fresh)).toEqual([]);
	});

	it('the keyboard moves the gap too', () => {
		const { get } = setup(['a', 'b', 'c'], { indicator: 'gap' });

		key(get('a'), ' ');
		key(get('a'), 'ArrowDown');

		expect(shiftOf(get('b'))).toBe('0px -30px');
		expect(shiftOf(get('a'))).toBe('0px 30px');
	});

	it('an item of another list opens a gap of the size of the items there', () => {
		const first = setup(['a', 'b'], { indicator: 'gap', group: 'shared' });
		const second = setup(['x', 'y', 'z'], { indicator: 'gap', group: 'shared' }, 400);

		drag(first.get('a'), at(second.get('y'), 0.25));

		expect(['x', 'y', 'z'].map(name => shiftOf(second.get(name)))).toEqual(['', '0px 30px', '0px 30px']);
		expect(shiftOf(first.get('a'))).toBe('');
	});

	it('the drop keeps the items where the gap drew them until the list re-renders in that order', async () => {
		const { get, drops } = setup(['a', 'b', 'c', 'd', 'e'], {
			indicator: 'gap',
			onDrop: (event) => {
				drops.push(event);
				// The re-render: `a` goes after `c`.
				void nextTick(() => {
					place(get('b'), { left: 0, top: 0, right: 300, bottom: 30 });
					place(get('c'), { left: 0, top: 30, right: 300, bottom: 60 });
					place(get('a'), { left: 0, top: 60, right: 300, bottom: 90 });
				});
			},
		});

		drag(get('a'), at(get('d'), 0.25));
		played.length = 0;
		pointer('pointerup', window, at(get('d'), 0.25));

		expect(drops[0]).toMatchObject({ key: 'a', index: 2 });
		expect(shiftOf(get('b'))).toBe('0px -30px');

		await nextTick();

		expect(['a', 'b', 'c'].map(name => shiftOf(get(name)))).toEqual(['', '', '']);
		expect(played).toEqual([]);
	});

	it('cancelled, the items slide back', async () => {
		const { get } = setup(['a', 'b', 'c', 'd'], { indicator: 'gap' });

		drag(get('a'), at(get('d'), 0.25));
		played.length = 0;
		pointer('pointercancel', window, { x: 0, y: 0 });
		await nextTick();

		expect(shiftOf(get('b'))).toBe('');
		expect(slidesOf(get('b'))).toEqual([[{ translate: '0px -30px' }, { translate: '0px 0px' }]]);
		expect(slidesOf(get('a'))).toEqual([[{ translate: '0px 60px' }, { translate: '0px 0px' }]]);
	});

	describe('in a tree', () => {
		const tree: DragTree = {
			getParent: name => ({ x: 'g', y: 'g' } as Record<string, string>)[name] ?? null,
			getLevel: name => (name === 'x' || name === 'y' ? 1 : 0),
			getChildren: parent => (parent === null ? ['g', 'h', 'z'] : parent === 'g' ? ['x', 'y'] : []),
			canNest: name => name === 'g' || name === 'h',
			isExpanded: name => name === 'g',
		};
		const keys = ['g', 'x', 'y', 'h', 'z'];

		it('an item moves with the shown part of its subtree', () => {
			const { get } = setup(keys, { indicator: 'gap', tree });

			drag(get('g'), at(get('z'), 0.75));

			expect(shiftOf(get('h'))).toBe('0px -90px');
			expect(shiftOf(get('z'))).toBe('0px -90px');
			expect(['g', 'x', 'y'].map(name => shiftOf(get(name)))).toEqual(['0px 60px', '0px 60px', '0px 60px']);
		});

		it('into an expanded item, the gap opens before its first child, at the deeper level', () => {
			const { get } = setup(keys, { indicator: 'gap', tree });

			drag(get('z'), at(get('g'), 0.5));

			expect(['x', 'y', 'h'].map(name => shiftOf(get(name)))).toEqual(['0px 30px', '0px 30px', '0px 30px']);
			expect(shiftOf(get('z'))).toBe('0px -90px');
			expect(get('z').style.getPropertyValue(DROP_LEVEL_PROPERTY)).toBe('1');
		});

		it('an item whose subtree closes mid-gesture moves alone', () => {
			const shown = shallowRef<readonly string[]>(keys);
			const { get, drag: list } = setup(keys, { indicator: 'gap', tree, keys: shown });

			pointer('pointerdown', get('g'), at(get('g')));
			moveTo({ x: 150, y: 23 });
			// The subtree closes: its items unmount once the ones after it have moved up.
			shown.value = ['g', 'h', 'z'];
			place(get('h'), { left: 0, top: 30, right: 300, bottom: 60 });
			place(get('z'), { left: 0, top: 60, right: 300, bottom: 90 });

			for (const name of ['x', 'y']) {
				get(name).remove();
				list.list.register(get(name), name)();
			}

			moveTo(at(get('z'), 0.75));

			expect(['g', 'h', 'z'].map(name => shiftOf(get(name)))).toEqual(['0px 60px', '0px -30px', '0px -30px']);
		});

		it('into a collapsed item there is no place to open: only the mark shows it', () => {
			const { get } = setup(keys, { indicator: 'gap', tree });

			drag(get('z'), at(get('h'), 0.5));

			expect(keys.map(name => shiftOf(get(name)))).toEqual(['', '', '', '', '']);
			expect(get('z').style.getPropertyValue(DROP_LEVEL_PROPERTY)).toBe('1');
		});
	});
});

describe('indicator: line', () => {
	function indicatorOf(container: HTMLElement) {
		return container.querySelector<HTMLElement>(`[${DROP_INDICATOR_ATTRIBUTE}]`);
	}

	it('one element slides along the edges of the places', () => {
		const { get, container } = setup(['a', 'b', 'c', 'd', 'e'], { indicator: 'line' });

		drag(get('a'), at(get('d'), 0.25));

		const line = indicatorOf(container);

		expect(line?.getAttribute(DROP_INDICATOR_ATTRIBUTE)).toBe('before');
		expect(line?.style.translate).toBe('0px 90px');
		expect(line?.style.width).toBe('300px');
		expect(line?.style.height).toBe('');
		expect(played).toEqual([]);

		moveTo(at(get('e'), 0.75));

		expect(indicatorOf(container)).toBe(line);
		expect(line?.getAttribute(DROP_INDICATOR_ATTRIBUTE)).toBe('after');
		expect(line?.style.translate).toBe('0px 150px');
		expect(slidesOf(line as HTMLElement)).toEqual([[{ translate: '0px -60px' }, { translate: '0px 0px' }]]);
	});

	it('inside an item it covers the item, one level deeper', () => {
		const tree: DragTree = {
			getParent: () => null,
			getLevel: () => 0,
			getChildren: parent => (parent === null ? ['g', 'z'] : []),
			canNest: name => name === 'g',
			isExpanded: () => false,
		};
		const { get, container } = setup(['g', 'z'], { indicator: 'line', tree });

		drag(get('z'), at(get('g'), 0.5));

		const line = indicatorOf(container);

		expect(line?.getAttribute(DROP_INDICATOR_ATTRIBUTE)).toBe('inside');
		expect(line?.style.translate).toBe('0px 0px');
		expect([line?.style.width, line?.style.height]).toEqual(['300px', '30px']);
		expect(line?.style.getPropertyValue(DROP_LEVEL_PROPERTY)).toBe('1');
	});

	it('waits for a place that is not rendered, and is gone with the gesture', () => {
		const { get, container, drag: list } = setup(['a', 'b', 'c'], { indicator: 'line' });
		const later = document.createElement('div');

		get('c').remove();
		list.list.register(get('c'), 'c')();
		key(get('a'), ' ');
		key(get('a'), 'End');

		expect(indicatorOf(container)).toBeNull();

		container.append(later);
		place(later, { left: 0, top: 60, right: 300, bottom: 90 });
		list.list.register(later, 'c');

		expect(indicatorOf(container)?.style.translate).toBe('0px 90px');

		key(get('a'), 'Escape');

		expect(indicatorOf(container)).toBeNull();
	});
});

/** The re-render a drop of `a` after `c` causes. */
function reorder(get: (name: string) => HTMLElement) {
	void nextTick(() => {
		place(get('b'), { left: 0, top: 0, right: 300, bottom: 30 });
		place(get('c'), { left: 0, top: 30, right: 300, bottom: 60 });
		place(get('a'), { left: 0, top: 60, right: 300, bottom: 90 });
	});
}

describe('settling after a drop', () => {
	it('`settle: false` leaves the items where the re-render put them, and the gap still closes', async () => {
		const list = setup(['a', 'b', 'c', 'd'], { indicator: 'gap', settle: false, onDrop: () => reorder(list.get) });

		drag(list.get('a'), at(list.get('d'), 0.25));
		played.length = 0;
		pointer('pointerup', window, at(list.get('d'), 0.25));
		await nextTick();

		expect(played).toEqual([]);
		expect(shiftOf(list.get('b'))).toBe('');
		expect(shiftOf(list.get('a'))).toBe('');
	});

	it('a transition that something else started on an item is cut short, not stacked', async () => {
		const list = setup(['a', 'b', 'c', 'd'], { onDrop: () => reorder(list.get) });
		const signals: AbortSignal[] = [];

		playMotion(({ signal }) => {
			signals.push(signal);

			return new Promise(() => undefined);
		}, { kind: 'rows', moves: [{ element: list.get('b'), x: 0, y: 10 }] });
		drag(list.get('a'), at(list.get('d'), 0.25));
		pointer('pointerup', window, at(list.get('d'), 0.25));
		await nextTick();

		expect(signals[0].aborted).toBe(true);
		expect(slidesOf(list.get('b'))).toHaveLength(1);
	});

	it('items that came in with the drop enter', async () => {
		const fresh = document.createElement('div');
		const list = setup(['a', 'b'], { onDrop: () => void nextTick(() => list.drag.list.register(fresh, 'x')) });

		list.container.append(fresh);
		place(fresh, { left: 0, top: 60, right: 300, bottom: 90 });
		drag(list.get('a'), at(list.get('b'), 0.75));
		pointer('pointerup', window, at(list.get('b'), 0.75));
		await nextTick();

		expect(slidesOf(fresh)).toEqual([[{ opacity: 0, offset: 0 }]]);
	});

	it('an Alt+arrow step slides like a drop', async () => {
		const list = setup(['a', 'b', 'c', 'd'], { stepKeys: true, onDrop: () => reorder(list.get) });

		key(list.get('a'), 'ArrowDown', { altKey: true });
		await nextTick();

		expect(slidesOf(list.get('a'))).toEqual([[{ translate: '0px -60px' }, { translate: '0px 0px' }]]);
	});

	it('items slide from where they were to where the re-render put them', async () => {
		const list = setup(['a', 'b', 'c', 'd'], { onDrop: () => reorder(list.get) });

		drag(list.get('a'), at(list.get('d'), 0.25));
		pointer('pointerup', window, at(list.get('d'), 0.25));
		await nextTick();

		expect(slidesOf(list.get('b'))).toEqual([[{ translate: '0px 30px' }, { translate: '0px 0px' }]]);
		expect(slidesOf(list.get('c'))).toEqual([[{ translate: '0px 30px' }, { translate: '0px 0px' }]]);
		expect(slidesOf(list.get('a'))).toEqual([[{ translate: '0px -60px' }, { translate: '0px 0px' }]]);
		expect(slidesOf(list.get('d'))).toEqual([]);
	});

	it('a keyboard drop slides the same way', async () => {
		const list = setup(['a', 'b', 'c', 'd'], { onDrop: () => reorder(list.get) });

		key(list.get('a'), ' ');
		key(list.get('a'), 'ArrowDown');
		key(list.get('a'), 'ArrowDown');
		key(list.get('a'), ' ');
		await nextTick();

		expect(slidesOf(list.get('a'))).toEqual([[{ translate: '0px -60px' }, { translate: '0px 0px' }]]);
	});

	it('`motion: false` moves nothing', async () => {
		const list = setup(['a', 'b', 'c', 'd'], { motion: false, onDrop: () => reorder(list.get) });

		drag(list.get('a'), at(list.get('d'), 0.25));
		pointer('pointerup', window, at(list.get('d'), 0.25));
		await nextTick();

		expect(played).toEqual([]);
	});

	it('a reduced motion preference moves nothing, and a gap still opens', async () => {
		vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));

		const list = setup(['a', 'b', 'c', 'd'], { indicator: 'gap', onDrop: () => reorder(list.get) });

		drag(list.get('a'), at(list.get('d'), 0.25));

		expect(shiftOf(list.get('b'))).toBe('0px -30px');

		pointer('pointerup', window, at(list.get('d'), 0.25));
		await nextTick();

		expect(played).toEqual([]);
	});
});

describe('the ghost', () => {
	const preview = { render: (_key: string, container: HTMLElement) => void (container.textContent = 'ghost') };

	function ghost() {
		return document.querySelector(`[${DRAG_GHOST_ATTRIBUTE}]`);
	}

	const landing = { ...preview, exit: 'land' as const };

	it('fades where it was dropped by default, and its item slides into place like the others', async () => {
		const { get } = setup(['a', 'b', 'c', 'd'], { preview, onDrop: () => reorder(get) });

		drag(get('a'), at(get('d'), 0.25));
		pointer('pointerup', window, at(get('d'), 0.25));
		await flush();

		const [flight] = played.filter(animation => animation.element === ghost());

		expect(flight?.keyframes.at(-1)).toMatchObject({ opacity: 0 });
		expect(get('a').hasAttribute(DRAG_LANDING_ATTRIBUTE)).toBe(false);
		expect(slidesOf(get('a'))).toEqual([[{ translate: '0px -60px' }, { translate: '0px 0px' }]]);
	});

	it('`exit` of `none` goes at once', () => {
		const { get } = setup(['a', 'b', 'c', 'd'], { preview: { ...preview, exit: 'none' } });

		drag(get('a'), at(get('d'), 0.25));
		pointer('pointerup', window, at(get('d'), 0.25));

		expect(ghost()).toBeNull();
	});

	it('`exit` of `land` flies into the item it landed as, which is marked until it lands', async () => {
		const { get } = setup(['a', 'b', 'c', 'd'], { preview: landing });

		drag(get('a'), at(get('d'), 0.25));
		pointer('pointerup', window, at(get('d'), 0.25));
		await flush();

		const element = ghost() as HTMLElement;
		const [flight] = played.filter(animation => animation.element === element);

		expect(element.style.translate).toBe('162px 30px');
		expect(flight?.keyframes).toEqual([{ translate: '0px 71.5px' }, { translate: '0px 0px' }]);
		expect(get('a').hasAttribute(DRAG_LANDING_ATTRIBUTE)).toBe(true);
		// The item a ghost flies to does not slide itself.
		expect(slidesOf(get('a'))).toEqual([]);

		flight?.finish();
		await flush();

		expect(ghost()).toBeNull();
		expect(get('a').hasAttribute(DRAG_LANDING_ATTRIBUTE)).toBe(false);
	});

	it('a landing ghost flies to where its item is laid out, not to where a slide draws it', async () => {
		const { get } = setup(['a', 'b', 'c', 'd'], { preview: landing });

		drag(get('a'), at(get('d'), 0.25));
		// Something else slides the item into its place: drawn 40px below where it is laid out.
		get('a').style.setProperty('translate', '0px 40px');
		pointer('pointerup', window, at(get('d'), 0.25));
		await flush();

		expect((ghost() as HTMLElement).style.translate).toBe('162px 30px');
	});

	it('dropped nowhere, a landing ghost flies back to the item', async () => {
		const { get } = setup(['a', 'b', 'c'], { preview: landing });

		drag(get('a'), { x: 500, y: 50 });
		pointer('pointerup', window, { x: 500, y: 50 });
		await flush();

		expect(get('a').hasAttribute(DRAG_LANDING_ATTRIBUTE)).toBe(true);
	});

	it('over an area that takes it, even a landing ghost fades there', async () => {
		const { get } = setup(['a', 'b'], { preview: landing });
		const bin = document.createElement('div');
		const scope = effectScope();

		document.body.append(bin);
		place(bin, { left: 400, top: 0, right: 500, bottom: 100 });
		scope.run(() => useDropTarget(bin, { kinds: ['row'] }));
		scopes.push(scope);
		await nextTick();

		drag(get('a'), { x: 450, y: 50 });
		pointer('pointerup', window, { x: 450, y: 50 });
		await flush();

		const [flight] = played.filter(animation => animation.element === ghost());

		expect(flight?.keyframes.at(-1)).toMatchObject({ opacity: 0 });
		expect(get('a').hasAttribute(DRAG_LANDING_ATTRIBUTE)).toBe(false);
	});

	it('without movement it goes at once', () => {
		const { get } = setup(['a', 'b', 'c', 'd'], { preview, motion: false });

		drag(get('a'), at(get('d'), 0.25));
		pointer('pointerup', window, at(get('d'), 0.25));

		expect(ghost()).toBeNull();
	});
});

describe('a custom engine', () => {
	const preview = { render: (_key: string, container: HTMLElement) => void (container.textContent = 'ghost') };

	function record() {
		const transitions: MotionTransition[] = [];
		const engine: MotionEngine = (transition) => {
			transitions.push(transition);
		};

		return { engine, transitions, kinds: () => transitions.map(transition => transition.kind) };
	}

	it('plays the gap, the settling and the ghost, each named by its kind', async () => {
		const { engine, kinds } = record();
		const list = setup(['a', 'b', 'c', 'd'], { indicator: 'gap', preview, motion: engine, onDrop: () => reorder(list.get) });

		drag(list.get('a'), at(list.get('d'), 0.25));
		pointer('pointerup', window, at(list.get('d'), 0.25));
		await flush();

		expect(kinds()).toEqual(['gap', 'ghost']);
		expect(played).toEqual([]);
	});

	it('plays the line as an indicator', () => {
		const { engine, transitions } = record();
		const { get, container } = setup(['a', 'b', 'c', 'd', 'e'], { indicator: 'line', motion: engine });

		drag(get('a'), at(get('d'), 0.25));
		moveTo(at(get('e'), 0.75));

		expect(transitions.map(({ kind, moves }) => [kind, moves])).toEqual([
			['indicator', [{ element: container.querySelector(`[${DROP_INDICATOR_ATTRIBUTE}]`), x: 0, y: -60 }]],
		]);
	});

	it('is read when a gesture starts', async () => {
		const { engine, kinds } = record();
		const motion = shallowRef<MotionEngine | false>(false);
		let swapped = false;
		// Each drop swaps `a` and `b`.
		const list = setup(['a', 'b', 'c', 'd'], {
			motion,
			onDrop: () => {
				swapped = !swapped;
				void nextTick(() => {
					place(list.get('a'), { left: 0, top: swapped ? 30 : 0, right: 300, bottom: swapped ? 60 : 30 });
					place(list.get('b'), { left: 0, top: swapped ? 0 : 30, right: 300, bottom: swapped ? 30 : 60 });
				});
			},
		});

		drag(list.get('a'), at(list.get('d'), 0.25));
		motion.value = engine;
		pointer('pointerup', window, at(list.get('d'), 0.25));
		await nextTick();

		expect(kinds()).toEqual([]);

		drag(list.get('d'), at(list.get('a'), 0.25));
		pointer('pointerup', window, at(list.get('a'), 0.25));
		await nextTick();

		expect(kinds()).toEqual(['settle']);
	});
});
