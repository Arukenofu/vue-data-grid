import { defineComponent, effectScope, h, nextTick, shallowRef, withDirectives } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { type DragItemBinding, vDragItem } from '../src/drag-item-directive';
import { vDragItemVapor } from '../src/drag-item-vapor';
import type { DragList } from '../src/use-drag-list';

function createLog() {
	const log: string[] = [];
	const list: DragList = {
		register: (element, key) => {
			log.push(`register ${key} on ${element.textContent}`);

			return () => log.push(`release ${key}`);
		},
	};

	return { log, list };
}

describe('vDragItem — components with a virtual DOM', () => {
	it('registers on mount, follows a change of key and releases on unmount', async () => {
		const { log, list } = createLog();
		const rows = shallowRef([{ id: 'a', key: 'a' }, { id: 'b', key: 'b' }]);

		const wrapper = mount(defineComponent({
			setup: () => () => h('div', rows.value.map(row =>
				withDirectives(h('div', { key: row.id }, row.id), [[vDragItem, { list, key: row.key }]]))),
		}));

		rows.value = [{ id: 'a', key: 'a2' }];
		await nextTick();
		wrapper.unmount();

		expect(log).toEqual(['register a on a', 'register b on b', 'release a', 'register a2 on a', 'release b', 'release a2']);
	});

	it('`key: null` takes the element out of dragging', async () => {
		const { log, list } = createLog();
		const key = shallowRef<string | null>('a');

		const wrapper = mount(defineComponent({
			setup: () => () => withDirectives(h('div', 'a'), [[vDragItem, { list, key: key.value }]]),
		}));

		key.value = null;
		await nextTick();
		wrapper.unmount();

		expect(log).toEqual(['register a on a', 'release a']);
	});
});

describe('vDragItemVapor — the Vapor contract of Vue 3.6', () => {
	it('is called once with a getter, follows it, and releases through its cleanup', () => {
		const { log, list } = createLog();
		const binding = shallowRef<DragItemBinding | null>({ list, key: 'a' });
		const element = document.createElement('div');
		const scope = effectScope();

		element.textContent = 'row';

		const cleanup = scope.run(() => vDragItemVapor(element, () => binding.value));

		binding.value = { list, key: 'b' };
		binding.value = null;
		binding.value = { list, key: 'c' };
		cleanup?.();
		binding.value = { list, key: 'd' };
		scope.stop();

		expect(log).toEqual(['register a on row', 'release a', 'register b on row', 'release b', 'register c on row', 'release c']);
	});

	it('the same list and key again do not re-register', () => {
		const { log, list } = createLog();
		const binding = shallowRef<DragItemBinding>({ list, key: 'a' });
		const scope = effectScope();

		scope.run(() => vDragItemVapor(document.createElement('div'), () => binding.value));
		binding.value = { list, key: 'a' };
		scope.stop();

		expect(log.filter(line => line.startsWith('register'))).toHaveLength(1);
	});
});
