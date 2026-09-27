<!--
	The kit's table: the parts of @vue-stack/table in the kit's look. It takes the table object of
	`useDataTable`, so what the table can do (sorting, selection, a tree, the keyboard) is decided where
	the table is assembled, and this component only renders it: the header with icons, the body, the
	empty and loading states, with `footer` the footer, and cell ranges with the `ranges` feature and
	their fill handle with `fill`.

	The default slot replaces the body, for rows of your own: put a `TableBody` there.
-->
<script setup lang="ts">
import {
	type DataTable,
	TableBody,
	TableCells,
	TableFooter,
	TableFooterCell,
	TableFooterRow,
	TableFillHandle,
	TableFillPreview,
	type TableMessages,
	TableRangeOverlay,
	TableRoot,
	TableRow,
} from '@vue-stack/table';

import DataTableHeader from './DataTableHeader.vue';
import TableStates from './TableStates.vue';

withDefaults(defineProps<{
	table: DataTable;
	/** The accessible name of the table. */
	label: string;
	loading?: boolean;
	/** Show the footer row with the columns' `footer` fields. */
	footer?: boolean;
	/** The strings of the interface; read once. */
	messages?: Partial<TableMessages>;
	density?: 'comfortable' | 'compact';
}>(), {
	loading: false,
	footer: false,
	messages: undefined,
	density: 'comfortable',
});
</script>

<template>
	<TableRoot :table="table" :label="label" :messages="messages" class="ui-table" :data-density="density">
		<DataTableHeader />
		<slot>
			<TableBody v-slot="{ rows }">
				<TableRow v-for="row in rows" :key="row.key" :row="row">
					<TableCells />
				</TableRow>
				<TableRangeOverlay v-if="table.ranges" v-slot="{ corner }">
					<TableFillHandle v-if="corner && table.fill" />
				</TableRangeOverlay>
				<TableFillPreview v-if="table.fill" />
			</TableBody>
		</slot>
		<TableStates :loading="loading" />
		<TableFooter v-if="footer">
			<TableFooterRow v-slot="{ columns }">
				<TableFooterCell v-for="column in columns" :key="column.key" :column="column" />
			</TableFooterRow>
		</TableFooter>
	</TableRoot>
</template>
