<script setup lang="ts">
import { defineColumn, defineColumns, navigation, sorting, useDataTable } from 'vue-data-grid';
import IconArrowDownToLine from '~icons/lucide/arrow-down-to-line';
import IconArrowUpToLine from '~icons/lucide/arrow-up-to-line';
import IconLocate from '~icons/lucide/locate';
import { computed, h, nextTick, shallowRef, watch } from 'vue';

import { type BadgeTone, type Option, UiBadge, UiButton, UiDataTable, UiNumberField, UiStat, UiToggleGroup, UiToolbar } from '@/ui';

import { createReadings, type Health, METRICS, type Reading } from './data';

type Size = '10000' | '50000' | '100000';

const SIZES: readonly Option<Size>[] = [
	{ value: '10000', label: '10k rows' },
	{ value: '50000', label: '50k rows' },
	{ value: '100000', label: '100k rows' },
];

const HEALTH: Readonly<Record<Health, { label: string; tone: BadgeTone }>> = {
	ok: { label: 'OK', tone: 'green' },
	warning: { label: 'Warning', tone: 'amber' },
	failing: { label: 'Failing', tone: 'red' },
};

const size = shallowRef<Size>('50000');
const target = shallowRef(25000);
const sortTime = shallowRef<number | null>(null);

const rows = computed(() => createReadings(Number(size.value)));

const column = defineColumn<Reading>({ sortable: true, resizable: true, width: 124, align: 'right' });

const metrics = Object.fromEntries(METRICS.map((metric, index) => [
	`metric${index}`,
	column(reading => reading.values[index], {
		label: metric.label,
		format: value => `${value.toFixed(metric.digits)}${metric.unit}`,
	}),
]));

const columns = defineColumns({
	id: column(reading => reading.id, {
		label: '#',
		width: 88,
		pinned: 'start',
		format: id => id.toLocaleString('en-US'),
	}),
	time: column(reading => reading.time, { label: 'Time', width: 136, align: 'left' }),
	device: column(reading => reading.device, { label: 'Device', width: 112, align: 'left' }),
	region: column(reading => reading.region, { label: 'Region', width: 104, align: 'left' }),
	...metrics,
	health: column(reading => reading.health, {
		label: 'Health',
		width: 112,
		align: 'left',
		pinned: 'end',
		cell: ({ value }) => h(UiBadge, { tone: HEALTH[value].tone, dot: true }, () => HEALTH[value].label),
	}),
});

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 36,
	virtual: true,
	features: {
		sorting: sorting(),
		navigation: navigation(),
	},
});

const { scope } = table;

const cellCount = computed(() => rows.value.length * scope.columns.value.length);
const renderedRows = computed(() => scope.rowRange.value.end - scope.rowRange.value.start);
const renderedColumns = computed(() => scope.renderedColumns.value.filter(rendered => rendered.column !== null).length);

watch(scope.sort, () => {
	const started = performance.now();

	void nextTick(() => {
		sortTime.value = performance.now() - started;
	});
});

function goToRow() {
	const row = Math.min(Math.max(target.value, 1), rows.value.length) - 1;

	void table.navigation.focusCell({ section: 'body', row, cell: 'id' });
}

function formatCount(value: number) {
	return value.toLocaleString('en-US');
}
</script>

<template>
	<div>
		<UiToolbar>
			<UiToggleGroup v-model="size" :options="SIZES" label="Number of rows" />
			<span class="ui-separator" />
			<UiNumberField v-model="target" label="Row to go to" :min="1" :max="rows.length" />
			<UiButton @click="goToRow">
				<IconLocate />
				Go to row
			</UiButton>
			<span class="ui-spacer" />
			<UiButton icon aria-label="Scroll to the first row" @click="scope.scrollToRow(0)">
				<IconArrowUpToLine />
			</UiButton>
			<UiButton icon aria-label="Scroll to the last row" @click="scope.scrollToRow(rows.length - 1, 'end')">
				<IconArrowDownToLine />
			</UiButton>
		</UiToolbar>

		<UiDataTable :table="table" label="Device readings" density="compact" style="height: 560px" />

		<div class="stats">
			<UiStat label="Cells" :value="formatCount(cellCount)" />
			<UiStat label="Rows in the DOM" :value="`${renderedRows} of ${formatCount(rows.length)}`" />
			<UiStat label="Columns in the DOM" :value="`${renderedColumns} of ${scope.columns.value.length}`" />
			<UiStat label="Last sort" :value="sortTime === null ? 'click a header' : `${Math.round(sortTime)} ms`" />
		</div>
	</div>
</template>

<style scoped>
.stats {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-block-start: 12px;
}
</style>
