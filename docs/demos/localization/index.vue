<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	navigation,
	selection,
	selectionColumn,
	sorting,
	useDataGrid,
} from '@vue-data-grid/core';
import { computed, shallowRef } from 'vue';

import { type Person, people } from '@/data/people';
import { UiDataGrid, UiToggleGroup, UiToolbar } from '@/ui';

import { type Locale, type LocaleName, LOCALES } from './locales';

const NAMES: readonly LocaleName[] = ['en', 'de', 'ru', 'kk', 'ar'];

const LANGUAGES = NAMES.map(name => ({ value: name, label: LOCALES[name].label }));

function createColumns(locale: Locale) {
	const money = new Intl.NumberFormat(locale.tag, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
	const day = new Intl.DateTimeFormat(locale.tag, { dateStyle: 'short', timeZone: 'UTC' });
	const column = defineColumn<Person>({ sortable: true, resizable: true });
	const { columns: labels } = locale;

	return defineColumns({
		select: selectionColumn({ label: labels.selection }),
		name: column('name', { label: labels.name, width: 140 }),
		team: column('team', { label: labels.team, width: 112 }),
		location: column('location', { label: labels.location, width: 100 }),
		started: column('started', {
			label: labels.started,
			width: 124,
			format: started => day.format(new Date(started)),
		}),
		salary: column('salary', {
			label: labels.salary,
			width: 112,
			align: 'right',
			format: salary => money.format(salary),
		}),
	});
}

const COLUMNS: Readonly<Record<LocaleName, ReturnType<typeof createColumns>>> = {
	en: createColumns(LOCALES.en),
	de: createColumns(LOCALES.de),
	ru: createColumns(LOCALES.ru),
	kk: createColumns(LOCALES.kk),
	ar: createColumns(LOCALES.ar),
};

const locale = shallowRef<LocaleName>('en');
const current = computed(() => LOCALES[locale.value]);

const grid = useDataGrid({
	columns: () => COLUMNS[locale.value],
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
	multiSort: true,
	features: {
		sorting: sorting(),
		selection: selection(),
		navigation: navigation(),
	},
});
</script>

<template>
	<div :dir="current.dir" :lang="current.tag">
		<UiToolbar>
			<UiToggleGroup v-model="locale" :options="LANGUAGES" label="Language" />
		</UiToolbar>
		<UiDataGrid :key="locale" :grid="grid" :label="current.title" :messages="current.messages" />
	</div>
</template>
