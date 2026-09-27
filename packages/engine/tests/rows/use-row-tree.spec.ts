import { ref, shallowRef } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import { defineColumns } from '../../src/columns/define-columns';
import type { ChildrenField } from '../../src/rows/row-tree';
import { useRowTree } from '../../src/rows/use-row-tree';

interface Node {
	id: string;
	cap: number;
	children?: Node[];
}

interface Flat {
	id: string;
	parentId: string | null;
	cap: number;
}

const FIELD = 'children' as ChildrenField<Node>;

const nested: Node[] = [
	{ id: 'a', cap: 1, children: [{ id: 'a1', cap: 3 }, { id: 'a2', cap: 2, children: [{ id: 'a2x', cap: 9 }] }] },
	{ id: 'b', cap: 5 },
];

const flat: Flat[] = [
	{ id: 'a2x', parentId: 'a2', cap: 9 },
	{ id: 'a', parentId: null, cap: 1 },
	{ id: 'a1', parentId: 'a', cap: 3 },
	{ id: 'b', parentId: null, cap: 5 },
	{ id: 'a2', parentId: 'a', cap: 2 },
];

const keys = (rows: readonly { id: string }[]) => rows.map(row => row.id);

describe('useRowTree — children field', () => {
	it('shows the expanded tree in traversal order', () => {
		const tree = useRowTree({ rows: nested, rowKey: 'id', childrenField: FIELD, defaultExpanded: -1 });

		expect(keys(tree.rows.value)).toEqual(['a', 'a1', 'a2', 'a2x', 'b']);
		expect(tree.nodes.value.map(node => node.level)).toEqual([0, 1, 1, 2, 0]);
		expect(tree.getNode('a')?.count).toBe(2);
	});

	it('says whether any row has children', () => {
		const rows = shallowRef<Node[]>(nested);
		const tree = useRowTree({ rows, rowKey: 'id', childrenField: FIELD });

		expect(tree.hasGroups.value).toBe(true);

		rows.value = [{ id: 'a', cap: 1 }, { id: 'b', cap: 5 }];

		expect(tree.hasGroups.value).toBe(false);
	});

	it('starts collapsed without `expanded` and `defaultExpanded`', () => {
		const tree = useRowTree({ rows: nested, rowKey: 'id', childrenField: FIELD });

		expect(keys(tree.rows.value)).toEqual(['a', 'b']);

		tree.toggle('a');

		expect(keys(tree.rows.value)).toEqual(['a', 'a1', 'a2', 'b']);
	});

	it('a function `rowKey` works: it is not taken for a getter', () => {
		const tree = useRowTree({ rows: nested, rowKey: row => `k-${row.id}`, childrenField: FIELD });

		expect(tree.nodes.value.map(node => node.key)).toEqual(['k-a', 'k-b']);
	});
});

describe('useRowTree — parent keys', () => {
	it('builds the same tree from a flat list', () => {
		const tree = useRowTree({ rows: flat, rowKey: 'id', parentKey: 'parentId', defaultExpanded: -1 });

		expect(tree.enabled.value).toBe(true);
		expect(keys(tree.rows.value)).toEqual(['a', 'a1', 'a2', 'a2x', 'b']);
		expect(tree.getNode('a2')).toMatchObject({ group: true, parent: 'a', count: 1 });
		expect(tree.getNode('b')?.group).toBe(false);
	});

	it('a row whose parent is missing goes to the top level', () => {
		const tree = useRowTree({
			rows: [{ id: 'x', parentId: 'nobody', cap: 0 }],
			rowKey: 'id',
			parentKey: 'parentId',
		});

		expect(tree.getNode('x')?.parent).toBeNull();
	});

	it('rows in a cycle of parents are shown at the top level instead of disappearing', () => {
		const tree = useRowTree({
			rows: [{ id: 'p', parentId: 'q', cap: 0 }, { id: 'q', parentId: 'p', cap: 0 }],
			rowKey: 'id',
			parentKey: 'parentId',
			defaultExpanded: -1,
		});

		expect(keys(tree.rows.value)).toEqual(['p', 'q']);
		expect(tree.getNode('q')?.parent).toBe('p');
	});
});

