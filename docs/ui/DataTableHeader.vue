<!--
	The header of a table of parts with the kit's icons: group rows with a chevron that collapses a
	group, and column headers with a sort icon and a resize handle. The content parts render the
	`header` field of columns and groups, so service columns such as `selectionColumn()` keep their
	checkbox.
-->
<script setup lang="ts">
import {
	TableGroupCell,
	TableGroupContent,
	TableGroupRow,
	TableGroupToggle,
	TableHeader,
	TableHeaderCell,
	TableHeaderContent,
	TableHeaderRow,
	TableResizeHandle,
	TableSortIndicator,
} from '@vue-stack/table';
import IconChevronLeft from '~icons/lucide/chevron-left';
import IconChevronRight from '~icons/lucide/chevron-right';

import SortIcon from './SortIcon.vue';
</script>

<template>
	<TableHeader v-slot="{ groups }">
		<TableGroupRow v-for="(_cells, level) in groups" :key="`level-${level}`" v-slot="{ cells }" :level="level">
			<TableGroupCell v-for="cell in cells" :key="cell.key" :cell="cell">
				<TableGroupContent />
				<TableGroupToggle v-slot="{ collapsed }" class="ui-cell-button">
					<IconChevronRight v-if="collapsed" aria-hidden="true" />
					<IconChevronLeft v-else aria-hidden="true" />
				</TableGroupToggle>
			</TableGroupCell>
		</TableGroupRow>
		<TableHeaderRow v-slot="{ columns }">
			<TableHeaderCell
				v-for="rendered in columns"
				:key="rendered.key"
				:column="rendered"
				:class="{ 'is-sortable': rendered.column?.sortable }"
			>
				<TableHeaderContent />
				<TableSortIndicator v-slot="{ direction, sortIndex }">
					<SortIcon :direction="direction" :sort-index="sortIndex" />
				</TableSortIndicator>
				<TableResizeHandle />
			</TableHeaderCell>
		</TableHeaderRow>
	</TableHeader>
</template>
