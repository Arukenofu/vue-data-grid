import { type CellEditSource, defineColumns, useCellFocus, useCellRanges, useTableEngine } from '@vue-data-grid/core';
import { mount } from '@vue/test-utils';
import { defineComponent, h, type Ref, shallowRef } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadCsv } from '../../src/clipboard/download-csv';
import { type ClipboardEditing, type ClipboardOptions, useClipboard } from '../../src/clipboard/use-clipboard';

interface Row {
	id: string;
	price: number;
	note: string;
}

const columns = defineColumns({
	number: { value: (row: Row) => row.id, label: '#', kind: 'service' },
	id: { value: (row: Row) => row.id, label: 'Id' },
	price: { value: (row: Row) => row.price, label: 'Price', format: (value: number) => value.toFixed(2) },
	note: { value: (row: Row) => row.note, label: 'Note' },
});

const ROWS: Row[] = [{ id: 'a', price: 1, note: '-5 apples' }, { id: 'b', price: 2.5, note: '' }];

const BOM = String.fromCharCode(0xFE_FF);

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	document.body.innerHTML = '';
	document.getSelection()?.removeAllRanges();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

interface EditingStub extends ClipboardEditing {
	cell: Ref<unknown>;
	pasted: string[];
	cleared: CellEditSource[];
}

function createEditing(): EditingStub {
	const pasted: string[] = [];
	const cleared: CellEditSource[] = [];

	return {
		cell: shallowRef(null),
		hasSelection: () => true,
		paste: text => pasted.push(text),
		clear: source => cleared.push(source),
		pasted,
		cleared,
	};
}

function setup(options: ClipboardOptions = {}, editing?: ClipboardEditing) {
	const root = shallowRef<HTMLElement | null>(null);
	let result: {
		ranges: ReturnType<typeof useCellRanges>;
		focus: ReturnType<typeof useCellFocus>;
		clipboard: ReturnType<typeof useClipboard>;
	} | null = null;

	wrapper = mount(defineComponent({
		setup() {
			const engine = useTableEngine<Row>({ columns, rows: ROWS, root, rowKey: 'id', rowHeight: 30 });
			const ranges = useCellRanges(engine.scope);
			const focus = useCellFocus(engine.scope);

			result = { ranges, focus, clipboard: useClipboard({ scope: engine.scope, root, ranges, editing }, { focus, ...options }) };

			return () => h('div', [
				h('p', { id: 'page' }, 'Text on the page'),
				h('div', { ref: root, tabindex: 0 }, [h('input', { id: 'field' }), h('span', { id: 'text' }, 'Cell text')]),
			]);
		},
	}), { attachTo: document.body });

	return { root: root.value as HTMLElement, ...result! };
}

function clipboardEvent(type: 'copy' | 'cut' | 'paste', target: EventTarget, text = '') {
	const data = new Map<string, string>([['text/plain', text]]);
	const event = new Event(type, { bubbles: true, cancelable: true });

	Object.defineProperty(event, 'clipboardData', {
		value: {
			setData: (format: string, value: string) => data.set(format, value),
			getData: (format: string) => data.get(format) ?? '',
		},
	});
	target.dispatchEvent(event);

	return { event, data };
}

function select(element: Element) {
	const range = document.createRange();

	range.selectNodeContents(element);
	document.getSelection()?.removeAllRanges();
	document.getSelection()?.addRange(range);
}

