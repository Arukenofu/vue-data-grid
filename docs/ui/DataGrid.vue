<!--
	The kit's grid: the parts of @vue-data-grid/core in the kit's look. It takes the grid object of
	`useDataGrid`, so what the grid can do (sorting, selection, a tree, the keyboard) is decided where
	the grid is assembled, and this component only renders it: the header with icons, the body, the
	empty and loading states, with `footer` the footer, and cell ranges with the `ranges` feature and
	their fill handle with `fill`.

	The default slot holds the column templates (`GridCellTemplate` and the others), first in
	`GridRoot`, before the header and the body. The `body` slot replaces the body, for rows of your
	own: put a `GridBody` there.
-->
<script setup lang="ts">
import {
	type DataGrid,
	GridBody,
	GridCells,
	GridFooter,
	GridFooterCell,
	GridFooterRow,
	GridFillHandle,
	GridFillPreview,
	type GridMessages,
	GridRangeOverlay,
	GridRoot,
	GridRow,
} from '@vue-data-grid/core';

import DataGridHeader from './DataGridHeader.vue';
import GridStates from './GridStates.vue';

withDefaults(defineProps<{
	grid: DataGrid;
	/** The accessible name of the grid. */
	label: string;
	loading?: boolean;
	/** Show the footer row with the columns' `footer` fields. */
	footer?: boolean;
	/** The strings of the interface; read once. */
	messages?: Partial<GridMessages>;
	density?: 'comfortable' | 'compact';
}>(), {
	loading: false,
	footer: false,
	messages: undefined,
	density: 'comfortable',
});
</script>

<template>
	<GridRoot :grid="grid" :label="label" :messages="messages" class="ui-grid" :data-density="density">
		<slot />
		<DataGridHeader />
		<slot name="body">
			<GridBody v-slot="{ rows }">
				<GridRow v-for="row in rows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
				<GridRangeOverlay v-if="grid.ranges" v-slot="{ corner }">
					<GridFillHandle v-if="corner && grid.fill" />
				</GridRangeOverlay>
				<GridFillPreview v-if="grid.fill" />
			</GridBody>
		</slot>
		<GridStates :loading="loading" />
		<GridFooter v-if="footer">
			<GridFooterRow v-slot="{ columns }">
				<GridFooterCell v-for="column in columns" :key="column.key" :column="column" />
			</GridFooterRow>
		</GridFooter>
	</GridRoot>
</template>
