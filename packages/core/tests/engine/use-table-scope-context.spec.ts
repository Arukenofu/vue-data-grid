import { defineComponent, h, provide } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { TABLE_SCOPE } from '../../src/engine/scope';
import type { TableScope } from '../../src/engine/scope';
import { useTableScopeContext } from '../../src/engine/use-table-scope-context';

const child = (onScope: (scope: TableScope) => void) => defineComponent({
	setup() {
		onScope(useTableScopeContext());

		return () => null;
	},
});

describe('useTableScopeContext', () => {
	it('takes the scope provided higher up the tree', () => {
		const scope = { rows: [] } as unknown as TableScope;
		let seen: TableScope | null = null;

		const wrapper = mount(defineComponent({
			setup() {
				provide(TABLE_SCOPE, scope);

				return () => h(child((given) => {
					seen = given;
				}));
			},
		}));

		expect(seen).toBe(scope);

		wrapper.unmount();
	});

	it('throws outside a table instead of returning `null`', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		expect(() => mount(child(() => undefined))).toThrow('must be called inside a component below createTableScopeContext()');
	});

	it('gives its fallback outside a table', () => {
		let seen: unknown;

		mount(defineComponent({
			setup() {
				seen = useTableScopeContext(null);

				return () => null;
			},
		})).unmount();

		expect(seen).toBeNull();
	});

	it('takes the nearest scope: a nested table shadows the outer one', () => {
		const outer = { rows: 'outer' } as unknown as TableScope;
		const inner = { rows: 'inner' } as unknown as TableScope;
		let seen: TableScope | null = null;

		const middle = defineComponent({
			setup() {
				provide(TABLE_SCOPE, inner);

				return () => h(child((given) => {
					seen = given;
				}));
			},
		});

		const wrapper = mount(defineComponent({
			setup() {
				provide(TABLE_SCOPE, outer);

				return () => h(middle);
			},
		}));

		expect(seen).toBe(inner);

		wrapper.unmount();
	});
});
