import { afterEach, describe, expect, it } from 'vitest';

import { type BrowserGrid, mountBrowserGrid } from '../support/browser-grid';

let grid: BrowserGrid | null = null;

afterEach(() => {
	grid?.unmount();
	grid = null;
});

async function scrollTo(current: BrowserGrid, index: number, align: 'start' | 'end') {
	current.scope.scrollToRow(index, align);
	await expect.poll(() => current.row(index)).not.toBeNull();

	return (current.row(index) as HTMLElement).getBoundingClientRect();
}

describe('useStickyOffset in a browser', () => {
	it('measures the header and the footer, and `scrollToRow` keeps a row clear of both', async () => {
		grid = mountBrowserGrid({ footer: true });

		const head = grid.head.getBoundingClientRect();
		const foot = (grid.foot as HTMLElement).getBoundingClientRect();

		expect((await scrollTo(grid, 100, 'start')).top).toBeCloseTo(head.bottom, 0);
		expect((await scrollTo(grid, 150, 'end')).bottom).toBeCloseTo(foot.top, 0);
	});

	it('the header and the footer stay at the edges while the body scrolls under them', async () => {
		grid = mountBrowserGrid({ footer: true });

		const root = grid.root.getBoundingClientRect();

		grid.root.scrollTop = 1000;

		await expect.poll(() => grid?.head.getBoundingClientRect().top).toBeCloseTo(root.top + grid.root.clientTop, 0);
		expect((grid.foot as HTMLElement).getBoundingClientRect().bottom).toBeCloseTo(root.top + grid.root.clientTop + grid.root.clientHeight, 0);
	});
});
