import { inject, provide } from 'vue';

import { GRID_SCOPE, type GridScope } from './scope';

/** Provides the scope to components below, which take it with `useGridScopeContext()`. */
export function createGridScopeContext<TRow>(scope: GridScope<TRow>) {
	provide(GRID_SCOPE, scope as GridScope);

	return scope;
}

/**
 * The scope provided above. `TRow` is not checked against the provided scope, just as with `inject`:
 * name the row type of the engine that provided it. Throws outside a grid, unless given a
 * `fallback`, such as `null`.
 */
export function useGridScopeContext<TRow = unknown>(): GridScope<TRow>;
export function useGridScopeContext<TRow = unknown, TFallback = null>(fallback: TFallback): GridScope<TRow> | TFallback;
export function useGridScopeContext(...fallback: unknown[]) {
	const scope = inject(GRID_SCOPE, null);

	if (scope) {
		return scope;
	}

	if (fallback.length > 0) {
		return fallback[0];
	}

	throw new Error('useGridScopeContext() must be called inside a component below createGridScopeContext()');
}
