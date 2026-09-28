import { createRowKeyResolver, type GridRowsFeature, type RowsGrid, useGridSorting } from '@vue-data-grid/core';
import { computed, type Ref } from 'vue';

export function starredFirst(starred: Readonly<Ref<ReadonlySet<string>>>) {
	return <TRow>(grid: RowsGrid<TRow>): GridRowsFeature<TRow> => {
		const sorted = useGridSorting(grid);
		const getKey = createRowKeyResolver(grid.rowKey);

		return {
			rows: computed(() => {
				const stars = starred.value;
				const first = sorted.rows.value.filter(row => stars.has(getKey(row)));
				const rest = sorted.rows.value.filter(row => !stars.has(getKey(row)));

				return [...first, ...rest];
			}),
		};
	};
}
