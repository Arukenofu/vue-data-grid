import type { GridSort } from '@vue-data-grid/engine';
import { type MaybeRefOrGetter, shallowRef, toValue, watch } from 'vue';

import { DEFAULT_MESSAGES, type GridMessages } from '../components/messages';
import type { DataGrid } from '../data-grid/use-data-grid';

// A live region says nothing when its text does not change; this makes a repeated message differ.
const REPEAT_MARK = ' ';

/**
 * What a grid tells a screen reader on its own: the whole sort when it changes, since `aria-sort`
 * sits on the first sort column only and ARIA has no sort levels; the number of selected rows when it
 * changes; and that the grid is loading. `message` is the text of a polite live region, which
 * `GridRoot` renders next to the grid; `announce(text)` says anything else through it.
 */
export function useGridAnnouncer(
	grid: Pick<DataGrid, 'scope' | 'selection' | 'isBusy'>,
	messages: MaybeRefOrGetter<GridMessages> = DEFAULT_MESSAGES,
) {
	const message = shallowRef('');

	function announce(text: string) {
		message.value = text === message.value ? `${text}${REPEAT_MARK}` : text;
	}

	function getLabel(name: string) {
		const column = grid.scope.orderedColumns.value.find(item => item.name === name);

		return column?.label ?? name;
	}

	watch(grid.scope.sort, (sort: readonly GridSort[]) => {
		announce(toValue(messages).sorted(sort.map(item => ({ label: getLabel(item.name), direction: item.direction }))));
	});

	const { selection } = grid;

	if (selection) {
		watch(selection.selectedCount, count => announce(toValue(messages).selected(count)));
	}

	watch(grid.isBusy, (busy) => {
		if (busy) {
			announce(toValue(messages).loading);
		}
	});

	return { message, announce };
}
