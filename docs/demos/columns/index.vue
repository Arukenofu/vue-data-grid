<script setup lang="ts">
import { defineColumn, defineColumns, rowNumberColumn, useDataTable } from '@vue-data-grid/core';
import { h } from 'vue';

import { type BadgeTone, UiBadge, UiDataTable, UiProgress } from '@/ui';

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
	customer: column(invoice => invoice.customer, {
		label: 'Customer',
		width: 248,
		flex: 1,
		cell: ({ row }) => h(CustomerCell, { name: row.customer, email: row.email }),
	}),
	status: column(invoice => invoice.status, {
		label: 'Status',
		width: 124,
		format: status => STATUS[status].label,
		cell: ({ value }) => h(UiBadge, { tone: STATUS[value].tone, dot: true }, () => STATUS[value].label),
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
		cell: ({ value }) => h('span', { style: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%' } }, [
			h(UiProgress, { value }),
			`${value}%`,
		]),
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

const table = useDataTable({
	columns,
	rows: invoices,
	rowKey: 'id',
	rowHeight: 52,
});
</script>

<template>
	<UiDataTable :table="table" label="Invoices" footer />
</template>
