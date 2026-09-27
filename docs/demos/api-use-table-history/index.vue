<script setup lang="ts">
import {
	clipboard,
	defineColumn,
	defineColumns,
	editing,
	history,
	navigation,
	numberField,
	ranges,
	useDataTable,
} from 'vue-data-grid';
import IconRedo from '~icons/lucide/redo-2';
import IconUndo from '~icons/lucide/undo-2';
import { computed, shallowRef } from 'vue';

import { UiButton, UiDataTable, UiToolbar } from '@/ui';

import { type BudgetLine, budget } from './budget';

const rows = shallowRef<readonly BudgetLine[]>(budget);

const column = defineColumn<BudgetLine>({ editable: true });

const money = (value: number | null) => (value === null ? '' : `$${value.toLocaleString('en-US')}`);

const columns = defineColumns({
	category: column(line => line.category, {
		label: 'Category',
		width: 160,
		setValue: (line, category) => ({ ...line, category }),
	}),
	planned: column(line => line.planned, {
		label: 'Planned',
		width: 120,
		align: 'right',
		format: money,
		...numberField({ min: 0, step: 100 }),
		setValue: (line, planned) => ({ ...line, planned: planned ?? 0 }),
	}),
	spent: column(line => line.spent, {
		label: 'Spent',
		width: 120,
		align: 'right',
		format: money,
		...numberField({ min: 0, step: 100 }),
		setValue: (line, spent) => ({ ...line, spent: spent ?? 0 }),
	}),
	note: column(line => line.note, {
		label: 'Note',
		flex: 1,
		width: 220,
		setValue: (line, note) => ({ ...line, note }),
	}),
});

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 38,
	features: {
		navigation: navigation(),
		ranges: ranges(),
		editing: editing<BudgetLine>({
			onCommit: (commit) => {
				rows.value = commit.apply(rows.value);
			},
		}),
		history: history({ limit: 50 }),
		clipboard: clipboard(),
	},
});

const { canUndo, canRedo } = table.history;

const steps = computed(() => table.history.steps.value
	.map((step, index) => ({
		id: index,
		source: step.source,
		cells: step.edits.length === 1 ? '1 cell' : `${step.edits.length} cells`,
	}))
	.reverse());
</script>

<template>
	<div>
		<UiToolbar>
			<UiButton :disabled="!canUndo" @click="table.history.undo()">
				<IconUndo aria-hidden="true" />
				Undo
			</UiButton>
			<UiButton :disabled="!canRedo" @click="table.history.redo()">
				<IconRedo aria-hidden="true" />
				Redo
			</UiButton>
			<span class="ui-toolbar-text">Edit a few cells, paste over a range, press Delete, then undo.</span>
		</UiToolbar>

		<UiDataTable :table="table" label="Budget" data-size="sm" />

		<ol class="history-steps" aria-label="Steps to undo">
			<li v-for="step in steps" :key="step.id">
				<span class="history-source">{{ step.source }}</span>
				<span class="history-cells">{{ step.cells }}</span>
			</li>
			<li v-if="steps.length === 0" class="history-empty">No steps yet</li>
		</ol>
	</div>
</template>

<style scoped>
.history-steps {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	min-height: 30px;
	margin: 12px 0 0;
	padding: 0;
	list-style: none;
}

.history-steps li {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	height: 28px;
	padding: 0 10px;
	border: 1px solid var(--ui-border);
	border-radius: 999px;
	background: var(--ui-bg);
	font-size: 12.5px;
}

.history-steps li:first-child {
	border-color: var(--ui-accent-line);
	background: var(--ui-accent-soft);
}

.history-source {
	font-weight: 600;
	text-transform: capitalize;
}

.history-cells {
	color: var(--ui-fg-muted);
}

.history-steps .history-empty {
	border-style: dashed;
	background: none;
	color: var(--ui-fg-subtle);
}
</style>
