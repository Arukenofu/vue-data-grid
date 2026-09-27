<!--
	The header rows of a table of hand-written markup, in the kit's look: group rows, sortable column
	headers and resize handles. It takes the table from `useTableScopeContext()` and the prop-getters from
	`tableProps`, and renders only rows: the sticky element around them belongs to the table, which
	measures it for `scrollMargin`. Header cells take the handlers of `useHeaderCell`: a click or Enter
	sorts, Alt+arrows move, Shift+arrows resize.
-->
<script setup lang="ts">
import { type TableProps, useColumnResize, useHeaderCell, useTableScopeContext } from 'vue-data-grid';
import IconChevronLeft from '~icons/lucide/chevron-left';
import IconChevronRight from '~icons/lucide/chevron-right';

import SortIcon from './SortIcon.vue';

const { tableProps } = defineProps<{
	/** The prop-getters of the table: roles, positions, `aria-sort`, and `tabindex` for the navigation. */
	tableProps: TableProps;
}>();

const scope = useTableScopeContext();
const { headerGroups, renderedColumns } = scope;
const header = useHeaderCell(scope);
const resize = useColumnResize(scope);
</script>

<template>
	<div v-for="(cells, level) in headerGroups" :key="`level-${level}`" v-bind="tableProps.getGroupRowProps(level)">
		<div v-for="cell in cells" :key="cell.key" v-bind="tableProps.getGroupCellProps(cell)">
			<template v-if="cell.group">
				<span data-tc-part="cell-text">{{ cell.group.label ?? cell.group.name }}</span>
				<button
					v-if="cell.collapsible"
					type="button"
					class="ui-cell-button"
					data-tc-part="group-toggle"
					:data-tc-state="cell.collapsed ? 'collapsed' : 'expanded'"
					:aria-expanded="!cell.collapsed"
					:aria-label="cell.collapsed ? 'Expand the group' : 'Collapse the group'"
					@click="scope.toggleGroup(cell.group.name)"
				>
					<IconChevronRight v-if="cell.collapsed" aria-hidden="true" />
					<IconChevronLeft v-else aria-hidden="true" />
				</button>
			</template>
		</div>
	</div>
	<div v-bind="tableProps.getHeaderRowProps()">
		<template v-for="item in renderedColumns" :key="item.key">
			<div v-if="!item.column" v-bind="tableProps.getHeaderCellProps(item)" />
			<div
				v-else
				v-bind="{ ...tableProps.getHeaderCellProps(item), ...header.getHandlers(item.column.name) }"
				:class="{ 'is-sortable': item.column.sortable }"
			>
				<span data-tc-part="cell-text">{{ item.column.label ?? item.column.name }}</span>
				<span
					v-if="item.column.sortable"
					data-tc-part="sort-indicator"
					:data-tc-state="scope.getSortDirection(item.column.name) ?? 'none'"
					aria-hidden="true"
				>
					<SortIcon
						:direction="scope.getSortDirection(item.column.name)"
						:sort-index="scope.getSortIndex(item.column.name)"
					/>
				</span>
				<span v-if="item.column.resizable" v-bind="resize.getHandleProps(item.column.name)" />
			</div>
		</template>
	</div>
</template>
