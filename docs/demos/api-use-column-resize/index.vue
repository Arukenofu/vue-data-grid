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
	useColumnResize,
	useDataTable,
	useTableMotion,
} from '@vue-stack/table';

import { type Stock, stocks } from '@/data/stocks';
import { UiButton, UiToolbar } from '@/ui';

const column = defineColumn<Stock>({ resizable: true, minWidth: 70 });

const columns = defineColumns({
	symbol: column(stock => stock.symbol, { label: 'Symbol', width: 100 }),
	name: column(stock => stock.name, { label: 'Company', width: 200, maxWidth: 320 }),
	sector: column(stock => stock.sector, { label: 'Sector', width: 130 }),
	price: column(stock => stock.price, { label: 'Price', width: 110, align: 'right', format: price => price.toFixed(2) }),
	volume: column(stock => stock.volume, {
		label: 'Volume',
		width: 130,
		align: 'right',
		format: volume => volume.toLocaleString('en-US'),
	}),
});

const table = useDataTable({
	columns,
	rows: stocks,
	rowKey: 'id',
	rowHeight: 40,
});

useTableMotion(table);

const resize = useColumnResize(table.scope, { step: 10 });
const resizing = resize.resizing;
</script>

<template>
	<div>
		<UiToolbar>
			<UiButton @click="table.scope.fitColumns()">Fill the width</UiButton>
			<span class="ui-toolbar-text">Drag a line between headers, or focus it and press ← or →.</span>
			<span class="ui-toolbar-spacer" />
			<UiButton variant="ghost" @click="table.state.reset()">Reset</UiButton>
		</UiToolbar>

		<TableRoot :table="table" label="Stocks" class="ui-table" data-size="sm">
			<TableHeader>
				<TableHeaderRow v-slot="{ columns }">
					<TableHeaderCell v-for="column in columns" :key="column.key" v-slot="{ column: header }" :column="column">
						<TableHeaderContent />
						<span v-bind="resize.getHandleProps(header.name)" class="grip">
							<span class="grip-line" />
							<span v-if="resizing === header.name" class="grip-width">{{ table.scope.getWidth(header.name) }} px</span>
						</span>
					</TableHeaderCell>
				</TableHeaderRow>
			</TableHeader>
			<TableBody v-slot="{ rows }">
				<TableRow v-for="row in rows" :key="row.key" :row="row">
					<TableCells />
				</TableRow>
			</TableBody>
		</TableRoot>
	</div>
</template>

<style scoped>
.grip-line {
	position: absolute;
	inset-block: 10px;
	inset-inline-end: 3px;
	width: 2px;
	border-radius: 2px;
	background: var(--ui-border-strong);
	transition: background-color 0.15s;
}

.grip:hover .grip-line,
.grip:focus-visible .grip-line,
.grip[data-tc-state='resizing'] .grip-line {
	background: var(--ui-accent);
}

.grip-width {
	position: absolute;
	top: 50%;
	right: 10px;
	padding: 2px 6px;
	border-radius: 6px;
	background: var(--ui-fg);
	color: var(--ui-bg);
	font-size: 11px;
	font-weight: 600;
	white-space: nowrap;
	translate: 0 -50%;
}
</style>
