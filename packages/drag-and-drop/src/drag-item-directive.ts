import type { ObjectDirective } from 'vue';

import type { DragList } from './use-drag-list';

export interface DragItemBinding {
	list: DragList;
	/** The item's key in the list; `null` takes the element out of dragging without removing the directive. */
	key: string | null;
}

type DragItemValue = DragItemBinding | null | undefined;

const cleanups = new WeakMap<HTMLElement, () => void>();

function release(element: HTMLElement) {
	cleanups.get(element)?.();
	cleanups.delete(element);
}

function apply(element: HTMLElement, value: DragItemValue) {
	release(element);

	if (value?.key !== null && value?.key !== undefined) {
		cleanups.set(element, value.list.register(element, value.key));
	}
}

function isSame(value: DragItemValue, other: DragItemValue) {
	return value?.list === other?.list && value?.key === other?.key;
}

/**
 * An item of a drag list: `v-drag-item="{ list, key }"`. A directive rather than a component, since
 * the rows of a grid are one template over thousands of rows, not components: the registration
 * lives with the element, goes away with it, and follows a change of key.
 */
export const vDragItem: ObjectDirective<HTMLElement, DragItemValue> = {
	mounted: (element, { value }) => apply(element, value),
	updated: (element, { value, oldValue }) => {
		if (!isSame(value, oldValue)) {
			apply(element, value);
		}
	},
	unmounted: release,
};
