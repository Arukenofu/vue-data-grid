<script setup lang="ts">
import { type DateValue, parseDate } from '@internationalized/date';
import type { EditorContext } from '@vue-data-grid/core';
import IconCalendar from '~icons/lucide/calendar';
import IconChevronLeft from '~icons/lucide/chevron-left';
import IconChevronRight from '~icons/lucide/chevron-right';
import {
	DatePickerCalendar,
	DatePickerCell,
	DatePickerCellTrigger,
	DatePickerContent,
	DatePickerField,
	DatePickerGrid,
	DatePickerGridBody,
	DatePickerGridHead,
	DatePickerGridRow,
	DatePickerHeadCell,
	DatePickerHeader,
	DatePickerHeading,
	DatePickerInput,
	DatePickerNext,
	DatePickerPrev,
	DatePickerRoot,
	DatePickerTrigger,
} from 'reka-ui';
import { computed, shallowRef } from 'vue';

const props = defineProps<{ context: EditorContext<unknown, string | null> }>();

const open = shallowRef(true);
let picked = false;

const value = computed(() => (props.context.draft === null ? undefined : parseDate(props.context.draft)));

function change(date: DateValue | undefined) {
	props.context.setDraft(date ? date.toString() : null);
	picked = open.value;
}

function toggle(next: boolean) {
	open.value = next;

	if (!next && picked) {
		props.context.commit('none');
	}
}
</script>

<template>
	<div class="date-editor">
		<DatePickerRoot
			:model-value="value"
			:open="open"
			locale="en-US"
			close-on-select
			@update:model-value="change"
			@update:open="toggle"
		>
			<DatePickerField v-slot="{ segments }" v-bind="context.inputProps" class="date-editor-field">
				<template v-for="(item, index) in segments" :key="`${item.part}-${index}`">
					<DatePickerInput :part="item.part" :class="item.part === 'literal' ? 'date-editor-literal' : 'date-editor-segment'">
						{{ item.value }}
					</DatePickerInput>
				</template>
				<DatePickerTrigger class="date-editor-trigger" aria-label="Open the calendar">
					<IconCalendar aria-hidden="true" />
				</DatePickerTrigger>
			</DatePickerField>

			<DatePickerContent class="date-editor-calendar" align="end" :side-offset="6">
				<DatePickerCalendar :ref="context.ownFocus" v-slot="{ weekDays, grid }" class="date-editor-body">
					<DatePickerHeader class="date-editor-header">
						<DatePickerPrev class="date-editor-nav" aria-label="Previous month">
							<IconChevronLeft aria-hidden="true" />
						</DatePickerPrev>
						<DatePickerHeading class="date-editor-heading" />
						<DatePickerNext class="date-editor-nav" aria-label="Next month">
							<IconChevronRight aria-hidden="true" />
						</DatePickerNext>
					</DatePickerHeader>
					<DatePickerGrid v-for="month in grid" :key="month.value.toString()" class="date-editor-grid">
						<DatePickerGridHead>
							<DatePickerGridRow class="date-editor-row">
								<DatePickerHeadCell v-for="day in weekDays" :key="day" class="date-editor-weekday">
									{{ day }}
								</DatePickerHeadCell>
							</DatePickerGridRow>
						</DatePickerGridHead>
						<DatePickerGridBody>
							<DatePickerGridRow v-for="(week, index) in month.rows" :key="index" class="date-editor-row">
								<DatePickerCell v-for="date in week" :key="date.toString()" :date="date">
									<DatePickerCellTrigger :day="date" :month="month.value" class="date-editor-day" />
								</DatePickerCell>
							</DatePickerGridRow>
						</DatePickerGridBody>
					</DatePickerGrid>
				</DatePickerCalendar>
			</DatePickerContent>
		</DatePickerRoot>
	</div>
</template>

<style>
.date-editor {
	display: flex;
	width: 100%;
	height: 100%;
}

.date-editor-field {
	display: flex;
	align-items: center;
	gap: 1px;
	font-variant-numeric: tabular-nums;
}

.date-editor-segment {
	padding: 1px 2px;
	border-radius: 3px;
	outline: none;
	caret-color: transparent;
}

.date-editor-segment:focus {
	background: var(--ui-accent-soft);
	color: var(--ui-accent-text);
}

.date-editor-segment[data-placeholder] {
	color: var(--ui-fg-subtle);
}

.date-editor-literal {
	color: var(--ui-fg-subtle);
}

.date-editor-trigger {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	margin-inline-start: auto;
	padding: 0;
	border: none;
	border-radius: var(--ui-radius-xs);
	background: none;
	color: var(--ui-fg-subtle);
	cursor: pointer;
}

.date-editor-trigger:hover,
.date-editor-trigger[data-state='open'] {
	background: var(--ui-bg-muted);
	color: var(--ui-accent-text);
}

.date-editor-trigger svg {
	width: 15px;
	height: 15px;
}

.date-editor-calendar {
	z-index: 100;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius);
	background: var(--ui-bg);
	box-shadow: var(--ui-shadow-lg);
	color: var(--ui-fg);
	font: 400 13px/1 var(--ui-font);
	animation: ui-pop-in 0.14s ease-out;
}

.date-editor-body {
	display: block;
	padding: 12px;
}

.date-editor-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-block-end: 8px;
}

.date-editor-heading {
	font-weight: 600;
}

.date-editor-nav {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	padding: 0;
	border: none;
	border-radius: var(--ui-radius-xs);
	background: none;
	color: var(--ui-fg-muted);
	cursor: pointer;
}

.date-editor-nav:hover {
	background: var(--ui-bg-muted);
	color: var(--ui-fg);
}

.date-editor-nav svg {
	width: 16px;
	height: 16px;
}

.date-editor-grid {
	border-collapse: collapse;
}

.date-editor-row {
	display: grid;
	grid-template-columns: repeat(7, 32px);
	gap: 2px;
}

.date-editor-weekday {
	padding-block: 6px;
	color: var(--ui-fg-subtle);
	font-size: 11.5px;
	font-weight: 500;
}

.date-editor-day {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border-radius: var(--ui-radius-xs);
	font-variant-numeric: tabular-nums;
	outline: none;
	cursor: pointer;
	transition: background-color 0.12s, color 0.12s;
}

.date-editor-day:hover {
	background: var(--ui-bg-muted);
}

.date-editor-day:focus-visible {
	box-shadow: var(--ui-ring);
}

.date-editor-day[data-today] {
	color: var(--ui-accent-text);
	font-weight: 700;
}

.date-editor-day[data-selected] {
	background: var(--ui-accent);
	color: var(--ui-accent-fg);
}

.date-editor-day[data-outside-view] {
	color: var(--ui-fg-subtle);
	opacity: 0.5;
}

.date-editor-day[data-disabled],
.date-editor-day[data-unavailable] {
	color: var(--ui-fg-subtle);
	cursor: not-allowed;
	text-decoration: line-through;
}
</style>
