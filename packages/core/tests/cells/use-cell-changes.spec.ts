import { defineComponent, nextTick, shallowRef } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type CellChangesOptions, useCellChanges } from '../../src/cells/use-cell-changes';
import { defineColumns } from '../../src/columns/define-columns';
import { useTableEngine } from '../../src/engine/use-table-engine';

interface Row {
	id: string;
	price: number | null;
	tags: string[];
}

const columns = defineColumns({
	price: { value: (row: Row) => row.price },
	tags: {
		value: (row: Row) => row.tags,
		equals: (a: string[], b: string[]) => a.join() === b.join(),
	},
	flag: { value: (row: Row) => row.price, kind: 'service' },
});

const initial: Row[] = [
	{ id: 'a', price: 10, tags: ['x'] },
	{ id: 'b', price: 20, tags: [] },
];

function setup(options: CellChangesOptions = {}) {
	const rows = shallowRef<Row[]>(initial);
	let changes: ReturnType<typeof useCellChanges> | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			const engine = useTableEngine({ columns, rows, root: shallowRef(null), rowKey: 'id', rowHeight: 36 });

			changes = useCellChanges(engine.scope, options);

			return () => null;
		},
	}));

	async function update(id: string, fields: Partial<Row>) {
		rows.value = rows.value.map(row => (row.id === id ? { ...row, ...fields } : row));
		await nextTick();
	}

	return {
		rows,
		update,
		changes: changes as unknown as ReturnType<typeof useCellChanges>,
		unmount: () => wrapper.unmount(),
	};
}

let current: ReturnType<typeof setup> | null = null;

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	current?.unmount();
	current = null;
	vi.useRealTimers();
});

describe('useCellChanges', () => {
	it('the first rows are not changes', () => {
		current = setup();

		expect(current.changes.getChanges('a')).toBeUndefined();
	});

	it('a new value under a known key is a change with its direction', async () => {
		current = setup();
		await current.update('a', { price: 12 });
		await current.update('b', { price: 15 });

		expect(current.changes.getChange('a', 'price')?.direction).toBe('up');
		expect(current.changes.getChange('b', 'price')?.direction).toBe('down');
		expect(current.changes.getChange('a', 'tags')).toBeUndefined();
	});

	it('service columns are not watched unless named', async () => {
		current = setup();
		await current.update('a', { price: 12 });

		expect(current.changes.getChange('a', 'flag')).toBeUndefined();

		current.unmount();
		current = setup({ columns: ['flag'] });
		await current.update('a', { price: 12 });

		expect(current.changes.getChange('a', 'flag')?.direction).toBe('up');
	});

	it('a new object with equal values is not a change, through the column\'s `equals`', async () => {
		current = setup();
		await current.update('a', { tags: ['x'] });

		expect(current.changes.getChanges('a')).toBeUndefined();
	});

	it('a value that becomes empty is a change without a direction', async () => {
		current = setup();
		await current.update('a', { price: null });

		expect(current.changes.getChange('a', 'price')?.direction).toBeNull();
	});

	it('a row keeps one frozen object while its changes hold', async () => {
		current = setup();
		await current.update('a', { price: 12 });

		const token = current.changes.getChanges('a');

		await current.update('b', { price: 25 });

		expect(current.changes.getChanges('a')).toBe(token);
		expect(Object.isFrozen(token)).toBe(true);
	});

	it('changes expire after `duration`, each on its own time', async () => {
		current = setup({ duration: 1000 });
		await current.update('a', { price: 12 });
		vi.advanceTimersByTime(600);
		await current.update('b', { price: 25 });
		vi.advanceTimersByTime(400);

		expect(current.changes.getChanges('a')).toBeUndefined();
		expect(current.changes.getChange('b', 'price')).toBeDefined();

		vi.advanceTimersByTime(600);

		expect(current.changes.getChanges('b')).toBeUndefined();
	});

	it('`columns` limits what is watched', async () => {
		current = setup({ columns: ['tags'] });
		await current.update('a', { price: 12, tags: ['y'] });

		expect(Object.keys(current.changes.getChanges('a') ?? {})).toEqual(['tags']);
	});

	it('a removed row is forgotten: when it comes back it is new', async () => {
		current = setup();
		current.rows.value = [initial[1]];
		await nextTick();
		current.rows.value = [{ ...initial[0], price: 11 }, initial[1]];
		await nextTick();

		expect(current.changes.getChanges('a')).toBeUndefined();
	});

	it('`clear` forgets everything', async () => {
		current = setup();
		await current.update('a', { price: 12 });
		current.changes.clear();

		expect(current.changes.getChanges('a')).toBeUndefined();
	});
});
