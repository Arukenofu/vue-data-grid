import type { ColumnPinSide, RenderedColumn } from '../columns/column';

export type GroupShowWhen = 'expanded' | 'collapsed';

/**
 * Fields a layer on top of the core adds to every column group, such as how its header cell renders;
 * declared by augmenting this interface, as `ColumnExtension` is for columns.
 */
export interface ColumnGroupExtension {}

export interface ColumnGroupInput<TMeta = unknown> extends ColumnGroupExtension {
	/** The group's name for people: the header text, a settings panel. */
	label?: string;
	/** Columns and nested groups by name, in order. */
	children: readonly string[];
	/**
	 * Children shown only while the group is expanded, or only while it is collapsed; children not
	 * named here are always shown. A group with at least one entry can collapse. Keep at least one
	 * child visible while collapsed, or the group has no cell to expand it from.
	 */
	showWhen?: Readonly<Record<string, GroupShowWhen>>;
	collapsedByDefault?: boolean;
	/** Moves never split the group's columns, and no other column lands between them. */
	keepTogether?: boolean;
	meta?: TMeta;
}

export interface ColumnGroup<TMeta = unknown> extends ColumnGroupInput<TMeta> {
	name: string;
}

export type ColumnGroupsInput = Readonly<Record<string, ColumnGroup>>;

/** A cell of a group row before styling: what it covers and where it stands. */
export interface GroupCellDraft {
	/** `null` for columns without a group at this level, and for a column-window spacer. */
	group: ColumnGroup | null;
	/** The group one level up; `null` at the top level. */
	parent: ColumnGroup | null;
	/** Shown columns under the cell, in display order; empty for a spacer. */
	columns: RenderedColumn[];
	pin?: ColumnPinSide;
	spacer?: RenderedColumn;
	/** Whether the group has columns before (`start`) or after (`end`) this cell in the row. */
	continues: { start: boolean; end: boolean };
}

/** A cell of a group row in `scope.headerGroups`. */
export interface RenderedGroup {
	group: ColumnGroup | null;
	parent: ColumnGroup | null;
	level: number;
	/** The group has `showWhen`, so it can collapse and expand. */
	collapsible: boolean;
	collapsed: boolean;
	/** The first column under the cell, or the key of a spacer: unique in the row, for `v-for`. */
	key: string;
	/** Names of the shown columns under the cell, in display order; empty for a spacer. */
	columns: readonly string[];
	pin?: ColumnPinSide;
	spacer?: ColumnPinSide;
	continues: Readonly<{ start: boolean; end: boolean }>;
	/**
	 * `key`, `data-dg-group`, `data-dg-columns`, `data-dg-pinned` and `style`: one frozen object while the
	 * cell's geometry holds.
	 */
	props: Readonly<Record<string, unknown>>;
	/**
	 * Position of the first column under the cell among the shown columns, from `0`; `-1` for a
	 * spacer. The cell's `aria-colindex` is one more.
	 */
	index: number;
	/** How many shown columns the cell covers, its `aria-colspan`; `0` for a spacer. */
	span: number;
}

const NOT_CONTINUED = Object.freeze({ start: false, end: false });

export function toGroupList(
	groups: ColumnGroupsInput | readonly ColumnGroup[] | undefined,
): readonly ColumnGroup[] {
	if (!groups) {
		return [];
	}

	return Array.isArray(groups) ? groups : Object.values(groups as ColumnGroupsInput);
}

/**
 * The group path of each column, from the outermost group in. A column is any name in `children`
 * that is not a group. A name listed in two groups stays in the first; a cycle is cut at the repeat.
 */
export function resolveGroupPaths(groups: readonly ColumnGroup[]) {
	const byName = new Map(groups.map(group => [group.name, group]));
	const parents = new Map<string, ColumnGroup>();

	for (const group of groups) {
		for (const child of group.children) {
			if (!parents.has(child)) {
				parents.set(child, group);
			}
		}
	}

	const paths = new Map<string, readonly ColumnGroup[]>();

	for (const [child, parent] of parents) {
		if (byName.has(child)) {
			continue;
		}

		const path: ColumnGroup[] = [];
		const seen = new Set<string>();
		let group: ColumnGroup | undefined = parent;

		while (group && !seen.has(group.name)) {
			seen.add(group.name);
			path.unshift(group);
			group = parents.get(group.name);
		}

		paths.set(child, path);
	}

	return paths;
}

