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
	GridSortIndicator,
	sorting,
	useDataGrid,
} from '@vue-data-grid/core';
import IconArrowDownWideNarrow from '~icons/lucide/arrow-down-wide-narrow';
import IconArrowUpNarrowWide from '~icons/lucide/arrow-up-narrow-wide';
import IconArrowUpDown from '~icons/lucide/arrow-up-down';

import { type Person, people } from '@/data/people';
import { UiButton, UiSwitch, UiToolbar } from '@/ui';

const column = defineColumn<Person>({ sortable: true });

const columns = defineColumns({
	name: column(person => person.name, { label: 'Name', width: 170, sortOrder: ['asc', 'desc'] }),
	team: column(person => person.team, { label: 'Team', width: 150, sortOrder: ['asc', 'desc'] }),
	location: column(person => person.location, { label: 'Location', width: 130, flex: 1, sortOrder: ['asc', 'desc'] }),
	projects: column(person => person.projects, { label: 'Projects', width: 120, align: 'right' }),
	rating: column(person => person.rating, { label: 'Rating', width: 110, align: 'right', format: rating => rating.toFixed(1) }),
});

const grid = useDataGrid({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
	multiSort: true,
	sort: [{ name: 'team', direction: 'asc' }, { name: 'rating', direction: 'desc' }],
	features: { sorting: sorting() },
});

const { multiSort, sort } = grid.state;

function clearSort() {
	sort.value = [];
}
</script>

<template>
	<div>
		<UiToolbar>
			<UiSwitch v-model="multiSort" label="Shift-click adds a column" />
			<span class="ui-spacer" />
			<UiButton size="sm" :disabled="sort.length === 0" @click="clearSort">Clear sort</UiButton>
		</UiToolbar>

		<GridRoot :grid="grid" label="People" class="ui-grid" data-size="sm">
			<GridHeader>
				<GridHeaderRow v-slot="{ columns: headers }">
					<GridHeaderCell v-for="header in headers" :key="header.key" :column="header" class="is-sortable">
						<GridHeaderContent />
						<GridSortIndicator v-slot="{ direction, sortIndex }" class="indicator">
							<IconArrowUpNarrowWide v-if="direction === 'asc'" />
							<IconArrowDownWideNarrow v-else-if="direction === 'desc'" />
							<IconArrowUpDown v-else class="idle" />
							<span v-if="sortIndex !== undefined" class="order">{{ sortIndex }}</span>
						</GridSortIndicator>
					</GridHeaderCell>
				</GridHeaderRow>
			</GridHeader>
			<GridBody v-slot="{ rows }">
				<GridRow v-for="row in rows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
			</GridBody>
		</GridRoot>
	</div>
</template>

<style scoped>
.indicator {
	gap: 3px;
}

.indicator svg {
	width: 15px;
	height: 15px;
}

.idle {
	color: var(--ui-fg-subtle);
	opacity: 0.5;
}

.order {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 16px;
	height: 16px;
	padding-inline: 4px;
	border-radius: 999px;
	background: var(--ui-accent-soft);
	color: var(--ui-accent-text);
	font-size: 10.5px;
	font-weight: 700;
}
</style>
