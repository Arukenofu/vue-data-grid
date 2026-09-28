<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridHeader,
	GridHeaderCell,
	GridHeaderContent,
	GridHeaderRow,
	GridRoot,
	GridRow,
	GridSelectAllCheckbox,
	GridSelectionCheckbox,
	GridSortIndicator,
	navigation,
	selection,
	selectionColumn,
	sorting,
	useDataGrid,
} from '@vue-data-grid/core';
import IconArrowDown from '~icons/lucide/arrow-down';
import IconArrowUp from '~icons/lucide/arrow-up';
import IconCheck from '~icons/lucide/check';
import IconMinus from '~icons/lucide/minus';

import { type Person, people } from '@/data/people';

import PresenceDot from './PresenceDot.vue';

const column = defineColumn<Person>({ sortable: true });

const columns = defineColumns({
	select: selectionColumn(),
	name: column('name', { label: 'Name', width: 180 }),
	team: column('team', { label: 'Team', width: 120 }),
	role: column('role', { label: 'Role', width: 170, flex: 1 }),
	location: column('location', { label: 'Office', width: 100 }),
});

const grid = useDataGrid({
	columns,
	rows: people.slice(0, 16),
	rowKey: 'id',
	rowHeight: 40,
	features: {
		sorting: sorting(),
		selection: selection(),
		navigation: navigation(),
	},
});
</script>

<template>
	<div>
		<GridRoot :grid="grid" label="People" class="ui-grid" data-size="sm">
			<GridHeader>
				<GridHeaderRow v-slot="{ columns }">
					<GridHeaderCell v-for="column in columns" :key="column.key" :column="column" :class="{ 'is-sortable': column.column?.sortable }">
						<GridSelectAllCheckbox v-if="column.key === 'select'" v-slot="{ selected, partly }" as-child>
							<button class="check">
								<IconMinus v-if="partly" aria-hidden="true" />
								<IconCheck v-else-if="selected" aria-hidden="true" />
							</button>
						</GridSelectAllCheckbox>
						<template v-else>
							<GridHeaderContent />
							<GridSortIndicator v-slot="{ direction }">
								<IconArrowUp v-if="direction === 'asc'" />
								<IconArrowDown v-else-if="direction === 'desc'" />
							</GridSortIndicator>
						</template>
					</GridHeaderCell>
				</GridHeaderRow>
			</GridHeader>
			<GridBody v-slot="{ rows }">
				<GridRow v-for="row in rows" :key="row.key" :row="row">
					<GridCells v-slot="{ column, value }">
						<GridSelectionCheckbox v-if="column.name === 'select'" v-slot="{ selected }" as-child>
							<button class="check">
								<IconCheck v-if="selected" aria-hidden="true" />
							</button>
						</GridSelectionCheckbox>
						<template v-else-if="column.name === 'name'">
							<PresenceDot />
							<span data-dg-part="cell-text">{{ value }}</span>
						</template>
					</GridCells>
				</GridRow>
			</GridBody>
		</GridRoot>
	</div>
</template>

<style scoped>
.check {
	display: inline-flex;
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
	transition: background-color 0.15s, border-color 0.15s;
}

.check[aria-checked='true'],
.check[aria-checked='mixed'] {
	border-color: var(--ui-accent);
	background: var(--ui-accent);
}

.check:focus-visible {
	outline: none;
	box-shadow: var(--ui-ring);
}

.check svg {
	width: 14px;
	height: 14px;
	stroke-width: 3.5;
}
</style>
