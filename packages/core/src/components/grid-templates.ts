import type { AggregateResult } from '@vue-data-grid/engine';
import {
	defineComponent,
	onActivated,
	onBeforeUpdate,
	onDeactivated,
	onMounted,
	onScopeDispose,
	type PropType,
	type PublicProps,
	type SlotsType,
	type VNode,
	type VNodeChild,
	watch,
} from 'vue';

import type { CellContext, EditorContext, FooterContext } from '../columns/column-fields';
import { useDataGridContext, useGridTemplatesContext } from './context';
import type { GridTemplate, GridTemplateKind, GridTemplateRegistration, GridTemplates } from './template-registry';

/**
 * The column a template part stands for: a column of `defineColumns`, such as `columns.status`, which
 * types the slot by its rows, values and `aggregate`.
 */
export interface GridTemplateColumn<TRow = unknown, TValue = unknown, TAggregate = unknown> {
	name: string;
	// A method, not a property: its parameter stays bivariant, so a column of any rows fits where the
	// part is not inferred, as in `h(GridCellTemplate, { column })`.
	value(row: TRow): TValue;
	aggregate?: TAggregate;
}

function useTemplates(part: string): GridTemplates {
	const templates = useGridTemplatesContext(null);

	if (!templates) {
		throw new Error(`<${part}> must be inside <GridRoot>, or a root of your own that calls createGridTemplatesContext()`);
	}

	return templates;
}

function warnWithoutEditor(column: string) {
	// oxlint-disable-next-line no-console
	console.warn(
		`[@vue-data-grid/core] <GridEditorTemplate> of column "${column}" never renders: the column has \`editor: false\`, `
		+ 'and its cell edits itself.',
	);
}

/** In development, warns once the grid has mounted when the column of an editor template opens no editor. */
function useEditorCheck(column: () => string) {
	const grid = useDataGridContext(null);

	onMounted(() => {
		if (grid?.scope.getColumn(column())?.column?.editor === false) {
			warnWithoutEditor(column());
		}
	});
}

function defineTemplatePart<TKind extends GridTemplateKind>(name: string, kind: TKind) {
	return defineComponent({
		name,
		props: {
			/** The column, from `defineColumns`. */
			column: { type: Object as PropType<GridTemplateColumn>, required: true },
		},
		slots: Object as SlotsType<{ default?: GridTemplate<TKind> }>,
		setup(props, { slots }) {
			const templates = useTemplates(name);
			let registration: GridTemplateRegistration<TKind> | null = null;

			// A new function for each render of the part: Vue renders it again when its slot may read
			// something new, such as an item of a `v-for` around it, and the cells of its column follow.
			// A slot that reads nothing of the render around it does not render the part, nor the cells.
			function readSlot(): GridTemplate<TKind> {
				return context => slots.default?.(context);
			}

			function register() {
				registration = templates.register(kind, props.column.name, readSlot());
			}

			function unregister() {
				registration?.unregister();
				registration = null;
			}

			// In setup, not in a hook: a server render runs setup and renders the cells after it, and a
			// template set up before the header and the body is there when they render.
			register();

			watch(() => props.column.name, () => {
				unregister();
				register();
			});
			onBeforeUpdate(() => registration?.update(readSlot()));
			// A template kept by `KeepAlive` fills its column only while it is shown.
			onDeactivated(unregister);
			onActivated(() => {
				if (!registration) {
					register();
				}
			});
			onScopeDispose(unregister);

			if (__DEV__ && kind === 'editor') {
				useEditorCheck(() => props.column.name);
			}

			return () => null;
		},
	});
}

/** What vue-tsc reads of a generic part, as it does of a `<script setup generic>` component: its props and slot. */
interface TemplatePartContext<TContext> {
	attrs: Record<string, unknown>;
	slots: { default?: (context: TContext) => VNodeChild };
	/** The part emits nothing. */
	emit: (event: never) => void;
}

type TemplatePartResult<TColumn, TContext> = VNode & {
	__ctx?: TemplatePartContext<TContext> & {
		props: PublicProps & { column: TColumn };
		expose: (exposed: Record<string, never>) => void;
	};
};

