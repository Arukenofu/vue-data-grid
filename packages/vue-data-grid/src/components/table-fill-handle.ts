import { computed, defineComponent, type SlotsType, type VNodeChild } from 'vue';

import { useDataTableContext } from './context';
import { primitiveProps, renderPrimitive } from './primitive';
import { warnMissing } from './warn';

const HANDLE_PROPS = Object.freeze({ 'data-tc-part': 'fill-handle', 'aria-hidden': 'true' });

/**
 * The fill handle of the `fill` feature: a small square at the end corner of the last range that fills
 * the cells it is dragged over. Put it in the slot of `TableRangeOverlay` where `corner` is true. It is
 * hidden from screen readers: Ctrl+D and Ctrl+R fill from the keyboard. It renders nothing without the
 * feature, and nothing while a cell is being edited, whose editor it would cover.
 */
export const TableFillHandle = defineComponent({
	name: 'TableFillHandle',
	props: {
		...primitiveProps,
		as: { ...primitiveProps.as, default: 'span' },
	},
	slots: Object as SlotsType<{ default?: () => VNodeChild }>,
	setup(props, { slots }) {
		const table = useDataTableContext();

		if (!table.fill) {
			warnMissing('TableFillHandle', 'fill');
		}

		/** Whether a cell is being edited, apart from its draft: typing in the editor renders no handle. */
		const editing = computed(() => (table.editing?.cell.value ?? null) !== null);

		function onPointerdown(event: PointerEvent) {
			table.fill?.start(event);
		}

		return () => (table.fill && !editing.value
			? renderPrimitive(props, {
				...HANDLE_PROPS,
				'data-tc-state': table.fill.dragging.value ? 'dragging' : 'idle',
				onPointerdown,
			}, () => slots.default?.())
			: null);
	},
});
