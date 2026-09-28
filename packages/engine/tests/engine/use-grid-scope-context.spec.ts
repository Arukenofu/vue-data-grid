import { defineComponent, h, provide } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { GRID_SCOPE } from '../../src/engine/scope';
import type { GridScope } from '../../src/engine/scope';
import { useGridScopeContext } from '../../src/engine/use-grid-scope-context';

const child = (onScope: (scope: GridScope) => void) => defineComponent({
	setup() {
		onScope(useGridScopeContext());

		return () => null;
	},
});

describe('useGridScopeContext', () => {
	it('takes the scope provided higher up the tree', () => {
		const scope = { rows: [] } as unknown as GridScope;
		let seen: GridScope | null = null;

		const wrapper = mount(defineComponent({
			setup() {
				provide(GRID_SCOPE, scope);

				return () => h(child((given) => {
					seen = given;
				}));
			},
		}));

		expect(seen).toBe(scope);

		wrapper.unmount();
	});

	it('throws outside a grid instead of returning `null`', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		expect(() => mount(child(() => undefined))).toThrow('must be called inside a component below createGridScopeContext()');
	});

	it('gives its fallback outside a grid', () => {
		let seen: unknown;

		mount(defineComponent({
			setup() {
				seen = useGridScopeContext(null);

				return () => null;
			},
		})).unmount();

		expect(seen).toBeNull();
	});

	it('takes the nearest scope: a nested grid shadows the outer one', () => {
		const outer = { rows: 'outer' } as unknown as GridScope;
		const inner = { rows: 'inner' } as unknown as GridScope;
		let seen: GridScope | null = null;

		const middle = defineComponent({
			setup() {
				provide(GRID_SCOPE, inner);

				return () => h(child((given) => {
					seen = given;
				}));
			},
		});

		const wrapper = mount(defineComponent({
			setup() {
				provide(GRID_SCOPE, outer);

				return () => h(middle);
			},
		}));

		expect(seen).toBe(inner);

		wrapper.unmount();
	});
});
