const COLLATOR = new Intl.Collator('en', { numeric: true });

/** `null`, `undefined` or `NaN`: a missing value, sorted last in either direction. */
export function isEmptyValue(value: unknown) {
	return value === null || value === undefined || Number.isNaN(value);
}

function toNumber(value: unknown) {
	if (typeof value === 'number') {
		return value;
	}

	return value instanceof Date ? value.getTime() : null;
}

/**
 * The default comparison: numbers, bigints and dates by magnitude, `false` before `true`, everything
 * else as strings with a numeric collator, so `A9` comes before `A10`. The locale is fixed to `en`
 * (the root Unicode rules) so that the server and the browser sort alike; use a column's `compare`
 * for another one.
 */
export function compareValues(a: unknown, b: unknown) {
	const first = toNumber(a);
	const second = toNumber(b);

	if (first !== null && second !== null) {
		return first - second;
	}

	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return Number(a) - Number(b);
	}

	if (typeof a === 'bigint' && typeof b === 'bigint') {
		return Number(a > b) - Number(a < b);
	}

	return COLLATOR.compare(String(a), String(b));
}
