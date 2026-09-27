import { shallowReactive, watch } from 'vue';

/** The row that holds a token now, such as the focused column of the focused row. */
export interface RowToken<TToken> {
	/** The row: its key, or any id of a row. */
	row: string;
	token: TToken;
}

/**
 * A token that one row holds at a time, such as the focused or the edited column, read per row:
 * `get(row)` is tracked for that row alone, so when the token moves, only the row it leaves and the
 * row it enters wake, not every reader. A move within one row wakes that row once.
 */
export function useRowToken<TToken>(source: () => RowToken<TToken> | null) {
	const tokens = shallowReactive(new Map<string, TToken>());

	watch(source, (next, previous) => {
		// A move along the row only sets its entry: a delete first would wake the row twice.
		if (previous && previous.row !== next?.row) {
			tokens.delete(previous.row);
		}

		if (next) {
			tokens.set(next.row, next.token);
		}
	}, { flush: 'sync', immediate: true });

	return {
		/** The token of the row; `undefined` in any other row. */
		get: (row: string) => tokens.get(row),
	};
}
