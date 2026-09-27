import type { VNode } from 'vue';

/** Whether two token lists match, element by element with `Object.is`: the check before `keepMounted`. */
export function isSameTokens(current: readonly unknown[], next: readonly unknown[]) {
	return current.length === next.length && current.every((token, index) => Object.is(token, next[index]));
}

const KEEP_MOUNTED: unknown[] = [];

/**
 * Marks a vnode so that Vue's `cloneIfMounted` returns it as is, and `patch` stops at `n1 === n2`
 * without walking the subtree. Keep the previous vnode in your cache and return it marked while your
 * tokens match.
 *
 * Relies on the vnode's `memo` field, which belongs to `v-memo` and is not public Vue API. Tokens are
 * not stored there: `isMemoSame` would also register the vnode in the current compiler block, which
 * render functions do not have.
 */
export function keepMounted<TVNode extends VNode>(vnode: TVNode): TVNode {
	(vnode as VNode & { memo?: unknown[] }).memo ??= KEEP_MOUNTED;

	return vnode;
}
