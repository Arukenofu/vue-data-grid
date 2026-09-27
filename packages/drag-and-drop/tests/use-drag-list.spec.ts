import { effectScope, nextTick, shallowRef } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DragAnnouncements } from '../src/announcer';
import type { DragTree } from '../src/drop-position';
import { DRAG_SOURCE_ATTRIBUTE, type DragDropEvent, DROP_LEVEL_PROPERTY, DROP_TARGET_ATTRIBUTE } from '../src/model';
import { type DragListOptions, useDragList } from '../src/use-drag-list';
import { at, createList, type Frames, key, pointer, stubFrames, stubLayout } from './support';

const scopes: ReturnType<typeof effectScope>[] = [];

let frames: Frames;

function setup(keys: readonly string[], options: Partial<DragListOptions> = {}) {
	const list = createList(keys);
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

function region() {
	return document.querySelector('[aria-live]')?.textContent?.trim();
}

beforeEach(() => {
	stubLayout();
	frames = stubFrames();
});

afterEach(() => {
	pointer('pointercancel', window, { x: 0, y: 0 });
	scopes.splice(0).forEach(scope => scope.stop());
	document.body.innerHTML = '';
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('useDragList — the pointer', () => {
	it('marks the source and the target, and drops at the index after taking the source out', () => {
		const { get, drag, drops } = setup(['a', 'b', 'c', 'd', 'e']);

		pointer('pointerdown', get('a'), at(get('a')));
		pointer('pointermove', window, at(get('d'), 0.25));
		frames.run();

		expect(get('a').hasAttribute(DRAG_SOURCE_ATTRIBUTE)).toBe(true);
		expect(get('d').getAttribute(DROP_TARGET_ATTRIBUTE)).toBe('before');
		expect(drag.active.value).toBe('a');
		expect(drag.target.value).toEqual({ key: 'd', position: 'before', level: 0, parent: null, index: 2 });

		pointer('pointerup', window, at(get('d'), 0.25));

		expect(drops).toEqual([expect.objectContaining({ key: 'a', parent: null, index: 2, external: false })]);
		expect(get('a').hasAttribute(DRAG_SOURCE_ATTRIBUTE)).toBe(false);
		expect(get('d').hasAttribute(DROP_TARGET_ATTRIBUTE)).toBe(false);
		expect(drag.active.value).toBeNull();
	});

	it('a place where the drop would change nothing is not marked, and dropping there does nothing', () => {
		const { get, drops } = setup(['a', 'b', 'c']);

		pointer('pointerdown', get('b'), at(get('b')));
		pointer('pointermove', window, at(get('a'), 0.75));
		frames.run();

		expect(get('a').hasAttribute(DROP_TARGET_ATTRIBUTE)).toBe(false);

		pointer('pointerup', window, at(get('a'), 0.75));

		expect(drops).toEqual([]);
	});

	it('past the last item is the end of the list', () => {
		const { get, drops } = setup(['a', 'b', 'c']);

		pointer('pointerdown', get('a'), at(get('a')));
		pointer('pointermove', window, { x: 50, y: 200 });
		frames.run();
		pointer('pointerup', window, { x: 50, y: 200 });

		expect(drops[0]).toMatchObject({ key: 'a', index: 2 });
	});

	it('`canDrop` hides places', () => {
		const { get, drops } = setup(['a', 'b', 'c'], { canDrop: (_key, target) => target.key !== 'c' });

		pointer('pointerdown', get('a'), at(get('a')));
		pointer('pointermove', window, at(get('c'), 0.75));
		frames.run();

		expect(get('c').hasAttribute(DROP_TARGET_ATTRIBUTE)).toBe(false);

		pointer('pointerup', window, at(get('c'), 0.75));

		expect(drops).toEqual([]);
	});

	it('`canDrag` refuses a press on an item, and asks only when a gesture would start', () => {
		const canDrag = vi.fn((name: string) => name !== 'a');
		const { get, drag } = setup(['a', 'b', 'c'], { canDrag });

		expect(canDrag).not.toHaveBeenCalled();

		pointer('pointerdown', get('a'), at(get('a')));
		pointer('pointermove', window, at(get('c'), 0.75));
		frames.run();

		expect(canDrag).toHaveBeenCalledWith('a');
		expect(drag.active.value).toBeNull();

		pointer('pointerup', window, at(get('c'), 0.75));
		pointer('pointerdown', get('b'), at(get('b')));
		pointer('pointermove', window, at(get('c'), 0.75));
		frames.run();

		expect(drag.active.value).toBe('b');
	});

	it('an item that re-renders mid-drag keeps its mark', () => {
		const { get, drag } = setup(['a', 'b', 'c']);

		pointer('pointerdown', get('a'), at(get('a')));
		pointer('pointermove', window, at(get('c'), 0.75));
		frames.run();

		const fresh = get('c').cloneNode(true) as HTMLElement;

		fresh.removeAttribute(DROP_TARGET_ATTRIBUTE);
		drag.list.register(fresh, 'c');

		expect(fresh.getAttribute(DROP_TARGET_ATTRIBUTE)).toBe('after');
	});

	it('another list of the same group takes the item, a list without a group does not', () => {
		const first = setup(['a', 'b'], { group: 'shared' });
		const second = setup(['x', 'y'], { group: 'shared' });
		const lonely = setup(['p']);

		pointer('pointerdown', first.get('a'), at(first.get('a')));
		pointer('pointermove', window, at(first.get('b')));

		expect(second.drag.dragging.value?.key).toBe('a');
		expect(lonely.drag.dragging.value).toBeNull();
	});
});

describe('useDragList — scrolling', () => {
	/** A container that scrolls: `scrollBy` moves its `scrollTop`, as far as 1000 px. */
	function scrollable(container: HTMLElement) {
		let top = 0;

		Object.defineProperty(container, 'scrollTop', { configurable: true, get: () => top });
		container.scrollBy = ((_x: number, y: number) => {
			top = Math.min(Math.max(top + y, 0), 1000);
		}) as typeof container.scrollBy;

		return () => top;
	}

	function dragTo(from: HTMLElement, y: number, frameCount: number) {
		pointer('pointerdown', from, at(from));
		pointer('pointermove', window, { x: 150, y });

		for (let frame = 0; frame < frameCount; frame += 1) {
			frames.run();
		}
	}

	it('scrolls the container as `autoScroll` says while an item nears its edge', () => {
		const { get, container } = setup(['a', 'b', 'c'], { autoScroll: { threshold: 40, speed: 1000, curve: depth => depth } });
		const top = scrollable(container);

		// Half-way into the zone, 500 px/s, for four frames of 16 ms after the first.
		dragTo(get('a'), 280, 5);

		expect(top()).toBe(32);
	});

	it('scrolls nothing with `autoScroll: false`', () => {
		const { get, container } = setup(['a', 'b', 'c'], { autoScroll: false });
		const top = scrollable(container);

		dragTo(get('a'), 299, 5);

		expect(top()).toBe(0);
	});
});

describe('useDragList — a tree', () => {
	const tree: DragTree = {
		getParent: key => ({ x: 'g', y: 'g' } as Record<string, string>)[key] ?? null,
		getLevel: key => (key === 'x' || key === 'y' ? 1 : 0),
		getChildren: parent => (parent === null ? ['g', 'z'] : parent === 'g' ? ['x', 'y'] : []),
		canNest: key => key === 'g',
		isExpanded: key => key === 'g',
	};

	it('the middle of a group drops inside it, with the mark one level deeper', () => {
		const { get, drops } = setup(['g', 'x', 'y', 'z'], { tree });

		pointer('pointerdown', get('z'), at(get('z')));
		pointer('pointermove', window, at(get('g'), 0.5));
		frames.run();

		expect(get('g').getAttribute(DROP_TARGET_ATTRIBUTE)).toBe('inside');
		expect(get('g').style.getPropertyValue(DROP_LEVEL_PROPERTY)).toBe('1');

		pointer('pointerup', window, at(get('g'), 0.5));

		expect(drops[0]).toMatchObject({ key: 'z', parent: 'g', index: 0 });
	});

	it('a group cannot go into its own subtree', () => {
		const { get, drops } = setup(['g', 'x', 'y', 'z'], { tree });

		pointer('pointerdown', get('g'), at(get('g')));
		pointer('pointermove', window, at(get('y'), 0.75));
		frames.run();
		pointer('pointerup', window, at(get('y'), 0.75));

		expect(drops).toEqual([]);
	});
});

describe('useDragList — the keyboard', () => {
	it('Space picks up, arrows step through places, Enter drops', () => {
		const { get, drag, drops } = setup(['a', 'b', 'c', 'd', 'e']);

		key(get('a'), ' ');

		expect(drag.active.value).toBe('a');
		expect(get('a').hasAttribute(DRAG_SOURCE_ATTRIBUTE)).toBe(true);
		expect(region()).toBe('Picked up a, position 1 of 5.');

		key(get('a'), 'ArrowDown');

		expect(get('b').getAttribute(DROP_TARGET_ATTRIBUTE)).toBe('after');
		expect(region()).toBe('a: position 2 of 5.');

		key(get('a'), 'ArrowDown');
		key(get('a'), 'Enter');

		expect(drops).toEqual([expect.objectContaining({ key: 'a', parent: null, index: 2 })]);
		expect(region()).toBe('Dropped a at position 3 of 5.');
		expect(drag.active.value).toBeNull();
		expect(get('c').hasAttribute(DROP_TARGET_ATTRIBUTE)).toBe(false);
	});

	it('Escape cancels and says where the item stays', () => {
		const { get, drops } = setup(['a', 'b', 'c']);

		key(get('b'), 'Enter');
		key(get('b'), 'ArrowUp');

		const escape = key(get('b'), 'Escape');

		expect(escape.defaultPrevented).toBe(true);
		expect(drops).toEqual([]);
		expect(region()).toBe('Cancelled. b stays at position 2 of 3.');
	});

	it('Home and End jump to the first and the last place', () => {
		const { get, drops } = setup(['a', 'b', 'c', 'd']);

		key(get('c'), ' ');
		key(get('c'), 'Home');
		key(get('c'), ' ');

		expect(drops[0]).toMatchObject({ key: 'c', index: 0 });

		key(get('a'), ' ');
		key(get('a'), 'End');
		key(get('a'), ' ');

		expect(drops[1]).toMatchObject({ key: 'a', index: 3 });
	});

	it('an arrow at the last place stays there', () => {
		const { get, drops } = setup(['a', 'b']);

		key(get('a'), ' ');
		key(get('a'), 'ArrowDown');
		key(get('a'), 'ArrowDown');
		key(get('a'), ' ');

		expect(drops[0]).toMatchObject({ index: 1 });
	});

	it('with `stepKeys`, Alt+arrows on an item or inside it move it one place at once', () => {
		const { get, drops } = setup(['a', 'b', 'c'], { stepKeys: true });
		const inner = document.createElement('span');

		get('b').append(inner);
		key(inner, 'ArrowDown', { altKey: true });

		expect(drops).toEqual([expect.objectContaining({ key: 'b', parent: null, index: 2, external: false })]);
		expect(region()).toBe('Dropped b at position 3 of 3.');

		key(get('a'), 'ArrowUp', { altKey: true });
		key(get('c'), 'ArrowDown', { altKey: true, shiftKey: true });

		expect(drops).toHaveLength(1);
	});

	it('an Alt+arrow step honours `canDrop`, and does nothing without `stepKeys`', () => {
		const refused = setup(['a', 'b'], { stepKeys: true, canDrop: () => false });

		key(refused.get('a'), 'ArrowDown', { altKey: true });

		expect(refused.drops).toEqual([]);

		const plain = setup(['c', 'd']);

		key(plain.get('c'), 'ArrowDown', { altKey: true });

		expect(plain.drops).toEqual([]);
	});

	it('`canDrag` refuses Space and Alt+arrows, and leaves the keys to the page', () => {
		const { get, drag, drops } = setup(['a', 'b'], { stepKeys: true, canDrag: name => name !== 'a' });

		const space = key(get('a'), ' ');
		const step = key(get('a'), 'ArrowDown', { altKey: true });

		expect(drag.active.value).toBeNull();
		expect(drops).toEqual([]);
		expect(space.defaultPrevented).toBe(false);
		expect(step.defaultPrevented).toBe(false);
	});

	it('`handle`, `stepKeys` and `keyboard` may be refs, read when a key is pressed', () => {
		const handle = shallowRef<string | undefined>(undefined);
		const stepKeys = shallowRef(false);
		const { get, drag, drops } = setup(['a', 'b'], { handle, stepKeys });
		const grip = document.createElement('button');

		grip.className = 'grip';
		get('a').append(grip);
		key(get('a'), 'ArrowDown', { altKey: true });

		expect(drops).toEqual([]);

		stepKeys.value = true;
		key(get('a'), 'ArrowDown', { altKey: true });

		expect(drops).toHaveLength(1);

		handle.value = '.grip';
		key(get('b'), ' ');

		expect(drag.active.value).toBeNull();

		key(grip, ' ');

		expect(drag.active.value).toBe('a');
	});

	it('`reveal` brings each place into view', () => {
		const reveal = vi.fn();
		const { get } = setup(['a', 'b', 'c'], { reveal });

		key(get('a'), ' ');
		key(get('a'), 'ArrowDown');

		expect(reveal).toHaveBeenCalledWith('b');
	});

	it('a place whose item is not in the DOM is marked once the item mounts', () => {
		const { get, drag } = setup(['a', 'b', 'c']);
		const later = document.createElement('div');

		get('c').remove();
		drag.list.register(get('c'), 'c')();
		key(get('a'), ' ');
		key(get('a'), 'End');
		drag.list.register(later, 'c');

		expect(later.getAttribute(DROP_TARGET_ATTRIBUTE)).toBe('after');
	});

	it('with a handle, only the handle picks up; without one, only the item itself', () => {
		const withHandle = setup(['a', 'b'], { handle: '.grip' });
		const grip = document.createElement('button');

		grip.className = 'grip';
		withHandle.get('a').append(grip);
		key(withHandle.get('a'), ' ');

		expect(withHandle.drag.active.value).toBeNull();

		key(grip, ' ');

		expect(withHandle.drag.active.value).toBe('a');

		const withoutHandle = setup(['p', 'q']);
		const button = document.createElement('button');

		withoutHandle.get('p').append(button);
		key(button, 'Enter');

		expect(withoutHandle.drag.active.value).toBeNull();
	});

	it('typing in a field inside an item never picks it up', () => {
		const { get, drag } = setup(['a', 'b'], { handle: '.grip' });
		const input = document.createElement('input');

		input.className = 'grip';
		get('a').append(input);
		key(input, ' ');

		expect(drag.active.value).toBeNull();
	});

	it('`keyboard: false` turns it off', () => {
		const { get, drag } = setup(['a', 'b'], { keyboard: false });

		key(get('a'), ' ');

		expect(drag.active.value).toBeNull();
	});

	it('a pointer press cancels a keyboard drag', () => {
		const { get, drag, drops } = setup(['a', 'b', 'c']);

		key(get('a'), ' ');
		key(get('a'), 'ArrowDown');
		pointer('pointerdown', get('c'), at(get('c')));

		expect(drag.active.value).toBeNull();
		expect(drops).toEqual([]);
	});

	it('the instructions are in the document under `describedBy`', () => {
		const { drag } = setup(['a']);

		expect(document.getElementById(drag.describedBy)?.textContent).toContain('Space or Enter');
	});

	it('announcements may be a ref: what is said and the instructions follow it', async () => {
		const announcements = shallowRef<Partial<DragAnnouncements>>({ instructions: 'Drag me', pickUp: () => 'Up' });
		const { get, drag } = setup(['a', 'b'], { announcements });
		const first = drag.describedBy;

		expect(document.getElementById(first)?.textContent).toBe('Drag me');

		announcements.value = { instructions: 'Zieh mich', pickUp: () => 'Hoch' };
		await nextTick();

		expect(drag.describedBy).not.toBe(first);
		expect(document.getElementById(drag.describedBy)?.textContent).toBe('Zieh mich');

		key(get('a'), ' ');

		expect(region()).toBe('Hoch');
	});

	it('announcements take labels and can be replaced', () => {
		const { get } = setup(['a', 'b'], {
			getLabel: name => `Row ${name.toUpperCase()}`,
			announcements: { pickUp: context => `Grabbed ${context.item}` },
		});

		key(get('a'), ' ');

		expect(region()).toBe('Grabbed Row A');
	});

	it('focus comes back to the item after the drop re-renders the list', async () => {
		const { get, container } = setup(['a', 'b', 'c']);

		get('a').focus();
		key(get('a'), ' ');
		key(get('a'), 'End');
		key(get('a'), ' ');
		container.append(get('a'));
		(document.activeElement as HTMLElement | null)?.blur();
		await nextTick();

		expect(document.activeElement).toBe(get('a'));
	});
});

describe('useDragList — a horizontal list', () => {
	it('in a right-to-left container the arrows follow the reading direction', async () => {
		const container = shallowRef<HTMLElement | null>(null);
		const { get, drops, container: element } = setup(['a', 'b', 'c'], { axis: 'horizontal', container });

		element.style.direction = 'rtl';
		container.value = element;
		await nextTick();
		key(get('a'), ' ');
		key(get('a'), 'ArrowLeft');
		key(get('a'), ' ');

		expect(drops[0]).toMatchObject({ key: 'a', index: 1 });
	});
});
