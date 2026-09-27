import { describe, expect, it } from 'vitest';

import {
	collectDropSlots,
	createFlatTree,
	describeDestination,
	type DragTree,
	getOwnDestination,
	isInside,
	resolveDestination,
	resolvePosition,
} from '../src/drop-position';

const flat = createFlatTree(() => ['a', 'b', 'c', 'd']);

/**
 * docs          (expanded)
 *   guide
 *   api         (collapsed, nests)
 *     hooks
 * notes
 */
function createTree(expanded: readonly string[] = ['docs']): DragTree {
	const children: Record<string, readonly string[]> = { docs: ['guide', 'api'], api: ['hooks'] };
	const parents: Record<string, string> = { guide: 'docs', api: 'docs', hooks: 'api' };

	return {
		getParent: key => parents[key] ?? null,
		getLevel: (key) => {
			let level = 0;

			for (let parent = parents[key]; parent; parent = parents[parent]) {
				level += 1;
			}

			return level;
		},
		getChildren: parent => (parent === null ? ['docs', 'notes'] : children[parent] ?? []),
		canNest: key => key === 'docs' || key === 'api',
		isExpanded: key => expanded.includes(key),
	};
}

describe('resolveDestination — a flat list', () => {
	it('an index is counted after the source is taken out', () => {
		expect(resolveDestination(flat, 'a', 'c', 'after')).toEqual({ parent: null, index: 2 });
		expect(resolveDestination(flat, 'd', 'b', 'before')).toEqual({ parent: null, index: 1 });
	});

	it('a place that leaves the source where it is gives `null`', () => {
		expect(resolveDestination(flat, 'b', 'a', 'after')).toBeNull();
		expect(resolveDestination(flat, 'b', 'c', 'before')).toBeNull();
	});

	it('a foreign source is inserted without being taken out', () => {
		expect(resolveDestination(flat, 'x', 'b', 'after')).toEqual({ parent: null, index: 2 });
	});
});

describe('resolveDestination — a tree', () => {
	const tree = createTree();

	it('inside is the first child', () => {
		expect(resolveDestination(tree, 'notes', 'api', 'inside')).toEqual({ parent: 'api', index: 0 });
	});

	it('next to an item is among its siblings', () => {
		expect(resolveDestination(tree, 'notes', 'guide', 'after')).toEqual({ parent: 'docs', index: 1 });
	});

	it('inside, where the source already is first, changes nothing', () => {
		expect(resolveDestination(tree, 'guide', 'docs', 'inside')).toBeNull();
	});
});

describe('resolvePosition', () => {
	const tree = createTree();

	it('the middle of an item that nests is inside, the edges are next to it', () => {
		expect([0.1, 0.5, 0.9].map(ratio => resolvePosition(tree, 'api', ratio))).toEqual(['before', 'inside', 'after']);
	});

	it('an item that does not nest splits in halves', () => {
		expect([0.4, 0.6].map(ratio => resolvePosition(tree, 'notes', ratio))).toEqual(['before', 'after']);
	});

	it('below the middle of an expanded item is its first child', () => {
		expect(resolvePosition(createTree(['docs']), 'docs', 0.9)).toBe('inside');
	});
});

describe('isInside', () => {
	it('finds an ancestor on any level', () => {
		const tree = createTree();

		expect(isInside(tree, 'hooks', 'docs')).toBe(true);
		expect(isInside(tree, 'docs', 'hooks')).toBe(false);
	});
});

describe('collectDropSlots', () => {
	it('a flat list gives each distinct destination once, in display order', () => {
		const slots = collectDropSlots(flat, ['a', 'b', 'c', 'd'], 'b');

		expect(slots.map(slot => `${slot.position} ${slot.key} → ${slot.index}`)).toEqual([
			'before a → 0',
			'after c → 2',
			'after d → 3',
		]);
	});

	it('a tree skips the source subtree and offers inside for items that nest', () => {
		const slots = collectDropSlots(createTree(), ['docs', 'guide', 'api', 'notes'], 'api');

		expect(slots.map(slot => `${slot.position} ${slot.key} → ${slot.parent}:${slot.index} @${slot.level}`)).toEqual([
			'before docs → null:0 @0',
			'inside docs → docs:0 @1',
			'before notes → null:1 @0',
			'after notes → null:2 @0',
		]);
	});

	it('an expanded item offers no place after it: its first child comes there', () => {
		const slots = collectDropSlots(createTree(), ['docs', 'guide', 'api', 'notes'], 'notes');

		expect(slots.some(slot => slot.key === 'docs' && slot.position === 'after')).toBe(false);
	});

	it('`canDrop` removes places, and the next equivalent one is offered instead', () => {
		const slots = collectDropSlots(flat, ['a', 'b', 'c', 'd'], 'a', slot => slot.position !== 'after' || slot.key !== 'b');

		expect(slots.map(slot => `${slot.position} ${slot.key}`)).toEqual(['before c', 'after c', 'after d']);
	});

	it('slots are ordered by where they are drawn', () => {
		const slots = collectDropSlots(flat, ['a', 'b', 'c', 'd'], 'c');
		const orders = slots.map(slot => slot.order);

		expect(orders).toEqual([...orders].sort((first, second) => first - second));
	});
});

describe('describing a place', () => {
	it('the own place of an item is its parent and index', () => {
		expect(getOwnDestination(createTree(), 'api')).toEqual({ parent: 'docs', index: 1 });
	});

	it('a place counts the item among the siblings it will have', () => {
		const tree = createTree();

		expect(describeDestination(tree, 'notes', { parent: 'docs', index: 0 })).toEqual({ position: 1, total: 3 });
		expect(describeDestination(tree, 'guide', { parent: 'docs', index: 1 })).toEqual({ position: 2, total: 2 });
	});
});
