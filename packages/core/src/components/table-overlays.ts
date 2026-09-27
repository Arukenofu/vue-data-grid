import { computed, defineComponent, h, onBeforeUnmount, onMounted, type SlotsType, type VNodeChild, watch } from 'vue';

import { useDataTableContext } from './context';
import { useTableMessagesContext } from './messages';
import { primitiveProps, renderPrimitive } from './primitive';

/**
 * What the table shows while it has no rows: a row with one cell over every column, so the grid stays
 * valid ARIA, counted into `aria-rowcount` while it is there. It sticks to the start edge, as wide as
 * the table. Put it after `TableBody`; it renders nothing while there are rows.
 *
 * The default slot holds the content; without it, the `empty` message.
 */
export const TableEmpty = defineComponent({
	name: 'TableEmpty',
	props: primitiveProps,
	slots: Object as SlotsType<{ default?: () => VNodeChild }>,
	setup(props, { slots }) {
		const table = useDataTableContext();
		const messages = useTableMessagesContext();
		const empty = computed(() => table.rows.value.length === 0);
		let release: (() => void) | null = null;

		function count(shown: boolean) {
			release?.();
			release = shown ? table.addBodyRows(1) : null;
		}

		// Counted once mounted: a change while the table element renders would not render it again.
		onMounted(() => {
			count(empty.value);
			watch(empty, count);
		});
		onBeforeUnmount(() => release?.());

		return () => {
			if (!empty.value) {
				return null;
			}

			const role = table.getGridProps().role === 'table' ? 'cell' : 'gridcell';

			return renderPrimitive(props, {
				role: 'row',
				'aria-rowindex': table.headerRows.value + 1,
				'data-dg-part': 'empty',
			}, () => h('div', {
				role,
				'aria-colindex': 1,
				'aria-colspan': Math.max(table.scope.columns.value.length, 1),
				'data-dg-part': 'empty-cell',
			}, [slots.default ? slots.default() : messages.empty]));
		};
	},
});

/**
 * What the table shows while it loads: a bar stuck to the bottom of the table over the rows, right
 * above a footer. While it is mounted the table is `aria-busy` and the announcer says it is loading;
 * the bar itself is hidden from screen readers. Render it with `v-if` while loading, after `TableBody`
 * and before `TableFooter`.
 *
 * The default slot holds the content; without it, the `loading` message.
 */
export const TableLoading = defineComponent({
	name: 'TableLoading',
	props: primitiveProps,
	slots: Object as SlotsType<{ default?: () => VNodeChild }>,
	setup(props, { slots }) {
		const table = useDataTableContext();
		const messages = useTableMessagesContext();
		let release: (() => void) | null = null;

		onMounted(() => {
			release = table.markBusy();
		});
		onBeforeUnmount(() => release?.());

		// Only the bar reads the height of the footer: a footer that grows moves the bar alone.
		return () => renderPrimitive(props, {
			'aria-hidden': 'true',
			'data-dg-part': 'loading',
			style: { insetBlockEnd: `${table.footHeight.value}px` },
		}, () => (
			slots.default ? slots.default() : messages.loading
		));
	},
});
