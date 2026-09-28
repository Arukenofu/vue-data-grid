<script setup lang="ts">
import { defineColumn, defineColumns, GridCellTemplate, rowNumberColumn, useDataGrid } from '@vue-data-grid/core';

import { type BadgeTone, UiBadge, UiDataGrid, UiProgress } from '@/ui';

import CustomerCell from './CustomerCell.vue';
import { type Invoice, type InvoiceStatus, invoices } from './data';

const STATUS: Readonly<Record<InvoiceStatus, { label: string; tone: BadgeTone }>> = {
	paid: { label: 'Paid', tone: 'green' },
	open: { label: 'Open', tone: 'blue' },
	overdue: { label: 'Overdue', tone: 'red' },
	credit: { label: 'Credit note', tone: 'violet' },
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const column = defineColumn<Invoice>({ resizable: true });

const columns = defineColumns({
	row: rowNumberColumn({ width: 44 }),
	number: column(invoice => invoice.number, {
		label: 'Invoice',
		width: 100,
		cellClass: () => 'ui-cell-mono',
		footer: () => 'Total',
	}),
	customer: column(invoice => invoice.customer, { label: 'Customer', width: 248, flex: 1 }),
	status: column(invoice => invoice.status, {
		label: 'Status',
		width: 124,
		format: status => STATUS[status].label,
	}),
	issued: column(invoice => invoice.issued, {
		label: 'Issued',
		width: 116,
		format: issued => day.format(new Date(issued)),
	}),
	paid: column(invoice => invoice.paid, {
		label: 'Paid',
		width: 144,
		format: paid => `${paid}%`,
	}),
	amount: column(invoice => invoice.amount, {
		label: 'Amount',
		width: 124,
		align: 'right',
		pinned: 'end',
		format: amount => money.format(amount),
		cellClass: ({ value }) => (value < 0 ? 'ui-cell-down' : undefined),
		aggregate: 'sum',
		footer: ({ aggregate }) => money.format(aggregate ?? 0),
	}),
});

const grid = useDataGrid({
	columns,
	rows: invoices,
	rowKey: 'id',
	rowHeight: 52,
});
</script>

<template>
	<UiDataGrid :grid="grid" label="Invoices" footer>
		<GridCellTemplate v-slot="{ row }" :column="columns.customer">
			<CustomerCell :name="row.customer" :email="row.email" />
		</GridCellTemplate>
		<GridCellTemplate v-slot="{ value }" :column="columns.status">
			<UiBadge :tone="STATUS[value].tone" dot>{{ STATUS[value].label }}</UiBadge>
		</GridCellTemplate>
		<GridCellTemplate v-slot="{ value }" :column="columns.paid">
			<span class="paid">
				<UiProgress :value="value" />
				{{ value }}%
			</span>
		</GridCellTemplate>
	</UiDataGrid>
</template>

<style scoped>
.paid {
	display: flex;
	align-items: center;
	gap: 10px;
	width: 100%;
}
</style>
