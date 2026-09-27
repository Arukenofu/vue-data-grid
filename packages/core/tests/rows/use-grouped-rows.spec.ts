import { shallowRef } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import type { ColumnAggregates } from '../../src/columns/column';
import { defineColumns } from '../../src/columns/define-columns';
import type { RowGroup } from '../../src/rows/row-groups';
import { useGroupedRows } from '../../src/rows/use-grouped-rows';

interface Row {
	id: string;
	sector: string;
	cap: number;
	children?: Row[];
}

const columns = defineColumns({
	sector: { value: (row: Row) => row.sector },
	cap: { value: (row: Row) => row.cap, aggregate: 'sum' },
});

const createRows = (): Row[] => [
	{ id: 'a', sector: 'tech', cap: 1 },
	{ id: 'b', sector: 'energy', cap: 2 },
	{ id: 'c', sector: 'tech', cap: 3 },
];

function setup() {
	const rows = shallowRef(createRows());
	const by = shallowRef([columns.sector]);
	const createGroup = vi.fn((group: RowGroup<Row, ColumnAggregates<typeof columns>>): Row => ({
		id: group.key,
		sector: String(group.value),
		cap: group.aggregates.cap ?? 0,
		children: [...group.children],
	}));
	const grouped = useGroupedRows({ rows, by, columns, createGroup });

	return { rows, by, createGroup, grouped };
}

describe('useGroupedRows', () => {
	it('builds groups with aggregates', () => {
		const { grouped } = setup();

		expect(grouped.value.map(group => [group.id, group.cap])).toEqual([
			['group:sector=tech', 4],
			['group:sector=energy', 2],
		]);
	});

	it('a tick on one row rebuilds only its group', () => {
		const { rows, grouped, createGroup } = setup();
		const [tech, energy] = grouped.value;

		createGroup.mockClear();
		rows.value = rows.value.map(row => (row.id === 'b' ? { ...row, cap: 5 } : row));

		expect(grouped.value[0]).toBe(tech);
		expect(grouped.value[1]).not.toBe(energy);
		expect(grouped.value[1].cap).toBe(5);
		expect(createGroup).toHaveBeenCalledTimes(1);
	});

	it('the same rows in a new array give the same array of groups', () => {
		const { rows, grouped } = setup();
		const before = grouped.value;

		rows.value = [...rows.value];

		expect(grouped.value).toBe(before);
	});

	it('without levels the rows pass as they are', () => {
		const { rows, by, grouped } = setup();

		by.value = [];

		expect(grouped.value).toBe(rows.value);
	});
});
