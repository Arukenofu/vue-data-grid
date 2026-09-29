<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridRoot,
	GridRow,
	useDataGrid,
	useGridEdge,
} from '@vue-data-grid/core';
import IconLoaderCircle from '~icons/lucide/loader-circle';
import { computed, onBeforeUnmount, shallowRef } from 'vue';

import { createRandom } from '@/data/random';
import { UiDataGridHeader, UiStat, UiToolbar } from '@/ui';

interface Service {
	id: string;
	name: string;
	seed: number;
}

const DAYS_PER_PAGE = 14;
const LAST_DAY = 90;
const LATENCY = 900;
const FIRST_DAY = Date.UTC(2026, 6, 1);
const DAY = 24 * 60 * 60 * 1000;

const services: Service[] = ['api', 'auth', 'billing', 'search', 'worker', 'mailer', 'reports', 'uploads']
	.map((name, index) => ({ id: name, name, seed: index + 1 }));

const dayLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function requestsOn(service: Service, day: number) {
	return createRandom(service.seed * 1000 + day).int(800, 9_800);
}

const days = shallowRef(DAYS_PER_PAGE);
let timer: ReturnType<typeof setTimeout> | undefined;

const column = defineColumn<Service>();

const nameColumn = column('name', { label: 'Service', width: 120, pinned: 'start' });

function createDayColumn(day: number) {
	return column(service => requestsOn(service, day), {
		label: dayLabel.format(FIRST_DAY + day * DAY),
		width: 84,
		align: 'right',
		format: value => value.toLocaleString('en-US'),
	});
}

const dayColumns: ReturnType<typeof createDayColumn>[] = [];

const columns = computed(() => {
	while (dayColumns.length < days.value) {
		dayColumns.push(createDayColumn(dayColumns.length));
	}

	return defineColumns({
		name: nameColumn,
		...Object.fromEntries(dayColumns.slice(0, days.value).map((dayColumn, day) => [`day${day}`, dayColumn])),
	});
});

const grid = useDataGrid({ columns, rows: services, rowKey: 'id', rowHeight: 40, virtual: true });

function loadDays() {
	return new Promise<void>((resolve) => {
		timer = setTimeout(() => {
			days.value = Math.min(days.value + DAYS_PER_PAGE, LAST_DAY);
			resolve();
		}, LATENCY);
	});
}

const { reached, pending } = useGridEdge(grid, {
	edge: 'end',
	hasMore: () => days.value < LAST_DAY,
	onReach: loadDays,
});

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
	<div>
		<UiToolbar>
			<UiStat label="Days" :value="`${days} of ${LAST_DAY}`" />
			<UiStat label="At the end" :value="reached ? 'yes' : 'no'" />
			<span class="ui-spacer" />
			<span v-if="pending" class="ui-toolbar-text loading">
				<IconLoaderCircle class="spinner" aria-hidden="true" />
				Loading two more weeks…
			</span>
		</UiToolbar>
		<GridRoot :grid="grid" label="Requests per day" class="ui-grid" data-size="sm">
			<UiDataGridHeader />
			<GridBody v-slot="{ rows }">
				<GridRow v-for="row in rows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
			</GridBody>
		</GridRoot>
	</div>
</template>

<style scoped>
.loading {
	display: inline-flex;
	align-items: center;
	gap: 6px;
}

.spinner {
	color: var(--ui-accent);
	animation: spin 0.8s linear infinite;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
