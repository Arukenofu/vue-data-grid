import { defineComponent, h, type PropType, type Ref, type SlotsType, type VNodeChild } from 'vue';

import { useGridAnnouncer } from '../announcer/use-grid-announcer';
import type { DataGrid } from '../data-grid/use-data-grid';
import { createDataGridContext } from './context';
import { createGridMessagesContext, type GridMessages } from './messages';
import { forwardElement, primitiveProps, renderPrimitive } from './primitive';

// The live region reads the message itself: an announcement, such as one on every selection change,
// renders the region alone, not the grid and the slot inside it.
const LiveRegion = defineComponent({
	name: 'GridLiveRegion',
	props: { message: { type: Object as PropType<Readonly<Ref<string>>>, required: true } },
	setup: props => () => h('div', { role: 'status', 'aria-live': 'polite', 'data-dg-part': 'announcer' }, props.message.value),
});

/**
 * The grid element: the scroll container with the grid's role, counts and `ref`, over its header,
 * body and footer. It provides the grid and its messages to the parts inside. With the navigation it
 * is the grid that takes focus first, and it renders the exit that Tab leaves the grid through right
 * after itself. Next to it stands a polite live region of `useGridAnnouncer`: the sort, the number of
 * selected rows, loading.
 *
 * The default slot gets `{ grid }`. Attributes go to the grid element; `grid` and `messages` are
 * read once. The part has several root nodes, so the scoped styles of a parent reach the grid from
 * an element around it, with `:deep()`.
 */
export const GridRoot = defineComponent({
	name: 'GridRoot',
	inheritAttrs: false,
	props: {
		...primitiveProps,
		/** The grid object of `useDataGrid`. */
		grid: { type: Object as PropType<DataGrid>, required: true },
		/** The accessible name of the grid, when no heading names it through `aria-labelledby`. */
		label: { type: String, default: undefined },
		/** The strings of the interface, over the English defaults. */
		messages: { type: Object as PropType<Partial<GridMessages>>, default: undefined },
		/** Announce the sort, the selection and loading to screen readers; `true` by default. */
		announce: { type: Boolean, default: true },
	},
	slots: Object as SlotsType<{ default?: (context: { grid: DataGrid }) => VNodeChild }>,
	setup(props, { attrs, slots }) {
		const { grid } = props;
		const messages = createGridMessagesContext(props.messages);
		const announcer = props.announce ? useGridAnnouncer(grid, messages) : null;

		createDataGridContext(grid);

		const rootRef = forwardElement(grid.root);

		return () => {
			const navigation = grid.navigation !== undefined;

			return [
				renderPrimitive(props, {
					...attrs,
					...grid.getGridProps(),
					ref: rootRef,
					tabindex: navigation ? 0 : undefined,
					'aria-label': props.label ?? attrs['aria-label'],
				}, () => slots.default?.({ grid })),
				navigation ? h('span', { ref: grid.exit, tabindex: 0 }) : null,
				announcer ? h(LiveRegion, { message: announcer.message }) : null,
			];
		};
	},
});
