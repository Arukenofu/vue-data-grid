/// <reference types="vite/client" />
import '../../src/style.css';

import {
	type AnyColumnInput,
	defineColumns,
	getCellText,
	createGridScopeContext,
	type RenderedColumn,
	type GridScope,
	useCellRanges,
	useGridEngine,
	useGridGeometry,
} from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, type MaybeRefOrGetter, shallowRef } from 'vue';

import { useCellNavigation } from '../../src/navigation/use-cell-navigation';
import { useRangeSelection } from '../../src/ranges/use-range-selection';
import { type GridProps, useGridProps } from '../../src/props/use-grid-props';
import { useStickyOffset } from '../../src/render/use-sticky-offset';

export interface BrowserRow {
	id: string;
	name: string;
	value: number;
}

export const ROW_HEIGHT = 30;

export function createRows(count: number): BrowserRow[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `r${index}`,
		name: index % 7 === 0 ? `A considerably longer name ${index}` : `Row ${index}`,
		value: index * 1.5,
	}));
}

const DEFAULT_COLUMNS: Record<string, AnyColumnInput> = {
	name: { value: (row: BrowserRow) => row.name, label: 'Name', width: 60, minWidth: 20, resizable: true },
	value: { value: (row: BrowserRow) => row.value, label: 'Value', width: 90, align: 'right' },
	code: { value: (row: BrowserRow) => row.id, label: 'Code', width: 90 },
};

export interface BrowserGridOptions {
	rows?: MaybeRefOrGetter<BrowserRow[]>;
	columns?: Record<string, AnyColumnInput>;
	/** Viewport of the grid, px. */
	width?: number;
	height?: number;
	navigation?: boolean;
	footer?: boolean;
	/** Cell ranges, drawn over the body from their rectangles, with the gestures of `useRangeSelection`. */
	ranges?: boolean;
}

export interface BrowserGrid {
	scope: GridScope<BrowserRow>;
	gridProps: GridProps;
	/** With `ranges`. */
	ranges: ReturnType<typeof useCellRanges> | null;
	root: HTMLElement;
	head: HTMLElement;
	foot: HTMLElement | null;
	/** The element of a rendered body row. */
	row: (index: number) => HTMLElement | null;
	/** The element of a rendered body cell. */
	cell: (index: number, column: string) => HTMLElement | null;
	unmount: () => void;
}

/**
 * A complete grid as an app renders it: the engine, `useGridProps`, the structural styles, a sticky
 * header and footer measured for the scroll margins, and positioned rows under the row window.
 */
export function mountBrowserGrid(options: BrowserGridOptions = {}): BrowserGrid {
	let scope: GridScope<BrowserRow> | null = null;
	let gridProps: GridProps | null = null;
	let ranges: ReturnType<typeof useCellRanges> | null = null;
	const root = shallowRef<HTMLElement | null>(null);
	const head = shallowRef<HTMLElement | null>(null);
	const body = shallowRef<HTMLElement | null>(null);
	const foot = shallowRef<HTMLElement | null>(null);
	const exit = shallowRef<HTMLElement | null>(null);
	const rows = options.rows ?? createRows(200);
	const columns = defineColumns(options.columns ?? DEFAULT_COLUMNS);

	const wrapper = mount(defineComponent({
		setup() {
			const headHeight = useStickyOffset(head);
			const engine = useGridEngine<BrowserRow>({
				columns,
				rows,
				root,
				rowKey: 'id',
				rowHeight: ROW_HEIGHT,
				virtual: true,
				scrollMargin: headHeight,
				scrollMarginEnd: useStickyOffset(foot),
			});
			const props = useGridProps(engine.scope, {
				navigation: options.navigation,
				footerRows: options.footer ? 1 : 0,
			});

			createGridScopeContext(engine.scope);
			useGridGeometry(root, engine.layers);
			scope = engine.scope;
			gridProps = props;
			ranges = options.ranges ? useCellRanges(engine.scope) : null;

			const navigation = options.navigation
				? useCellNavigation(engine.scope, {
					grid: root,
					exit,
					sections: props.sections,
					stickyStart: head,
					stickyEnd: foot,
				})
				: undefined;

			if (ranges) {
				useRangeSelection({ scope: engine.scope, root, body, headHeight }, { ranges, focus: navigation?.cells });
			}

			function cells(text: (column: NonNullable<RenderedColumn['column']>) => string) {
				return engine.scope.renderedColumns.value.map(rendered => h(
					'div',
					{ ...props.getCellProps(rendered), key: rendered.key },
					rendered.column ? [h('span', text(rendered.column))] : [],
				));
			}

			const headerRow = () => h('div', { ...props.getHeaderRowProps(), style: { height: '36px' } }, (
				engine.scope.renderedColumns.value.map(rendered => h(
					'div',
					{ ...props.getHeaderCellProps(rendered), key: rendered.key },
					rendered.column ? [
						h('span', rendered.column.label),
						rendered.column.resizable ? h('span', { 'data-dg-part': 'resize-handle' }) : null,
					] : [],
				))
			));

			const bodyRows = () => engine.items.value.map(item => h('div', {
				...props.getRowProps(item),
				key: item.key,
				style: { top: `${item.start - headHeight.value}px`, height: `${item.size}px` },
			}, cells(column => getCellText(column, engine.scope.rows.value[item.index]))));

			const rangeRows = () => (ranges?.rects.value ?? []).map(rect => h(
				'div',
				{ ...props.getRangeProps(rect), key: `range-${rect.bounds.rowStart}:${rect.bounds.rowEnd}:${rect.bounds.columnStart}:${rect.bounds.columnEnd}` },
				rect.cells.map(cell => h('div', props.getRangeCellProps(cell))),
			));

			const footerRow = () => h('div', { ...props.getFooterRowProps(), style: { height: '32px' } }, (
				cells(column => `Total ${column.label ?? ''}`)
			));

			return () => h('div', null, [
				h('div', {
					...props.getGridProps(),
					ref: root,
					tabindex: 0,
					style: { width: `${options.width ?? 400}px`, height: `${options.height ?? 300}px`, font: '14px sans-serif' },
				}, [
					h('div', { ...props.getHeadProps(), ref: head }, [headerRow()]),
					h('div', { ...props.getBodyProps(), ref: body, style: { height: `${engine.totalSize.value}px` } }, [...bodyRows(), ...rangeRows()]),
					options.footer ? h('div', { ...props.getFootProps(), ref: foot }, [footerRow()]) : null,
				]),
				h('span', { ref: exit, tabindex: 0 }),
			]);
		},
	}), { attachTo: document.body });

	const element = root.value as unknown as HTMLElement;

	function row(index: number) {
		return element.querySelector<HTMLElement>(`[data-dg-part="body"] > [data-dg-index="${index}"]`);
	}

	return {
		scope: scope as unknown as GridScope<BrowserRow>,
		gridProps: gridProps as unknown as GridProps,
		ranges,
		root: element,
		head: head.value as unknown as HTMLElement,
		foot: foot.value,
		row,
		cell: (index, column) => row(index)?.querySelector<HTMLElement>(`[data-dg-column="${column}"]`) ?? null,
		unmount: () => wrapper.unmount(),
	};
}
