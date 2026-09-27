import { afterEach, describe, expect, it } from 'vitest';

import { type BrowserTable, mountBrowserTable } from '../support/browser-table';

let table: BrowserTable | null = null;

afterEach(() => {
	table?.unmount();
	table = null;
});

async function scrollTo(current: BrowserTable, index: number, align: 'start' | 'end') {
	current.scope.scrollToRow(index, align);
	await expect.poll(() => current.row(index)).not.toBeNull();

	return (current.row(index) as HTMLElement).getBoundingClientRect();
}

describe('useStickyOffset in a browser', () => {
	it('measures the header and the footer, and `scrollToRow` keeps a row clear of both', async () => {
		table = mountBrowserTable({ footer: true });

		const head = table.head.getBoundingClientRect();
		const foot = (table.foot as HTMLElement).getBoundingClientRect();

		expect((await scrollTo(table, 100, 'start')).top).toBeCloseTo(head.bottom, 0);
		expect((await scrollTo(table, 150, 'end')).bottom).toBeCloseTo(foot.top, 0);
	});

	it('the header and the footer stay at the edges while the body scrolls under them', async () => {
		table = mountBrowserTable({ footer: true });

		const root = table.root.getBoundingClientRect();

		table.root.scrollTop = 1000;

		await expect.poll(() => table?.head.getBoundingClientRect().top).toBeCloseTo(root.top + table.root.clientTop, 0);
		expect((table.foot as HTMLElement).getBoundingClientRect().bottom).toBeCloseTo(root.top + table.root.clientTop + table.root.clientHeight, 0);
	});
});
