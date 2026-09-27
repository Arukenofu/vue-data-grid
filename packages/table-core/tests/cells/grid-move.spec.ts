import { describe, expect, it } from 'vitest';

import { type GridSection, resolveGridMove } from '../../src/cells/grid-move';

const columns = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }];

const sections: GridSection[] = [
	{ name: 'head', rows: 1, cells: columns },
	{ name: 'body', rows: 5, cells: columns },
	{ name: 'foot', rows: 1, cells: columns },
];

describe('resolveGridMove', () => {
	it('moves along a row inside its section', () => {
		expect(resolveGridMove(sections, { section: 'body', row: 2, cell: 'b' }, 'right'))
			.toEqual({ section: 'body', row: 2, cell: 'c' });
		expect(resolveGridMove(sections, { section: 'head', row: 0, cell: 'b' }, 'rowEnd'))
			.toEqual({ section: 'head', row: 0, cell: 'd' });
	});

	it('crosses from the body into the header and the footer', () => {
		expect(resolveGridMove(sections, { section: 'body', row: 0, cell: 'c' }, 'up'))
			.toEqual({ section: 'head', row: 0, cell: 'c' });
		expect(resolveGridMove(sections, { section: 'head', row: 0, cell: 'c' }, 'down'))
			.toEqual({ section: 'body', row: 0, cell: 'c' });
		expect(resolveGridMove(sections, { section: 'body', row: 4, cell: 'a' }, 'down'))
			.toEqual({ section: 'foot', row: 0, cell: 'a' });
	});

	it('stops at the edges of the grid', () => {
		expect(resolveGridMove(sections, { section: 'head', row: 0, cell: 'a' }, 'up'))
			.toEqual({ section: 'head', row: 0, cell: 'a' });
		expect(resolveGridMove(sections, { section: 'foot', row: 0, cell: 'd' }, 'right'))
			.toEqual({ section: 'foot', row: 0, cell: 'd' });
	});

	it('a page of rows runs across sections and stops at the last row', () => {
		expect(resolveGridMove(sections, { section: 'head', row: 0, cell: 'b' }, 'down', 3))
			.toEqual({ section: 'body', row: 2, cell: 'b' });
		expect(resolveGridMove(sections, { section: 'body', row: 1, cell: 'b' }, 'down', 30))
			.toEqual({ section: 'foot', row: 0, cell: 'b' });
	});

	it('column ends and grid corners take the whole grid', () => {
		expect(resolveGridMove(sections, { section: 'body', row: 3, cell: 'b' }, 'columnStart'))
			.toEqual({ section: 'head', row: 0, cell: 'b' });
		expect(resolveGridMove(sections, { section: 'body', row: 3, cell: 'b' }, 'last'))
			.toEqual({ section: 'foot', row: 0, cell: 'd' });
		expect(resolveGridMove(sections, { section: 'body', row: 3, cell: 'b' }, 'first'))
			.toEqual({ section: 'head', row: 0, cell: 'a' });
	});

	it('a section without rows or cells is skipped', () => {
		const withEmpty: GridSection[] = [
			{ name: 'head', rows: 1, cells: columns },
			{ name: 'pinned', rows: 0, cells: columns },
			{ name: 'blank', rows: 3, cells: [] },
			{ name: 'body', rows: 2, cells: columns },
		];

		expect(resolveGridMove(withEmpty, { section: 'head', row: 0, cell: 'a' }, 'down'))
			.toEqual({ section: 'body', row: 0, cell: 'a' });
	});

	it('keeps the cell by key when sections have different cells', () => {
		const head: GridSection = { name: 'head', rows: 1, cells: [{ key: 'select' }, ...columns, { key: 'actions' }] };
		const body: GridSection = { name: 'body', rows: 2, cells: columns };

		expect(resolveGridMove([head, body], { section: 'head', row: 0, cell: 'c' }, 'down'))
			.toEqual({ section: 'body', row: 0, cell: 'c' });
		expect(resolveGridMove([head, body], { section: 'head', row: 0, cell: 'actions' }, 'down'))
			.toEqual({ section: 'body', row: 0, cell: 'd' });
	});

	describe('group cells over several columns', () => {
		const groups: GridSection = {
			name: 'groups',
			rows: 1,
			cells: [{ key: 'price', span: 2 }, { key: 'none-c', span: 1 }, { key: 'size', span: 1 }],
		};
		const grid = [groups, ...sections];

		it('a column leads up to the group over it', () => {
			expect(resolveGridMove(grid, { section: 'head', row: 0, cell: 'b' }, 'up'))
				.toEqual({ section: 'groups', row: 0, cell: 'price' });
			expect(resolveGridMove(grid, { section: 'head', row: 0, cell: 'd' }, 'up'))
				.toEqual({ section: 'groups', row: 0, cell: 'size' });
		});

		it('a group leads down to its first column', () => {
			expect(resolveGridMove(grid, { section: 'groups', row: 0, cell: 'price' }, 'down'))
				.toEqual({ section: 'head', row: 0, cell: 'a' });
			expect(resolveGridMove(grid, { section: 'groups', row: 0, cell: 'size' }, 'down'))
				.toEqual({ section: 'head', row: 0, cell: 'd' });
		});

		it('a move along the group row steps over whole groups', () => {
			expect(resolveGridMove(grid, { section: 'groups', row: 0, cell: 'price' }, 'right'))
				.toEqual({ section: 'groups', row: 0, cell: 'none-c' });
		});
	});

	describe('cells to skip', () => {
		const groups: GridSection = {
			name: 'groups',
			rows: 1,
			cells: [{ key: 'a', span: 1, skip: true }, { key: 'price', span: 2 }, { key: 'd', span: 1, skip: true }],
		};
		const grid = [groups, ...sections];

		it('a move up over a column without a group stays in the header', () => {
			expect(resolveGridMove(grid, { section: 'head', row: 0, cell: 'a' }, 'up'))
				.toEqual({ section: 'head', row: 0, cell: 'a' });
			expect(resolveGridMove(grid, { section: 'head', row: 0, cell: 'c' }, 'up'))
				.toEqual({ section: 'groups', row: 0, cell: 'price' });
		});

		it('a move along the row passes over them, and stays when nothing is left', () => {
			expect(resolveGridMove(grid, { section: 'groups', row: 0, cell: 'price' }, 'right'))
				.toEqual({ section: 'groups', row: 0, cell: 'price' });
			expect(resolveGridMove(grid, { section: 'groups', row: 0, cell: 'price' }, 'rowStart'))
				.toEqual({ section: 'groups', row: 0, cell: 'price' });
		});

		it('a jump to the top of a column or the first cell lands below them', () => {
			expect(resolveGridMove(grid, { section: 'body', row: 3, cell: 'a' }, 'columnStart'))
				.toEqual({ section: 'head', row: 0, cell: 'a' });
			expect(resolveGridMove(grid, { section: 'body', row: 3, cell: 'b' }, 'first'))
				.toEqual({ section: 'groups', row: 0, cell: 'price' });
		});

		it('a page up goes as far as a cell that takes focus', () => {
			expect(resolveGridMove(grid, { section: 'body', row: 1, cell: 'd' }, 'up', 10))
				.toEqual({ section: 'head', row: 0, cell: 'd' });
		});

		it('a move up goes on over an empty cell to a group a level higher', () => {
			const outer: GridSection = { name: 'outer', rows: 1, cells: [{ key: 'a', span: 4 }] };

			expect(resolveGridMove([outer, groups, ...sections], { section: 'head', row: 0, cell: 'a' }, 'up'))
				.toEqual({ section: 'outer', row: 0, cell: 'a' });
		});
	});

	it('an unknown cell starts from the first cell of its row', () => {
		expect(resolveGridMove(sections, { section: 'body', row: 1, cell: 'gone' }, 'right'))
			.toEqual({ section: 'body', row: 1, cell: 'b' });
	});

	it('a row past the end of its section is clamped to it', () => {
		expect(resolveGridMove(sections, { section: 'body', row: 40, cell: 'a' }, 'down'))
			.toEqual({ section: 'foot', row: 0, cell: 'a' });
	});

	it('an unknown section or an empty grid gives `null`', () => {
		expect(resolveGridMove(sections, { section: 'nowhere', row: 0, cell: 'a' }, 'down')).toBeNull();
		expect(resolveGridMove([], { section: 'body', row: 0, cell: 'a' }, 'down')).toBeNull();
	});
});
