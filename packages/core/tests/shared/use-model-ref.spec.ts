import { ref, shallowRef } from 'vue';
import { describe, expect, it } from 'vitest';

import { useModelRef } from '../../src/shared/use-model-ref';

describe('useModelRef', () => {
	it('keeps its own value without a model', () => {
		const value = useModelRef<readonly string[]>(undefined, []);

		value.value = ['a'];

		expect(value.value).toEqual(['a']);
	});

	it('writes to the model and follows a change of the model from outside', () => {
		const model = shallowRef<readonly string[]>(['a']);
		const value = useModelRef(model, []);

		value.value = ['b'];

		expect(model.value).toEqual(['b']);

		model.value = ['c'];

		expect(value.value).toEqual(['c']);
	});

	it('reads back the very object written, with the model in a deep ref', () => {
		const model = ref<readonly { name: string }[]>([]);
		const value = useModelRef(model, []);
		const next = [{ name: 'a' }];

		value.value = next;

		expect(value.value).toBe(next);
	});
});
