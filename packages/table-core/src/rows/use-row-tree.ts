import { computed, type MaybeRefOrGetter, type Ref, ref, toValue } from 'vue';

import { type AnyColumn, type ColumnsInput, toColumnList } from '../columns/column';
import type { TableSort } from '../columns/sort';
import { stableComputed } from '../shared/stable-computed';
import { createRowKeyResolver, type RowKey } from './row-key';
import {
	type ChildrenField,
	createParentKeyResolver,
	getRowChildren,
	type ParentKey,
	type RowNode,
} from './row-tree';
import { resolveSortedRows, type SortFrame } from './sort-rows';

export interface RowTreeOptions<TRow> {
	rows: MaybeRefOrGetter<readonly TRow[]>;
	rowKey: RowKey<TRow>;
	/** The field holding an array of children. Without it and without `parentKey` the rows are flat. */
	childrenField?: MaybeRefOrGetter<ChildrenField<TRow> | undefined>;
	/** The parent of each row of a flat list; takes precedence over `childrenField`. Read once. */
	parentKey?: ParentKey<TRow>;
	/**
	 * Keys of expanded groups; `undefined` for the initial state from `defaultExpanded`. Without it the
	 * tree keeps its own.
	 */
	expanded?: Ref<string[] | undefined>;
	/** How many levels start expanded; a negative number expands all. `0` by default. */
	defaultExpanded?: MaybeRefOrGetter<number>;
	/** Sorts siblings on every level; without it the order of `rows` and the children fields is kept. */
	sort?: MaybeRefOrGetter<readonly TableSort[]>;
	/** Columns whose `value` and `compare` sort the siblings. */
	columns?: MaybeRefOrGetter<ColumnsInput | readonly AnyColumn[]>;
	/** Re-sort only siblings that arrive as new objects; the same contract as in `useSortedRows`. */
	delta?: MaybeRefOrGetter<boolean>;
}

interface TreeEntry<TRow> {
	row: TRow;
	node: RowNode;
	children: string[];
}

interface TreeIndex<TRow> {
	entries: Map<string, TreeEntry<TRow>>;
	root: string[];
	/** Sibling sort frames by parent key, for the incremental re-sort. */
	frames: Map<string, SortFrame<TRow>>;
}

interface ShownFrame<TRow> {
	rows: readonly TRow[];
	nodes: readonly RowNode[];
	/** Nodes of expanded groups by key: an index node always has `expanded: false`. */
	expanded: Map<string, RowNode>;
}

const EMPTY: readonly string[] = [];

const ROOT_FRAME = '\u0000root';

function isSameNode(current: RowNode, next: RowNode) {
	return current.key === next.key
		&& current.level === next.level
		&& current.parent === next.parent
		&& current.group === next.group
		&& current.expanded === next.expanded
		&& current.count === next.count
		&& current.position === next.position
		&& current.setSize === next.setSize;
}

function reuseNode(previous: RowNode | undefined, next: RowNode) {
	return previous && isSameNode(previous, next) ? previous : next;
}

function isSameList<TItem>(current: readonly TItem[], next: readonly TItem[]) {
	return current.length === next.length && current.every((item, index) => item === next[index]);
}

/**
 * A tree of rows flattened into the list of shown rows, with nesting kept in the nodes. The tree comes
 * from a children field or from parent keys of a flat list; without either every row is a leaf of the
 * root. A node that did not change stays the same object, and unchanged shown rows the same arrays.
 */
