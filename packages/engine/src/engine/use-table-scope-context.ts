import { inject, provide } from 'vue';

import { TABLE_SCOPE, type TableScope } from './scope';

/** Provides the scope to components below, which take it with `useTableScopeContext()`. */
export function createTableScopeContext<TRow>(scope: TableScope<TRow>) {
	provide(TABLE_SCOPE, scope as TableScope);

	return scope;
}

/**
 * The scope provided above. `TRow` is not checked against the provided scope, just as with `inject`:
 * name the row type of the engine that provided it. Throws outside a table, unless given a
 * `fallback`, such as `null`.
 */
export function useTableScopeContext<TRow = unknown>(): TableScope<TRow>;
export function useTableScopeContext<TRow = unknown, TFallback = null>(fallback: TFallback): TableScope<TRow> | TFallback;
export function useTableScopeContext(...fallback: unknown[]) {
	const scope = inject(TABLE_SCOPE, null);

	if (scope) {
		return scope;
	}

	if (fallback.length > 0) {
		return fallback[0];
	}

	throw new Error('useTableScopeContext() must be called inside a component below createTableScopeContext()');
}
