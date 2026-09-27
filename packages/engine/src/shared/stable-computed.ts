import { computed } from 'vue';

/**
 * A `computed` that receives its previous result, so it can return the same reference when nothing
 * really changed: row, cell and column-window caches rely on reference equality.
 */
export function stableComputed<TValue, TInitial = TValue>(
	initial: TInitial,
	resolve: (previous: TValue | TInitial) => TValue,
) {
	let previous: TValue | TInitial = initial;

	return computed(() => {
		const next = resolve(previous);

		previous = next;

		return next;
	});
}
