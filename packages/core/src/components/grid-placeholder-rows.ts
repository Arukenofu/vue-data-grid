import type { RenderedColumn, RuntimeColumn } from '@vue-data-grid/engine';
import {
	computed,
	defineComponent,
	type ExtractPublicPropTypes,
	h,
	onBeforeUnmount,
	onMounted,
	type PropType,
	shallowRef,
	type SlotsType,
	type VNodeChild,
} from 'vue';

import type { GridRowEdge } from '../loading/use-grid-edge';
import { useStickyOffset } from '../render/use-sticky-offset';
import { useDataGridContext } from './context';
import { forwardElement, primitiveProps, renderPrimitive } from './primitive';

/** What the slot of `GridPlaceholderRows` gets for each cell. */
export interface PlaceholderCellSlotContext {
	/** The column of the cell. */
	column: RuntimeColumn;
	/** The place of the row among the placeholder rows, from `0`. */
	index: number;
}

const placeholderRowsProps = {
	...primitiveProps,
	/** How many rows to show. */
	count: { type: Number, required: true as const },
	/**
	 * The edge of the body the rows stand at: `'bottom'`, the default, after `GridBody`, or `'top'`,
	 * before it.
	 */
	edge: { type: String as PropType<GridRowEdge>, default: 'bottom' },
	/**
	 * The height of a row, px. By default the height of the row at that edge, or without rows the one
	 * height of every row (`rowHeight` as a number); else it is left to CSS.
	 */
	rowHeight: { type: Number, default: undefined },
};

/** The props of `GridPlaceholderRows`. */
export type GridPlaceholderRowsProps = ExtractPublicPropTypes<typeof placeholderRowsProps>;

/** Whether `element` stands before `body` in the document. */
function isBefore(element: HTMLElement, body: HTMLElement) {
	return (element.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/**
 * Rows that stand for rows on their way, such as skeletons while the next page loads: `count` rows at
 * an edge of the body, their cells laid out, sized and pinned as the columns are. They are not rows of
 * the grid: no key, focus or selection, hidden from screen readers and left out of `aria-rowcount`;
 * while they are mounted the grid is `aria-busy`. Render them with `v-if` while loading, after
 * `GridBody` for the bottom edge, or before it with `edge="top"`.
 *
 * At the top they move the body down, and keep the rows in view in place as rows loaded there do: they
 * show once people scroll up to them. At the very top they show at once, unless something holds the
 * rows in place there, as `useGridEdge` at the top does.
 *
 * The default slot renders the content of each cell from `{ column, index }`; without it the cells
 * are empty, for the theme to draw on.
 */
export const GridPlaceholderRows = defineComponent({
	name: 'GridPlaceholderRows',
	props: placeholderRowsProps,
	slots: Object as SlotsType<{ default?: (context: PlaceholderCellSlotContext) => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();
		const element = shallowRef<HTMLElement | null>(null);
		const elementRef = forwardElement(element);
		// Observed rather than read after a render: CSS, fonts and the slot change it without one.
		const height = useStickyOffset(element);
		let releaseBusy: (() => void) | null = null;
		let releaseOffset: (() => void) | null = null;

		// The edge says which way the body moves; standing on the other side of it, the rows land off by
		// the height of these ones, and nothing else would tell.
		function warnMisplaced() {
			const body = grid.body.value;

			if (!body || !element.value || isBefore(element.value, body) === (props.edge === 'top')) {
				return;
			}

			const place = props.edge === 'top' ? 'before' : 'after';

			// oxlint-disable-next-line no-console
			console.warn(
				`[@vue-data-grid/core] <GridPlaceholderRows edge="${props.edge}"> belongs ${place} <GridBody>: `
				+ 'move it there, or set `edge` to the side of the body it stands at.',
			);
		}

		onMounted(() => {
			releaseBusy = grid.markBusy();
			releaseOffset = grid.addBodyOffset(() => (props.edge === 'top' ? height.value : 0));

			if (__DEV__) {
				warnMisplaced();
			}
		});
		onBeforeUnmount(() => {
			releaseBusy?.();
			releaseOffset?.();
		});

		// A number, so the rows render again when it changes, not on every measurement of the body.
		const rowHeight = computed(() => {
			if (props.rowHeight !== undefined) {
				return props.rowHeight;
			}

			const count = grid.rows.value.length;

			if (count === 0) {
				return grid.uniformHeight.value ?? undefined;
			}

			const index = props.edge === 'top' ? 0 : count - 1;

			return grid.scope.getRowOffset(index + 1) - grid.scope.getRowOffset(index);
		});

		function renderCell(rendered: RenderedColumn, index: number) {
			const { column } = rendered;

			// A spacer of the column window stands for columns out of view: nothing to draw a skeleton in.
			if (!column) {
				return h('div', { key: rendered.key, ...rendered.cellProps });
			}

			const content = slots.default ? [slots.default({ column, index })] : undefined;

			return h('div', { key: rendered.key, ...rendered.cellProps, 'data-dg-part': 'placeholder-cell' }, content);
		}

		return () => {
			const style = rowHeight.value === undefined ? undefined : `height:${rowHeight.value}px`;
			const columns = grid.scope.renderedColumns.value;
			const rows = Array.from({ length: Math.max(props.count, 0) }, (_, index) => h('div', {
				// Placeholder rows stand for no row: their place is all they are.
				key: index,
				'data-dg-part': 'placeholder-row',
				style,
			}, columns.map(rendered => renderCell(rendered, index))));

			return renderPrimitive(props, {
				ref: elementRef,
				'aria-hidden': 'true',
				'data-dg-part': 'placeholder-rows',
				'data-dg-edge': props.edge,
			}, () => rows);
		};
	},
});
