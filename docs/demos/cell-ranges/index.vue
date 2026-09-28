<script setup lang="ts">
import { clipboard, defineColumn, defineColumns, downloadCsv, navigation, ranges, toCsv, useDataGrid } from '@vue-data-grid/core';
import IconCopy from '~icons/lucide/copy';
import IconDownload from '~icons/lucide/download';
import { computed, shallowRef } from 'vue';

import { UiButton, UiDataGrid, UiStat, UiSwitch, UiToolbar } from '@/ui';

import { type BudgetLine, budget } from './data';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function amount(value: number) {
	return money.format(value);
}

const column = defineColumn<BudgetLine>();

const columns = defineColumns({
	team: column('team', { label: 'Team', width: 120, pinned: 'start', pinnable: true }),
	q1: column('q1', { label: 'Q1', width: 100, align: 'right', format: amount }),
	q2: column('q2', { label: 'Q2', width: 100, align: 'right', format: amount }),
	q3: column('q3', { label: 'Q3', width: 100, align: 'right', format: amount }),
	q4: column('q4', { label: 'Q4', width: 100, align: 'right', format: amount }),
	year: column(line => line.q1 + line.q2 + line.q3 + line.q4, {
		label: 'Year',
		width: 116,
		align: 'right',
		format: amount,
		cellClass: () => 'ui-cell-strong',
	}),
});

const withHeaders = shallowRef(false);
const status = shallowRef('');

const grid = useDataGrid({
	columns,
	rows: budget,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		navigation: navigation(),
		ranges: ranges(),
		clipboard: clipboard({ headers: withHeaders }),
	},
});

const summary = computed(() => {
	const cells = grid.ranges.getCells();
	const numbers = cells.flatMap((cell) => {
		const row = grid.rows.value[grid.scope.getRowIndex(cell.key)];
		const value = row === undefined ? undefined : grid.scope.getColumn(cell.column)?.column?.value(row);

		return typeof value === 'number' ? [value] : [];
	});
	const sum = numbers.reduce((total, value) => total + value, 0);

	return {
		cells: cells.length,
		sum: amount(sum),
		average: amount(numbers.length > 0 ? sum / numbers.length : 0),
	};
});

async function copy() {
	const copied = await grid.clipboard.copy();

	status.value = copied ? 'Copied as tab-separated text: paste it into a spreadsheet.' : 'Select some cells first.';
}

function download() {
	const shown = grid.scope.columns.value.flatMap(item => (item.column ? [item.column] : []));

	downloadCsv(toCsv({ columns: shown, rows: grid.rows.value }), { name: 'budget' });
}
</script>

<template>
	<div class="ui-stack">
		<UiToolbar>
			<UiButton @click="grid.ranges.selectAll()">Select all</UiButton>
			<UiButton variant="ghost" @click="grid.ranges.clear()">Clear</UiButton>
			<span class="ui-separator" />
			<UiSwitch v-model="withHeaders" label="Copy with headers" />
			<span class="ui-spacer" />
			<UiButton @click="copy">
				<IconCopy aria-hidden="true" />
				Copy
			</UiButton>
			<UiButton variant="solid" @click="download">
				<IconDownload aria-hidden="true" />
				Download CSV
			</UiButton>
		</UiToolbar>

		<UiDataGrid :grid="grid" label="Budget by team" data-size="sm" />

		<div class="summary" aria-live="polite">
			<template v-if="summary.cells > 0">
				<UiStat label="Cells" :value="summary.cells" />
				<UiStat label="Sum" :value="summary.sum" />
				<UiStat label="Average" :value="summary.average" />
			</template>
			<span v-else class="ui-muted">Drag across the cells, or click one and Shift+click another.</span>
			<span class="summary-status ui-muted">{{ status }}</span>
		</div>
	</div>
</template>

<style scoped>
.summary {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 16px;
	min-height: 20px;
	font-size: 12.5px;
}

.summary-status {
	margin-inline-start: auto;
}
</style>
