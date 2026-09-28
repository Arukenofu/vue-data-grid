import { type MaybeRefOrGetter, onScopeDispose, toValue, watchEffect } from 'vue';

import type { GeometryLayer } from './geometry';

interface AppliedLayer {
	elements: HTMLElement[];
	style: Readonly<Record<string, string>>;
}

const ROOT = '\u0000root';

function setStyle(targets: readonly HTMLElement[], style: Readonly<Record<string, string>>) {
	for (const [name, value] of Object.entries(style)) {
		for (const target of targets) {
			target.style.setProperty(name, value);
		}
	}
}

/**
 * Writes geometry layers to the DOM after each render. Keep rarely changing values on the root: a
 * custom property written there restyles the whole subtree, whether or not anything reads it. Values
 * that change during a gesture belong in layers that target exactly the elements reading them.
 *
 * What is written stays written: the root gets its properties back when your markup replaces its
 * `style`, and elements mounted while a selector layer is active, such as rows scrolled into view
 * during a resize, get that layer too.
 */
export function useGridGeometry(
	host: MaybeRefOrGetter<HTMLElement | null>,
	layers: MaybeRefOrGetter<readonly GeometryLayer[]>,
) {
	let applied = new Map<string, AppliedLayer>();
	let observed: HTMLElement | null = null;
	let rootObserver: MutationObserver | null = null;
	let treeObserver: MutationObserver | null = null;
	let watchingTree = false;

	// Vue sets `cssText` when a string `style` of the root changes, which drops every property set here.
	function restoreRoot() {
		const layer = applied.get(ROOT);

		if (!observed || !layer) {
			return;
		}

		for (const [name, value] of Object.entries(layer.style)) {
			if (observed.style.getPropertyValue(name) !== value) {
				observed.style.setProperty(name, value);
			}
		}
	}

	function applyToAdded(records: readonly MutationRecord[]) {
		for (const record of records) {
			for (const node of record.addedNodes) {
				if (!(node instanceof HTMLElement)) {
					continue;
				}

				for (const [selector, layer] of applied) {
					if (selector === ROOT) {
						continue;
					}

					const targets = [...node.matches(selector) ? [node] : [], ...node.querySelectorAll<HTMLElement>(selector)];

					setStyle(targets, layer.style);
					layer.elements.push(...targets);
				}
			}
		}
	}

	function disconnect() {
		rootObserver?.disconnect();
		treeObserver?.disconnect();
		rootObserver = null;
		treeObserver = null;
		watchingTree = false;
	}

	function observe(element: HTMLElement | null) {
		if (element === observed) {
			return;
		}

		disconnect();
		observed = element;
		// A new root has none of the properties written to the old one.
		applied = new Map();

		if (!element || typeof MutationObserver === 'undefined') {
			return;
		}

		rootObserver = new MutationObserver(restoreRoot);
		rootObserver.observe(element, { attributes: true, attributeFilter: ['style'] });
		treeObserver = new MutationObserver(applyToAdded);
	}

	// The subtree is watched only while a selector layer exists: during a gesture, not on every scroll.
	function syncTreeObserver() {
		const needed = [...applied.keys()].some(key => key !== ROOT);

		if (!observed || !treeObserver || needed === watchingTree) {
			return;
		}

		if (needed) {
			treeObserver.observe(observed, { childList: true, subtree: true });
		} else {
			treeObserver.disconnect();
		}

		watchingTree = needed;
	}

	// After render: selector layers must find the elements this render produced.
	watchEffect(() => {
		const element = toValue(host);

		observe(element);

		if (!element) {
			return;
		}

		const merged = new Map<string, Record<string, string>>();

		for (const layer of toValue(layers)) {
			const key = layer.selector ?? ROOT;

			merged.set(key, { ...merged.get(key), ...layer.style });
		}

		const next = new Map<string, AppliedLayer>();

		for (const [key, style] of merged) {
			const previous = applied.get(key);
			const elements = key === ROOT ? [element] : [...element.querySelectorAll<HTMLElement>(key)];
			// Selector layers may match freshly rendered elements, so only the root is written as a diff.
			const byDiff = key === ROOT && previous !== undefined;

			for (const [name, value] of Object.entries(style)) {
				if (byDiff && previous.style[name] === value) {
					continue;
				}

				for (const target of elements) {
					target.style.setProperty(name, value);
				}
			}

			for (const name of Object.keys(previous?.style ?? {})) {
				if (!(name in style)) {
					for (const target of previous?.elements ?? []) {
						target.style.removeProperty(name);
					}
				}
			}

			next.set(key, { elements, style });
		}

		// A removed layer takes its properties with it, or a resize override would outlive the gesture.
		for (const [key, layer] of applied) {
			if (merged.has(key)) {
				continue;
			}

			for (const name of Object.keys(layer.style)) {
				for (const target of layer.elements) {
					target.style.removeProperty(name);
				}
			}
		}

		applied = next;
		syncTreeObserver();
	}, { flush: 'post' });

	onScopeDispose(disconnect);
}
