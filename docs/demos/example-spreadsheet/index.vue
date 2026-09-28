<script setup lang="ts">
import {
	checkboxField,
	clipboard,
	defineColumn,
	defineColumns,
	downloadCsv,
	editing,
	fill,
	getCellText,
	type HeaderContext,
	history,
	navigation,
	numberField,
	ranges,
	rowNumberColumn,
	selectEditor,
	toColumnList,
	toCsv,
	useDataGrid,
} from '@vue-data-grid/core';
import IconArrowDownToLine from '~icons/lucide/arrow-down-to-line';
import IconCopy from '~icons/lucide/copy';
import IconDownload from '~icons/lucide/download';
import IconRedo from '~icons/lucide/redo-2';
import IconUndo from '~icons/lucide/undo-2';
import { computed, h, shallowRef } from 'vue';

import { UiButton, UiDataGrid, UiToolbar } from '@/ui';

import ColumnHeader from './ColumnHeader.vue';
import { type BudgetLine, CATEGORIES, createBudget, getTotal } from './data';
import FormulaBar from './FormulaBar.vue';
import StatusBar from './StatusBar.vue';

type Quarter = 'q1' | 'q2' | 'q3' | 'q4';

const SHEET = ['item', 'category', 'owner', 'q1', 'q2', 'q3', 'q4', 'total', 'approved'];

function letterOf(name: string) {
	const index = SHEET.indexOf(name);

	return index === -1 ? '' : String.fromCharCode(65 + index);
}

function heading({ column }: HeaderContext) {
	return h(ColumnHeader, { letter: letterOf(column.name), name: column.label ?? column.name });
}

function formatAmount(value: number | null) {
	return value === null ? '' : value.toLocaleString('en-US');
}

const lines = shallowRef<readonly BudgetLine[]>(createBudget());

const column = defineColumn<BudgetLine>({ editable: true, resizable: true, minWidth: 64 });

function quarter(name: Quarter, label: string) {
	return column(line => line[name], {
		label,
		width: 88,
		align: 'right',
		header: heading,
		...numberField<BudgetLine>({ step: 50 }),
		cell: ({ value }) => formatAmount(value),
		cellClass: ({ value }) => (value !== null && value < 0 ? 'ui-cell-down' : undefined),
		validate: value => (value !== null && Number.isNaN(value) ? 'Type a number' : undefined),
		setValue: (line, value) => ({ ...line, [name]: value }),
	});
}

const columns = defineColumns({
	row: rowNumberColumn({ rowHeader: true, pinned: 'start', width: 48, minWidth: 44 }),
	item: column(line => line.item, {
		label: 'Item',
		width: 160,
		header: heading,
		validate: value => (value.trim() === '' ? 'An item needs a name' : undefined),
		setValue: (line, item) => ({ ...line, item }),
	}),
	category: column(line => line.category, {
		label: 'Category',
		width: 116,
		header: heading,
		editor: selectEditor({ options: CATEGORIES.map(category => ({ value: category, label: category })) }),
		setValue: (line, category) => ({ ...line, category }),
	}),
	owner: column(line => line.owner, {
		label: 'Owner',
		width: 92,
		header: heading,
		setValue: (line, owner) => ({ ...line, owner }),
	}),
	q1: quarter('q1', 'Q1'),
	q2: quarter('q2', 'Q2'),
	q3: quarter('q3', 'Q3'),
	q4: quarter('q4', 'Q4'),
	total: column(getTotal, {
		label: 'Total',
		width: 100,
		align: 'right',
		editable: false,
		header: heading,
		cell: ({ value }) => formatAmount(value),
		cellClass: () => 'ui-cell-strong',
	}),
	approved: column(line => line.approved, {
		label: 'Approved',
		width: 88,
		align: 'center',
		header: heading,
		...checkboxField<BudgetLine>(),
		setValue: (line, approved) => ({ ...line, approved }),
	}),
});

const grid = useDataGrid({
	columns,
	rows: lines,
	rowKey: 'id',
	rowHeight: 34,
	features: {
		navigation: navigation(),
		ranges: ranges(),
		editing: editing({
			onCommit: (commit) => {
				lines.value = commit.apply(lines.value);
			},
		}),
		history: history(),
		fill: fill(),
		clipboard: clipboard(),
	},
});

const { canUndo, canRedo } = grid.history;

const active = computed(() => {
	const cell = grid.navigation.cells.focused.value;
	const rendered = cell ? grid.scope.getColumn(cell.column)?.column : undefined;
	const line = cell ? grid.rows.value[cell.index] : undefined;

	if (!cell || !rendered || line === undefined || letterOf(cell.column) === '') {
		return { reference: '', content: '' };
	}

	return { reference: `${letterOf(cell.column)}${cell.index + 1}`, content: getCellText(rendered, line) };
});

const draft = computed(() => {
	const cell = grid.editing.cell.value;

	if (!cell) {
		return null;
	}

	return cell.text ?? (cell.draft === null || cell.draft === undefined ? '' : String(cell.draft));
});

const selected = computed(() => {
	const values = grid.ranges.getCells().map((cell) => {
		const line = grid.rows.value[grid.scope.getRowIndex(cell.key)];
		const rendered = grid.scope.getColumn(cell.column)?.column;

		return line && rendered ? rendered.value(line) : undefined;
	});

	return {
		cells: values.length,
		numbers: values.filter((value): value is number => typeof value === 'number' && !Number.isNaN(value)),
	};
});

function download() {
	downloadCsv(toCsv({ columns: toColumnList(columns), rows: grid.rows.value }), { name: 'budget' });
}
</script>

<template>
	<div class="sheet">
		<UiToolbar>
			<UiButton icon aria-label="Undo" :disabled="!canUndo" @click="grid.history.undo()">
				<IconUndo />
			</UiButton>
			<UiButton icon aria-label="Redo" :disabled="!canRedo" @click="grid.history.redo()">
				<IconRedo />
			</UiButton>
			<span class="ui-separator" />
			<UiButton @click="grid.fill.fillDown()">
				<IconArrowDownToLine />
				Fill down
			</UiButton>
			<UiButton @click="grid.clipboard.copy()">
				<IconCopy />
				Copy
			</UiButton>
			<span class="ui-spacer" />
			<UiButton @click="download">
				<IconDownload />
				Download CSV
			</UiButton>
		</UiToolbar>

		<FormulaBar :reference="active.reference" :content="draft ?? active.content" :editing="draft !== null" />

		<UiDataGrid :grid="grid" label="Budget" density="compact" style="height: 520px" />

		<StatusBar :cells="selected.cells" :numbers="selected.numbers" />
	</div>
</template>
