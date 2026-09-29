<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridPlaceholderRows,
	GridRoot,
	GridRow,
	useDataGrid,
} from '@vue-data-grid/core';
import IconArrowDown from '~icons/lucide/arrow-down';
import IconArrowUp from '~icons/lucide/arrow-up';
import { computed, onBeforeUnmount, shallowRef } from 'vue';

import { createPeople, type Person } from '@/data/people';
import { UiButton, UiDataGridHeader, UiToolbar } from '@/ui';

const PAGE_SIZE = 5;
const LATENCY = 1200;

const everyone = createPeople(60, 3);

const column = defineColumn<Person>();

const columns = defineColumns({
	name: column('name', { label: 'Name', width: 170, pinned: 'start' }),
	role: column('role', { label: 'Role', width: 180 }),
	team: column('team', { label: 'Team', width: 120 }),
	location: column('location', { label: 'Office', width: 120, flex: 1 }),
});

const WIDTHS: Readonly<Record<string, string>> = { name: '72%', role: '84%', team: '48%', location: '40%' };

const first = shallowRef(25);
const last = shallowRef(35);
const loading = shallowRef<'top' | 'bottom' | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

const people = computed(() => everyone.slice(first.value, last.value));

const grid = useDataGrid({ columns, rows: people, rowKey: 'id', rowHeight: 40 });

function load(edge: 'top' | 'bottom') {
	loading.value = edge;
	timer = setTimeout(() => {
		if (edge === 'top') {
			first.value = Math.max(first.value - PAGE_SIZE, 0);
		} else {
			last.value = Math.min(last.value + PAGE_SIZE, everyone.length);
		}

		loading.value = null;
	}, LATENCY);
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
	<div>
		<UiToolbar>
			<UiButton size="sm" :disabled="loading !== null || first === 0" @click="load('top')">
				<IconArrowUp aria-hidden="true" />
				Load earlier
			</UiButton>
			<UiButton size="sm" :disabled="loading !== null || last === everyone.length" @click="load('bottom')">
				<IconArrowDown aria-hidden="true" />
				Load later
			</UiButton>
		</UiToolbar>
		<GridRoot :grid="grid" label="People" class="ui-grid" data-size="sm">
			<UiDataGridHeader />
			<GridPlaceholderRows v-if="loading === 'top'" v-slot="{ column: placeholder }" edge="top" :count="PAGE_SIZE">
				<span class="ui-skeleton" :style="{ width: WIDTHS[placeholder.name] }" />
			</GridPlaceholderRows>
			<GridBody v-slot="{ rows }">
				<GridRow v-for="row in rows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
			</GridBody>
			<GridPlaceholderRows v-if="loading === 'bottom'" v-slot="{ column: placeholder }" :count="PAGE_SIZE">
				<span class="ui-skeleton" :style="{ width: WIDTHS[placeholder.name] }" />
			</GridPlaceholderRows>
		</GridRoot>
	</div>
</template>
