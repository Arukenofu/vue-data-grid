import { getCellText } from '@vue-data-grid/engine';
import { h, type VNodeChild } from 'vue';

import type { CellContext, CellEditor, EditorContext, FooterContext, HeaderContext } from '../columns/column-fields';
import { hasContent } from './primitive';
import type { GridTemplates } from './template-registry';

/** Text of a cell on one line, with an ellipsis in the structural styles. */
export function renderCellText(text: string | number) {
	return h('span', { 'data-dg-part': 'cell-text' }, text);
}

/**
 * The content of a body cell: `own` content, such as a slot's, else the column's `GridCellTemplate`,
 * else its `cell` field, else its text through `format` on one line; content that renders nothing, as
 * a `v-if` that fails, passes the cell on. The column's `cellFrame` goes around it. `templates` comes
 * from `useGridTemplatesContext(null)`. For a part of your own that renders body cells as `GridCells`.
 */
export function renderCellContent(context: CellContext<unknown, unknown>, templates: GridTemplates | null, own?: VNodeChild): VNodeChild {
	const content = hasContent(own) ? own : renderColumnCell(context, templates);
	const { cellFrame } = context.column;

	return cellFrame ? cellFrame(context, content) : content;
}

function renderColumnCell(context: CellContext<unknown, unknown>, templates: GridTemplates | null) {
	const content = templates?.get('cell', context.column.name)?.(context);

	if (hasContent(content)) {
		return content;
	}

	return context.column.cell?.(context) ?? renderCellText(getCellText(context.column, context.row));
}

/**
 * The content of a header cell: the column's `GridHeaderTemplate`, else its `header` field, else its
 * label on one line. For a part of your own that renders header cells as `GridHeaderCell`.
 */
export function renderHeaderContent(context: HeaderContext, templates: GridTemplates | null): VNodeChild {
	const content = templates?.get('header', context.column.name)?.(context);

	if (hasContent(content)) {
		return content;
	}

	return context.column.header?.(context) ?? renderCellText(context.column.label ?? context.column.name);
}

/**
 * The content of a footer cell: the column's `GridFooterTemplate`, else its `footer` field, text of it
 * on one line. For a part of your own that renders footer cells as `GridFooterCell`.
 */
export function renderFooterContent(context: FooterContext<unknown, unknown>, templates: GridTemplates | null): VNodeChild {
	const own = templates?.get('footer', context.column.name)?.(context);

	if (hasContent(own)) {
		return own;
	}

	const content = context.column.footer?.(context);

	// Text of the field is cut to one line as the text of body and header cells is; a node is the column's own.
	return typeof content === 'string' || typeof content === 'number' ? renderCellText(content) : content;
}

/**
 * The editor of a cell being edited: the column's `GridEditorTemplate`, else `editor`, the one
 * `getEditor` of the editing gives for the column. A template that renders nothing for the cell passes
 * it on to `editor`. For a part of your own that renders body cells as `GridCells`.
 */
export function renderCellEditor(context: EditorContext<unknown, unknown>, templates: GridTemplates | null, editor: CellEditor): VNodeChild {
	const content = templates?.get('editor', context.column.name)?.(context);

	return hasContent(content) ? content : editor(context);
}
