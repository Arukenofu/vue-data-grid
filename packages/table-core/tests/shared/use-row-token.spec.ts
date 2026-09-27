import { effectScope, shallowRef, watchEffect } from 'vue';
import { describe, expect, it, onTestFinished } from 'vitest';

import { type RowToken, useRowToken } from '../../src/shared/use-row-token';

function setup() {
	const scope = effectScope();
	const source = shallowRef<RowToken<string> | null>(null);
	const tokens = scope.run(() => useRowToken(() => source.value))!;
	const runs: Record<string, number> = { a: 0, b: 0 };

	onTestFinished(() => scope.stop());

	for (const row of ['a', 'b']) {
		scope.run(() => watchEffect(() => {
			tokens.get(row);
			runs[row] += 1;
		}, { flush: 'sync' }));
	}

	return { source, tokens, runs };
}

describe('useRowToken', () => {
	it('gives the token to the row that holds it and nothing to the others', () => {
		const { source, tokens } = setup();

		source.value = { row: 'a', token: 'price' };

		expect(tokens.get('a')).toBe('price');
		expect(tokens.get('b')).toBeUndefined();
	});

	it('wakes only the rows the token leaves and enters, a move within a row once', () => {
		const { source, runs } = setup();

		source.value = { row: 'a', token: 'price' };
		source.value = { row: 'a', token: 'cap' };
		source.value = { row: 'b', token: 'cap' };

		expect(runs).toEqual({ a: 4, b: 2 });
	});

	it('takes the token back when the source gives none', () => {
		const { source, tokens } = setup();

		source.value = { row: 'a', token: 'price' };
		source.value = null;

		expect(tokens.get('a')).toBeUndefined();
	});
});
