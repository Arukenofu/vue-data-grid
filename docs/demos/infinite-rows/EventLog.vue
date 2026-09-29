<script setup lang="ts">
import { useInfiniteQuery } from '@tanstack/vue-query';
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridCellTemplate,
	GridPlaceholderRows,
	GridRoot,
	GridRow,
	useDataGrid,
	useGridEdge,
} from '@vue-data-grid/core';
import { computed } from 'vue';

import { type BadgeTone, UiBadge, UiDataGridHeader, UiStat, UiToolbar } from '@/ui';

import { type EventLevel, fetchEvents, type LogEvent, START_PAGE } from './api';

const ROW_HEIGHT = 36;

const LEVEL_TONES: Readonly<Record<EventLevel, BadgeTone>> = { info: 'gray', warning: 'amber', error: 'red' };

const column = defineColumn<LogEvent>();

const columns = defineColumns({
	time: column('time', { label: 'Time', width: 100 }),
	level: column('level', { label: 'Level', width: 110 }),
	service: column('service', { label: 'Service', width: 110 }),
	message: column('message', { label: 'Message', width: 220, flex: 1 }),
});

const {
	data,
	isPending,
	isFetching,
	isFetchingNextPage,
	isFetchingPreviousPage,
	hasNextPage,
	hasPreviousPage,
	fetchNextPage,
	fetchPreviousPage,
} = useInfiniteQuery({
	queryKey: ['events'],
	queryFn: ({ pageParam }) => fetchEvents(pageParam),
	initialPageParam: START_PAGE,
	getNextPageParam: page => page.next,
	getPreviousPageParam: page => page.previous,
});

const events = computed(() => data.value?.pages.flatMap(page => page.rows) ?? []);

const grid = useDataGrid({
	columns,
	rows: events,
	rowKey: 'id',
	rowHeight: ROW_HEIGHT,
	virtual: true,
	rowCount: () => (hasNextPage.value || hasPreviousPage.value ? -1 : undefined),
});

useGridEdge(grid, {
	edge: 'bottom',
	hasMore: hasNextPage,
	busy: isFetching,
	onReach: () => fetchNextPage(),
});

useGridEdge(grid, {
	edge: 'top',
	hasMore: hasPreviousPage,
	busy: isFetching,
	onReach: () => fetchPreviousPage(),
});
</script>

<template>
	<div>
		<UiToolbar>
			<UiStat label="Loaded" :value="`${events.length} events`" />
			<UiStat label="Pages" :value="data?.pages.length ?? 0" />
			<span class="ui-spacer" />
			<UiStat label="Earlier" :value="hasPreviousPage ? 'more' : 'start of day'" />
			<UiStat label="Later" :value="hasNextPage ? 'more' : 'end of day'" />
		</UiToolbar>
		<GridRoot :grid="grid" label="Event log" class="ui-grid">
			<GridCellTemplate v-slot="{ value }" :column="columns.level">
				<UiBadge :tone="LEVEL_TONES[value]" dot>{{ value }}</UiBadge>
			</GridCellTemplate>
			<UiDataGridHeader />
			<GridPlaceholderRows v-if="isFetchingPreviousPage" edge="top" :count="3" />
			<GridBody v-slot="{ rows }">
				<GridRow v-for="row in rows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
			</GridBody>
			<GridPlaceholderRows v-if="isPending || isFetchingNextPage" :count="isPending ? 10 : 3" />
		</GridRoot>
	</div>
</template>
