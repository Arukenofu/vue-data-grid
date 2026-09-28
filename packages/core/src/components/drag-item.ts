import { onBeforeUnmount } from 'vue';

import type { GridDragItems } from './context';

/**
 * Keeps the element of a part registered with a drag list under its key while both hold: the
 * function it returns takes the element, as a ref does.
 */
export function useDragItem(items: GridDragItems | null, getKey: () => string) {
	let current: { element: HTMLElement; key: string; release: () => void } | null = null;

	function bind(element: HTMLElement | null) {
		const key = getKey();

		if (current?.element === element && current.key === key) {
			return;
		}

		current?.release();
		current = items && element ? { element, key, release: items.register(element, key) } : null;
	}

	onBeforeUnmount(() => bind(null));

	return bind;
}
