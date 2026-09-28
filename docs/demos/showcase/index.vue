<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	downloadCsv,
	getCellColumns,
	GridCellTemplate,
	GridHeaderTemplate,
	navigation,
	selection,
	selectionColumn,
	sorting,
	toCsv,
	useDataGrid,
} from '@vue-data-grid/core';
import IconDownload from '~icons/lucide/download';
import IconTrash from '~icons/lucide/trash-2';
import IconX from '~icons/lucide/x';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import {
	type BadgeTone,
	type Option,
	UiBadge,
	UiButton,
	UiColumnsMenu,
	UiDataGrid,
	UiInput,
	UiToggleGroup,
	UiToolbar,
} from '@/ui';

import AccountCell from './AccountCell.vue';
import { type Account, type AccountStatus, createAccounts, type Plan, upgrade } from './accounts';
import { formatMinutesAgo, formatMoney, formatPercent } from './format';
import RowActions from './RowActions.vue';
import UsageCell from './UsageCell.vue';

type StatusFilter = 'all' | AccountStatus;

type Density = 'comfortable' | 'compact';

const STATUS: Readonly<Record<AccountStatus, { label: string; tone: BadgeTone }>> = {
	'active': { label: 'Active', tone: 'green' },
	'trial': { label: 'Trial', tone: 'blue' },
	'past-due': { label: 'Past due', tone: 'amber' },
	'churned': { label: 'Churned', tone: 'gray' },
};

const PLAN_TONES: Readonly<Record<Plan, BadgeTone>> = {
	Free: 'gray',
	Starter: 'blue',
	Pro: 'violet',
	Enterprise: 'green',
};

const STATUS_FILTERS: readonly Option<StatusFilter>[] = [
	{ value: 'all', label: 'All' },
	{ value: 'active', label: 'Active' },
	{ value: 'trial', label: 'Trial' },
	{ value: 'past-due', label: 'Past due' },
	{ value: 'churned', label: 'Churned' },
];

const DENSITIES: readonly Option<Density>[] = [
	{ value: 'comfortable', label: 'Comfortable' },
	{ value: 'compact', label: 'Compact' },
];

const accounts = shallowRef(createAccounts(50));
const search = shallowRef('');
const status = shallowRef<StatusFilter>('all');
const density = shallowRef<Density>('comfortable');
const selected = ref<string[]>([]);

function replace(id: string, change: (account: Account) => Account) {
	accounts.value = accounts.value.map(account => (account.id === id ? change(account) : account));
}

function remove(ids: readonly string[]) {
	accounts.value = accounts.value.filter(account => !ids.includes(account.id));
	selected.value = selected.value.filter(id => !ids.includes(id));
}

async function copyEmail(account: Account) {
	await navigator.clipboard.writeText(account.email);
}

const column = defineColumn<Account>({ sortable: true, resizable: true, hideable: true });

const columns = defineColumns({
	select: selectionColumn(),
	account: column('company', {
		label: 'Account',
		width: 220,
		minWidth: 180,
		pinned: 'start',
		pinnable: true,
		hideable: false,
		footer: ({ rows }) => `${rows.length} accounts`,
	}),
	status: column('status', {
		label: 'Status',
		width: 110,
		format: value => STATUS[value].label,
	}),
	plan: column('plan', {
		label: 'Plan',
		width: 104,
	}),
	mrr: column('mrr', {
		label: 'MRR',
		width: 104,
		align: 'right',
		format: formatMoney,
		aggregate: 'sum',
		footer: ({ aggregate }) => formatMoney(aggregate ?? 0),
	}),
	usage: column(account => account.seatsUsed / account.seats, {
		label: 'Seats',
		width: 140,
		format: formatPercent,
		aggregate: 'avg',
		footer: ({ aggregate }) => (aggregate === null ? '' : `${formatPercent(aggregate)} used`),
	}),
	country: column('country', { label: 'Country', width: 112, flex: 1 }),
	lastActive: column('lastActive', {
		label: 'Last active',
		width: 112,
		sortOrder: ['asc', 'desc'],
		format: formatMinutesAgo,
	}),
	actions: column(() => null, {
		kind: 'service',
		label: 'Actions',
		width: 48,
		align: 'center',
		sortable: false,
		resizable: false,
		hideable: false,
	}),
});

const filtered = computed(() => {
	const text = search.value.trim().toLowerCase();

	return accounts.value.filter(account => (status.value === 'all' || account.status === status.value)
		&& (text === '' || `${account.company} ${account.contact} ${account.email}`.toLowerCase().includes(text)));
});

const grid = useDataGrid({
	columns,
	rows: filtered,
	rowKey: 'id',
	rowHeight: computed(() => (density.value === 'compact' ? 40 : 52)),
	multiSort: true,
	sort: [{ name: 'mrr', direction: 'desc' }],
	features: {
		sorting: sorting(),
		selection: selection({ selection: selected }),
		navigation: navigation(),
	},
});

const selectedCount = grid.selection.selectedCount;

