<script setup lang="ts">
import {
	type CellRange,
	clipboard,
	defineColumn,
	defineColumns,
	editing,
	fill,
	navigation,
	numberField,
	ranges,
	TableBody,
	TableCells,
	TableFillHandle,
	TableFillPreview,
	TableHeader,
	TableHeaderCell,
	TableHeaderRow,
	TableRangeOverlay,
	TableRoot,
	TableRow,
	useDataTable,
} from 'vue-data-grid';
import { computed, shallowRef } from 'vue';

import { UiStat, UiToolbar } from '@/ui';

import { budget, type BudgetLine, type Month, MONTHS } from './data';

const LABELS: Readonly<Record<Month, string>> = { jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', may: 'May', jun: 'Jun' };

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const column = defineColumn<BudgetLine>();

function validate(amount: number | null) {
	if (amount === null || Number.isNaN(amount)) {
		return 'Enter an amount';
	}

	return amount < 0 ? 'An amount cannot be negative' : undefined;
}

function month(name: Month) {
	return column((line): number | null => line.months[name], {
		label: LABELS[name],
		width: 104,
		align: 'right',
		editable: true,
		...numberField({ min: 0, step: 100 }),
		format: amount => money.format(amount ?? 0),
		setValue: (line, amount) => ({ ...line, months: { ...line.months, [name]: amount ?? 0 } }),
		validate,
	});
}

function total(line: BudgetLine) {
	let sum = 0;

	for (const name of MONTHS) {
		sum += line.months[name];
	}

	return sum;
}

const columns = defineColumns({
	category: column(line => line.category, { label: 'Category', width: 150, pinned: 'start' }),
	jan: month('jan'),
	feb: month('feb'),
	mar: month('mar'),
	apr: month('apr'),
	may: month('may'),
	jun: month('jun'),
	total: column(total, { label: 'Total', width: 120, align: 'right', format: sum => money.format(sum) }),
});

const rows = shallowRef<readonly BudgetLine[]>(budget);
const selection = shallowRef<readonly CellRange[]>([
	{ anchor: { key: 'cloud', column: 'jan' }, focus: { key: 'travel', column: 'mar' } },
]);

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 38,
	features: {
		navigation: navigation(),
		ranges: ranges({ ranges: selection }),
		editing: editing({
			onCommit: (commit) => {
				rows.value = commit.apply(rows.value);
			},
		}),
		fill: fill(),
		clipboard: clipboard(),
	},
});

function isMonth(name: string): name is Month {
	return MONTHS.some(item => item === name);
}

const totals = computed(() => {
	const lines = new Map(rows.value.map(line => [line.id, line]));
	let sum = 0;
	let count = 0;

	for (const cell of table.ranges.getCells()) {
		const line = lines.get(cell.key);

		if (line && isMonth(cell.column)) {
			sum += line.months[cell.column];
			count += 1;
		}
	}

	return { sum, count, average: count === 0 ? 0 : sum / count };
});
</script>

<template>
	<div>
		<TableRoot :table="table" label="Budget" class="ui-table" data-size="auto">
			<TableHeader>
				<TableHeaderRow v-slot="{ columns: headers }">
					<TableHeaderCell v-for="header in headers" :key="header.key" :column="header" />
				</TableHeaderRow>
			</TableHeader>
			<TableBody v-slot="{ rows: bodyRows }">
				<TableRow v-for="row in bodyRows" :key="row.key" :row="row">
					<TableCells />
				</TableRow>
				<TableRangeOverlay v-slot="{ corner }">
					<TableFillHandle v-if="corner" />
				</TableRangeOverlay>
				<TableFillPreview />
			</TableBody>
		</TableRoot>

		<UiToolbar class="status">
			<UiStat label="Cells" :value="totals.count" />
			<UiStat label="Sum" :value="money.format(totals.sum)" />
			<UiStat label="Average" :value="money.format(totals.average)" />
		</UiToolbar>
	</div>
</template>

<style scoped>
.status {
	justify-content: flex-end;
	margin-block: 12px 0;
}
</style>
