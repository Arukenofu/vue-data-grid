<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	TableBody,
	TableCells,
	TableHeader,
	TableHeaderCell,
	TableHeaderContent,
	TableHeaderRow,
	TableRoot,
	TableRow,
	useDataTable,
	useTableMotion,
} from '@vue-stack/table';
import { type DragIndicator, TableColumnDrag, TableDragPreview } from '@vue-stack/table/drag-and-drop';
import IconColumns from '~icons/lucide/columns-3';
import { computed, shallowRef } from 'vue';

import { getChange, type Stock, stocks } from '@/data/stocks';
import { UiButton, UiToggleGroup, UiToolbar } from '@/ui';

const INDICATORS = [
	{ value: 'gap', label: 'Gap' },
	{ value: 'line', label: 'Line' },
] as const;

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const column = defineColumn<Stock>({ movable: true });

const columns = defineColumns({
	symbol: column(stock => stock.symbol, { label: 'Symbol', width: 96, pinned: 'start', movable: false }),
	name: column(stock => stock.name, { label: 'Company', width: 170 }),
	sector: column(stock => stock.sector, { label: 'Sector', width: 120 }),
	price: column(stock => stock.price, { label: 'Price', width: 96, align: 'right', format: price => `$${price.toFixed(2)}` }),
	change: column(getChange, {
		label: 'Change',
		width: 96,
		align: 'right',
		format: change => `${change > 0 ? '+' : ''}${change.toFixed(2)}%`,
		cellClass: ({ value }) => (value < 0 ? 'ui-cell-down' : 'ui-cell-up'),
	}),
	volume: column(stock => stock.volume, { label: 'Volume', width: 96, align: 'right', format: volume => compact.format(volume) }),
});

const table = useDataTable({
	columns,
	rows: stocks,
	rowKey: 'id',
	rowHeight: 40,
});

useTableMotion(table);

const indicator = shallowRef<DragIndicator>('gap');

const order = computed(() => table.scope.columns.value.map(item => item.column?.label).join(' · '));
</script>

<template>
	<div>
		<UiToolbar>
			<UiToggleGroup v-model="indicator" :options="INDICATORS" label="Show the place as" />
			<span class="ui-spacer" />
			<UiButton size="sm" variant="ghost" @click="table.state.reset()">Reset order</UiButton>
		</UiToolbar>

		<TableRoot :table="table" label="Stocks" class="ui-table" data-size="sm">
			<TableColumnDrag :indicator="indicator">
				<TableHeader>
					<TableHeaderRow v-slot="{ columns: headers }">
						<TableHeaderCell v-for="header in headers" :key="header.key" :column="header">
							<TableHeaderContent />
						</TableHeaderCell>
					</TableHeaderRow>
				</TableHeader>
				<TableDragPreview v-slot="{ label }" for="columns">
					<IconColumns class="ghost-icon" aria-hidden="true" />
					{{ label }}
				</TableDragPreview>
			</TableColumnDrag>
			<TableBody v-slot="{ rows }">
				<TableRow v-for="row in rows" :key="row.key" :row="row">
					<TableCells />
				</TableRow>
			</TableBody>
		</TableRoot>

		<p class="order">{{ order }}</p>
	</div>
</template>

<style scoped>
.ghost-icon {
	width: 14px;
	height: 14px;
	color: var(--ui-accent);
}

.order {
	margin: 10px 0 0;
	color: var(--ui-fg-muted);
	font-size: 12.5px;
	text-align: center;
}
</style>
