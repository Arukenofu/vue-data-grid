<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	selection,
	type SelectionMode,
	TableBody,
	TableCells,
	TableHeader,
	TableHeaderCell,
	TableHeaderContent,
	TableHeaderRow,
	TableRoot,
	TableRow,
	TableSelectAllCheckbox,
	TableSelectionCheckbox,
	useDataTable,
} from '@vue-stack/table';
import IconCheck from '~icons/lucide/check';
import IconMinus from '~icons/lucide/minus';
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui';
import { h, shallowRef } from 'vue';

import { type Person, type Presence, people } from '@/data/people';
import { type BadgeTone, UiBadge, UiButton, UiStat, UiToggleGroup, UiToolbar } from '@/ui';

const MODES = [
	{ value: 'multiple', label: 'Multiple' },
	{ value: 'single', label: 'Single' },
] as const;

const PRESENCE: Readonly<Record<Presence, { label: string; tone: BadgeTone }>> = {
	active: { label: 'Active', tone: 'green' },
	away: { label: 'Away', tone: 'amber' },
	offline: { label: 'Offline', tone: 'gray' },
};

const offline = new Set(people.filter(person => person.presence === 'offline').map(person => person.id));

const column = defineColumn<Person>();

const columns = defineColumns({
	select: column(() => null, { kind: 'service', label: 'Select', width: 48, align: 'center', pinned: 'start' }),
	name: column(person => person.name, { label: 'Name', width: 170 }),
	role: column(person => person.role, { label: 'Role', width: 180, flex: 1 }),
	presence: column(person => person.presence, {
		label: 'Status',
		width: 120,
		cell: ({ value }) => h(UiBadge, { tone: PRESENCE[value].tone, dot: true }, () => PRESENCE[value].label),
	}),
});

const mode = shallowRef<SelectionMode>('multiple');

const table = useDataTable({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		selection: selection({ selectionMode: mode, canSelect: key => !offline.has(key) }),
	},
});

const { selectedCount, clear } = table.selection;
</script>

<template>
	<div>
		<UiToolbar>
			<UiToggleGroup v-model="mode" :options="MODES" label="Selection mode" />
			<span class="ui-spacer" />
			<UiStat label="Selected" :value="selectedCount" />
			<UiButton size="sm" :disabled="selectedCount === 0" @click="clear">Clear</UiButton>
		</UiToolbar>

		<TableRoot :table="table" label="People" class="ui-table people" data-size="sm">
			<TableHeader>
				<TableHeaderRow v-slot="{ columns: headers }">
					<TableHeaderCell v-for="header in headers" :key="header.key" v-slot="{ column }" :column="header">
						<TableSelectAllCheckbox v-if="column.name === 'select'" v-slot="{ selected, partly }" as-child>
							<CheckboxRoot class="check" :model-value="partly ? 'indeterminate' : selected">
								<CheckboxIndicator class="check-mark">
									<IconMinus v-if="partly" />
									<IconCheck v-else />
								</CheckboxIndicator>
							</CheckboxRoot>
						</TableSelectAllCheckbox>
						<TableHeaderContent v-else />
					</TableHeaderCell>
				</TableHeaderRow>
			</TableHeader>
			<TableBody v-slot="{ rows }">
				<TableRow v-for="row in rows" :key="row.key" :row="row">
					<TableCells v-slot="{ column }">
						<TableSelectionCheckbox v-if="column.name === 'select'" v-slot="{ selected, partly }" as-child>
							<CheckboxRoot class="check" :model-value="partly ? 'indeterminate' : selected">
								<CheckboxIndicator class="check-mark">
									<IconMinus v-if="partly" />
									<IconCheck v-else />
								</CheckboxIndicator>
							</CheckboxRoot>
						</TableSelectionCheckbox>
					</TableCells>
				</TableRow>
			</TableBody>
		</TableRoot>
	</div>
</template>

<style scoped>
.check {
	display: inline-flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 18px;
	height: 18px;
	padding: 0;
	border: 1.5px solid var(--ui-border-strong);
	border-radius: 6px;
	background: var(--ui-bg);
	color: var(--ui-accent-fg);
	cursor: pointer;
	transition: background-color 0.15s, border-color 0.15s, transform 0.15s;
}

.check:hover {
	border-color: var(--ui-accent);
}

.check:active {
	transform: scale(0.92);
}

.check:focus-visible {
	outline: none;
	box-shadow: var(--ui-ring);
}

.check[data-state='checked'],
.check[data-state='indeterminate'] {
	border-color: var(--ui-accent);
	background: var(--ui-accent);
}

.check[aria-disabled='true'] {
	cursor: not-allowed;
	opacity: 0.35;
}

.check-mark {
	display: inline-flex;
}

.check-mark[data-state='checked'],
.check-mark[data-state='indeterminate'] {
	animation: mark-in 0.22s cubic-bezier(0.2, 0, 0, 1);
}

.check-mark[data-state='unchecked'] {
	animation: mark-out 0.14s ease-in forwards;
}

.check-mark svg {
	width: 12px;
	height: 12px;
	stroke-width: 3;
	stroke-dasharray: 30;
	animation: mark-draw 0.28s 0.04s cubic-bezier(0.2, 0, 0, 1) backwards;
}

.people :deep([data-tc-part='body'] [data-tc-column]) {
	transition: background-color 0.2s, box-shadow 0.2s;
}

@keyframes mark-in {
	from {
		opacity: 0;
		transform: scale(0.4) rotate(-12deg);
	}
}

@keyframes mark-out {
	to {
		opacity: 0;
		transform: scale(0.4);
	}
}

@keyframes mark-draw {
	from {
		stroke-dashoffset: 30;
	}
}

@media (prefers-reduced-motion: reduce) {
	.check-mark,
	.check-mark svg {
		animation: none;
	}
}
</style>
