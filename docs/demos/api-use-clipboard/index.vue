<script setup lang="ts">
import {
	clipboard,
	defineColumn,
	defineColumns,
	downloadCsv,
	editing,
	navigation,
	numberField,
	ranges,
	toCsv,
	useDataTable,
} from 'vue-data-grid';
import { computed, onBeforeUnmount, shallowRef } from 'vue';

import { createSales, type Sale } from '@/data/sales';
import { UiButton, UiDataTable, UiSwitch, UiToolbar } from '@/ui';

const COPIED_FOR = 1500;

const rows = shallowRef<readonly Sale[]>(createSales(24, 17));

const column = defineColumn<Sale>();

const money = (value: number | null) => (value === null ? '' : `$${value.toLocaleString('en-US')}`);

const columns = defineColumns({
	product: column(sale => sale.product, { label: 'Product', width: 140 }),
	region: column(sale => sale.region, { label: 'Region', width: 130 }),
	quarter: column(sale => sale.quarter, { label: 'Quarter', width: 90 }),
	units: column(sale => sale.units, {
		label: 'Units',
		width: 100,
		align: 'right',
		editable: true,
		...numberField({ min: 0 }),
		setValue: (sale, units) => ({ ...sale, units: units ?? 0 }),
	}),
	revenue: column(sale => sale.revenue, {
		label: 'Revenue',
		flex: 1,
		width: 120,
		align: 'right',
		format: money,
		editable: true,
		...numberField({ min: 0 }),
		setValue: (sale, revenue) => ({ ...sale, revenue: revenue ?? 0 }),
	}),
});

const headers = shallowRef(false);

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 38,
	features: {
		navigation: navigation(),
		ranges: ranges(),
		editing: editing<Sale>({
			onCommit: (commit) => {
				rows.value = commit.apply(rows.value);
			},
		}),
		clipboard: clipboard({ headers }),
	},
});

table.ranges.selectBounds({ rowStart: 0, rowEnd: 4, columnStart: 0, columnEnd: 4 });

const preview = computed(() => {
	const text = table.clipboard.getText();

	return text === '' ? 'Select cells to see what a copy takes.' : text;
});

const copied = shallowRef(false);
let timer: ReturnType<typeof setTimeout> | undefined;

async function copy() {
	copied.value = await table.clipboard.copy();
	clearTimeout(timer);
	timer = setTimeout(() => {
		copied.value = false;
	}, COPIED_FOR);
}

function download() {
	const shown = table.scope.columns.value.flatMap(item => (item.column ? [item.column] : []));

	downloadCsv(toCsv({ columns: shown, rows: table.rows.value }), { name: 'sales' });
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
	<div>
		<UiToolbar>
			<UiButton variant="solid" @click="copy">{{ copied ? 'Copied' : 'Copy selection' }}</UiButton>
			<UiButton @click="download">Download CSV</UiButton>
			<span class="ui-toolbar-spacer" />
			<UiSwitch v-model="headers" label="Copy with headers" />
		</UiToolbar>

		<UiDataTable :table="table" label="Sales" data-size="sm" />

		<pre class="clipboard">{{ preview }}</pre>
	</div>
</template>

<style scoped>
.clipboard {
	max-height: 120px;
	margin: 12px 0 0;
	padding: 12px 14px;
	overflow: auto;
	border: 1px dashed var(--ui-border-strong);
	border-radius: var(--ui-radius-sm);
	background: var(--ui-bg-subtle);
	color: var(--ui-fg-muted);
	font-family: var(--ui-font-mono);
	font-size: 12px;
	line-height: 1.6;
	tab-size: 16;
}
</style>
