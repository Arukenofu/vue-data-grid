<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	getCellText,
	navigation,
	type RenderedColumn,
	sorting,
	useDataTable,
	useHeaderCell,
} from '@vue-data-grid/core';
import IconArrowDown from '~icons/lucide/arrow-down';
import IconArrowUp from '~icons/lucide/arrow-up';

import { type BadgeTone, UiBadge } from '@/ui';

import { type Invoice, type InvoiceStatus, invoices } from './data';

const STATUS: Readonly<Record<InvoiceStatus, BadgeTone>> = {
	paid: 'green',
	due: 'amber',
	overdue: 'red',
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const column = defineColumn<Invoice>({ sortable: true });

const columns = defineColumns({
	number: column(invoice => invoice.number, { label: 'Invoice', width: 110, cellClass: () => 'ui-cell-mono' }),
	customer: column(invoice => invoice.customer, { label: 'Customer', width: 170, flex: 1 }),
	issued: column(invoice => invoice.issued, { label: 'Issued', width: 110 }),
	amount: column(invoice => invoice.amount, { label: 'Amount', width: 120, align: 'right', format: amount => money.format(amount) }),
	status: column(invoice => invoice.status, { label: 'Status', width: 100 }),
});

const table = useDataTable({
	columns,
	rows: invoices,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		sorting: sorting(),
		navigation: navigation(),
	},
});

const header = useHeaderCell(table.scope);

function getHeaderProps(rendered: RenderedColumn) {
	const props = table.getHeaderCellProps(rendered);

	return rendered.column ? { ...props, ...header.getHandlers(rendered.column.name) } : props;
}
</script>

<template>
	<div>
		<div :ref="table.root" v-bind="table.getGridProps()" tabindex="0" aria-label="Invoices" class="ui-table" data-size="sm">
			<div :ref="table.head" v-bind="table.getHeadProps()">
				<div v-bind="table.getHeaderRowProps()">
					<div
						v-for="rendered in table.scope.renderedColumns.value"
						:key="rendered.key"
						v-bind="getHeaderProps(rendered)"
						:class="{ 'is-sortable': rendered.column?.sortable }"
					>
						<template v-if="rendered.column">
							<span data-dg-part="cell-text">{{ rendered.column.label }}</span>
							<IconArrowUp v-if="table.scope.getSortDirection(rendered.column.name) === 'asc'" class="sort" aria-hidden="true" />
							<IconArrowDown v-else-if="table.scope.getSortDirection(rendered.column.name) === 'desc'" class="sort" aria-hidden="true" />
						</template>
					</div>
				</div>
			</div>

			<div :ref="table.body" v-bind="table.getBodyProps()">
				<div v-for="item in table.items.value" :key="item.key" v-bind="table.getRowProps(item)">
					<div v-for="rendered in table.scope.renderedColumns.value" :key="rendered.key" v-bind="table.getCellProps(rendered)">
						<UiBadge v-if="rendered.column?.name === 'status'" :tone="STATUS[table.rows.value[item.index].status]" dot>
							{{ table.rows.value[item.index].status }}
						</UiBadge>
						<span v-else-if="rendered.column" data-dg-part="cell-text">
							{{ getCellText(rendered.column, table.rows.value[item.index]) }}
						</span>
					</div>
				</div>
			</div>
		</div>
		<span :ref="table.exit" tabindex="0" />
	</div>
</template>

<style scoped>
.sort {
	flex: none;
	width: 14px;
	height: 14px;
	margin-inline-start: 4px;
	color: var(--ui-accent-text);
}
</style>
