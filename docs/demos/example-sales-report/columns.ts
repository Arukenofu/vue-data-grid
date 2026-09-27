import { defineColumn, defineColumnGroups, defineColumns, treeColumn } from '@vue-data-grid/core';
import { h } from 'vue';

import MarginCell from './MarginCell.vue';
import { count, getMargin, getProfit, money, type ReportRow } from './report';

const column = defineColumn<ReportRow>({ sortable: true, resizable: true });

export const columns = defineColumns({
	label: treeColumn(column(row => row.label, {
		label: 'Breakdown',
		flex: 1,
		minWidth: 240,
		sortOrder: ['asc', 'desc'],
		footer: () => 'Total',
	})),
	units: column(row => row.units, {
		label: 'Units',
		width: 96,
		align: 'right',
		aggregate: 'sum',
		format: units => count.format(units),
		footer: ({ aggregate }) => count.format(aggregate ?? 0),
	}),
	price: column(row => (row.units === 0 ? 0 : row.revenue / row.units), {
		label: 'Avg price',
		width: 110,
		align: 'right',
		format: price => money.format(price),
	}),
	revenue: column(row => row.revenue, {
		label: 'Revenue',
		width: 128,
		align: 'right',
		aggregate: 'sum',
		format: revenue => money.format(revenue),
		footer: ({ aggregate }) => money.format(aggregate ?? 0),
	}),
	cost: column(row => row.cost, {
		label: 'Cost',
		width: 128,
		align: 'right',
		aggregate: 'sum',
		format: cost => money.format(cost),
		footer: ({ aggregate }) => money.format(aggregate ?? 0),
	}),
	profit: column(getProfit, {
		label: 'Profit',
		width: 128,
		align: 'right',
		aggregate: 'sum',
		format: profit => money.format(profit),
		footer: ({ aggregate }) => money.format(aggregate ?? 0),
	}),
	margin: column(row => getMargin([row]), {
		label: 'Margin',
		width: 130,
		align: 'right',
		cell: ({ value }) => h(MarginCell, { value }),
		footer: ({ rows }) => h(MarginCell, { value: getMargin(rows) }),
	}),
});

export const groups = defineColumnGroups({
	volume: {
		label: 'Volume',
		children: ['units', 'price'],
		showWhen: { price: 'expanded' },
	},
	money: {
		label: 'Money',
		children: ['revenue', 'cost', 'profit', 'margin'],
		showWhen: { revenue: 'expanded', cost: 'expanded' },
	},
});
