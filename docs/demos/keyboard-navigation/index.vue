<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	navigation,
	selection,
	selectionColumn,
	sorting,
	useDataTable,
} from 'vue-data-grid';
import { computed, h, shallowRef } from 'vue';

import { type BadgeTone, UiBadge, UiButton, UiDataTable, UiStat, UiToolbar } from '@/ui';

import { type BuildStatus, type Release, releases } from './data';
import ReleaseActions from './ReleaseActions.vue';

const STATUS: Readonly<Record<BuildStatus, { label: string; tone: BadgeTone }>> = {
	passed: { label: 'Passed', tone: 'green' },
	failed: { label: 'Failed', tone: 'red' },
	running: { label: 'Running', tone: 'amber' },
};

const rows = shallowRef(releases);
const lastAction = shallowRef('None yet');

function toggleApproval(release: Release) {
	rows.value = rows.value.map(row => (row.id === release.id ? { ...row, approved: !row.approved } : row));
	lastAction.value = `${release.approved ? 'Revoked' : 'Approved'} ${release.version}`;
}

function run(action: string, release: Release) {
	lastAction.value = `${action} ${release.service} ${release.version}`;
}

const column = defineColumn<Release>({ sortable: true, movable: true, resizable: true });

const columns = defineColumns({
	select: selectionColumn(),
	version: column(release => release.version, {
		label: 'Version',
		width: 100,
		cell: ({ row, value }) => h('button', { type: 'button', class: 'release-link', onClick: () => run('Opened the notes of', row) }, value),
	}),
	service: column(release => release.service, { label: 'Service', width: 110, flex: 1 }),
	status: column(release => release.status, {
		label: 'Build',
		width: 104,
		cell: ({ value }) => h(UiBadge, { tone: STATUS[value].tone, dot: true }, () => STATUS[value].label),
	}),
	approved: column(release => release.approved, {
		label: 'Approved',
		width: 106,
		align: 'center',
		cell: ({ row, value }) => h('input', {
			type: 'checkbox',
			class: 'release-check',
			checked: value,
			'aria-label': `Approve ${row.version}`,
			onChange: () => toggleApproval(row),
		}),
	}),
	actions: column(() => null, {
		label: 'Actions',
		kind: 'service',
		width: 164,
		sortable: false,
		cell: ({ row }) => h(ReleaseActions, { release: row, onAction: (name: string) => run(name, row) }),
	}),
});

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 44,
	features: {
		sorting: sorting(),
		selection: selection(),
		navigation: navigation(),
	},
});

const focused = computed(() => {
	const cell = table.navigation.focused.value;

	if (!cell) {
		return 'Nowhere yet';
	}

	const label = table.scope.getColumn(cell.cell)?.column?.label ?? cell.cell;

	return cell.section === 'body' ? `${table.rows.value[cell.row]?.version} › ${label}` : `Header › ${label}`;
});

async function focusFirstCell() {
	await table.navigation.focusCell({ section: 'body', row: 0, cell: 'version' });
}
</script>

<template>
	<div class="releases">
		<UiToolbar>
			<UiButton @click="focusFirstCell">Focus the first cell</UiButton>
			<span class="ui-spacer" />
			<UiStat label="Focus" :value="focused" />
			<UiStat label="Last action" :value="lastAction" />
		</UiToolbar>

		<UiDataTable :table="table" label="Releases" />
	</div>
</template>

<style scoped>
.releases :deep(.release-link) {
	padding: 0;
	border: none;
	background: none;
	color: var(--ui-accent-text);
	font-family: var(--ui-font-mono);
	font-weight: 600;
	text-decoration: underline;
	text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);
	text-underline-offset: 3px;
	cursor: pointer;
}

.releases :deep(.release-check) {
	width: 16px;
	height: 16px;
	margin: 0;
	accent-color: var(--ui-accent);
	cursor: pointer;
}
</style>
