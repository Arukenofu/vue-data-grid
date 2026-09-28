import type { AnyColumnInput } from '@vue-data-grid/engine';
import { afterEach, describe, expect, it } from 'vitest';

import { type BrowserGrid, type BrowserRow, mountBrowserGrid } from './support/browser-grid';

let grid: BrowserGrid | null = null;

afterEach(() => {
	grid?.unmount();
	grid = null;
});

const COLUMNS: Record<string, AnyColumnInput> = {
	pinned: { value: (row: BrowserRow) => row.id, label: 'Pinned', width: 120, pinned: 'start' },
	name: { value: (row: BrowserRow) => row.name, label: 'Name', width: 150, resizable: true },
	value: { value: (row: BrowserRow) => row.value, label: 'Value', width: 300, resizable: true },
};

describe('style.css in a browser', () => {
	it('keeps the resize handle of a column scrolled under a pinned one under it too', async () => {
		grid = mountBrowserGrid({ columns: COLUMNS, width: 300 });

		const pinned = grid.head.querySelector('[data-dg-column="pinned"]') as HTMLElement;
		const handle = grid.head.querySelector('[data-dg-column="name"] [data-dg-part="resize-handle"]') as HTMLElement;

		// The end edge of `name`, and its handle, go under the pinned cell.
		grid.root.scrollLeft = 200;
		await expect.poll(() => handle.getBoundingClientRect().right).toBeLessThan(pinned.getBoundingClientRect().right);

		const box = handle.getBoundingClientRect();
		const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);

		expect(pinned.contains(hit)).toBe(true);
	});

	it('lines up the cells of a `flex` column in every row, whatever the length of their text', async () => {
		grid = mountBrowserGrid({
			width: 360,
			columns: {
				name: { value: (row: BrowserRow) => row.name, label: 'Name', width: 120, flex: 1 },
				code: { value: (row: BrowserRow) => row.id, label: 'Code', width: 90 },
				value: { value: (row: BrowserRow) => row.value, label: 'Value', width: 90 },
			},
		});
		await expect.poll(() => grid?.cell(7, 'code') ?? null).not.toBeNull();

		const lefts = [0, 1, 7, 14].map(index => grid?.cell(index, 'code')?.getBoundingClientRect().left);
		const rows = [0, 1, 7, 14].map(index => grid?.row(index)?.getBoundingClientRect().width);

		expect(new Set(lefts).size).toBe(1);
		expect(new Set(rows).size).toBe(1);
	});
});
