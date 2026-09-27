<script setup lang="ts">
import {
	clipboard,
	defineColumn,
	defineColumns,
	editing,
	fill,
	history,
	navigation,
	numberField,
	ranges,
	useDataTable,
} from 'vue-data-grid';
import { shallowRef } from 'vue';

import { UiButton, UiDataTable, UiSwitch, UiToolbar } from '@/ui';

import { type Month, type PlanLine, plan } from './plan';

const rows = shallowRef<readonly PlanLine[]>(plan);

const column = defineColumn<PlanLine>();

function month(name: Month, label: string) {
	return column(line => line.signups[name], {
		label,
		width: 80,
		align: 'right',
		editable: true,
		...numberField({ min: 0 }),
		setValue: (line, value) => ({ ...line, signups: { ...line.signups, [name]: value } }),
	});
}

const columns = defineColumns({
	channel: column(line => line.channel, { label: 'Channel', width: 140 }),
	jan: month('jan', 'Jan'),
	feb: month('feb', 'Feb'),
	mar: month('mar', 'Mar'),
	apr: month('apr', 'Apr'),
	may: month('may', 'May'),
	jun: month('jun', 'Jun'),
});

const series = shallowRef(true);

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 38,
	features: {
		navigation: navigation(),
		ranges: ranges(),
		editing: editing<PlanLine>({
			onCommit: (commit) => {
				rows.value = commit.apply(rows.value);
			},
		}),
		history: history(),
		fill: fill({ series }),
		clipboard: clipboard(),
	},
});

table.ranges.selectBounds({ rowStart: 0, rowEnd: plan.length, columnStart: 1, columnEnd: 3 });

const { canUndo } = table.history;
</script>

<template>
	<div>
		<UiToolbar>
			<UiSwitch v-model="series" label="Continue numbers as a series" />
			<span class="ui-spacer" />
			<UiButton @click="table.fill.fillDown()">Fill down</UiButton>
			<UiButton @click="table.fill.fillRight()">Fill right</UiButton>
			<UiButton variant="ghost" :disabled="!canUndo" @click="table.history.undo()">Undo</UiButton>
		</UiToolbar>

		<UiDataTable :table="table" label="Signups plan" data-size="sm" />

		<p class="hint">Drag the square at the corner of the selection to the right, to June.</p>
	</div>
</template>

<style scoped>
.hint {
	margin: 10px 0 0;
	color: var(--ui-fg-muted);
	font-size: 13px;
}
</style>
