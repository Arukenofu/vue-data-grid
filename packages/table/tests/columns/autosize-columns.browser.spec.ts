import { afterEach, describe, expect, it } from 'vitest';

import { autosizeColumns } from '../../src/columns/autosize-columns';
import { type BrowserTable, mountBrowserTable } from '../support/browser-table';

let table: BrowserTable | null = null;

afterEach(() => {
	table?.unmount();
	table = null;
});

function getCells(name: string) {
	return [...(table?.root.querySelectorAll<HTMLElement>(`[data-tc-column="${name}"]`) ?? [])];
}

const isClipped = (cell: HTMLElement) => cell.scrollWidth > cell.clientWidth;

/** The width of the whole text of a cell, overflow included: a flex item of a narrow cell is shrunk to its longest word. */
function getTextWidth(cell: HTMLElement) {
	const range = document.createRange();

	range.selectNodeContents(cell.querySelector('span') ?? cell);

	return range.getBoundingClientRect().width;
}

describe('autosizeColumns in a browser', () => {
	it('fits a column to its widest rendered cell, padding included, and nothing stays clipped', async () => {
		table = mountBrowserTable();
		await expect.poll(() => getCells('name').some(isClipped)).toBe(true);

		expect(autosizeColumns(table.scope, ['name'])).toEqual(['name']);

		await expect.poll(() => getCells('name').some(isClipped)).toBe(false);

		const widest = Math.max(...getCells('name').map(getTextWidth));
		const width = table.scope.getWidth('name');

		// The cell padding of the structural styles is 8px on each side.
		expect(width).toBeGreaterThanOrEqual(Math.floor(widest + 16));
		expect(width).toBeLessThanOrEqual(Math.ceil(widest + 16) + 1);
	});

	it('with `rows: all` also fits the text of rows outside the row window', async () => {
		table = mountBrowserTable();
		await expect.poll(() => getCells('name').length).toBeGreaterThan(0);

		autosizeColumns(table.scope, ['name'], { rows: 'all' });
		table.scope.scrollToRow(196, 'center');

		await expect.poll(() => table?.cell(196, 'name') ?? null).not.toBeNull();

		const cell = table.cell(196, 'name') as HTMLElement;

		expect(cell.textContent).toBe('A considerably longer name 196');
		await expect.poll(() => isClipped(cell)).toBe(false);
	});

	it('keeps the padding a theme gives the cells through `--tc-cell-padding`', async () => {
		table = mountBrowserTable();
		table.root.style.setProperty('--tc-cell-padding', '0 24px');
		await expect.poll(() => getCells('name').length).toBeGreaterThan(0);

		autosizeColumns(table.scope, ['name']);

		const widest = Math.max(...getCells('name').map(getTextWidth));

		expect(table.scope.getWidth('name')).toBeGreaterThanOrEqual(Math.floor(widest + 48));
		await expect.poll(() => getCells('name').some(isClipped)).toBe(false);
	});

	it('fits a `flex` column by its content, not by the room it grows into', async () => {
		table = mountBrowserTable({
			columns: {
				name: { value: (row: { name: string }) => row.name, label: 'Name', width: 60, flex: 1, resizable: true },
			},
		});
		await expect.poll(() => getCells('name').length).toBeGreaterThan(0);

		autosizeColumns(table.scope, ['name']);

		const widest = Math.max(...getCells('name').map(getTextWidth));

		expect(table.scope.getWidth('name')).toBeLessThanOrEqual(Math.ceil(widest + 16) + 1);
	});
});