export function useRowTree<TRow>(options: RowTreeOptions<TRow>) {
	const getKey = createRowKeyResolver(options.rowKey);
	const getParent = options.parentKey === undefined ? null : createParentKeyResolver(options.parentKey);
	const expanded = options.expanded ?? ref<string[] | undefined>();

	const enabled = computed(() => getParent !== null || toValue(options.childrenField) !== undefined);

	function groupByParent(rows: readonly TRow[], parentOf: (row: TRow) => string | null) {
		const keys = rows.map(getKey);
		const known = new Set(keys);
		const byParent = new Map<string | null, TRow[]>();

		rows.forEach((row, position) => {
			const parent = parentOf(row);
			const resolved = parent !== null && parent !== keys[position] && known.has(parent) ? parent : null;
			const siblings = byParent.get(resolved);

			if (siblings) {
				siblings.push(row);
			} else {
				byParent.set(resolved, [row]);
			}
		});

		return byParent;
	}

	const index = stableComputed<TreeIndex<TRow>, null>(null, (previous) => {
		const rows = toValue(options.rows);
		const field = toValue(options.childrenField);
		const sort = toValue(options.sort) ?? [];
		const columns = toColumnList(toValue(options.columns) ?? []);
		const delta = toValue(options.delta) ?? false;
		const byParent = getParent ? groupByParent(rows, getParent) : null;
		const entries = new Map<string, TreeEntry<TRow>>();
		const frames = new Map<string, SortFrame<TRow>>();

		function order(siblings: readonly TRow[], parent: string | null) {
			if (sort.length === 0) {
				return siblings;
			}

			const id = parent ?? ROOT_FRAME;
			const frame = resolveSortedRows(previous?.frames.get(id) ?? null, siblings, sort, columns, delta);

			frames.set(id, frame);

			return frame.rows;
		}

		function getChildren(row: TRow, key: string) {
			return byParent ? byParent.get(key) : getRowChildren(row, field);
		}

		function visit(siblings: readonly TRow[], parent: string | null, level: number, keys: string[]) {
			let count = 0;

			for (const row of order(siblings, parent)) {
				const key = getKey(row);

				// A repeated key or a cycle of parents: the row is already in the tree.
				if (entries.has(key)) {
					continue;
				}

				const children = getChildren(row, key);
				const group = children !== undefined;
				const entry: TreeEntry<TRow> = {
					row,
					node: { key, level, parent, group, expanded: false, count: 0, position: 0, setSize: 0 },
					children: [],
				};

				entries.set(key, entry);
				keys.push(key);

				// The node is new and not shared yet: it is filled in place and reused, if it can be, below.
				entry.node.count = children ? visit(children, key, level + 1, entry.children) : 0;
				count += group ? entry.node.count : 1;
			}

			return count;
		}

		// Positions are known once every sibling is placed: rows in a cycle of parents join the top last.
		function place(keys: readonly string[]) {
			keys.forEach((key, position) => {
				const entry = entries.get(key);

				if (entry) {
					entry.node.position = position;
					entry.node.setSize = keys.length;
					entry.node = reuseNode(previous?.entries.get(key)?.node, entry.node);
				}
			});
		}

		const root: string[] = [];

		visit(byParent ? byParent.get(null) ?? [] : rows, null, 0, root);

		// Rows whose parents form a cycle are not reachable from the top: show them there.
		if (byParent && entries.size < rows.length) {
			for (const row of rows) {
				if (!entries.has(getKey(row))) {
					visit([row], null, 0, root);
				}
			}
		}

		place(root);

		for (const entry of entries.values()) {
			place(entry.children);
		}

		return { entries, root, frames };
	});

	const expandedKeys = computed(() => {
		const given = expanded.value;

		if (given !== undefined) {
			return new Set(given);
		}

		const levels = toValue(options.defaultExpanded) ?? 0;
		const keys = new Set<string>();

		for (const { node } of index.value.entries.values()) {
			if (node.group && (levels < 0 || node.level < levels)) {
				keys.add(node.key);
			}
		}

		return keys;
	});

	const shown = stableComputed<ShownFrame<TRow>, null>(null, (previous) => {
		const rows: TRow[] = [];
		const nodes: RowNode[] = [];
		const expandedNodes = new Map<string, RowNode>();
		const { entries } = index.value;

		function visit(keys: readonly string[]) {
			for (const key of keys) {
				const entry = entries.get(key);

				if (!entry) {
					continue;
				}

				const isExpanded = entry.node.group && expandedKeys.value.has(key);
				let { node } = entry;

				if (isExpanded) {
					node = reuseNode(previous?.expanded.get(key), { ...node, expanded: true });
					expandedNodes.set(key, node);
				}

				rows.push(entry.row);
				nodes.push(node);

				if (isExpanded) {
					visit(entry.children);
				}
			}
		}

		visit(index.value.root);

		if (previous && isSameList(previous.rows, rows) && isSameList(previous.nodes, nodes)) {
			return previous;
		}

		return { rows, nodes, expanded: expandedNodes };
	});

	const rows = computed(() => shown.value.rows);
	const nodes = computed(() => shown.value.nodes);

	const leaves = stableComputed<readonly TRow[], null>(null, (previous) => {
		const result: TRow[] = [];

		for (const entry of index.value.entries.values()) {
			if (!entry.node.group) {
				result.push(entry.row);
			}
		}

		return previous && isSameList(previous, result) ? previous : result;
	});

	function getEntry(key: string) {
		return index.value.entries.get(key);
	}

	function getChildren(parent: string | null): readonly string[] {
		return parent === null ? index.value.root : getEntry(parent)?.children ?? EMPTY;
	}

	function setExpanded(key: string, value: boolean) {
		const current = expandedKeys.value;

		if (current.has(key) === value) {
			return;
		}

		const next = new Set(current);

		if (value) {
			next.add(key);
		} else {
			next.delete(key);
		}

		expanded.value = [...next];
	}

	function toggle(key: string) {
		setExpanded(key, !expandedKeys.value.has(key));
	}

	/**
	 * Expands every group above a row so that it is shown; `false` when the row is not in the tree.
	 * All groups are written at once: with `v-model:expanded` a write returns through the parent only on
	 * the next tick, and one write per ancestor would overwrite the previous one.
	 */
	function reveal(key: string) {
		const entry = getEntry(key);

		if (!entry) {
			return false;
		}

		const next = new Set(expandedKeys.value);
		let { parent } = entry.node;

		while (parent !== null) {
			next.add(parent);
			parent = getEntry(parent)?.node.parent ?? null;
		}

		if (next.size !== expandedKeys.value.size) {
			expanded.value = [...next];
		}

		return true;
	}

	return {
		enabled,
		/** The shown rows: the expanded tree in traversal order. */
		rows,
		/** The node of each shown row, at the same index. */
		nodes,
		/** Every leaf in traversal order, expanded or not: compute totals from it. */
		leaves,
		/** Whether any row has children: a flat list in a tree has no groups to expand or to line up with. */
		hasGroups: computed(() => leaves.value.length < index.value.entries.size),
		/** The node of any row in the tree, shown or not; its `expanded` is always `false`. */
		getNode: (key: string) => getEntry(key)?.node,
		/** Child keys of a group; `null` gives the top level. */
		getChildren,
		isExpanded: (key: string) => expandedKeys.value.has(key),
		setExpanded,
		toggle,
		reveal,
	};
}

/** A tree of rows as `useRowTree` gives it. */
export type RowTree<TRow = unknown> = ReturnType<typeof useRowTree<TRow>>;