export function getGroupDepth(paths: ReadonlyMap<string, readonly ColumnGroup[]>) {
	let depth = 0;

	for (const path of paths.values()) {
		depth = Math.max(depth, path.length);
	}

	return depth;
}

function getGroupBounds(visible: readonly RenderedColumn[], paths: ReadonlyMap<string, readonly ColumnGroup[]>) {
	const bounds = new Map<ColumnGroup, { first: number; last: number }>();

	for (const rendered of visible) {
		for (const group of paths.get(rendered.column?.name ?? '') ?? []) {
			const bound = bounds.get(group);

			if (bound) {
				bound.last = rendered.index;
			} else {
				bounds.set(group, { first: rendered.index, last: rendered.index });
			}
		}
	}

	return bounds;
}

function canJoin(cell: GroupCellDraft | undefined, next: GroupCellDraft) {
	return cell !== undefined
		&& cell.spacer === undefined
		&& cell.group === next.group
		&& cell.pin === next.pin
		&& (next.group !== null || cell.parent === next.parent);
}

/**
 * Group rows above the rendered columns, from the top. Groups stick to the top: rows below a short
 * path hold group-less cells, which never merge across different parent groups. Neighbouring columns
 * share a cell when they have the same group at this level and the same pin, so a group split by
 * pinning, a move or the column window comes as several cells.
 */
export function resolveGroupRows(
	visible: readonly RenderedColumn[],
	rendered: readonly RenderedColumn[],
	paths: ReadonlyMap<string, readonly ColumnGroup[]>,
	depth: number,
) {
	const bounds = getGroupBounds(visible, paths);
	const rows: GroupCellDraft[][] = [];

	for (let level = 0; level < depth; level += 1) {
		const cells: GroupCellDraft[] = [];

		for (const item of rendered) {
			if (!item.column) {
				cells.push({ group: null, parent: null, columns: [], spacer: item, continues: NOT_CONTINUED });
				continue;
			}

			const path = paths.get(item.column.name) ?? [];
			const next: GroupCellDraft = {
				group: path[level] ?? null,
				parent: level > 0 ? path[level - 1] ?? null : null,
				columns: [item],
				pin: item.pin,
				continues: NOT_CONTINUED,
			};
			const last = cells[cells.length - 1];

			if (canJoin(last, next)) {
				last.columns.push(item);
			} else {
				cells.push(next);
			}
		}

		for (const cell of cells) {
			const bound = cell.group ? bounds.get(cell.group) : undefined;

			if (bound) {
				cell.continues = {
					start: cell.columns[0].index > bound.first,
					end: cell.columns[cell.columns.length - 1].index < bound.last,
				};
			}
		}

		rows.push(cells);
	}

	return rows;
}

export function isCollapsibleGroup(group: ColumnGroupInput) {
	return group.showWhen !== undefined && Object.keys(group.showWhen).length > 0;
}

/** Columns hidden by collapsed groups on their path, by each level's `showWhen` for its child. */
export function resolveCollapsedColumns(
	paths: ReadonlyMap<string, readonly ColumnGroup[]>,
	isCollapsed: (group: ColumnGroup) => boolean,
) {
	const result = new Set<string>();

	for (const [name, path] of paths) {
		const hidden = path.some((group, level) => {
			const rule = group.showWhen?.[path[level + 1]?.name ?? name];

			return rule !== undefined && (rule === 'expanded') === isCollapsed(group);
		});

		if (hidden) {
			result.add(name);
		}
	}

	return result;
}

function countRuns(names: readonly string[], paths: ReadonlyMap<string, readonly ColumnGroup[]>, group: ColumnGroup) {
	let runs = 0;
	let inside = false;

	for (const name of names) {
		const member = paths.get(name)?.includes(group) ?? false;

		if (member && !inside) {
			runs += 1;
		}

		inside = member;
	}

	return runs;
}

/**
 * Whether a move from `before` to `after` leaves every `keepTogether` group in no more contiguous
 * runs than it had. Comparing with the previous row, rather than requiring one run, lets a group that
 * pinning already split still move.
 */
export function keepsGroupsTogether(
	paths: ReadonlyMap<string, readonly ColumnGroup[]>,
	before: readonly string[],
	after: readonly string[],
) {
	const groups = new Set<ColumnGroup>();

	for (const path of paths.values()) {
		for (const group of path) {
			if (group.keepTogether) {
				groups.add(group);
			}
		}
	}

	for (const group of groups) {
		if (countRuns(after, paths, group) > countRuns(before, paths, group)) {
			return false;
		}
	}

	return true;
}
