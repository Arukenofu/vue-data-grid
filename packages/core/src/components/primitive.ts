import {
	cloneVNode,
	Comment,
	type Component,
	type ComponentPublicInstance,
	Fragment,
	h,
	type PropType,
	type ShallowRef,
	type VNode,
	type VNodeArrayChildren,
	type VNodeChild,
} from 'vue';

/** The props every part of the table takes: which element it renders, or none of its own. */
export const primitiveProps = {
	/** The element or component the part renders; `div` unless the part says otherwise. */
	as: { type: [String, Object, Function] as PropType<string | Component>, default: 'div' },
	/**
	 * Render the one child of the default slot instead of an element of its own, with the part's props
	 * merged into it. Props the child sets itself win; classes, styles and handlers of both are kept.
	 */
	asChild: { type: Boolean, default: false },
};

export interface PrimitiveOptions {
	as: string | Component;
	asChild: boolean;
}

function flatten(children: VNodeChild): VNode[] {
	if (Array.isArray(children)) {
		return children.flatMap(flatten);
	}

	if (children && typeof children === 'object' && 'type' in children) {
		return children.type === Fragment && Array.isArray(children.children)
			? flatten(children.children as VNodeChild)
			: [children];
	}

	return [];
}

/** The element of a part: the element itself, or the root element of a component it renders. */
export function toElement(value: Element | ComponentPublicInstance | null) {
	const element = value instanceof Element ? value : value?.$el;

	return element instanceof HTMLElement ? element : null;
}

/**
 * A function ref that writes the element of a part to `target`: the element itself, or the root
 * element of a component the part renders through `as` or `asChild`. Made once in `setup`: a new
 * function every render would make Vue reset the ref to `null` and back on each one.
 */
export function forwardElement(target: ShallowRef<HTMLElement | null>) {
	return (value: Element | ComponentPublicInstance | null) => {
		target.value = toElement(value);
	};
}

/**
 * Whether slot content renders anything: a `v-if` that fails leaves only a comment, and Vue's own
 * `<slot>` shows its fallback then too.
 */
export function hasContent(children: VNodeChild): boolean {
	if (Array.isArray(children)) {
		return children.some(hasContent);
	}

	if (children && typeof children === 'object' && 'type' in children) {
		if (children.type === Comment) {
			return false;
		}

		return children.type !== Fragment || hasContent(children.children as VNodeChild);
	}

	return children !== null && children !== undefined && typeof children !== 'boolean' && children !== '';
}

/**
 * Content a part renders as its own root, such as a `header` field: nothing for an empty string. The
 * server writes no text node for one, and hydration would miss it.
 */
export function toRootContent(content: VNodeChild) {
	return content === '' ? null : content;
}

/**
 * The tag of the element a part renders: `as`, or with `asChild` the tag of the first element of
 * `children`; `null` for a component, whose element the part does not know.
 */
export function getRenderedTag(options: PrimitiveOptions, children?: VNodeChild): string | null {
	if (!options.asChild) {
		return typeof options.as === 'string' ? options.as : null;
	}

	const child = flatten(children).find(node => node.type !== Comment);

	return typeof child?.type === 'string' ? child.type : null;
}

function isMerged(name: string) {
	return name === 'class' || name === 'style' || name === 'ref' || /^on[A-Z]/.test(name);
}

/**
 * Renders a part: its element with `props` over `children`, or with `asChild` the first element of
 * `children`, which is then the slot content, cloned with `props` merged in.
 */
export function renderPrimitive(options: PrimitiveOptions, props: Record<string, unknown>, children?: () => VNodeChild) {
	if (!options.asChild) {
		// An element takes its children as they are; a component, as its default slot.
		return typeof options.as === 'string'
			? h(options.as, props, children?.() as VNodeArrayChildren)
			: h(options.as, props, children ? { default: children } : undefined);
	}

	const content = flatten(children?.());
	const child = content.find(node => node.type !== Comment);

	if (!child) {
		if (__DEV__) {
			// oxlint-disable-next-line no-console
			console.warn('[@vue-data-grid/core] A part with `asChild` needs one element in its default slot.');
		}

		return content;
	}

	const own = child.props ?? {};
	const extra = Object.fromEntries(Object.entries(props).filter(([name]) => isMerged(name) || !(name in own)));

	return cloneVNode(child, extra, true);
}
