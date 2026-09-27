import { defineComponent, h, type PropType, type Ref, type SlotsType, type VNodeChild } from 'vue';

import { useTableAnnouncer } from '../announcer/use-table-announcer';
import type { DataTable } from '../data-table/use-data-table';
import { createDataTableContext } from './context';
import { createTableMessagesContext, type TableMessages } from './messages';
import { forwardElement, primitiveProps, renderPrimitive } from './primitive';

// The live region reads the message itself: an announcement, such as one on every selection change,
// renders the region alone, not the table and the slot inside it.
const LiveRegion = defineComponent({
	name: 'TableLiveRegion',
	props: { message: { type: Object as PropType<Readonly<Ref<string>>>, required: true } },
	setup: props => () => h('div', { role: 'status', 'aria-live': 'polite', 'data-dg-part': 'announcer' }, props.message.value),
});

/**
 * The table element: the scroll container with the table's role, counts and `ref`, over its header,
 * body and footer. It provides the table and its messages to the parts inside. With the navigation it
 * is the grid that takes focus first, and it renders the exit that Tab leaves the grid through right
 * after itself. Next to it stands a polite live region of `useTableAnnouncer`: the sort, the number of
 * selected rows, loading.
 *
 * The default slot gets `{ table }`. Attributes go to the table element; `table` and `messages` are
 * read once. The part has several root nodes, so the scoped styles of a parent reach the table from
 * an element around it, with `:deep()`.
 */
export const TableRoot = defineComponent({
	name: 'TableRoot',
	inheritAttrs: false,
	props: {
		...primitiveProps,
		/** The table object of `useDataTable`. */
		table: { type: Object as PropType<DataTable>, required: true },
		/** The accessible name of the table, when no heading names it through `aria-labelledby`. */
		label: { type: String, default: undefined },
		/** The strings of the interface, over the English defaults. */
		messages: { type: Object as PropType<Partial<TableMessages>>, default: undefined },
		/** Announce the sort, the selection and loading to screen readers; `true` by default. */
		announce: { type: Boolean, default: true },
	},
	slots: Object as SlotsType<{ default?: (context: { table: DataTable }) => VNodeChild }>,
	setup(props, { attrs, slots }) {
		const { table } = props;
		const messages = createTableMessagesContext(props.messages);
		const announcer = props.announce ? useTableAnnouncer(table, messages) : null;

		createDataTableContext(table);

		const rootRef = forwardElement(table.root);

		return () => {
			const navigation = table.navigation !== undefined;

			return [
				renderPrimitive(props, {
					...attrs,
					...table.getGridProps(),
					ref: rootRef,
					tabindex: navigation ? 0 : undefined,
					'aria-label': props.label ?? attrs['aria-label'],
				}, () => slots.default?.({ table })),
				navigation ? h('span', { ref: table.exit, tabindex: 0 }) : null,
				announcer ? h(LiveRegion, { message: announcer.message }) : null,
			];
		};
	},
});
