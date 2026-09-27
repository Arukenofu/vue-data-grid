import { computed, isRef, type MaybeRef, type Ref, ref, shallowRef } from 'vue';

import type { PersistStore } from '../persist/store';
import { usePersistedState } from '../persist/use-persisted-state';
import { useModelRef } from '../shared/use-model-ref';
import { type ColumnPinSide, type ColumnsInput, toColumnList } from './column';
import type { TableLayout } from './layout';
import type { SortDirection, TableSort } from './sort';

export type RememberField = 'order' | 'hidden' | 'widths' | 'pinned' | 'collapsed' | 'sort';

export type ColumnName<TColumns> = Extract<keyof TColumns, string>;

export interface TableColumnsStateOptions<TColumns extends ColumnsInput = ColumnsInput> {
	/**
	 * Columns from `defineColumns`. Names in `sort` are checked against them when compiling, and a sort
	 * restored from `persist` drops columns that are not among them.
	 */
	columns?: TColumns;
	/**
	 * The initial sort, or a ref of it as a model, such as `v-model:sort`: the state writes to it and
	 * follows it.
	 */
	sort?: readonly TableSort<ColumnName<TColumns>>[] | Ref<readonly TableSort<ColumnName<TColumns>>[]>;
	/** A ref of the layout as a model, such as `v-model:layout`; `null` in it means the declared layout. */
	layout?: Ref<TableLayout | null>;
	/** Whether a header click can add a column to the sort: a boolean, or a ref the state then uses. */
	multiSort?: MaybeRef<boolean>;
	/** Where the state is kept between visits, such as `localStorageStore('screener')`. Read once. */
	persist?: PersistStore;
	/** What `persist` keeps; everything by default. */
	remember?: readonly RememberField[];
}

export interface TableColumnsState<TName extends string = string> {
	/** The layout; writes also go to the `layout` model when there is one. */
	layout: Ref<TableLayout | null>;
	/**
	 * The sort; writes also go to the `sort` model when there is one. Replaced as a whole, never changed
	 * in place: a change in place reaches no reader.
	 */
	sort: Ref<readonly TableSort<TName>[]>;
	/** Can be switched at any time: the engine reads it reactively. */
	multiSort: Ref<boolean>;
	/**
	 * Returns the layout and the sort to their initial values, the values of the models when the state
	 * was created, and removes the stored record.
	 */
	reset: () => void;
	/** `false` until the stored state is read and applied; always `true` without `persist`. */
	ready: Readonly<Ref<boolean>>;
}

interface StoredState {
	layout?: Partial<TableLayout>;
	sort?: readonly TableSort[];
}

const ALL_FIELDS: readonly RememberField[] = ['order', 'hidden', 'widths', 'pinned', 'collapsed', 'sort'];

const LAYOUT_FIELDS = ['order', 'hidden', 'widths', 'pinned', 'collapsed'] as const;

const STORAGE_VERSION = 1;

const DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isName(value: unknown): value is string {
	return typeof value === 'string';
}

function isWidth(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPinSide(value: unknown): value is ColumnPinSide {
	return value === 'start' || value === 'end';
}

function isFlag(value: unknown): value is boolean {
	return typeof value === 'boolean';
}

function readNames(value: unknown) {
	return Array.isArray(value) ? value.filter(isName) : undefined;
}

function readMap<TValue>(value: unknown, isValue: (item: unknown) => item is TValue) {
	if (!isRecord(value)) {
		return undefined;
	}

	const result: Record<string, TValue> = {};

	for (const [name, item] of Object.entries(value)) {
		if (isValue(item)) {
			result[name] = item;
		}
	}

	return result;
}

function readSort(value: unknown, known: ReadonlySet<string> | null): TableSort[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}

	const result: TableSort[] = [];

	for (const item of value) {
		if (
			isRecord(item)
			&& typeof item.name === 'string'
			&& DIRECTIONS.includes(item.direction as SortDirection)
			&& (!known || known.has(item.name))
		) {
			result.push({ name: item.name, direction: item.direction as SortDirection });
		}
	}

	return result;
}

