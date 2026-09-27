<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	type MotionEngine,
	sorting,
	useDataTable,
	useTableMotion,
	webAnimations,
} from '@vue-stack/table';
import IconArrowDownWideNarrow from '~icons/lucide/arrow-down-wide-narrow';
import IconArrowLeftRight from '~icons/lucide/arrow-left-right';
import IconMoveHorizontal from '~icons/lucide/move-horizontal';
import IconShuffle from '~icons/lucide/shuffle';
import IconUserMinus from '~icons/lucide/user-minus';
import IconUserPlus from '~icons/lucide/user-plus';
import { computed, shallowRef } from 'vue';

import { type ToggleOption, UiButton, UiDataTable, UiToggleGroup, UiToolbar } from '@/ui';

import { animeEngine, animeHeight } from './anime';
import { newcomers, type Player, players } from './data';
import { gsapEngine, gsapHeight } from './gsap';
import { type HeightMotion, noHeight, useHeightMotion, webHeight } from './height';
import { motionEngine, motionHeight } from './motion';

type EngineName = 'web' | 'gsap' | 'motion' | 'anime' | 'none';

interface Engine {
	rows: MotionEngine;
	height: HeightMotion;
}

const ENGINES: Readonly<Record<EngineName, Engine>> = {
	web: { rows: webAnimations({ duration: 320 }), height: webHeight },
	gsap: { rows: gsapEngine, height: gsapHeight },
	motion: { rows: motionEngine, height: motionHeight },
	anime: { rows: animeEngine, height: animeHeight },
	none: { rows: () => undefined, height: noHeight },
};

const ROW_HEIGHT = 40;

const ENGINE_OPTIONS: readonly ToggleOption<EngineName>[] = [
	{ value: 'web', label: 'Web Animations' },
	{ value: 'gsap', label: 'GSAP' },
	{ value: 'motion', label: 'Motion' },
	{ value: 'anime', label: 'anime.js' },
	{ value: 'none', label: 'None' },
];

function shuffled<TItem>(items: readonly TItem[]) {
	const result = [...items];

	for (let index = result.length - 1; index > 0; index -= 1) {
		const other = Math.floor(Math.random() * (index + 1));

		[result[index], result[other]] = [result[other], result[index]];
	}

	return result;
}

const column = defineColumn<Player>({ sortable: true, resizable: true, movable: true });

const columns = defineColumns({
	number: column(player => player.number, { label: '#', width: 56, sortable: false, format: value => `#${value}` }),
	name: column(player => player.name, { label: 'Player', width: 150, flex: 1 }),
	team: column(player => player.team, { label: 'Team', width: 110 }),
	wins: column(player => player.wins, { label: 'Wins', width: 80, align: 'right' }),
	points: column(player => player.points, {
		label: 'Points',
		width: 100,
		align: 'right',
		format: points => points.toLocaleString('en-US'),
		cellClass: () => 'ui-cell-strong',
	}),
});

const rows = shallowRef(players);
const bench = shallowRef(newcomers);
const engine = shallowRef<EngineName>('gsap');

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: ROW_HEIGHT,
	features: { sorting: sorting() },
});

useTableMotion(table, { engine: computed(() => ENGINES[engine.value].rows) });

useHeightMotion(table.root, () => table.totalSize.value, () => ENGINES[engine.value].height);

const sorted = computed(() => table.state.sort.value.length > 0);
const pointsFirst = computed(() => table.scope.columns.value[1]?.column?.name === 'points');
const fitted = computed(() => Object.keys(table.state.layout.value?.widths ?? {}).length > 0);

function shuffle() {
	table.state.sort.value = [];
	rows.value = shuffled(rows.value);
}

function toggleSort() {
	table.state.sort.value = sorted.value ? [] : [{ name: 'points', direction: 'desc' }];
}

function add() {
	const [player, ...rest] = bench.value;

	if (player) {
		const index = Math.floor(Math.random() * (rows.value.length + 1));

		bench.value = rest;
		rows.value = [...rows.value.slice(0, index), player, ...rows.value.slice(index)];
	}
}

function remove() {
	const player = rows.value[Math.floor(Math.random() * rows.value.length)];

	if (player) {
		rows.value = rows.value.filter(item => item !== player);
		bench.value = [...bench.value, player];
	}
}

function moveColumn() {
	table.scope.moveColumnTo('points', pointsFirst.value ? 4 : 1);
}

function fit() {
	const layout = table.state.layout.value;

	if (layout && fitted.value) {
		table.state.layout.value = { ...layout, widths: {} };
	} else {
		table.scope.fitColumns();
	}
}
</script>

<template>
	<div class="ui-stack">
		<UiToolbar>
			<span class="ui-toolbar-text">Engine</span>
			<UiToggleGroup v-model="engine" :options="ENGINE_OPTIONS" label="Animation engine" />
		</UiToolbar>
		<UiToolbar>
			<UiButton size="sm" @click="shuffle">
				<IconShuffle aria-hidden="true" />
				Shuffle
			</UiButton>
			<UiButton size="sm" :variant="sorted ? 'soft' : 'outline'" :aria-pressed="sorted" @click="toggleSort">
				<IconArrowDownWideNarrow aria-hidden="true" />
				Sort by points
			</UiButton>
			<UiButton size="sm" :disabled="bench.length === 0" @click="add">
				<IconUserPlus aria-hidden="true" />
				Add
			</UiButton>
			<UiButton size="sm" :disabled="rows.length === 0" @click="remove">
				<IconUserMinus aria-hidden="true" />
				Remove
			</UiButton>
			<UiButton size="sm" @click="moveColumn">
				<IconArrowLeftRight aria-hidden="true" />
				Move column
			</UiButton>
			<UiButton size="sm" :variant="fitted ? 'soft' : 'outline'" :aria-pressed="fitted" @click="fit">
				<IconMoveHorizontal aria-hidden="true" />
				Fit widths
			</UiButton>
		</UiToolbar>

		<UiDataTable :table="table" label="Leaderboard" data-size="auto" class="leaderboard" />
	</div>
</template>

<style scoped>
:deep(.leaderboard) {
	max-height: none;
	overflow-y: hidden;
}
</style>
