import {
	computed,
	type ComputedRef,
	type MaybeRefOrGetter,
	type Ref,
	shallowReactive,
	shallowRef,
	toValue,
	watch,
} from 'vue';

import { createRowKeyResolver, type RowKey } from './row-key';

/** `'single'` keeps at most one row selected; `'multiple'`, the default, any number. */
export type SelectionMode = 'single' | 'multiple';

export interface RowSelectionOptions<TRow> {
	/** The rows in the order `extend` walks; without `getChildren`, also the rows "all" means. */
	rows: MaybeRefOrGetter<readonly TRow[]>;
	rowKey: RowKey<TRow>;
	/**
	 * Selected keys, for `v-model`; without it the composable keeps its own. `defineModel` returns a
	 * written value only after the parent re-renders, so changes are made against an internal copy.
	 */
	selection?: Ref<string[]>;
	/**
	 * The whole set is selected, including rows not loaded yet, and `selection` holds the exceptions;
	 * `null` or no ref leaves this mode off.
	 */
	selectAll?: Ref<boolean | null>;
	/** `'multiple'` by default. */
	selectionMode?: MaybeRefOrGetter<SelectionMode>;
	/**
	 * Whether a row can be selected, by key; every row by default. A row it refuses is never selected,
	 * whatever the model holds, and no operation selects it. In a tree it is asked for leaves: a group
	 * is selectable while a leaf under it is.
	 */
	canSelect?: (key: string) => boolean;
	/**
	 * Child keys of a group, `null` giving the top level: `useRowTree().getChildren` fits. With it,
	 * `selection` holds leaves only, a group is selected when every selectable leaf under it is, and
	 * "all" means every leaf of the tree, collapsed ones included. In `'single'` mode only leaves can
	 * be selected.
	 */
	getChildren?: (key: string | null) => readonly string[];
}

interface TreeLeaves {
	/** Leaves under each group, on all levels. */
	byGroup: Map<string, readonly string[]>;
	all: readonly string[];
}

type GroupState = 'all' | 'some' | 'none';

const NO_KEYS: readonly string[] = [];

function collectLeaves(getChildren: (key: string | null) => readonly string[]): TreeLeaves {
	const byGroup = new Map<string, readonly string[]>();
	const seen = new Set<string>();

	function collect(key: string | null): readonly string[] {
		const children = getChildren(key);

		if (key !== null && children.length === 0) {
			return [key];
		}

		const leaves: string[] = [];

		for (const child of children) {
			if (!seen.has(child)) {
				seen.add(child);
				leaves.push(...collect(child));
			}
		}

		if (key !== null) {
			byGroup.set(key, leaves);
		}

		return leaves;
	}

	return { byGroup, all: collect(null) };
}

/** Makes `target` hold exactly `keys`, touching only the keys that differ: a reader of one key wakes only for it. */
function patchSet(target: Set<string>, keys: ReadonlySet<string>) {
	for (const key of target) {
		if (!keys.has(key)) {
			target.delete(key);
		}
	}

	for (const key of keys) {
		target.add(key);
	}
}

/**
 * Selection by row key. "All" means the loaded rows; keys of rows that are not there stay in the
 * model as they are. With `selectAll`, "all" becomes a flag and `selection` a list of exceptions, so
 * the selection survives loading the set page by page.
 *
 * Reactive per row: `isSelected` and `isPartlySelected` of one row wake only when that row changes,
 * so a row template can read them without re-rendering the other rows on every click.
 */
