import { h } from 'vue';

import type { EditorContext } from '../columns/column-fields';

/** The error of the draft under the editor, which `inputProps` points `aria-describedby` at. */
export function renderError(context: Pick<EditorContext<unknown, unknown>, 'error' | 'errorId'>) {
	return context.error ? h('span', { id: context.errorId, 'data-tc-part': 'editor-error' }, context.error) : null;
}
