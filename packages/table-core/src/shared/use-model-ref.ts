import { computed, type Ref, shallowRef, toRaw, watch, type WritableComputedRef } from 'vue';

/**
 * A ref over an optional external model, such as a `v-model`. Reads go to a local copy: `defineModel`
 * returns a written value only after the parent re-renders, and a second change in the same tick
 * must build on the first. Writes go to both, and a change of the model from outside comes into the
 * copy at once. Without a model it is a plain ref starting at `initial`. Shallow: a model is replaced
 * as a whole, never changed in place. The copy holds the raw value, so a model in a deep `ref` reads
 * back the very object written into it.
 */
export function useModelRef<TValue>(model: Ref<TValue> | undefined, initial: TValue): WritableComputedRef<TValue> {
	const local = shallowRef(model ? toRaw(model.value) : initial) as Ref<TValue>;

	if (model) {
		watch(model, (next) => {
			local.value = toRaw(next);
		}, { flush: 'sync' });
	}

	return computed({
		get: () => local.value,
		set: (next) => {
			local.value = next;

			if (model) {
				model.value = next;
			}
		},
	});
}
