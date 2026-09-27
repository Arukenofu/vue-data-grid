<script setup lang="ts">
import {
	checkboxField,
	clipboard,
	dateField,
	defineColumn,
	defineColumns,
	editing,
	fill,
	history,
	navigation,
	numberField,
	ranges,
	selectEditor,
	useDataTable,
} from '@vue-stack/table';
import IconRedo from '~icons/lucide/redo-2';
import IconRotateCcw from '~icons/lucide/rotate-ccw';
import IconUndo from '~icons/lucide/undo-2';
import { computed, shallowRef } from 'vue';

import { UiButton, UiDataTable, UiStat, UiToolbar } from '@/ui';

import { CATEGORIES, type Product, products } from './data';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDay(date: string | null) {
	if (date === null) {
		return '';
	}

	const [year, month, day] = date.split('-');

	return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

const column = defineColumn<Product>({ editable: true });

const columns = defineColumns({
	name: column(product => product.name, {
		label: 'Product',
		width: 150,
		flex: 1,
		setValue: (product, name) => ({ ...product, name }),
		validate: name => (name.trim() === '' ? 'Give the product a name' : undefined),
	}),
	category: column(product => product.category, {
		label: 'Category',
		width: 110,
		setValue: (product, category) => ({ ...product, category }),
		editor: selectEditor({ options: CATEGORIES }),
	}),
	price: column(product => product.price, {
		label: 'Price',
		width: 100,
		align: 'right',
		format: price => (price === null ? '' : money.format(price)),
		setValue: (product, price) => ({ ...product, price }),
		validate: (price) => {
			if (price === null || Number.isNaN(price)) {
				return 'Enter a price';
			}

			return price <= 0 ? 'The price must be above zero' : undefined;
		},
		...numberField({ min: 0, step: 0.5, digits: 2 }),
	}),
	stock: column(product => product.stock, {
		label: 'Stock',
		width: 80,
		align: 'right',
		cellClass: ({ value }) => (value !== null && value < 5 ? 'ui-cell-down' : undefined),
		setValue: (product, stock) => ({ ...product, stock }),
		validate: stock => (stock !== null && (!Number.isInteger(stock) || stock < 0) ? 'Enter a whole number' : undefined),
		...numberField({ min: 0 }),
	}),
	restock: column(product => product.restock, {
		label: 'Restock',
		width: 112,
		format: formatDay,
		setValue: (product, restock) => ({ ...product, restock }),
		...dateField({ value: 'text' }),
	}),
	active: column(product => product.active, {
		label: 'Active',
		width: 72,
		align: 'center',
		setValue: (product, active) => ({ ...product, active }),
		...checkboxField(),
	}),
});

const rows = shallowRef(products);

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		navigation: navigation(),
		ranges: ranges(),
		editing: editing<Product>({
			onCommit: (commit) => {
				rows.value = commit.apply(rows.value);
			},
		}),
		history: history(),
		fill: fill(),
		clipboard: clipboard(),
	},
});

const lastChange = computed(() => {
	const commit = table.editing.lastCommit.value;

	if (!commit) {
		return 'Nothing yet';
	}

	const count = commit.edits.length;

	return `${count} ${count === 1 ? 'cell' : 'cells'}, by ${commit.source}`;
});

function reset() {
	rows.value = products;
	table.history.clear();
}
</script>

<template>
	<div class="ui-stack">
		<UiToolbar>
			<UiButton :disabled="!table.history.canUndo.value" @click="table.history.undo()">
				<IconUndo aria-hidden="true" />
				Undo
			</UiButton>
			<UiButton :disabled="!table.history.canRedo.value" @click="table.history.redo()">
				<IconRedo aria-hidden="true" />
				Redo
			</UiButton>
			<UiButton variant="ghost" @click="reset">
				<IconRotateCcw aria-hidden="true" />
				Reset
			</UiButton>
			<span class="ui-spacer" />
			<UiStat label="Last change" :value="lastChange" />
		</UiToolbar>

		<UiDataTable :table="table" label="Inventory" />
	</div>
</template>
