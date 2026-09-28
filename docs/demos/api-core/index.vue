<script setup lang="ts">
import { defineColumn, defineColumns, toCsv, useRowSelection } from '@vue-data-grid/core';
import IconCheck from '~icons/lucide/check';
import { computed } from 'vue';

import { type Person, people } from '@/data/people';
import { UiAvatar, UiButton, UiToolbar } from '@/ui';

const CARD_COUNT = 6;

const team = people.slice(0, CARD_COUNT);

const column = defineColumn<Person>();

const columns = defineColumns({
	name: column('name', { label: 'Name' }),
	role: column('role', { label: 'Role' }),
	email: column('email', { label: 'Email' }),
});

const selection = useRowSelection({ rows: team, rowKey: 'id' });

const chosen = computed(() => team.filter(person => selection.isSelected(person.id)));

const csv = computed(() => toCsv({ columns: Object.values(columns), rows: chosen.value }));
</script>

<template>
	<div class="ui-stack">
		<UiToolbar>
			<UiButton @click="selection.toggleAll()">{{ selection.isAllSelected.value ? 'Clear' : 'Select all' }}</UiButton>
			<span class="ui-toolbar-text">{{ selection.selectedCount.value }} of {{ team.length }} selected</span>
		</UiToolbar>

		<ul class="cards" aria-label="Team">
			<li v-for="person in team" :key="person.id">
				<button
					type="button"
					class="card"
					:aria-pressed="selection.isSelected(person.id)"
					@click="selection.toggle(person.id)"
				>
					<UiAvatar :name="person.name" />
					<span class="card-text">
						<span class="card-name">{{ person.name }}</span>
						<span class="card-role">{{ person.role }}</span>
					</span>
					<IconCheck v-if="selection.isSelected(person.id)" class="card-check" aria-hidden="true" />
				</button>
			</li>
		</ul>

		<pre class="csv" aria-label="CSV of the selected people">{{ chosen.length > 0 ? csv : 'Select people to export them as CSV' }}</pre>
	</div>
</template>

<style scoped>
.cards {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
	gap: 10px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.card {
	display: flex;
	align-items: center;
	gap: 10px;
	width: 100%;
	padding: 10px 12px;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius);
	background: var(--ui-bg);
	color: var(--ui-fg);
	font: 400 13px/1.4 var(--ui-font);
	text-align: start;
	cursor: pointer;
	transition: border-color 0.12s, background-color 0.12s;
}

.card:hover {
	border-color: var(--ui-border-strong);
}

.card:focus-visible {
	outline: none;
	box-shadow: var(--ui-ring);
}

.card[aria-pressed='true'] {
	border-color: var(--ui-accent);
	background: var(--ui-accent-soft);
}

.card-text {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.card-name {
	font-weight: 600;
}

.card-role {
	overflow: hidden;
	color: var(--ui-fg-subtle);
	text-overflow: ellipsis;
	white-space: nowrap;
}

.card-check {
	flex: none;
	width: 16px;
	height: 16px;
	margin-inline-start: auto;
	color: var(--ui-accent-text);
}

.csv {
	margin: 0;
	padding: 12px 14px;
	overflow: auto;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius);
	background: var(--ui-bg-subtle);
	color: var(--ui-fg-muted);
	font: 400 12.5px/1.6 var(--ui-font-mono);
	white-space: pre;
}
</style>
