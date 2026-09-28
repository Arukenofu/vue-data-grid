<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridCellTemplate,
	navigation,
	selection,
	selectionColumn,
	type SelectionMode,
	useDataGrid,
	useGridMotion,
} from '@vue-data-grid/core';
import IconArchive from '~icons/lucide/archive';
import IconTruck from '~icons/lucide/truck';
import { computed, shallowRef, watch } from 'vue';

import { type BadgeTone, UiBadge, UiButton, UiDataGrid, UiToggleGroup, UiToolbar } from '@/ui';

import { createOrders, type Order, type OrderStatus } from './data';

const STATUS: Readonly<Record<OrderStatus, { label: string; tone: BadgeTone }>> = {
	new: { label: 'New', tone: 'blue' },
	packed: { label: 'Packed', tone: 'amber' },
	shipped: { label: 'Shipped', tone: 'green' },
	cancelled: { label: 'Cancelled', tone: 'gray' },
};

const MODES = [
	{ value: 'multiple', label: 'Multiple' },
	{ value: 'single', label: 'Single' },
] as const;

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const column = defineColumn<Order>();

const columns = defineColumns({
	select: selectionColumn(),
	id: column(order => order.id, { label: 'Order', width: 84, cellClass: () => 'ui-cell-mono' }),
	customer: column(order => order.customer, { label: 'Customer', width: 140 }),
	city: column(order => order.city, { label: 'City', width: 96 }),
	status: column(order => order.status, {
		label: 'Status',
		width: 112,
		format: status => STATUS[status].label,
	}),
	items: column(order => order.items, { label: 'Items', width: 64, align: 'right' }),
	total: column(order => order.total, { label: 'Total', width: 96, align: 'right', format: total => money.format(total) }),
});

const orders = shallowRef<readonly Order[]>(createOrders(36));
const selected = shallowRef<string[]>([]);
const selectionMode = shallowRef<SelectionMode>('multiple');

const cancelled = computed(() => new Set(orders.value.filter(order => order.status === 'cancelled').map(order => order.id)));

const grid = useDataGrid({
	columns,
	rows: orders,
	rowKey: 'id',
	rowHeight: 44,
	features: {
		selection: selection({
			selection: selected,
			selectionMode,
			canSelect: key => !cancelled.value.has(key),
		}),
		navigation: navigation(),
	},
});

useGridMotion(grid);

const selectedCount = grid.selection.selectedCount;

watch(selectionMode, () => grid.selection.clear());

function ship(order: Order): Order {
	return { ...order, status: 'shipped' };
}

function markShipped() {
	const keys = new Set(selected.value);

	orders.value = orders.value.map(order => (keys.has(order.id) ? ship(order) : order));
	grid.selection.clear();
}

function archive() {
	const keys = new Set(selected.value);

	orders.value = orders.value.filter(order => !keys.has(order.id));
	grid.selection.clear();
}
</script>

<template>
	<div>
		<UiToolbar>
			<template v-if="selectedCount > 0">
				<UiBadge tone="green">{{ selectedCount }} selected</UiBadge>
				<UiButton size="sm" @click="markShipped">
					<IconTruck aria-hidden="true" />
					Mark shipped
				</UiButton>
				<UiButton size="sm" @click="archive">
					<IconArchive aria-hidden="true" />
					Archive
				</UiButton>
				<UiButton size="sm" variant="ghost" @click="grid.selection.clear()">Clear</UiButton>
			</template>
			<span v-else class="ui-toolbar-text">Select orders to ship or archive them. Cancelled ones cannot be selected.</span>
			<span class="ui-spacer" />
			<UiToggleGroup v-model="selectionMode" :options="MODES" label="Selection mode" />
		</UiToolbar>
		<UiDataGrid :grid="grid" label="Orders">
			<GridCellTemplate v-slot="{ value }" :column="columns.status">
				<UiBadge :tone="STATUS[value].tone" dot>{{ STATUS[value].label }}</UiBadge>
			</GridCellTemplate>
		</UiDataGrid>
	</div>
</template>