// The types of the generic parts are function types, which keep their generics where a component
// type does not; vue-tsc types the slot by the column given. The shape of `__ctx` is how vue-tsc
// writes a `<script setup generic>` component, and lives in the two types above only.

/** The type of `GridCellTemplate`, generic in the rows and the values of its column. */
export type GridCellTemplateComponent = <TRow, TValue>(
	props: PublicProps & { column: GridTemplateColumn<TRow, TValue> },
	context?: TemplatePartContext<CellContext<TRow, TValue>>,
) => TemplatePartResult<GridTemplateColumn<TRow, TValue>, CellContext<TRow, TValue>>;

/** The type of `GridFooterTemplate`, generic in the rows, the values and the `aggregate` of its column. */
export type GridFooterTemplateComponent = <TRow, TValue, TAggregate = undefined>(
	props: PublicProps & { column: GridTemplateColumn<TRow, TValue, TAggregate> },
	context?: TemplatePartContext<FooterContext<TRow, AggregateResult<TValue, TAggregate>>>,
) => TemplatePartResult<GridTemplateColumn<TRow, TValue, TAggregate>, FooterContext<TRow, AggregateResult<TValue, TAggregate>>>;

/** The type of `GridEditorTemplate`, generic in the rows and the values of its column. */
export type GridEditorTemplateComponent = <TRow, TValue>(
	props: PublicProps & { column: GridTemplateColumn<TRow, TValue> },
	context?: TemplatePartContext<EditorContext<TRow, TValue>>,
) => TemplatePartResult<GridTemplateColumn<TRow, TValue>, EditorContext<TRow, TValue>>;

/**
 * The content of the body cells of `column`, in a template: the default slot renders each cell from
 * its cell context `{ row, value, key, index, column, node, write }`, typed by the column. A cell the
 * slot renders nothing for shows the column's `cell` field, else its text. The part renders nothing
 * where it stands; put it first in the slot of `GridRoot`, before the header and the body, so the
 * cells have it when they first render, on the server too. A slot of `GridCells` comes before it.
 */
// The runtime part is not generic; the type is, for vue-tsc to type the slot by the column.
export const GridCellTemplate = defineTemplatePart('GridCellTemplate', 'cell') as unknown as GridCellTemplateComponent;

/**
 * The content of the header cell of `column`, in a template: the default slot gets
 * `{ column, direction, sortIndex }`; without content the cell shows the column's `header` field,
 * else its label. It renders nothing where it stands; put it first in the slot of `GridRoot`, before
 * the header. The slot of `GridHeaderCell` comes before it.
 */
// Not generic: what a header cell renders from does not depend on the rows or the values.
export const GridHeaderTemplate = defineTemplatePart('GridHeaderTemplate', 'header');

/**
 * The content of the footer cell of `column`, in a template: the default slot gets
 * `{ column, rows, aggregate }`, with `aggregate` typed by the column's `aggregate`; without content
 * the cell shows the column's `footer` field. It renders nothing where it stands; put it first in the
 * slot of `GridRoot`, before the footer. The slot of `GridFooterCell` comes before it.
 */
// The runtime part is not generic; the type is, for vue-tsc to type the slot by the column.
export const GridFooterTemplate = defineTemplatePart('GridFooterTemplate', 'footer') as unknown as GridFooterTemplateComponent;

/**
 * The editor of the cells of `column`, in a template, with the `editing` feature: the default slot
 * renders it from the `EditorContext`, typed by the column; bind `inputProps` to the element that
 * takes input. It takes the place of the column's `editor` in the cell; a cell the slot renders
 * nothing for gets the column's `editor`. What a typed character does is the column's `typing`, and a
 * column with `editor: false` opens no editor. It renders nothing where it stands; put it first in
 * the slot of `GridRoot`.
 */
// The runtime part is not generic; the type is, for vue-tsc to type the slot by the column.
export const GridEditorTemplate = defineTemplatePart('GridEditorTemplate', 'editor') as unknown as GridEditorTemplateComponent;