describe('useRowTree — sorting siblings', () => {
	const columns = defineColumns({ cap: { value: (row: Node) => row.cap } });

	it('sorts every level', () => {
		const tree = useRowTree({
			rows: nested,
			rowKey: 'id',
			childrenField: FIELD,
			defaultExpanded: -1,
			sort: [{ name: 'cap', direction: 'desc' }],
			columns,
		});

		expect(keys(tree.rows.value)).toEqual(['b', 'a', 'a1', 'a2', 'a2x']);
	});

	it('siblings whose array did not change are not sorted again', () => {
		const value = vi.fn((row: Node) => row.cap);
		const counted = defineColumns({ cap: { value } });
		const source = shallowRef(nested);
		const tree = useRowTree({
			rows: source,
			rowKey: 'id',
			childrenField: FIELD,
			defaultExpanded: -1,
			sort: [{ name: 'cap', direction: 'asc' }],
			columns: counted,
		});

		void tree.rows.value;
		value.mockClear();
		source.value = [nested[0], { ...nested[1], cap: 6 }];
		void tree.rows.value;

		expect(value.mock.calls.map(([row]) => row.id).sort()).toEqual(['a', 'b']);
	});
});

describe('useRowTree — positions among siblings', () => {
	it('every node knows its place among its siblings and how many there are', () => {
		const tree = useRowTree({ rows: nested, rowKey: 'id', childrenField: FIELD, defaultExpanded: -1 });

		expect(tree.nodes.value.map(node => [node.key, node.position, node.setSize])).toEqual([
			['a', 0, 2],
			['a1', 0, 2],
			['a2', 1, 2],
			['a2x', 0, 1],
			['b', 1, 2],
		]);
	});

	it('positions follow sorted siblings', () => {
		const columns = defineColumns({ cap: { value: (row: Node) => row.cap } });
		const tree = useRowTree({
			rows: nested,
			rowKey: 'id',
			childrenField: FIELD,
			defaultExpanded: -1,
			sort: [{ name: 'cap', direction: 'desc' }],
			columns,
		});

		expect(tree.nodes.value.map(node => [node.key, node.position])).toEqual([
			['b', 0],
			['a', 1],
			['a1', 0],
			['a2', 1],
			['a2x', 0],
		]);
	});

	it('rows in a cycle of parents count among the top level', () => {
		const tree = useRowTree({
			rows: [{ id: 'top', parentId: null, cap: 0 }, { id: 'p', parentId: 'q', cap: 0 }, { id: 'q', parentId: 'p', cap: 0 }],
			rowKey: 'id',
			parentKey: 'parentId',
		});

		expect(tree.getNode('top')).toMatchObject({ position: 0, setSize: 2 });
		expect(tree.getNode('p')).toMatchObject({ position: 1, setSize: 2 });
		expect(tree.getNode('q')).toMatchObject({ parent: 'p', position: 0, setSize: 1 });
	});

	it('a row that changes its place gets a new node, and the rows under it keep theirs', () => {
		const source = shallowRef(nested);
		const tree = useRowTree({ rows: source, rowKey: 'id', childrenField: FIELD });
		const a = tree.getNode('a');
		const a1 = tree.getNode('a1');

		source.value = [nested[1], nested[0]];

		expect(tree.getNode('a')).toMatchObject({ position: 1, setSize: 2 });
		expect(tree.getNode('a')).not.toBe(a);
		expect(tree.getNode('a1')).toBe(a1);
	});
});

describe('useRowTree — stable references', () => {
	it('expanding a group keeps the nodes of every other row', () => {
		const tree = useRowTree({ rows: nested, rowKey: 'id', childrenField: FIELD });
		const before = tree.nodes.value;

		tree.toggle('a');

		const after = tree.nodes.value;

		expect(after[0]).not.toBe(before[0]);
		expect(after[0].expanded).toBe(true);
		expect(after.at(-1)).toBe(before.at(-1));
	});

	it('a new array with the same rows gives the same shown rows and nodes', () => {
		const source = shallowRef(nested);
		const tree = useRowTree({ rows: source, rowKey: 'id', childrenField: FIELD, defaultExpanded: 1 });
		const rows = tree.rows.value;
		const nodes = tree.nodes.value;

		source.value = [...nested];

		expect(tree.rows.value).toBe(rows);
		expect(tree.nodes.value).toBe(nodes);
	});

	it('a changed leaf replaces only its own row, and nodes survive', () => {
		const source = shallowRef(nested);
		const tree = useRowTree({ rows: source, rowKey: 'id', childrenField: FIELD, defaultExpanded: -1 });
		const nodes = tree.nodes.value;

		source.value = [nested[0], { ...nested[1], cap: 7 }];

		expect(tree.rows.value.at(-1)?.cap).toBe(7);
		expect(tree.nodes.value.every((node, index) => node === nodes[index])).toBe(true);
	});

	it('`expanded` from outside drives the tree', () => {
		const expanded = ref<string[] | undefined>(['a']);
		const tree = useRowTree({ rows: nested, rowKey: 'id', childrenField: FIELD, expanded });

		expect(keys(tree.rows.value)).toEqual(['a', 'a1', 'a2', 'b']);

		tree.reveal('a2x');

		expect(new Set(expanded.value)).toEqual(new Set(['a', 'a2']));
	});
});
