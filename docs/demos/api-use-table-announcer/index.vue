<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	selection,
	selectionColumn,
	sorting,
	TableBody,
	TableCells,
	TableRoot,
	TableRow,
	useDataTable,
	useTableAnnouncer,
} from '@vue-data-grid/core';
import IconMegaphone from '~icons/lucide/megaphone';
import { shallowRef, watch } from 'vue';

import { type Stock, stocks } from '@/data/stocks';
import { UiButton, UiDataTableHeader, UiToolbar } from '@/ui';

const LOG_SIZE = 4;

const column = defineColumn<Stock>({ sortable: true });

const columns = defineColumns({
	select: selectionColumn(),
	symbol: column(stock => stock.symbol, { label: 'Symbol', width: 90 }),
	name: column(stock => stock.name, { label: 'Company', width: 150, flex: 1 }),
	price: column(stock => stock.price, { label: 'Price', width: 90, align: 'right', format: price => price.toFixed(2) }),
});

const table = useDataTable({
	columns,
	rows: stocks,
	rowKey: 'id',
	rowHeight: 38,
	multiSort: true,
	features: { sorting: sorting(), selection: selection() },
});

const { message, announce } = useTableAnnouncer(table);

const log = shallowRef<readonly { id: number; text: string }[]>([]);
let count = 0;

watch(message, (text) => {
	count += 1;
	log.value = [{ id: count, text: text.trim() }, ...log.value].slice(0, LOG_SIZE);
});

function exportSelection() {
	const rows = table.selection.selectedCount.value;

	announce(rows === 0 ? 'Nothing to export: select rows first' : `${rows} ${rows === 1 ? 'row' : 'rows'} exported`);
}
</script>

<template>
	<div class="announcer-demo">
		<div class="ui-stack">
			<UiToolbar>
				<UiButton @click="exportSelection">Export selection</UiButton>
				<span class="ui-toolbar-text">Sort, select, or export, and read what a screen reader hears.</span>
			</UiToolbar>

			<TableRoot :table="table" label="Stocks" class="ui-table" data-size="sm" :announce="false">
				<UiDataTableHeader />
				<TableBody v-slot="{ rows }">
					<TableRow v-for="row in rows" :key="row.key" :row="row">
						<TableCells />
					</TableRow>
				</TableBody>
			</TableRoot>
		</div>

		<div role="status" aria-live="polite" class="ui-visually-hidden">{{ message }}</div>

		<section class="announcer-log" aria-label="Announcements">
			<p class="announcer-title">
				<IconMegaphone aria-hidden="true" />
				Heard by a screen reader
			</p>
			<TransitionGroup tag="ol" name="announcement" class="announcer-list">
				<li v-for="entry in log" :key="entry.id">{{ entry.text }}</li>
			</TransitionGroup>
			<p v-if="log.length === 0" class="announcer-empty">Nothing yet</p>
		</section>
	</div>
</template>

<style scoped>
.announcer-demo {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 220px;
	gap: 16px;
}

.announcer-log {
	display: flex;
	flex-direction: column;
	min-width: 0;
	padding: 14px;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius);
	background: var(--ui-bg);
	box-shadow: var(--ui-shadow-sm);
	font: 400 13px/1.45 var(--ui-font);
}

.announcer-title {
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 0 0 10px;
	color: var(--ui-fg-muted);
	font-size: 12px;
	font-weight: 600;
}

.announcer-title svg {
	width: 15px;
	height: 15px;
	color: var(--ui-accent-text);
}

.announcer-list {
	display: grid;
	gap: 8px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.announcer-list li {
	padding: 8px 10px;
	border-radius: var(--ui-radius-sm);
	background: var(--ui-bg-subtle);
	color: var(--ui-fg-muted);
}

.announcer-list li:first-child {
	background: var(--ui-accent-soft);
	color: var(--ui-accent-text);
	font-weight: 500;
}

.announcer-empty {
	margin: 0;
	color: var(--ui-fg-subtle);
}

.announcement-enter-active {
	transition: opacity 0.25s, translate 0.25s;
}

.announcement-enter-from {
	opacity: 0;
	translate: 0 -6px;
}

.announcement-move {
	transition: translate 0.25s;
}

@media (max-width: 760px) {
	.announcer-demo {
		grid-template-columns: minmax(0, 1fr);
	}
}
</style>
