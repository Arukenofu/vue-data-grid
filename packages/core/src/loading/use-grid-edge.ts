import type { GridScope } from '@vue-data-grid/engine';
import {
	computed,
	type ComputedRef,
	type MaybeRefOrGetter,
	onScopeDispose,
	type Ref,
	shallowRef,
	toValue,
	watch,
} from 'vue';

import type { DataGrid } from '../data-grid/use-data-grid';

/**
 * An edge of the grid more can be loaded at: `'top'` and `'bottom'` of the rows, `'start'` and `'end'`
 * of the columns, in the reading direction.
 */
export type GridEdge = 'top' | 'bottom' | 'start' | 'end';

/** An edge of the rows: where `GridPlaceholderRows` stand. */
export type GridRowEdge = Extract<GridEdge, 'top' | 'bottom'>;

/** What `onReach` of `useGridEdge` gets. */
export interface GridEdgeContext {
	/** The edge that was reached. */
	edge: GridEdge;
}

/** The options of `useGridEdge`: the edge, what to do there, and when it counts as reached. */
export interface GridEdgeOptions {
	/** The edge to watch. Read once. */
	edge: GridEdge;
	/**
	 * Loads more at the edge, such as `fetchNextPage` of TanStack Query, and adds it to the rows or the
	 * columns yourself. Called when the rows or the columns in view come within `threshold` of the edge,
	 * and again when more came in and the edge is still that close. A promise it returns holds further
	 * calls until it settles.
	 */
	onReach: (context: GridEdgeContext) => unknown;
	/** Whether there is more to load at the edge, such as `hasNextPage`; `true` by default. */
	hasMore?: MaybeRefOrGetter<boolean>;
	/**
	 * Whether a load is on its way that `onReach` did not return, such as `isFetching` of a query that
	 * loads both edges: the edge waits for it as for a pending promise, and is called once it is over if
	 * it is still reached. `false` by default.
	 */
	busy?: MaybeRefOrGetter<boolean>;
	/**
	 * How many rows, or columns at `'start'` and `'end'`, may be left between the ones in view and the
	 * edge when it counts as reached: `10` rows or `2` columns by default.
	 */
	threshold?: MaybeRefOrGetter<number>;
}

/** What `useGridEdge` returns. */
export interface GridEdgeWatch {
	/** Whether the rows or columns in view are within `threshold` of the edge now. */
	reached: ComputedRef<boolean>;
	/** Whether the promise the last `onReach` returned is still unsettled. */
	pending: Readonly<Ref<boolean>>;
}

const DEFAULT_THRESHOLD: Readonly<Record<GridEdge, number>> = { top: 10, bottom: 10, start: 2, end: 2 };

/** How many rows or scrolling columns lie between the ones in view and the edge; `null` for none in view. */
function getDistance(scope: GridScope, edge: GridEdge) {
	if (edge === 'top' || edge === 'bottom') {
		const { start, end } = scope.visibleRowRange.value;

		if (end <= start) {
			return null;
		}

		return edge === 'top' ? start : scope.rows.value.length - end;
	}

	const { start, end } = scope.visibleColumnRange.value;

	if (end <= start) {
		return null;
	}

	const scrolling = scope.scrollingColumnRange.value;

	return edge === 'start' ? start - scrolling.start : scrolling.end - end;
}

function isPromise(value: unknown): value is PromiseLike<unknown> {
	return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}

/**
 * Tells when to load more at an edge of the grid, for infinite scrolling in any direction. It does not
 * load: `onReach` does, with the data layer you like, and puts what it got into the rows or the
 * columns. At the top the grid keeps the rows in view in place as rows come in above them, even at
 * the very top, while this edge is watched.
 *
 * An empty grid, or one not mounted yet, reaches no edge: the first page is yours to load. After a
 * call the edge is not called again until the rows or columns change, or the edge is left and reached
 * again, so a load that brought nothing does not repeat on its own. Returns `reached`, whether the
 * edge is within `threshold` now, and `pending`, whether the promise of the last call is unsettled.
 *
 * At `'start'` the grid does not keep the columns in view in place yet: scroll the root by the width
 * of the columns added, or they push the ones in view away and the edge is reached again at once.
 */
export function useGridEdge(grid: Pick<DataGrid, 'scope' | 'holdAnchorAtTop'>, options: GridEdgeOptions): GridEdgeWatch {
	const { scope } = grid;
	const { edge } = options;
	const pending = shallowRef(false);
	const rowsEdge = edge === 'top' || edge === 'bottom';

	if (edge === 'top') {
		onScopeDispose(grid.holdAnchorAtTop());
	}

	// The list itself, not its length: a new list of the same length, such as another query, is new.
	const list = computed<readonly unknown[]>(() => (rowsEdge ? scope.rows.value : scope.columns.value));

	const reached = computed(() => {
		const distance = getDistance(scope, edge);

		return distance !== null && distance <= (toValue(options.threshold) ?? DEFAULT_THRESHOLD[edge]);
	});

	// The list at the last call while the edge stayed reached.
	let calledAt: readonly unknown[] | null = null;

	function settle() {
		pending.value = false;
	}

	function isWaiting() {
		return pending.value || (toValue(options.busy) ?? false);
	}

	watch([reached, () => toValue(options.hasMore) ?? true, list, isWaiting], ([isReached, hasMore, current, waiting]) => {
		if (!isReached) {
			calledAt = null;

			return;
		}

		if (!hasMore || waiting || current === calledAt) {
			return;
		}

		calledAt = current;

		const result = options.onReach({ edge });

		if (isPromise(result)) {
			pending.value = true;
			// Not awaited: a failed load rejects on to be reported, and the edge only stops waiting for it.
			void result.then(settle, (error: unknown) => {
				settle();
				throw error;
			});
		}
	}, { immediate: true });

	return { reached, pending };
}
