import { onMounted, type Ref, shallowRef, watch } from 'vue';

/**
 * The element, exposed only once the component is mounted and following the source after that.
 * Before mount the windows render their server set, so the server and the hydration frame agree.
 */
export function useMountedElement(source: Ref<HTMLElement | null>) {
	const element = shallowRef<HTMLElement | null>(null);

	let mounted = false;

	watch(source, (next) => {
		if (mounted) {
			element.value = next;
		}
	}, { flush: 'sync' });

	onMounted(() => {
		mounted = true;
		element.value = source.value;
	});

	return element;
}
