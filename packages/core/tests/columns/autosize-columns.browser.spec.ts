import { afterEach, describe, expect, it } from 'vitest';

import { autosizeColumns } from '../../src/columns/autosize-columns';
import { type BrowserGrid, mountBrowserGrid } from '../support/browser-grid';

let grid: BrowserGrid | null = null;

afterEach(() => {
	grid?.unmount();
	grid = null;
});

function getCells(name: string) {
	return [...(grid?.root.querySelectorAll<HTMLElement>(`[data-dg-column="${name}"]`) ?? [])];
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
		grid = mountBrowserGrid();
		await expect.poll(() => getCells('name').some(isClipped)).toBe(true);

		expect(autosizeColumns(grid.scope, ['name'])).toEqual(['name']);

		await expect.poll(() => getCells('name').some(isClipped)).toBe(false);

		const widest = Math.max(...getCells('name').map(getTextWidth));
		const width = grid.scope.getWidth('name');

		// The cell padding of the structural styles is 8px on each side.
		expect(width).toBeGreaterThanOrEqual(Math.floor(widest + 16));
		expect(width).toBeLessThanOrEqual(Math.ceil(widest + 16) + 1);
	});

	it('with `rows: all` also fits the text of rows outside the row window', async () => {
		grid = mountBrowserGrid();
		await expect.poll(() => getCells('name').length).toBeGreaterThan(0);

		autosizeColumns(grid.scope, ['name'], { rows: 'all' });
		grid.scope.scrollToRow(196, 'center');

		await expect.poll(() => grid?.cell(196, 'name') ?? null).not.toBeNull();

		const cell = grid.cell(196, 'name') as HTMLElement;

		expect(cell.textContent).toBe('A considerably longer name 196');
		await expect.poll(() => isClipped(cell)).toBe(false);
	});

	it('keeps the padding a theme gives the cells through `--dg-cell-padding`', async () => {
		grid = mountBrowserGrid();
		grid.root.style.setProperty('--dg-cell-padding', '0 24px');
		await expect.poll(() => getCells('name').length).toBeGreaterThan(0);

		autosizeColumns(grid.scope, ['name']);

		const widest = Math.max(...getCells('name').map(getTextWidth));

		expect(grid.scope.getWidth('name')).toBeGreaterThanOrEqual(Math.floor(widest + 48));
		await expect.poll(() => getCells('name').some(isClipped)).toBe(false);
	});

	it('fits a `flex` column by its content, not by the room it grows into', async () => {
		grid = mountBrowserGrid({
			columns: {
				name: { value: (row: { name: string }) => row.name, label: 'Name', width: 60, flex: 1, resizable: true },
			},
		});
		await expect.poll(() => getCells('name').length).toBeGreaterThan(0);

		autosizeColumns(grid.scope, ['name']);

		const widest = Math.max(...getCells('name').map(getTextWidth));

		expect(grid.scope.getWidth('name')).toBeLessThanOrEqual(Math.ceil(widest + 16) + 1);
	});
});
