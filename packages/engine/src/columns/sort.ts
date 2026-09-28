export type SortDirection = 'asc' | 'desc';

export interface GridSort<TName extends string = string> {
	name: TName;
	direction: SortDirection;
}

/** Header clicks start with descending. */
export const DEFAULT_SORT_ORDER: readonly SortDirection[] = ['desc', 'asc'];

function getNextSort(
	current: GridSort | undefined,
	name: string,
	order: readonly SortDirection[],
): GridSort | null {
	const direction = order[current ? order.indexOf(current.direction) + 1 : 0];

	return direction ? { name, direction } : null;
}

/**
 * The sort after a header click on `name`: the next direction from `order`, and no sort for the
 * column after the last one. Without `additive` the column becomes the only sort key; with it, the
 * column is appended or changes direction in place.
 */
export function toggleSort(
	sort: readonly GridSort[],
	name: string,
	additive: boolean,
	order: readonly SortDirection[] = DEFAULT_SORT_ORDER,
): GridSort[] {
	const index = sort.findIndex(item => item.name === name);
	const next = getNextSort(sort[index], name, order);

	if (!additive) {
		return next ? [next] : [];
	}

	if (index === -1) {
		return next ? [...sort, next] : [...sort];
	}

	return next
		? sort.map((item, position) => (position === index ? next : item))
		: sort.filter(item => item.name !== name);
}
