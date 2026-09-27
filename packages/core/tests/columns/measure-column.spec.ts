import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { measureColumnsContent } from '../../src/columns/measure-column';

function measure(this: HTMLElement) {
	return { width: (this.textContent?.length ?? 0) * 10 + 8 } as DOMRect;
}

let root: HTMLElement;

beforeEach(() => {
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(measure);
	root = document.createElement('div');
	root.innerHTML = [
		'<div role="row"><span data-dg-column="price">Price</span><span data-dg-column="cap">Cap</span></div>',
		'<div data-dg-index="0"><span data-dg-column="price"><b>12.5</b></span><span data-dg-column="cap">1</span></div>',
		'<div data-dg-index="1"><span data-dg-column="price"><b>3</b></span><span data-dg-column="cap">22</span></div>',
	].join('');
	document.body.append(root);
});

afterEach(() => {
	root.remove();
	vi.restoreAllMocks();
});

describe('measureColumnsContent', () => {
	it('measures several columns at once and removes the copies', () => {
		const widths = measureColumnsContent(root, ['price', 'cap', 'missing']);

		expect([...widths]).toEqual([['price', 58], ['cap', 38]]);
		expect(root.querySelectorAll('[aria-hidden]')).toHaveLength(0);
	});

	it('with texts it also covers rows outside the window: the text plus what the body cell adds to it', () => {
		const texts = new Map([['price', ['1', '123456789.00', '42']]]);
		const widths = measureColumnsContent(root, ['price'], {
			texts,
			measureText: text => text.length * 10,
		});

		expect(widths.get('price')).toBe(128);
	});

	it('without a way to measure text the rendered measurement stays', () => {
		const texts = new Map([['price', ['123456789.00']]]);
		const widths = measureColumnsContent(root, ['price'], { texts, measureText: () => null });

		expect(widths.get('price')).toBe(58);
	});

	it('columns without rendered cells are left out', () => {
		expect([...measureColumnsContent(root, ['cap', 'missing']).keys()]).toEqual(['cap']);
	});
});
