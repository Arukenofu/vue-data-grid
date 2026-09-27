import { computed } from 'vue';

import type { RenderedColumn } from '../columns/column';
import { getColumnRunGeometry, getColumnRunGrow } from '../render/column-span';
import { getGeometryKey, type TableCellStyles } from '../render/geometry';
import { stableComputed } from '../shared/stable-computed';
import {
	type ColumnGroup,
	getGroupDepth,
	type GroupCellDraft,
	isCollapsibleGroup,
	type RenderedGroup,
	resolveGroupRows,
} from './column-groups';

interface ColumnGroupsOptions {
	/** The group path of each column, from `resolveGroupPaths`. */
	paths: () => ReadonlyMap<string, readonly ColumnGroup[]>;
	isCollapsed: (group: ColumnGroup) => boolean;
	/** Shown columns before the column window: they tell where a group is split. */
	visible: () => readonly RenderedColumn[];
	/** The same after the column window, with spacers: group rows stand above them. */
	rendered: () => readonly RenderedColumn[];
	getPinOffset: (name: string) => number;
	getGrow: (name: string) => number;
	cellStyles: TableCellStyles;
}

interface CacheEntry {
	signature: string;
	cell: RenderedGroup;
}

interface GroupsFrame {
	cache: ReadonlyMap<string, CacheEntry>;
	rows: readonly (readonly RenderedGroup[])[];
}

const EMPTY_FRAME: GroupsFrame = { cache: new Map(), rows: [] };

function isSameRows(current: GroupsFrame['rows'], next: GroupsFrame['rows']) {
	return current.length === next.length
		&& current.every((row, level) => row.length === next[level].length
			&& row.every((cell, index) => cell === next[level][index]));
}

/**
 * Group rows above the rendered columns. A cell whose columns and geometry did not change comes back
 * as the same object, so markup caches can rely on it just as on column props.
 */
export function useColumnGroups(options: ColumnGroupsOptions) {
	const depth = computed(() => getGroupDepth(options.paths()));

	function isCollapsed(group: ColumnGroup | null) {
		return group !== null && isCollapsibleGroup(group) && options.isCollapsed(group);
	}

	function getSignature(draft: GroupCellDraft, names: readonly string[], grow: number) {
		const geometry = draft.columns.map((item, index) => (item.column
			? getGeometryKey(item.column, draft.pin, options.getPinOffset(names[index]))
			: ''));

		return [
			draft.group?.name,
			draft.parent?.name,
			draft.pin,
			draft.continues.start,
			draft.continues.end,
			isCollapsed(draft.group),
			draft.columns[0].index,
			grow,
			...geometry,
		].join('|');
	}

	function createCell(draft: GroupCellDraft, level: number, names: readonly string[], grow: number): RenderedGroup {
		const geometry = getColumnRunGeometry(draft.columns, grow, options);

		return {
			group: draft.group,
			parent: draft.parent,
			level,
			collapsible: draft.group !== null && isCollapsibleGroup(draft.group),
			collapsed: isCollapsed(draft.group),
			key: names[0],
			columns: names,
			pin: draft.pin,
			continues: draft.continues,
			props: Object.freeze({
				key: names[0],
				'data-tc-group': draft.group?.name,
				'data-tc-columns': geometry.tokens,
				'data-tc-pinned': draft.pin,
				style: geometry.style,
			}),
			index: draft.columns[0].index,
			span: draft.columns.length,
		};
	}

	function createSpacer(draft: GroupCellDraft, level: number, spacer: RenderedColumn): RenderedGroup {
		return {
			group: null,
			parent: null,
			level,
			collapsible: false,
			collapsed: false,
			key: spacer.key,
			columns: [],
			spacer: spacer.spacer,
			continues: draft.continues,
			props: spacer.headerProps,
			index: -1,
			span: 0,
		};
	}

	const frame = stableComputed<GroupsFrame>(EMPTY_FRAME, (previous) => {
		if (depth.value === 0) {
			return EMPTY_FRAME;
		}

		const drafts = resolveGroupRows(options.visible(), options.rendered(), options.paths(), depth.value);
		const cache = new Map<string, CacheEntry>();

		const rows = drafts.map((cells, level) => cells.map((draft) => {
			if (draft.spacer) {
				const key = `${level}:\u0000${draft.spacer.key}`;
				const cached = previous.cache.get(key);
				const cell = cached?.cell.props === draft.spacer.headerProps
					? cached.cell
					: createSpacer(draft, level, draft.spacer);

				cache.set(key, { signature: '', cell });

				return cell;
			}

			const names = draft.columns.map(item => item.column?.name ?? '');
			const grow = getColumnRunGrow(names, options.getGrow);
			const key = `${level}:${names[0]}`;
			const signature = `${names.join(' ')}|${getSignature(draft, names, grow)}`;
			const cached = previous.cache.get(key);
			const cell = cached?.signature === signature ? cached.cell : createCell(draft, level, names, grow);

			cache.set(key, { signature, cell });

			return cell;
		}));

		return isSameRows(previous.rows, rows) ? previous : { cache, rows };
	});

	return computed(() => frame.value.rows);
}
