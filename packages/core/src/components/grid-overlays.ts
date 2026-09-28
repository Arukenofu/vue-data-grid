import { computed, defineComponent, h, onBeforeUnmount, onMounted, type SlotsType, type VNodeChild, watch } from 'vue';

import { useDataGridContext } from './context';
import { useGridMessagesContext } from './messages';
import { primitiveProps, renderPrimitive } from './primitive';

/**
 * What the grid shows while it has no rows: a row with one cell over every column, so the grid stays
 * valid ARIA, counted into `aria-rowcount` while it is there. It sticks to the start edge, as wide as
 * the grid. Put it after `GridBody`; it renders nothing while there are rows.
 *
 * The default slot holds the content; without it, the `empty` message.
 */
export const GridEmpty = defineComponent({
	name: 'GridEmpty',
	props: primitiveProps,
	slots: Object as SlotsType<{ default?: () => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();
		const messages = useGridMessagesContext();
		const empty = computed(() => grid.rows.value.length === 0);
		let release: (() => void) | null = null;

		function count(shown: boolean) {
			release?.();
			release = shown ? grid.addBodyRows(1) : null;
		}

		// Counted once mounted: a change while the grid element renders would not render it again.
		onMounted(() => {
			count(empty.value);
			watch(empty, count);
		});
		onBeforeUnmount(() => release?.());

		return () => {
			if (!empty.value) {
				return null;
			}

			const role = grid.getGridProps().role === 'table' ? 'cell' : 'gridcell';

			return renderPrimitive(props, {
				role: 'row',
				'aria-rowindex': grid.headerRows.value + 1,
				'data-dg-part': 'empty',
			}, () => h('div', {
				role,
				'aria-colindex': 1,
				'aria-colspan': Math.max(grid.scope.columns.value.length, 1),
				'data-dg-part': 'empty-cell',
			}, [slots.default ? slots.default() : messages.empty]));
		};
	},
});

/**
 * What the grid shows while it loads: a bar stuck to the bottom of the grid over the rows, right
 * above a footer. While it is mounted the grid is `aria-busy` and the announcer says it is loading;
 * the bar itself is hidden from screen readers. Render it with `v-if` while loading, after `GridBody`
 * and before `GridFooter`.
 *
 * The default slot holds the content; without it, the `loading` message.
 */
export const GridLoading = defineComponent({
	name: 'GridLoading',
	props: primitiveProps,
	slots: Object as SlotsType<{ default?: () => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();
		const messages = useGridMessagesContext();
		let release: (() => void) | null = null;

		onMounted(() => {
			release = grid.markBusy();
		});
		onBeforeUnmount(() => release?.());

		// Only the bar reads the height of the footer: a footer that grows moves the bar alone.
		return () => renderPrimitive(props, {
			'aria-hidden': 'true',
			'data-dg-part': 'loading',
			style: { insetBlockEnd: `${grid.footHeight.value}px` },
		}, () => (
			slots.default ? slots.default() : messages.loading
		));
	},
});
