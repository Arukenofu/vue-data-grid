import type { ColumnLayout, ColumnPinSide } from './column';

export interface TableLayout {
	order: string[];
	hidden: string[];
	widths: Record<string, number>;
	pinned: Record<string, ColumnPinSide>;
	/**
	 * Collapsed state of column groups set by the user; groups without an entry follow
	 * `collapsedByDefault`.
	 */
	collapsed?: Record<string, boolean>;
}

function getDefaultPins(columns: readonly ColumnLayout[]) {
	const pinned: Record<string, ColumnPinSide> = {};

	for (const column of columns) {
		if (column.pinnable && column.pinned) {
			pinned[column.name] = column.pinned;
		}
	}

	return pinned;
}

function createLayout(columns: readonly ColumnLayout[]): TableLayout {
	return {
		order: columns.map(column => column.name),
		hidden: columns.filter(column => column.hiddenByDefault).map(column => column.name),
		widths: {},
		pinned: getDefaultPins(columns),
	};
}

function mergeOrder(columns: readonly ColumnLayout[], order: readonly string[]) {
	const known = new Set(order);
	const trailing = new Map<string | null, string[]>();
	let anchor: string | null = null;

	for (const column of columns) {
		if (known.has(column.name)) {
			anchor = column.name;
			continue;
		}

		const list = trailing.get(anchor);

		if (list) {
			list.push(column.name);
		} else {
			trailing.set(anchor, [column.name]);
		}
	}

	const result = [...trailing.get(null) ?? []];

	for (const name of order) {
		result.push(name, ...trailing.get(name) ?? []);
	}

	return result;
}

/**
 * Lays a stored layout over the declared columns; without one, builds it from the declarations. A
 * column the layout does not know takes its declared place, right after the nearest known column
 * declared before it, rather than going to the end.
 */
export function resolveLayout(columns: readonly ColumnLayout[], layout: TableLayout | null): TableLayout {
	if (!layout) {
		return createLayout(columns);
	}

	const known = new Set(layout.order);
	const added = columns.filter(column => !known.has(column.name));
	const stored: Partial<TableLayout> = layout;
	const pinned = stored.pinned ?? getDefaultPins(columns);

	if (added.length === 0 && pinned === layout.pinned) {
		return layout;
	}

	return {
		order: mergeOrder(columns, layout.order),
		hidden: [...layout.hidden, ...added.filter(column => column.hiddenByDefault).map(column => column.name)],
		widths: layout.widths,
		pinned: { ...pinned, ...getDefaultPins(added) },
		collapsed: layout.collapsed,
	};
}
