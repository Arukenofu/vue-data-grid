import type { TableSort } from '@vue-stack/table-core';
import { type MaybeRefOrGetter, shallowRef, toValue, watch } from 'vue';

import { DEFAULT_MESSAGES, type TableMessages } from '../components/messages';
import type { DataTable } from '../data-table/use-data-table';

// A live region says nothing when its text does not change; this makes a repeated message differ.
const REPEAT_MARK = ' ';

/**
 * What a table tells a screen reader on its own: the whole sort when it changes, since `aria-sort`
 * sits on the first sort column only and ARIA has no sort levels; the number of selected rows when it
 * changes; and that the table is loading. `message` is the text of a polite live region, which
 * `TableRoot` renders next to the table; `announce(text)` says anything else through it.
 */
export function useTableAnnouncer(
	table: Pick<DataTable, 'scope' | 'selection' | 'isBusy'>,
	messages: MaybeRefOrGetter<TableMessages> = DEFAULT_MESSAGES,
) {
	const message = shallowRef('');

	function announce(text: string) {
		message.value = text === message.value ? `${text}${REPEAT_MARK}` : text;
	}

	function getLabel(name: string) {
		const column = table.scope.orderedColumns.value.find(item => item.name === name);

		return column?.label ?? name;
	}

	watch(table.scope.sort, (sort: readonly TableSort[]) => {
		announce(toValue(messages).sorted(sort.map(item => ({ label: getLabel(item.name), direction: item.direction }))));
	});

	const { selection } = table;

	if (selection) {
		watch(selection.selectedCount, count => announce(toValue(messages).selected(count)));
	}

	watch(table.isBusy, (busy) => {
		if (busy) {
			announce(toValue(messages).loading);
		}
	});

	return { message, announce };
}
