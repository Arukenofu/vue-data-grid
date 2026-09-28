<!--
	The header of a grid of parts with the kit's icons: group rows with a chevron that collapses a
	group, and column headers with a sort icon and a resize handle. The content parts render the
	`header` field of columns and groups, so service columns such as `selectionColumn()` keep their
	checkbox.
-->
<script setup lang="ts">
import {
	GridGroupCell,
	GridGroupContent,
	GridGroupRow,
	GridGroupToggle,
	GridHeader,
	GridHeaderCell,
	GridHeaderContent,
	GridHeaderRow,
	GridResizeHandle,
	GridSortIndicator,
} from '@vue-data-grid/core';
import IconChevronLeft from '~icons/lucide/chevron-left';
import IconChevronRight from '~icons/lucide/chevron-right';

import SortIcon from './SortIcon.vue';
</script>

<template>
	<GridHeader v-slot="{ groups }">
		<GridGroupRow v-for="(_cells, level) in groups" :key="`level-${level}`" v-slot="{ cells }" :level="level">
			<GridGroupCell v-for="cell in cells" :key="cell.key" :cell="cell">
				<GridGroupContent />
				<GridGroupToggle v-slot="{ collapsed }" class="ui-cell-button">
					<IconChevronRight v-if="collapsed" aria-hidden="true" />
					<IconChevronLeft v-else aria-hidden="true" />
				</GridGroupToggle>
			</GridGroupCell>
		</GridGroupRow>
		<GridHeaderRow v-slot="{ columns }">
			<GridHeaderCell
				v-for="rendered in columns"
				:key="rendered.key"
				:column="rendered"
				:class="{ 'is-sortable': rendered.column?.sortable }"
			>
				<GridHeaderContent />
				<GridSortIndicator v-slot="{ direction, sortIndex }">
					<SortIcon :direction="direction" :sort-index="sortIndex" />
				</GridSortIndicator>
				<GridResizeHandle />
			</GridHeaderCell>
		</GridHeaderRow>
	</GridHeader>
</template>
