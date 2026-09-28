<script setup lang="ts">
import {
	type CellCommit,
	checkboxField,
	defineColumn,
	defineColumns,
	editing,
	GridBody,
	GridCells,
	GridEditorTemplate,
	GridHeader,
	GridHeaderCell,
	GridHeaderRow,
	GridRoot,
	GridRow,
	navigation,
	numberField,
	selectEditor,
	textEditor,
	useDataGrid,
} from '@vue-data-grid/core';
import IconPencil from '~icons/lucide/pencil';
import { shallowRef } from 'vue';

import { UiToolbar } from '@/ui';

import { CATEGORIES, type Category, type Product, products } from './data';
import DateEditor from './DateEditor.vue';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(text: string) {
	const value = text.trim();

	return DAY.test(value) ? value : null;
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function labelOf(category: Category) {
	return CATEGORIES.find(option => option.value === category)?.label ?? category;
}

function checkAmount(amount: number | null) {
	return amount === null || Number.isNaN(amount) || amount < 0 ? 'Enter zero or more' : undefined;
}

const column = defineColumn<Product>({ editable: true });

const columns = defineColumns({
	name: column('name', {
		label: 'Product',
		width: 170,
		setValue: (product, name) => ({ ...product, name }),
		validate: name => (name.trim() === '' ? 'A product needs a name' : undefined),
	}),
	category: column('category', {
		label: 'Category',
		width: 130,
		format: labelOf,
		editor: selectEditor({ options: CATEGORIES }),
		setValue: (product, category) => ({ ...product, category }),
	}),
	price: column('price', {
		label: 'Price',
		width: 104,
		align: 'right',
		...numberField({ min: 0, step: 5, digits: 2 }),
		format: price => (price === null ? '' : money.format(price)),
		setValue: (product, price) => ({ ...product, price }),
		validate: checkAmount,
	}),
	stock: column('stock', {
		label: 'Stock',
		width: 80,
		align: 'right',
		...numberField({ min: 0 }),
		setValue: (product, stock) => ({ ...product, stock }),
		validate: checkAmount,
	}),
	restock: column('restock', {
		label: 'Restock',
		width: 136,
		typing: 'value',
		parse: parseDay,
		format: restock => (restock === null ? '—' : day.format(new Date(restock))),
		setValue: (product, restock) => ({ ...product, restock }),
	}),
	published: column('published', {
		label: 'Live',
		width: 64,
		align: 'center',
		...checkboxField(),
		setValue: (product, published) => ({ ...product, published }),
	}),
	notes: column('notes', {
		label: 'Notes',
		width: 180,
		flex: 1,
		editor: textEditor({ multiline: true, placeholder: 'Add a note…' }),
		setValue: (product, notes) => ({ ...product, notes }),
	}),
});

const rows = shallowRef<readonly Product[]>(products);
const lastEdit = shallowRef('Double-click a cell, or focus it and start typing.');

function save(commit: CellCommit<Product>) {
	rows.value = commit.apply(rows.value);

	const [edit] = commit.edits;
	const label = grid.scope.getColumn(edit.column)?.column?.label ?? edit.column;

	lastEdit.value = `${label} of ${edit.row.name} changed.`;
}

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		navigation: navigation(),
		editing: editing({ onCommit: save }),
	},
});
</script>

<template>
	<div>
		<UiToolbar>
			<span class="ui-toolbar-text last-edit">
				<IconPencil aria-hidden="true" />
				{{ lastEdit }}
			</span>
		</UiToolbar>

		<GridRoot :grid="grid" label="Products" class="ui-grid" data-size="auto">
			<GridEditorTemplate v-slot="context" :column="columns.restock">
				<DateEditor :context="context" />
			</GridEditorTemplate>
			<GridHeader>
				<GridHeaderRow v-slot="{ columns: headers }">
					<GridHeaderCell v-for="header in headers" :key="header.key" :column="header" />
				</GridHeaderRow>
			</GridHeader>
			<GridBody v-slot="{ rows: bodyRows }">
				<GridRow v-for="row in bodyRows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
			</GridBody>
		</GridRoot>
	</div>
</template>

<style scoped>
.last-edit {
	display: inline-flex;
	align-items: center;
	gap: 8px;
}

.last-edit svg {
	width: 14px;
	height: 14px;
	color: var(--ui-accent);
}
</style>
