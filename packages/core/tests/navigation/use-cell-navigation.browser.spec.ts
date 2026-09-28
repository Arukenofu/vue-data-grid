import { shallowRef } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { type BrowserGrid, createRows, mountBrowserGrid, ROW_HEIGHT } from '../support/browser-grid';

let grid: BrowserGrid | null = null;

afterEach(() => {
	grid?.unmount();
	grid = null;
});

/** The body row and column of the element with DOM focus. */
function getFocused() {
	const cell = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	const row = cell?.closest<HTMLElement>('[data-dg-grid-section]');

	return cell && row
		? { section: row.dataset.dgGridSection, row: Number(row.dataset.dgGridRow), column: cell.dataset.dgColumn }
		: null;
}

/** Whether the element is in the scroll viewport between the sticky header and footer. */
function isClear(element: HTMLElement) {
	const rect = element.getBoundingClientRect();
	const top = grid?.head.getBoundingClientRect().bottom ?? 0;
	const bottom = grid?.foot?.getBoundingClientRect().top ?? grid?.root.getBoundingClientRect().bottom ?? 0;

	return rect.top >= top - 0.5 && rect.bottom <= bottom + 0.5;
}

async function focusCell(index: number, column: string) {
	await expect.poll(() => grid?.cell(index, column) ?? null).not.toBeNull();
	grid?.cell(index, column)?.focus();
}

describe('useCellNavigation in a browser', () => {
	it('an arrow brings the next cell out from under the sticky header', async () => {
		grid = mountBrowserGrid({ navigation: true });
		await focusCell(12, 'name');

		// Body rows start below the header, which covers the top of the viewport: row 11 now stands half
		// under it.
		grid.root.scrollTop = 11 * ROW_HEIGHT + ROW_HEIGHT / 2;
		await expect.poll(() => isClear(grid?.row(11) as HTMLElement)).toBe(false);

		await userEvent.keyboard('{ArrowUp}');

		await expect.poll(getFocused).toEqual({ section: 'body', row: 11, column: 'name' });
		await expect.poll(() => isClear(document.activeElement as HTMLElement)).toBe(true);
	});

	it('an arrow brings the next cell out from under the sticky footer', async () => {
		grid = mountBrowserGrid({ navigation: true, footer: true });
		await focusCell(0, 'name');

		for (let press = 0; press < 12; press += 1) {
			await userEvent.keyboard('{ArrowDown}');
		}

		await expect.poll(getFocused).toEqual({ section: 'body', row: 12, column: 'name' });
		await expect.poll(() => isClear(document.activeElement as HTMLElement)).toBe(true);
	});

	it('PageDown moves by the rows that fit between the sticky edges', async () => {
		grid = mountBrowserGrid({ navigation: true, footer: true });
		await focusCell(0, 'value');

		const step = grid.scope.getPageStep(0, 'down');

		await userEvent.keyboard('{PageDown}');

		await expect.poll(getFocused).toEqual({ section: 'body', row: step, column: 'value' });
		expect(step).toBe(Math.floor((300 - 36 - 32) / ROW_HEIGHT));
		await expect.poll(() => isClear(document.activeElement as HTMLElement)).toBe(true);
	});

	it('Ctrl+End focuses the last cell, rendered first from outside the row window', async () => {
		grid = mountBrowserGrid({ navigation: true });
		await focusCell(0, 'name');

		expect(grid.row(199)).toBeNull();

		await userEvent.keyboard('{Control>}{End}{/Control}');

		await expect.poll(getFocused).toEqual({ section: 'body', row: 199, column: 'code' });
		await expect.poll(() => isClear(document.activeElement as HTMLElement)).toBe(true);
	});

	it('an arrow up from the first body row goes into the header, and Tab leaves the grid', async () => {
		grid = mountBrowserGrid({ navigation: true });
		await focusCell(0, 'value');

		await userEvent.keyboard('{ArrowUp}');
		await expect.poll(getFocused).toEqual({ section: 'head', row: 0, column: 'value' });

		await userEvent.keyboard('{Tab}');
		await expect.poll(() => grid?.root.contains(document.activeElement)).toBe(false);
	});

	it('focus follows its row when the rows are re-sorted, and the cell keeps it', async () => {
		const rows = shallowRef(createRows(20));

		grid = mountBrowserGrid({ rows, navigation: true });
		await focusCell(2, 'name');

		// The focused row sorts last: Vue moves its element, and the browser drops focus from it.
		rows.value = [...rows.value.filter(row => row.id !== 'r2'), rows.value[2]];

		await expect.poll(getFocused).toEqual({ section: 'body', row: 19, column: 'name' });
		expect(document.activeElement?.textContent).toBe('Row 2');
	});

	it('when the focused row is removed, focus goes to the row that takes its place', async () => {
		const rows = shallowRef(createRows(20));

		grid = mountBrowserGrid({ rows, navigation: true });
		await focusCell(2, 'value');

		rows.value = rows.value.filter(row => row.id !== 'r2');

		await expect.poll(getFocused).toEqual({ section: 'body', row: 2, column: 'value' });
		expect(document.activeElement?.closest('[data-dg-grid-row]')?.textContent).toContain('Row 3');
	});
});
