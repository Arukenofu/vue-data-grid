import type { CellEditor } from 'vue-data-grid';
import { h } from 'vue';

import DateEditor from './DateEditor.vue';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function rekaDateEditor<TRow>(): CellEditor<TRow, string | null> {
	const editor: CellEditor<TRow, string | null> = context => h(DateEditor, { context });

	editor.typing = 'value';

	return editor;
}

export function parseDay(text: string) {
	const day = text.trim();

	return DAY.test(day) ? day : null;
}
