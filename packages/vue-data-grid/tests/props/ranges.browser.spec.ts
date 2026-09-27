import type { AnyColumnInput } from '@vue-data-grid/core';
import { nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import { type BrowserRow, type BrowserTable, mountBrowserTable } from '../support/browser-table';

let table: BrowserTable | null = null;

afterEach(() => {
	table?.unmount();
	table = null;
});

const COLUMNS: Record<string, AnyColumnInput> = {
	pinned: { value: (row: BrowserRow) => row.id, label: 'Pinned', width: 80, pinned: 'start' },
	name: { value: (row: BrowserRow) => row.name, label: 'Name', width: 150, flex: 1, resizable: true },
	value: { value: (row: BrowserRow) => row.value, label: 'Value', width: 120, resizable: true },
	code: { value: (row: BrowserRow) => row.id, label: 'Code', width: 200 },
};

function getInside(current: BrowserTable) {
	return [...current.root.querySelectorAll<HTMLElement>('[data-tc-part="range-cell"]')].map(element => element.getBoundingClientRect());
}

function select(current: BrowserTable, from: [number, string], to: [number, string]) {
	current.ranges?.select({ index: from[0], column: from[1] });
	current.ranges?.select({ index: to[0], column: to[1] }, 'extend');
}

describe('cell ranges drawn over the body', () => {
	it('a range stands exactly over its cells, a flex column that grew included', async () => {
		table = mountBrowserTable({ columns: COLUMNS, ranges: true, width: 700 });
		select(table, [1, 'name'], [3, 'value']);
		await nextTick();

		const [piece] = getInside(table);
		const first = table.cell(1, 'name')!.getBoundingClientRect();
		const last = table.cell(3, 'value')!.getBoundingClientRect();

		// The grid is wider than its columns: `name` grew, and the range with it.
		expect(first.width).toBeGreaterThan(150);
		expect(piece.left).toBeCloseTo(first.left, 0);
		expect(piece.top).toBeCloseTo(first.top, 0);
		expect(piece.right).toBeCloseTo(last.right, 0);
		expect(piece.bottom).toBeCloseTo(last.bottom, 0);
	});

	it('a range across a pinned column is cut at the pin, and the pinned piece stays with the pinned cells', async () => {
		table = mountBrowserTable({ columns: COLUMNS, ranges: true, width: 400 });
		// Rows 1 and 2 have short names: a long one in a growing column widens its row past the others.
		select(table, [1, 'pinned'], [2, 'code']);
		await nextTick();

		table.root.scrollLeft = 150;
		await expect.poll(() => table!.cell(1, 'name')!.getBoundingClientRect().left)
			.toBeLessThan(table.cell(1, 'pinned')!.getBoundingClientRect().left);

		const [pinned, rest] = getInside(table);
		const pinnedCell = table.cell(1, 'pinned')!.getBoundingClientRect();

		expect(pinned.left).toBeCloseTo(pinnedCell.left, 0);
		expect(pinned.right).toBeCloseTo(pinnedCell.right, 0);
		expect(rest.left).toBeCloseTo(table.cell(1, 'name')!.getBoundingClientRect().left, 0);
		expect(rest.right).toBeCloseTo(table.cell(2, 'code')!.getBoundingClientRect().right, 0);
	});

	it('the scrolling piece goes under pinned cells, a pinned piece stays over them', async () => {
		table = mountBrowserTable({ columns: COLUMNS, ranges: true, width: 400 });
		select(table, [1, 'pinned'], [2, 'code']);
		await nextTick();

		table.root.scrollLeft = 150;
		await expect.poll(() => table!.cell(1, 'name')!.getBoundingClientRect().left)
			.toBeLessThan(table.cell(1, 'pinned')!.getBoundingClientRect().left);

		// Hit-testing tells what is painted on top; the pieces let the pointer through, so let it hit them.
		function hitAt(cell: HTMLElement) {
			for (const piece of table!.root.querySelectorAll<HTMLElement>('[data-tc-part="range"] > *')) {
				piece.style.pointerEvents = piece.dataset.tcPart === 'range-cell' ? 'auto' : 'none';
			}

			const box = cell.getBoundingClientRect();

			return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
		}

		const pinnedCell = table.cell(1, 'pinned')!;
		const [pinned, rest] = table.root.querySelectorAll('[data-tc-part="range-cell"]');

		expect(hitAt(pinnedCell)).toBe(pinned);
		expect(hitAt(table.cell(1, 'value')!)).toBe(rest);

		// Without the pinned column the range still reaches under it, and the pinned cell covers it.
		select(table, [1, 'name'], [2, 'code']);
		await nextTick();

		expect(table.root.querySelector('[data-tc-part="range-cell"]')!.getBoundingClientRect().left)
			.toBeLessThan(pinnedCell.getBoundingClientRect().right);
		expect(pinnedCell.contains(hitAt(pinnedCell))).toBe(true);
	});

	it('a range follows a resize frame by frame, before anything renders', async () => {
		table = mountBrowserTable({ columns: COLUMNS, ranges: true, width: 400 });
		select(table, [0, 'value'], [0, 'value']);
		await nextTick();

		table.scope.resize('value', 220);

		const cell = table.cell(0, 'value')!;

		await expect.poll(() => cell.getBoundingClientRect().width).toBeCloseTo(220, 0);
		expect(getInside(table)[0].width).toBeCloseTo(220, 0);

		table.scope.commitResize();
	});
});

describe('selecting cells by dragging', () => {
	function pointer(type: string, target: EventTarget, x: number, y: number) {
		target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
	}

	function centre(element: HTMLElement) {
		const box = element.getBoundingClientRect();

		return [box.left + box.width / 2, box.top + box.height / 2] as const;
	}

	it('a drag extends the range to the cell under the pointer', async () => {
		table = mountBrowserTable({ ranges: true, width: 400, height: 300 });

		const [x, y] = centre(table.cell(1, 'name')!);

		pointer('pointerdown', table.cell(1, 'name')!, x, y);

		const [toX, toY] = centre(table.cell(4, 'value')!);

		pointer('pointermove', window, toX, toY);
		pointer('pointerup', window, toX, toY);

		expect(table.ranges?.bounds.value).toEqual([{ rowStart: 1, rowEnd: 5, columnStart: 0, columnEnd: 2 }]);
	});

	it('past the bottom edge the table scrolls and the range follows the rows', async () => {
		table = mountBrowserTable({ ranges: true, width: 400, height: 300 });

		const [x, y] = centre(table.cell(1, 'name')!);
		const box = table.root.getBoundingClientRect();

		pointer('pointerdown', table.cell(1, 'name')!, x, y);
		pointer('pointermove', window, x, box.bottom + 40);

		await expect.poll(() => table!.root.scrollTop, { timeout: 3000 }).toBeGreaterThan(200);
		pointer('pointerup', window, x, box.bottom + 40);

		const [bounds] = table.ranges!.bounds.value;

		expect(bounds.rowStart).toBe(1);
		// The last row in view at the bottom edge, not a row past the end of the table.
		expect(bounds.rowEnd).toBeGreaterThan(10);
		expect(table.row(bounds.rowEnd - 1)).not.toBeNull();
	});
});