function exportCsv(rows: readonly Account[], name: string) {
	downloadCsv(toCsv({ columns: getCellColumns(grid.scope.columns.value), rows }), { name });
}

function exportSelected() {
	exportCsv(grid.rows.value.filter(account => selected.value.includes(account.id)), 'accounts-selected');
}

const narrow = shallowRef(false);
let narrowQuery: MediaQueryList | null = null;

function followWidth() {
	narrow.value = narrowQuery?.matches ?? false;
}

onMounted(() => {
	narrowQuery = window.matchMedia('(max-width: 640px)');
	narrowQuery.addEventListener('change', followWidth);
	followWidth();
});

onBeforeUnmount(() => narrowQuery?.removeEventListener('change', followWidth));

watch(narrow, value => grid.scope.pinColumn('account', value ? null : 'start'));
</script>

<template>
	<div class="accounts">
		<div class="accounts-bar">
			<UiToolbar>
				<UiInput v-model="search" label="Search accounts" placeholder="Search accounts…" search />
				<UiToggleGroup v-model="status" :options="STATUS_FILTERS" label="Status" />
				<span class="ui-spacer" />
				<UiToggleGroup v-model="density" :options="DENSITIES" label="Density" />
				<UiColumnsMenu :scope="grid.scope" @reset="grid.state.reset()" />
				<UiButton @click="exportCsv(grid.rows.value, 'accounts')">
					<IconDownload aria-hidden="true" />
					Export
				</UiButton>
			</UiToolbar>

			<Transition name="accounts-bulk">
				<div v-if="selectedCount > 0" class="accounts-bulk" role="region" aria-label="Selected accounts">
					<span class="accounts-bulk-count">{{ selectedCount }} selected</span>
					<span class="ui-spacer" />
					<UiButton size="sm" variant="ghost" @click="exportSelected">
						<IconDownload aria-hidden="true" />
						Export
					</UiButton>
					<UiButton size="sm" variant="ghost" class="accounts-danger" @click="remove(selected)">
						<IconTrash aria-hidden="true" />
						Delete
					</UiButton>
					<UiButton size="sm" variant="ghost" icon aria-label="Clear the selection" @click="selected = []">
						<IconX aria-hidden="true" />
					</UiButton>
				</div>
			</Transition>
		</div>

		<UiDataGrid
			:grid="grid"
			label="Accounts"
			:density="density"
			:messages="{ empty: 'No accounts match these filters' }"
			footer
			data-size="lg"
		>
			<GridCellTemplate v-slot="{ row }" :column="columns.account">
				<AccountCell :account="row" />
			</GridCellTemplate>
			<GridCellTemplate v-slot="{ value }" :column="columns.status">
				<UiBadge :tone="STATUS[value].tone" dot>{{ STATUS[value].label }}</UiBadge>
			</GridCellTemplate>
			<GridCellTemplate v-slot="{ value }" :column="columns.plan">
				<UiBadge :tone="PLAN_TONES[value]">{{ value }}</UiBadge>
			</GridCellTemplate>
			<GridCellTemplate v-slot="{ row }" :column="columns.usage">
				<UsageCell :account="row" />
			</GridCellTemplate>
			<GridHeaderTemplate :column="columns.actions">
				<span class="ui-visually-hidden">Actions</span>
			</GridHeaderTemplate>
			<GridCellTemplate v-slot="{ row }" :column="columns.actions">
				<RowActions
					:account="row"
					@upgrade="replace(row.id, upgrade)"
					@copy="copyEmail(row)"
					@remove="remove([row.id])"
				/>
			</GridCellTemplate>
		</UiDataGrid>
	</div>
</template>

<style scoped>
.accounts-bar {
	position: relative;
	display: flow-root;
}

.accounts-bar :deep(.ui-toggle-group) {
	max-width: 100%;
	overflow-x: auto;
	scrollbar-width: none;
}

.accounts-bulk {
	position: absolute;
	inset: 0 0 12px;
	display: flex;
	align-items: center;
	gap: 4px;
	padding-inline: 14px 6px;
	border: 1px solid var(--ui-accent-line);
	border-radius: var(--ui-radius);
	background: var(--ui-accent-soft);
	color: var(--ui-accent-text);
	box-shadow: var(--ui-shadow-sm);
}

.accounts-bulk-count {
	font: 600 13px/1 var(--ui-font);
}

.accounts-bulk :deep(.ui-button) {
	color: var(--ui-accent-text);
}

.accounts-bulk :deep(.accounts-danger) {
	color: var(--ui-down);
}

.accounts-bulk-enter-active,
.accounts-bulk-leave-active {
	transition: opacity 0.18s, translate 0.18s;
}

.accounts-bulk-enter-from,
.accounts-bulk-leave-to {
	opacity: 0;
	translate: 0 4px;
}

@media (prefers-reduced-motion: reduce) {
	.accounts-bulk-enter-active,
	.accounts-bulk-leave-active {
		transition: none;
	}
}
</style>