export function useRowSelection<TRow>(options: RowSelectionOptions<TRow>) {
	const getKey = createRowKeyResolver(options.rowKey);
	const { getChildren } = options;
	const model = shallowRef<readonly string[]>(options.selection?.value ?? []);
	const flag = shallowRef<boolean | null>(options.selectAll?.value ?? null);
	// The model as a reactive set: `has(key)` is tracked per key, so a change wakes only its rows.
	const marks = shallowReactive(new Set<string>(model.value));

	if (options.selection) {
		watch(options.selection, (next) => {
			if (next !== model.value) {
				model.value = next;
				patchSet(marks, new Set(next));
			}
		}, { flush: 'sync' });
	}

	if (options.selectAll) {
		watch(options.selectAll, (next) => {
			flag.value = next;
		}, { flush: 'sync' });
	}

	const keys = computed(() => toValue(options.rows).map(row => getKey(row)));
	const inverted = computed(() => flag.value === true);
	const selectionMode = computed<SelectionMode>(() => toValue(options.selectionMode) ?? 'multiple');
	const single = computed(() => selectionMode.value === 'single');
	const tree = computed<TreeLeaves | null>(() => (getChildren ? collectLeaves(getChildren) : null));
	const universe = computed(() => tree.value?.all ?? keys.value);

	let anchor: string | null = null;
	let lead: string | null = null;

	function canSelectLeaf(key: string) {
		return options.canSelect?.(key) ?? true;
	}

	function isLeafSelected(key: string) {
		return canSelectLeaf(key) && inverted.value !== marks.has(key);
	}

	/** Selectable leaves under a group, or the key itself for a leaf or a row outside the tree. */
	function getLeaves(key: string): readonly string[] {
		const leaves = tree.value?.byGroup.get(key);

		if (leaves) {
			return single.value ? NO_KEYS : leaves.filter(canSelectLeaf);
		}

		return canSelectLeaf(key) ? [key] : NO_KEYS;
	}

	// One lazy computed per group read: it tracks the leaves of its group alone, and a computed whose
	// value holds does not wake its readers, so a click under one group wakes that group's rows only.
	const groupStates = new Map<string, ComputedRef<GroupState>>();

	function createGroupState(key: string) {
		return computed<GroupState>(() => {
			let total = 0;
			let count = 0;

			for (const leaf of tree.value?.byGroup.get(key) ?? NO_KEYS) {
				if (canSelectLeaf(leaf)) {
					total += 1;
					count += isLeafSelected(leaf) ? 1 : 0;
				}
			}

			return count === 0 ? 'none' : count === total ? 'all' : 'some';
		});
	}

	function getGroupState(key: string) {
		const groups = tree.value?.byGroup;

		if (!groups?.has(key)) {
			return undefined;
		}

		let state = groupStates.get(key);

		if (!state) {
			// Groups come and go with the rows: forget the ones that are gone before the cache doubles.
			if (groupStates.size >= groups.size * 2) {
				for (const name of groupStates.keys()) {
					if (!groups.has(name)) {
						groupStates.delete(name);
					}
				}
			}

			state = createGroupState(key);
			groupStates.set(key, state);
		}

		return state.value;
	}

	/** Whether the row is selected; a group is, when every selectable leaf under it is. */
	function isSelected(key: string) {
		const state = getGroupState(key);

		return state === undefined ? isLeafSelected(key) : state === 'all';
	}

	/** Whether some, but not all, selectable leaves under a group are selected; always `false` for a leaf. */
	function isPartlySelected(key: string) {
		return getGroupState(key) === 'some';
	}

	/** Whether an operation can select the row: `canSelect` allows it, or a leaf under the group. */
	function isSelectable(key: string) {
		return getLeaves(key).length > 0;
	}

	const selectable = computed(() => universe.value.filter(canSelectLeaf));

	const selectedCount = computed(() => universe.value.filter(isLeafSelected).length);

	const isAllSelected = computed(() => (inverted.value
		? marks.size === 0
		: selectable.value.length > 0 && selectable.value.every(isLeafSelected)));

	const isSomeSelected = computed(() => selectedCount.value > 0 && !isAllSelected.value);

	function commit(next: ReadonlySet<string>, nextFlag = flag.value) {
		const list = [...next];

		patchSet(marks, next);
		model.value = list;

		if (options.selection) {
			options.selection.value = list;
		}

		if (nextFlag !== flag.value) {
			flag.value = nextFlag;

			if (options.selectAll) {
				options.selectAll.value = nextFlag;
			}
		}
	}

	/** `true` selects the leaves, `false` deselects them, in whichever mode the model is. */
	function mark(next: Set<string>, leaves: readonly string[], value: boolean) {
		for (const leaf of leaves) {
			if (value === inverted.value) {
				next.delete(leaf);
			} else {
				next.add(leaf);
			}
		}
	}

	/** Leaves of the shown rows from `from` to `to`, both included; `null` when either is not shown. */
	function getRange(from: string, to: string) {
		const start = keys.value.indexOf(from);
		const end = keys.value.indexOf(to);

		if (start === -1 || end === -1) {
			return null;
		}

		const result: string[] = [];

		for (let index = Math.min(start, end); index <= Math.max(start, end); index += 1) {
			result.push(...getLeaves(keys.value[index]));
		}

		return result;
	}

	/**
	 * Selects only this row, or every selectable leaf under a group, and makes it the anchor. Does
	 * nothing for a row that cannot be selected.
	 */
	function replace(key: string) {
		const leaves = getLeaves(key);

		if (leaves.length === 0) {
			return;
		}

		anchor = key;
		lead = key;
		commit(new Set(single.value ? leaves.slice(0, 1) : leaves), flag.value === null ? null : false);
	}

	/**
	 * Toggles a row, or every selectable leaf under a group, and makes it the anchor. Does nothing for a
	 * row that cannot be selected, so a key press on a disabled row keeps the selection.
	 */
	function toggle(key: string) {
		if (!isSelectable(key)) {
			return;
		}

		const value = !isSelected(key);

		if (single.value) {
			if (value) {
				replace(key);
			} else {
				clear();
				anchor = key;
				lead = key;
			}

			return;
		}

		const next = new Set(marks);

		mark(next, getLeaves(key), value);
		anchor = key;
		lead = key;
		commit(next);
	}

	/**
	 * Selects the shown rows from the anchor, the last row of `replace` or `toggle`, to this one, as
	 * Shift+click does: the range from the anchor to the previous `extend` is let go first, and the
	 * rest of the selection stays. Without an anchor among the shown rows, it selects the row and
	 * makes it the anchor, if the row can be selected. In `'single'` mode it is `replace`.
	 */
	function extend(key: string) {
		if (single.value) {
			replace(key);

			return;
		}

		const range = anchor === null ? null : getRange(anchor, key);

		if (!range && !isSelectable(key)) {
			return;
		}

		const next = new Set(marks);

		if (!range || anchor === null) {
			mark(next, getLeaves(key), true);
			anchor = key;
		} else {
			mark(next, getRange(anchor, lead ?? anchor) ?? NO_KEYS, false);
			mark(next, range, true);
		}

		lead = key;
		commit(next);
	}

	/** Selects exactly these rows, groups through their leaves; turns the "all selected" mode off. */
	function set(selected: readonly string[]) {
		const leaves = selected.flatMap(getLeaves);

		anchor = null;
		lead = null;
		commit(new Set(single.value ? leaves.slice(-1) : leaves), flag.value === null ? null : false);
	}

	/** Deselects every row; turns the "all selected" mode off. */
	function clear() {
		set(NO_KEYS);
	}

	/**
	 * Selects or deselects every row "all" means. With `selectAll` it sets the flag and drops the
	 * exceptions. Selecting all does nothing in `'single'` mode.
	 */
	function setAll(value: boolean) {
		anchor = null;
		lead = null;

		if (value && single.value) {
			return;
		}

		if (flag.value !== null) {
			commit(new Set(), value);

			return;
		}

		const next = new Set(marks);

		mark(next, selectable.value, value);
		commit(next);
	}

	function toggleAll() {
		setAll(!isAllSelected.value);
	}

	return {
		/** The selected keys, or the exceptions in the "all selected" mode: the model as it is. */
		selectedKeys: computed(() => model.value),
		/** `'multiple'` unless the option says otherwise. */
		selectionMode,
		isSelected,
		isPartlySelected,
		isSelectable,
		isAllSelected,
		isSomeSelected,
		/**
		 * Selected rows among the ones "all" means: loaded rows, or leaves of the tree with
		 * `getChildren`. With `selectAll` it counts loaded rows only, not the whole set.
		 */
		selectedCount,
		toggle,
		replace,
		extend,
		set,
		clear,
		setAll,
		toggleAll,
	};
}

/** A row selection as `useRowSelection` gives it. */
export type RowSelection = ReturnType<typeof useRowSelection>;
