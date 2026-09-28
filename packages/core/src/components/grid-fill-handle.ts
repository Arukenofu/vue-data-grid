import { computed, defineComponent, type SlotsType, type VNodeChild } from 'vue';

import { useDataGridContext } from './context';
import { primitiveProps, renderPrimitive } from './primitive';
import { warnMissing } from './warn';

const HANDLE_PROPS = Object.freeze({ 'data-dg-part': 'fill-handle', 'aria-hidden': 'true' });

/**
 * The fill handle of the `fill` feature: a small square at the end corner of the last range that fills
 * the cells it is dragged over. Put it in the slot of `GridRangeOverlay` where `corner` is true. It is
 * hidden from screen readers: Ctrl+D and Ctrl+R fill from the keyboard. It renders nothing without the
 * feature, and nothing while a cell is being edited, whose editor it would cover.
 */
export const GridFillHandle = defineComponent({
	name: 'GridFillHandle',
	props: {
		...primitiveProps,
		as: { ...primitiveProps.as, default: 'span' },
	},
	slots: Object as SlotsType<{ default?: () => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();

		if (!grid.fill) {
			warnMissing('GridFillHandle', 'fill');
		}

		/** Whether a cell is being edited, apart from its draft: typing in the editor renders no handle. */
		const editing = computed(() => (grid.editing?.cell.value ?? null) !== null);

		function onPointerdown(event: PointerEvent) {
			grid.fill?.start(event);
		}

		return () => (grid.fill && !editing.value
			? renderPrimitive(props, {
				...HANDLE_PROPS,
				'data-dg-state': grid.fill.dragging.value ? 'dragging' : 'idle',
				onPointerdown,
			}, () => slots.default?.())
			: null);
	},
});
