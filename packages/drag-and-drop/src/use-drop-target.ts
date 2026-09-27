import { type MaybeRefOrGetter, shallowReadonly, shallowRef, toValue, watch } from 'vue';

import { registerDropTarget } from './drag-manager';
import type { DragPayload } from './model';

export interface DropTargetOptions {
	/** Kinds of payload the area takes. */
	kinds: readonly string[];
	/** Take only payloads of this group; any of the right kind without it. */
	group?: MaybeRefOrGetter<string | null | undefined>;
	canDrop?: (payload: DragPayload) => boolean;
	onDrop?: (payload: DragPayload) => void;
}

/** An area that takes a dropped item without being a list: a bin, "add here". */
export function useDropTarget(target: MaybeRefOrGetter<HTMLElement | null>, options: DropTargetOptions) {
	const dragging = shallowRef<DragPayload | null>(null);
	const over = shallowRef(false);

	function accepts(payload: DragPayload) {
		if (!options.kinds.includes(payload.kind)) {
			return false;
		}

		const group = toValue(options.group) ?? null;

		return (group === null || payload.group === group) && (options.canDrop?.(payload) ?? true);
	}

	watch(() => toValue(target), (element, _previous, onCleanup) => {
		if (!element) {
			return;
		}

		onCleanup(registerDropTarget({
			element,
			accepts,
			onStart: (payload) => {
				dragging.value = payload;
			},
			onEnter: () => {
				over.value = true;
			},
			onLeave: () => {
				over.value = false;
			},
			// Taken, with no item to fly to: the ghost fades over the area.
			onDrop: (payload) => {
				options.onDrop?.(payload);

				return null;
			},
			onEnd: () => {
				dragging.value = null;
				over.value = false;
			},
		}));
	}, { immediate: true, flush: 'post' });

	return {
		/** The payload being dragged that the area would take; `null` when there is none. */
		dragging: shallowReadonly(dragging),
		/** The payload is over the area. */
		over: shallowReadonly(over),
	};
}
