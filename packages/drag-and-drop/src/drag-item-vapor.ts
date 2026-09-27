import { watch } from 'vue';

import type { DragItemBinding } from './drag-item-directive';

/**
 * A Vapor directive of Vue 3.6: called once with a getter of the value, it returns its cleanup.
 * Declared here rather than imported, so that the package still builds and runs against Vue 3.5.
 */
export type DragItemVaporDirective = (
	element: HTMLElement,
	value?: () => DragItemBinding | null | undefined,
) => () => void;

/**
 * `v-drag-item` for Vapor components of Vue 3.6, where directives are functions rather than objects
 * with hooks. Import it from `@vue-stack/drag-and-drop/vapor` under the same name, so templates keep
 * `v-drag-item="{ list, key }"`.
 */
export const vDragItemVapor: DragItemVaporDirective = (element, value) => {
	let release: (() => void) | null = null;

	const stop = watch([() => value?.()?.list, () => value?.()?.key], ([list, key]) => {
		release?.();
		release = list && key !== null && key !== undefined ? list.register(element, key) : null;
	}, { immediate: true, flush: 'sync' });

	return () => {
		stop();
		release?.();
		release = null;
	};
};