describe('useClipboard — copy', () => {
	it('a copy from the table puts the last range on the clipboard as TSV through `format`', () => {
		const { root, ranges } = setup();

		ranges.select({ key: 'a', column: 'id' });
		ranges.select({ key: 'b', column: 'price' }, 'extend');

		const { event, data } = clipboardEvent('copy', root);

		expect(event.defaultPrevented).toBe(true);
		expect(data.get('text/plain')).toBe('a\t1.00\r\nb\t2.50');
	});

	it('copies text as it is, with nothing added to what looks like a formula', () => {
		const { root, ranges } = setup();

		ranges.select({ key: 'a', column: 'note' });

		expect(clipboardEvent('copy', root).data.get('text/plain')).toBe('-5 apples');
	});

	it('with `headers` the text starts with the column labels', () => {
		const { root, ranges } = setup({ headers: true });

		ranges.select({ key: 'b', column: 'price' });

		expect(clipboardEvent('copy', root).data.get('text/plain')).toBe('Price\r\n2.50');
	});

	it('without a range the focused cell is copied, an empty one as an empty line', () => {
		const { clipboard, focus } = setup();

		focus.focus({ key: 'b', column: 'price' }, { reveal: false });

		expect(clipboard.getText()).toBe('2.50');

		focus.focus({ key: 'b', column: 'note' }, { reveal: false });

		expect(clipboard.getText()).toBe('\r\n');
	});

	it('a copy from a text field, of text selected in the table, or with nothing to copy, is left to the browser', () => {
		const { root, ranges } = setup();

		expect(clipboardEvent('copy', root).event.defaultPrevented).toBe(false);

		ranges.select({ key: 'a', column: 'id' });

		expect(clipboardEvent('copy', root.querySelector('#field') as HTMLElement).event.defaultPrevented).toBe(false);

		select(root.querySelector('#text') as HTMLElement);

		expect(clipboardEvent('copy', root).event.defaultPrevented).toBe(false);
	});

	it('text selected elsewhere on the page does not keep a copy of the cells', () => {
		const { root, ranges } = setup();

		ranges.select({ key: 'a', column: 'id' });
		select(document.getElementById('page') as HTMLElement);

		expect(clipboardEvent('copy', root).data.get('text/plain')).toBe('a');
	});

	it('`copy` writes through `navigator.clipboard` and tells whether it could', async () => {
		const writeText = vi.fn(() => Promise.resolve());

		vi.stubGlobal('navigator', { clipboard: { writeText } });

		const { ranges, clipboard } = setup();

		expect(await clipboard.copy()).toBe(false);

		ranges.select({ key: 'a', column: 'price' });

		expect(await clipboard.copy()).toBe(true);
		expect(writeText).toHaveBeenCalledWith('1.00');
	});

	it('`copy` gives `false` when the browser refuses, and throws any other error', async () => {
		const writeText = vi.fn(() => Promise.reject(new DOMException('Denied', 'NotAllowedError')));

		vi.stubGlobal('navigator', { clipboard: { writeText } });

		const { ranges, clipboard } = setup();

		ranges.select({ key: 'a', column: 'price' });

		expect(await clipboard.copy()).toBe(false);

		writeText.mockImplementation(() => Promise.reject(new TypeError('Broken')));

		await expect(clipboard.copy()).rejects.toThrow('Broken');
	});
});

describe('useClipboard — cut and paste', () => {
	it('a cut copies the cells and clears them through the editing, as a cut', () => {
		const editing = createEditing();
		const { root, ranges } = setup({}, editing);

		ranges.select({ key: 'a', column: 'id' });

		const { event, data } = clipboardEvent('cut', root);

		expect(event.defaultPrevented).toBe(true);
		expect(data.get('text/plain')).toBe('a');
		expect(editing.cleared).toEqual(['cut']);
	});

	it('Ctrl+X and Ctrl+C put the same text on the clipboard', () => {
		const editing = createEditing();
		const { root, ranges } = setup({ headers: true }, editing);

		ranges.select({ key: 'a', column: 'id' });
		ranges.select({ key: 'b', column: 'price' }, 'extend');

		expect(clipboardEvent('cut', root).data.get('text/plain')).toBe(clipboardEvent('copy', root).data.get('text/plain'));
	});

	it('a paste goes to the editing, and without it the paste is the page\'s', () => {
		const editing = createEditing();
		const { root } = setup({}, editing);
		const { event } = clipboardEvent('paste', root, 'x\ty');

		expect(event.defaultPrevented).toBe(true);
		expect(editing.pasted).toEqual(['x\ty']);

		wrapper?.unmount();

		const plain = setup();

		expect(clipboardEvent('paste', plain.root, 'x').event.defaultPrevented).toBe(false);
	});

	it('an editor keeps the clipboard while a cell is edited', () => {
		const editing = createEditing();
		const { root, ranges } = setup({}, editing);

		ranges.select({ key: 'a', column: 'id' });
		editing.cell.value = { key: 'a', column: 'id' };

		expect(clipboardEvent('cut', root).event.defaultPrevented).toBe(false);
		expect(clipboardEvent('paste', root, 'x').event.defaultPrevented).toBe(false);
		expect(editing.cleared).toEqual([]);
		expect(editing.pasted).toEqual([]);
	});
});

describe('downloadCsv', () => {
	it('downloads the text with a byte order mark under a `.csv` name, and lets the file go later', async () => {
		vi.useFakeTimers();

		const blobs: Blob[] = [];
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

		vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
			blobs.push(blob as Blob);

			return 'blob:csv';
		});

		downloadCsv('a,b', { name: 'quotes' });

		expect(click).toHaveBeenCalledOnce();
		expect(click.mock.contexts[0]).toMatchObject({ download: 'quotes.csv' });
		expect(await blobs[0].text()).toBe(`${BOM}a,b`);

		vi.advanceTimersByTime(1000);

		expect(revoke).not.toHaveBeenCalled();

		vi.runAllTimers();

		expect(revoke).toHaveBeenCalledWith('blob:csv');
	});
});
