import { defineColumns, type TableScope, useTableColumnsState, useTableEngine } from '@vue-data-grid/core';
import { defineComponent, h, shallowRef, watch } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { autosizeColumns } from '../../src/columns/autosize-columns';

interface Row {
	id: string;
	price: number;
}

const columns = defineColumns({
	symbol: { value: (row: Row) => row.id, width: 100, minWidth: 20, resizable: true },
	price: { value: (row: Row) => row.price, width: 100, minWidth: 20, resizable: true, maxWidth: 150 },
	cap: { value: (row: Row) => row.price * 2, width: 100 },
	number: { value: (row: Row) => row.id, width: 40, minWidth: 20, resizable: true, kind: 'service' },
});

const rows: Row[] = [{ id: 'a', price: 1 }, { id: 'b', price: 1234567 }];

function mockTextWidths() {
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function measure(this: HTMLElement) {
		return { width: (this.textContent?.length ?? 0) * 10 } as DOMRect;
	});
}

function setup(html = '') {
	const root = shallowRef<HTMLElement | null>(null);
	const state = useTableColumnsState();
	let scope: TableScope | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			scope = useTableEngine<Row>({ columns, rows, root, rowKey: 'id', rowHeight: 30, state }).scope;

			return () => h('div');
		},
	}));

	if (html) {
		const element = document.createElement('div');

		element.innerHTML = html;
		root.value = element;
	}

	return { wrapper, state, scope: scope as unknown as TableScope };
}

let current: ReturnType<typeof setup> | null = null;

afterEach(() => {
	current?.wrapper.unmount();
	current = null;
	vi.restoreAllMocks();
});

describe('autosizeColumns', () => {
	it('measures every shown resizable column and writes the widths in one layout write', () => {
		mockTextWidths();
		current = setup('<i data-tc-column="symbol">12345678</i><i data-tc-column="price">1234</i><i data-tc-column="cap">1234567890</i>');

		const writes = vi.fn();

		watch(current.state.layout, writes, { flush: 'sync' });

		expect(autosizeColumns(current.scope)).toEqual(['symbol', 'price']);
		expect(current.state.layout.value?.widths).toEqual({ symbol: 80, price: 40 });
		expect(writes).toHaveBeenCalledTimes(1);
	});

	it('with names measures only those, and skips a column that is not resizable', () => {
		mockTextWidths();
		current = setup('<i data-tc-column="symbol">12345678</i><i data-tc-column="price">1234</i><i data-tc-column="cap">1234567890</i>');

		expect(autosizeColumns(current.scope, ['price', 'cap'])).toEqual(['price']);
		expect(current.state.layout.value?.widths).toEqual({ price: 40 });
	});

	it('leaves service columns out unless they are named', () => {
		mockTextWidths();
		current = setup('<i data-tc-column="price">1234</i><i data-tc-column="number">123456</i>');

		expect(autosizeColumns(current.scope)).toEqual(['price']);
		expect(autosizeColumns(current.scope, ['number'])).toEqual(['number']);
		expect(current.state.layout.value?.widths).toEqual({ price: 40, number: 60 });
	});

	it('keeps a measured width within `maxWidth`', () => {
		mockTextWidths();
		current = setup('<i data-tc-column="price">1234567890123456</i>');

		autosizeColumns(current.scope, ['price']);

		expect(current.state.layout.value?.widths.price).toBe(150);
	});

	it('with `rows: all` also measures the text of rows that are not rendered', () => {
		mockTextWidths();
		current = setup('<div data-tc-index="0"><i data-tc-column="price"><b>1</b></i></div>');

		autosizeColumns(current.scope, ['price'], { rows: 'all', measureText: text => text.length * 10 });

		expect(current.state.layout.value?.widths.price).toBe(70);
	});

	it('does nothing without a root or without cells', () => {
		current = setup();

		expect(autosizeColumns(current.scope)).toEqual([]);

		current.wrapper.unmount();
		current = setup('<i data-tc-column="other">1</i>');

		expect(autosizeColumns(current.scope, ['price'])).toEqual([]);
		expect(current.state.layout.value).toBeNull();
	});
});
