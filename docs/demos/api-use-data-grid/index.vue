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
	selection,
	selectionColumn,
	sorting,
	useDataGrid,
} from '@vue-data-grid/core';
import { computed, shallowRef } from 'vue';

import { createPeople, type Person } from '@/data/people';
import { UiSortIcon, UiStat, UiSwitch, UiToolbar } from '@/ui';

const people = createPeople(1000);

const column = defineColumn<Person>({ sortable: true });

const columns = defineColumns({
	select: selectionColumn(),
	name: column('name', { label: 'Name', width: 180 }),
	team: column('team', { label: 'Team', width: 130 }),
	location: column('location', { label: 'Location', width: 130 }),
	salary: column('salary', {
		label: 'Salary',
		flex: 1,
		width: 120,
		align: 'right',
		format: salary => `$${salary.toLocaleString('en-US')}`,
	}),
});

const virtual = shallowRef(true);

const grid = useDataGrid({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
	virtual,
	multiSort: true,
	features: {
		sorting: sorting(),
		selection: selection(),
	},
});

const { totalSize, headHeight } = grid;
const rendered = computed(() => grid.items.value.length);
const selectedCount = grid.selection.selectedCount;

const sort = computed(() => {
	const items = grid.state.sort.value.map(item => `${item.name} ${item.direction}`);

	return items.length > 0 ? items.join(', ') : 'none';
});
</script>

<template>
	<div class="inspector">
		<UiToolbar>
			<UiSwitch v-model="virtual" label="Virtual rows" />
			<span class="ui-toolbar-spacer" />
			<UiStat label="Rows" :value="people.length" />
			<UiStat label="Rendered" :value="rendered" />
			<UiStat label="Selected" :value="selectedCount" />
		</UiToolbar>

		<GridRoot :grid="grid" label="People" class="ui-grid">
			<GridHeader>
				<GridHeaderRow v-slot="{ columns }">
					<GridHeaderCell v-for="column in columns" :key="column.key" :column="column">
						<GridHeaderContent />
						<GridSortIndicator v-slot="{ direction, sortIndex }">
							<UiSortIcon :direction="direction" :sort-index="sortIndex" />
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

		<dl class="inspector-state">
			<div>
				<dt>grid.state.sort</dt>
				<dd>{{ sort }}</dd>
			</div>
			<div>
				<dt>grid.totalSize</dt>
				<dd>{{ totalSize.toLocaleString('en-US') }} px</dd>
			</div>
			<div>
				<dt>grid.headHeight</dt>
				<dd>{{ headHeight }} px</dd>
			</div>
		</dl>
	</div>
</template>

<style scoped>
.inspector-state {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
	margin: 12px 0 0;
}

.inspector-state div {
	padding: 10px 12px;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius-sm);
	background: var(--ui-bg);
}

.inspector-state dt {
	color: var(--ui-fg-muted);
	font-family: var(--ui-font-mono);
	font-size: 12px;
}

.inspector-state dd {
	margin: 4px 0 0;
	overflow: hidden;
	font-size: 13px;
	font-weight: 600;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
