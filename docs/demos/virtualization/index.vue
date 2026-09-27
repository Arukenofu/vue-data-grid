<script setup lang="ts">
import { defineColumn, defineColumns, navigation, useDataTable } from '@vue-data-grid/core';
import IconArrowDownToLine from '~icons/lucide/arrow-down-to-line';
import { computed, shallowRef, watch } from 'vue';

import { UiButton, UiDataTable, UiNumberField, UiSelect, UiStat, UiToolbar } from '@/ui';

import { DAY_COUNT, readTemperature, SENSOR_COUNT, type Sensor, sensors } from './data';

const DAYS = Array.from({ length: DAY_COUNT }, (_, day) => ({ value: `day${day + 1}`, label: `Sep ${day + 1}` }));

const column = defineColumn<Sensor>({ resizable: true });
const reading = defineColumn<Sensor>({ width: 78, align: 'right', resizable: true });

function temperature(day: number) {
	return reading(sensor => readTemperature(sensor.index, day), {
		label: DAYS[day].label,
		format: value => `${value.toFixed(1)}°`,
		cellClass: ({ value }) => {
			if (value > 27) {
				return 'reading-hot';
			}

			return value < 14 ? 'reading-cold' : undefined;
		},
	});
}

const columns = defineColumns({
	name: column(sensor => sensor.name, { label: 'Sensor', width: 150, pinned: 'start' }),
	site: column(sensor => sensor.site, { label: 'Site', width: 116 }),
	...Object.fromEntries(DAYS.map((day, index) => [day.value, temperature(index)])),
});

const table = useDataTable({
	columns,
	rows: sensors,
	rowKey: 'id',
	rowHeight: 36,
	virtual: true,
	features: { navigation: navigation() },
});

const renderedRows = computed(() => table.items.value.length);
const renderedColumns = computed(() => table.scope.renderedColumns.value.filter(rendered => rendered.column).length);
const renderedCells = computed(() => renderedRows.value * renderedColumns.value);

const targetRow = shallowRef(50_000);
const targetDay = shallowRef('day1');

function goToRow() {
	table.scope.scrollToRow(targetRow.value - 1, 'center');
}

watch(targetDay, day => table.scope.scrollToColumn(day, 'center'));

function format(value: number) {
	return value.toLocaleString('en-US');
}
</script>

<template>
	<div class="sensors">
		<UiToolbar>
			<UiNumberField v-model="targetRow" label="Row to go to" :min="1" :max="SENSOR_COUNT" />
			<UiButton @click="goToRow">
				<IconArrowDownToLine aria-hidden="true" />
				Go to row
			</UiButton>
			<UiSelect v-model="targetDay" :options="DAYS" label="Day to scroll to" size="md" />
			<span class="ui-spacer" />
			<UiStat label="Rendered cells" :value="`${format(renderedCells)} of ${format(SENSOR_COUNT * (DAY_COUNT + 2))}`" />
		</UiToolbar>
		<UiDataTable :table="table" label="Sensor readings" density="compact" data-size="lg" />
	</div>
</template>

<style scoped>
.sensors :deep(.reading-hot) {
	color: var(--ui-down);
}

.sensors :deep(.reading-cold) {
	color: var(--ui-info);
}
</style>
