import { getCurrentInstance, h, type MaybeRefOrGetter, render, type VNodeChild } from 'vue';

/**
 * Where the ghost stands relative to the pointer: `'outside'` below and to the right of it, leaving
 * the target visible; `'center'` centred under it; `'source'` where the item itself was under the
 * pointer at the moment of the grab, as if the item itself were dragged.
 */
export type DragPreviewPlacement = 'outside' | 'center' | 'source';

/**
 * How the ghost goes at the end of a gesture: `'fade'` where it is; `'land'` flies into the item at
 * its new place, or back to it when dropped nowhere, for a ghost that looks like the item; `'none'`
 * goes at once.
 */
export type DragGhostExit = 'fade' | 'land' | 'none';

export interface DragPreview {
	/** Fills the ghost for item `key`; may return a cleanup, called at the end of the gesture. */
	render: (key: string, container: HTMLElement) => (() => void) | void;
	/** `'outside'` by default. */
	placement?: MaybeRefOrGetter<DragPreviewPlacement>;
	/** `'fade'` by default. */
	exit?: MaybeRefOrGetter<DragGhostExit>;
}

/**
 * Renders Vue content into the ghost. The ghost lives outside the component tree, so the content is
 * mounted as its own root with the app context: global components and app-level `provide` work in
 * it, the component's own `provide` does not. `getContent` runs in render, so whatever reactive it
 * reads updates the ghost during the gesture.
 *
 * The content is taken as `unknown`, since that is how slots are typed: a template slot returns
 * `VNode[]`, which `defineSlots` cannot express.
 *
 * For components with a virtual DOM only. A Vapor component of Vue 3.6 has no current instance here
 * and its slots return DOM blocks rather than vnodes: fill the ghost in `DragPreview.render` with your
 * own DOM, or mount a Vapor app into the container there.
 */
export function useDragPreviewRenderer() {
	const appContext = getCurrentInstance()?.appContext ?? null;

	return function renderPreview(container: HTMLElement, getContent: () => unknown) {
		const root = h({ render: () => getContent() as VNodeChild });

		root.appContext = appContext;
		render(root, container);

		return () => render(null, container);
	};
}
