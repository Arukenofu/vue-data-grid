import { createRowKeyResolver, type RowsTable, type TableRowsFeature, useTableSorting } from '@vue-stack/table';
import { computed, type Ref } from 'vue';

export function starredFirst(starred: Readonly<Ref<ReadonlySet<string>>>) {
	return <TRow>(table: RowsTable<TRow>): TableRowsFeature<TRow> => {
		const sorted = useTableSorting(table);
		const getKey = createRowKeyResolver(table.rowKey);

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