const LAYOUT_READERS: Record<(typeof LAYOUT_FIELDS)[number], (value: unknown) => unknown> = {
	order: readNames,
	hidden: readNames,
	widths: value => readMap(value, isWidth),
	pinned: value => readMap(value, isPinSide),
	collapsed: value => readMap(value, isFlag),
};

/** The remembered fields of a layout that are present; `undefined` when none is. */
function pickLayout(
	layout: unknown,
	remember: ReadonlySet<RememberField>,
	read: (field: (typeof LAYOUT_FIELDS)[number], value: unknown) => unknown,
) {
	if (!isRecord(layout)) {
		return undefined;
	}

	const result: Record<string, unknown> = {};
	let found = false;

	for (const field of LAYOUT_FIELDS) {
		const value = remember.has(field) ? read(field, layout[field]) : undefined;

		if (value !== undefined) {
			result[field] = value;
			found = true;
		}
	}

	return found ? result as Partial<TableLayout> : undefined;
}

/**
 * Column order, hidden columns, widths, pins, collapsed groups and sort in one object, optionally kept
 * in `persist`. The stored record is validated field by field and carries a version; a record of
 * another version is ignored.
 */
export function useTableColumnsState<TColumns extends ColumnsInput = ColumnsInput>(
	options: TableColumnsStateOptions<TColumns> = {},
): TableColumnsState<ColumnName<TColumns>> {
	const sortModel = isRef(options.sort) ? options.sort as Ref<readonly TableSort[]> : undefined;
	const givenSort = isRef(options.sort) ? options.sort.value : options.sort;
	const initialSort: readonly TableSort[] = [...givenSort ?? []];
	const initialLayout = options.layout?.value ?? null;
	const layout = useModelRef<TableLayout | null>(options.layout, null);
	const sort = useModelRef<readonly TableSort[]>(sortModel, [...initialSort]);
	const multiSort = isRef(options.multiSort) ? options.multiSort : ref(options.multiSort ?? false);
	const remember = new Set(options.remember ?? ALL_FIELDS);
	const known = options.columns ? new Set(toColumnList(options.columns).map(column => column.name)) : null;

	function mergeLayout(restored: Partial<TableLayout> | undefined) {
		if (!restored) {
			return layout.value;
		}

		const base = layout.value ?? { order: [], hidden: [], widths: {}, pinned: {} };

		return {
			order: restored.order ?? base.order,
			hidden: restored.hidden ?? base.hidden,
			widths: restored.widths ?? base.widths,
			pinned: restored.pinned ?? base.pinned,
			collapsed: restored.collapsed ?? base.collapsed,
		};
	}

	const stored = computed<StoredState>({
		get: () => ({ layout: layout.value ?? undefined, sort: sort.value }),
		set: (restored) => {
			layout.value = mergeLayout(restored.layout);

			if (restored.sort) {
				sort.value = restored.sort;
			}
		},
	});

	const persisted = options.persist
		? usePersistedState(stored, options.persist, {
			parse: (value) => {
				if (!isRecord(value) || value.version !== STORAGE_VERSION) {
					return undefined;
				}

				return {
					layout: pickLayout(value.layout, remember, (field, item) => LAYOUT_READERS[field](item)),
					sort: remember.has('sort') ? readSort(value.sort, known) : undefined,
				};
			},
			serialize: value => ({
				version: STORAGE_VERSION,
				layout: pickLayout(value.layout, remember, (_field, item) => item),
				sort: remember.has('sort') ? value.sort : undefined,
			}),
		})
		: null;

	function reset() {
		layout.value = initialLayout;
		sort.value = [...initialSort];
		persisted?.forget();
	}

	return {
		layout,
		sort: sort as unknown as Ref<readonly TableSort<ColumnName<TColumns>>[]>,
		multiSort,
		reset,
		ready: persisted?.ready ?? shallowRef(true),
	};
}
