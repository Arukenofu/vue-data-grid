import { defineComponent, type PropType, type SlotsType, type VNodeChild } from 'vue';

import type { AutosizeOptions } from '../columns/autosize-columns';
import { useColumnResize } from '../columns/use-column-resize';
import { useDataGridContext, useHeaderCellContext } from './context';
import { primitiveProps, renderPrimitive } from './primitive';

/**
 * The resize handle of the header cell it is in: drag it, or focus it and press ← and → (Home and End
 * for the limits); a double click fits the column to its content. It is a `role="separator"` with the
 * width in `aria-valuenow`, so the screen reader hears it, and `data-dg-state` of `resizing` or
 * `idle`. Nothing renders for a column that is not `resizable`.
 *
 * The default slot gets `{ width, resizing }`; without it the handle is empty, and the structural
 * styles give it its grab area.
 */
export const GridResizeHandle = defineComponent({
	name: 'GridResizeHandle',
	props: {
		...primitiveProps,
		/** How far an arrow key changes the width, px; `16` by default. */
		step: { type: Number, default: undefined },
		/** How a double click fits the column; `false` turns it off. */
		autosize: { type: [Object, Boolean] as PropType<AutosizeOptions | false>, default: undefined },
	},
	slots: Object as SlotsType<{ default?: (context: { width: number; resizing: boolean }) => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();
		const column = useHeaderCellContext();
		// The handle's name and width text come from the grid's messages, as the composable reads them.
		const resize = useColumnResize(grid.scope, { step: () => props.step, autosize: () => props.autosize });

		return () => {
			const name = column().column?.name;

			if (!name || !column().column?.resizable) {
				return null;
			}

			// The slot's width is live, read only with a slot: without one the handle does not render per frame.
			return renderPrimitive(props, { ...resize.getHandleProps(name) }, slots.default
				? () => slots.default?.({ width: grid.scope.getWidth(name), resizing: resize.resizing.value === name })
				: undefined);
		};
	},
});
