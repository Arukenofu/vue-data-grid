<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	selection,
	selectionColumn,
	sorting,
	TableBody,
	TableCells,
	TableHeader,
	TableHeaderCell,
	TableHeaderContent,
	TableHeaderRow,
	TableRoot,
	TableRow,
	TableSortIndicator,
	useDataTable,
} from 'vue-data-grid';
import { computed, shallowRef } from 'vue';

import { createPeople, type Person } from '@/data/people';
import { UiSortIcon, UiStat, UiSwitch, UiToolbar } from '@/ui';

const people = createPeople(1000);

const column = defineColumn<Person>({ sortable: true });

const columns = defineColumns({
	select: selectionColumn(),
	name: column(person => person.name, { label: 'Name', width: 180 }),
	team: column(person => person.team, { label: 'Team', width: 130 }),
	location: column(person => person.location, { label: 'Location', width: 130 }),
	salary: column(person => person.salary, {
		label: 'Salary',
		flex: 1,
		width: 120,
		align: 'right',
		format: salary => `$${salary.toLocaleString('en-US')}`,
	}),
});

const virtual = shallowRef(true);

const table = useDataTable({
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

const { totalSize, headHeight } = table;
const rendered = computed(() => table.items.value.length);
const selectedCount = table.selection.selectedCount;

const sort = computed(() => {
	const items = table.state.sort.value.map(item => `${item.name} ${item.direction}`);

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

		<TableRoot :table="table" label="People" class="ui-table">
			<TableHeader>
				<TableHeaderRow v-slot="{ columns }">
					<TableHeaderCell v-for="column in columns" :key="column.key" :column="column">
						<TableHeaderContent />
						<TableSortIndicator v-slot="{ direction, sortIndex }">
							<UiSortIcon :direction="direction" :sort-index="sortIndex" />
						</TableSortIndicator>
					</TableHeaderCell>
				</TableHeaderRow>
			</TableHeader>
			<TableBody v-slot="{ rows }">
				<TableRow v-for="row in rows" :key="row.key" :row="row">
					<TableCells />
				</TableRow>
			</TableBody>
		</TableRoot>

		<dl class="inspector-state">
			<div>
				<dt>table.state.sort</dt>
				<dd>{{ sort }}</dd>
			</div>
			<div>
				<dt>table.totalSize</dt>
				<dd>{{ totalSize.toLocaleString('en-US') }} px</dd>
			</div>
			<div>
				<dt>table.headHeight</dt>
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
