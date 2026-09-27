import { describe, expect, it } from 'vitest';

import type { CellGrid } from '../../src/cells/cell-address';
import type { RangeBounds } from '../../src/cells/cell-range';
import { toCsv } from '../../src/cells/csv';
import { parseDelimited, resolvePaste } from '../../src/cells/paste';
import { toRuntimeColumn } from '../../src/columns/column';
import { defineColumns } from '../../src/columns/define-columns';

/** A seeded generator, so that a failing case is the same on every run. */
function createRandom(seed: number) {
	let state = seed;

	return () => {
		state = (state + 0x6d2b79f5) | 0;

		let value = Math.imul(state ^ (state >>> 15), 1 | state);

		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

const PIECES = ['a', 'B', ' ', '1', '"', ',', '\t', ';', '\n', '\r', '\r\n', 'é', '😀', '=', '\'', ''];

function randomField(random: () => number) {
	const length = Math.floor(random() * 5);

	return Array.from({ length }, () => PIECES[Math.floor(random() * PIECES.length)]).join('');
}

function randomMatrix(random: () => number) {
	const height = 1 + Math.floor(random() * 4);
	const width = 1 + Math.floor(random() * 4);

	return Array.from({ length: height }, () => Array.from({ length: width }, () => randomField(random)));
}

/** Writes fields the way RFC 4180 asks: quoted when they hold a delimiter, a quote or a line break. */
function writeDelimited(matrix: readonly (readonly string[])[], delimiter: string, newline: string, trailing: boolean) {
	const lines = matrix.map(row => row
		.map(field => (field.includes(delimiter) || /["\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field))
		.join(delimiter));

	return lines.map((line, index) => line + (trailing || index < lines.length - 1 ? newline : '')).join('');
}

describe('parseDelimited', () => {
	it('reads rows of fields, as a spreadsheet puts them on the clipboard', () => {
		expect(parseDelimited('a\tb\r\nc\td\r\n', { delimiter: '\t' })).toEqual([['a', 'b'], ['c', 'd']]);
	});

	it('a quoted field holds delimiters, line breaks and doubled quotes', () => {
		expect(parseDelimited('"a,b","line\none","say ""hi"""\nx,y,z')).toEqual([
			['a,b', 'line\none', 'say "hi"'],
			['x', 'y', 'z'],
		]);
	});

	it('lines break at `\\r\\n`, `\\n` and `\\r`', () => {
		expect(parseDelimited('a\rb\nc\r\nd')).toEqual([['a'], ['b'], ['c'], ['d']]);
	});

	it('a line break at the end ends the last row; empty fields and rows stay', () => {
		expect(parseDelimited('a,\n\n')).toEqual([['a', ''], ['']]);
		expect(parseDelimited('\r\n')).toEqual([['']]);
		expect(parseDelimited('\n\n')).toEqual([[''], ['']]);
		expect(parseDelimited('')).toEqual([]);
	});

	it('delimiters alone give empty fields, one more than there are delimiters', () => {
		expect(parseDelimited('\t\t', { delimiter: '\t' })).toEqual([['', '', '']]);
		expect(parseDelimited('a,', {})).toEqual([['a', '']]);
		expect(parseDelimited(',\n,')).toEqual([['', ''], ['', '']]);
	});

	it('skips a byte order mark and reads back what `toCsv` writes', () => {
		const columns = defineColumns({
			name: { value: (row: { name: string; note: string }) => row.name, label: 'Name' },
			note: { value: (row: { name: string; note: string }) => row.note, label: 'Note, "quoted"' },
		});
		const csv = toCsv({
			columns: [toRuntimeColumn(columns.name), toRuntimeColumn(columns.note)],
			rows: [{ name: 'Ann', note: 'two\nlines' }],
		});

		expect(parseDelimited(`﻿${csv}`)).toEqual([['Name', 'Note, "quoted"'], ['Ann', 'two\nlines']]);
		expect(parseDelimited('﻿')).toEqual([]);
	});

	it('reads back a column that `toCsv` writes with an empty last cell', () => {
		const columns = defineColumns({ note: { value: (row: { note: string }) => row.note } });
		const csv = toCsv({ columns: [toRuntimeColumn(columns.note)], rows: [{ note: 'a' }, { note: '' }], headers: false });

		expect(parseDelimited(csv)).toEqual([['a'], ['']]);
		expect(parseDelimited(toCsv({ columns: [toRuntimeColumn(columns.note)], rows: [{ note: '' }], headers: false })))
			.toEqual([['']]);
	});

	describe('what spreadsheets put on the clipboard', () => {
		it('Excel ends every row with `\\r\\n`, the last one too, and leaves empty cells empty', () => {
			expect(parseDelimited('Name\tAge\r\nAnn\t31\r\nBob\t\r\n', { delimiter: '\t' }))
				.toEqual([['Name', 'Age'], ['Ann', '31'], ['Bob', '']]);
		});

		it('Excel quotes a cell with line breaks, and doubles the quotes in it', () => {
			expect(parseDelimited('"two\nlines"\tx\r\n"say ""hi""\nnow"\ty\r\n', { delimiter: '\t' }))
				.toEqual([['two\nlines', 'x'], ['say "hi"\nnow', 'y']]);
		});

		it('a cell with quotes but no line break comes unquoted, and stays as it is', () => {
			expect(parseDelimited('She said "hi"\t5" screen\r\n', { delimiter: '\t' }))
				.toEqual([['She said "hi"', '5" screen']]);
		});

		it('Google Sheets leaves out the line break after the last row', () => {
			expect(parseDelimited('a\tb\nc\td', { delimiter: '\t' })).toEqual([['a', 'b'], ['c', 'd']]);
		});

		it('one empty cell copied from Excel pastes one empty field', () => {
			expect(parseDelimited('\r\n', { delimiter: '\t' })).toEqual([['']]);
		});
	});

	describe('text that is not quoted as RFC 4180 asks', () => {
		it('a quote that does not close right before a delimiter or a line break is plain text', () => {
			expect(parseDelimited('"Hello" world\tb', { delimiter: '\t' })).toEqual([['"Hello" world', 'b']]);
			expect(parseDelimited('"a"b,"c"')).toEqual([['"a"b', 'c']]);
			expect(parseDelimited('"abc" \n')).toEqual([['"abc" ']]);
		});

		it('a quote that never closes stays in its field, and the rest reads on', () => {
			expect(parseDelimited('"abc\tdef\nghi', { delimiter: '\t' })).toEqual([['"abc', 'def'], ['ghi']]);
			expect(parseDelimited('"')).toEqual([['"']]);
			expect(parseDelimited('a\t"\tb', { delimiter: '\t' })).toEqual([['a', '"', 'b']]);
		});

		it('a quote inside a plain field is plain text', () => {
			expect(parseDelimited('a"b,c""d')).toEqual([['a"b', 'c""d']]);
		});

		it('quoted empty fields and a quoted quote read as RFC 4180 has them', () => {
			expect(parseDelimited('"",""""')).toEqual([['', '"']]);
		});
	});

	it('takes a delimiter longer than one character', () => {
		expect(parseDelimited('a;;b;;"c;;d"\ne', { delimiter: ';;' })).toEqual([['a', 'b', 'c;;d'], ['e']]);
	});

	it('refuses an empty delimiter, which would never move on', () => {
		expect(() => parseDelimited('a,b', { delimiter: '' })).toThrow(TypeError);
	});

	it('reads back any fields written as RFC 4180 asks, with any line breaks', () => {
		const random = createRandom(4180);
		const breaks = ['\r\n', '\n', '\r'];

		for (let run = 0; run < 400; run += 1) {
			const matrix = randomMatrix(random);
			const delimiter = random() < 0.5 ? '\t' : ',';
			const newline = breaks[Math.floor(random() * breaks.length)];
			// Without a line break at the end, a last row of one empty field is no row at all.
			const trailing = random() < 0.5 || (matrix.at(-1)?.length === 1 && matrix.at(-1)?.[0] === '');
			const text = writeDelimited(matrix, delimiter, newline, trailing);

			expect(parseDelimited(text, { delimiter }), JSON.stringify(text)).toEqual(matrix);
		}
	});

	it('reads a large paste in one pass', () => {
		const text = Array.from({ length: 100_000 }, (_, index) => `${index}\tname ${index}\t"note\n${index}"`).join('\r\n');
		const rows = parseDelimited(text, { delimiter: '\t' });

		expect(rows).toHaveLength(100_000);
		expect(rows[99_999]).toEqual(['99999', 'name 99999', 'note\n99999']);
	});
});

function createGrid(rows: number, columns: number): CellGrid {
	return {
		keys: Array.from({ length: rows }, (_, index) => `r${index}`),
		columns: Array.from({ length: columns }, (_, index) => `c${index}`),
	};
}

/** `resolvePaste` with its writes back in indexes, as the grids here name rows and columns by them. */
function paste(target: RangeBounds, matrix: readonly (readonly string[])[], grid: CellGrid) {
	const { writes, bounds } = resolvePaste(target, matrix, grid);

	return {
		cells: writes.map(write => ({ row: grid.keys.indexOf(write.key), column: grid.columns.indexOf(write.column), text: write.text })),
		bounds,
	};
}

describe('resolvePaste', () => {
	const size = createGrid(10, 4);
	const one = { rowStart: 2, rowEnd: 3, columnStart: 1, columnEnd: 2 };

	it('writes text into cells by row key and column name', () => {
		expect(resolvePaste(one, [['a']], size).writes).toEqual([{ key: 'r2', column: 'c1', text: 'a' }]);
	});

	it('from a single cell the block pastes once, from that cell', () => {
		const { cells, bounds } = paste(one, [['a', 'b'], ['c', 'd']], size);

		expect(cells).toEqual([
			{ row: 2, column: 1, text: 'a' },
			{ row: 2, column: 2, text: 'b' },
			{ row: 3, column: 1, text: 'c' },
			{ row: 3, column: 2, text: 'd' },
		]);
		expect(bounds).toEqual({ rowStart: 2, rowEnd: 4, columnStart: 1, columnEnd: 3 });
	});

	it('a selection that is a multiple of the block is filled with it', () => {
		const target = { rowStart: 0, rowEnd: 4, columnStart: 0, columnEnd: 2 };
		const { cells } = paste(target, [['x']], size);

		expect(cells).toHaveLength(8);
		expect(new Set(cells.map(cell => cell.text))).toEqual(new Set(['x']));
		expect(paste(target, [['a', 'b'], ['c', 'd']], size).cells.map(cell => cell.text).join(''))
			.toBe('abcdabcd');
	});

	it('a row repeats down a taller selection, and a column across a wider one', () => {
		const tall = { rowStart: 0, rowEnd: 3, columnStart: 0, columnEnd: 2 };
		const wide = { rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 4 };

		expect(paste(tall, [['a', 'b']], size).cells.map(cell => cell.text).join('')).toBe('ababab');
		expect(paste(wide, [['a'], ['b']], size).cells.map(cell => cell.text).join('')).toBe('aaaabbbb');
	});

	it('a selection that is a multiple in one direction only takes the block once', () => {
		const target = { rowStart: 0, rowEnd: 3, columnStart: 0, columnEnd: 2 };

		expect(paste(target, [['a', 'b'], ['c', 'd']], size).bounds)
			.toEqual({ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 2 });
		expect(paste({ rowStart: 0, rowEnd: 4, columnStart: 0, columnEnd: 3 }, [['a', 'b'], ['c', 'd']], size).bounds)
			.toEqual({ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 2 });
	});

	it('a block bigger than the selection pastes whole, past the selection', () => {
		expect(paste(one, [['a', 'b', 'c']], size).bounds).toEqual({ rowStart: 2, rowEnd: 3, columnStart: 1, columnEnd: 4 });
	});

	it('the block is clipped at the last row and column, and short rows paste empty text', () => {
		const corner = { rowStart: 9, rowEnd: 10, columnStart: 3, columnEnd: 4 };

		expect(paste(corner, [['a', 'b'], ['c']], size).cells).toEqual([{ row: 9, column: 3, text: 'a' }]);
		expect(paste(one, [['a', 'b'], ['c']], size).cells.at(-1)).toEqual({ row: 3, column: 2, text: '' });
	});

	it('the block is as wide as its longest row, wherever that row is', () => {
		const { bounds, cells } = paste(one, [['a'], ['b', 'c', 'd']], size);

		expect(bounds).toEqual({ rowStart: 2, rowEnd: 4, columnStart: 1, columnEnd: 4 });
		expect(cells.map(cell => cell.text)).toEqual(['a', '', '', 'b', 'c', 'd']);
	});

	it('nothing to paste, or nowhere to paste it, gives no cells', () => {
		expect(paste(one, [], size)).toEqual({ cells: [], bounds: null });
		expect(paste(one, [[]], size)).toEqual({ cells: [], bounds: null });
		expect(paste(one, [['a']], createGrid(0, 4))).toEqual({ cells: [], bounds: null });
		expect(paste({ rowStart: 12, rowEnd: 13, columnStart: 0, columnEnd: 1 }, [['a']], size))
			.toEqual({ cells: [], bounds: null });
	});

	it('lays out any block over any selection as its bounds say', () => {
		const random = createRandom(7);

		for (let run = 0; run < 300; run += 1) {
			const matrix = Array.from({ length: 1 + Math.floor(random() * 4) }, () => (
				Array.from({ length: Math.floor(random() * 4) }, (_, index) => `${run}.${index}`)
			));
			const rowStart = Math.floor(random() * 12);
			const columnStart = Math.floor(random() * 5);
			const target: RangeBounds = {
				rowStart,
				rowEnd: rowStart + 1 + Math.floor(random() * 6),
				columnStart,
				columnEnd: columnStart + 1 + Math.floor(random() * 4),
			};
			const { cells, bounds } = paste(target, matrix, size);
			const width = Math.max(...matrix.map(row => row.length));

			if (!bounds) {
				expect(cells).toEqual([]);
				continue;
			}

			expect(bounds.rowStart).toBe(target.rowStart);
			expect(bounds.columnStart).toBe(target.columnStart);
			expect(bounds.rowEnd).toBeLessThanOrEqual(size.keys.length);
			expect(bounds.columnEnd).toBeLessThanOrEqual(size.columns.length);
			expect(cells).toHaveLength((bounds.rowEnd - bounds.rowStart) * (bounds.columnEnd - bounds.columnStart));

			for (const cell of cells) {
				const text = matrix[(cell.row - target.rowStart) % matrix.length][(cell.column - target.columnStart) % width] ?? '';

				expect(cell.text).toBe(text);
			}
		}
	});

	it('takes a paste of many rows', () => {
		const matrix = Array.from({ length: 200_000 }, (_, index) => [String(index)]);
		const { bounds } = resolvePaste({ rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 }, matrix, createGrid(300_000, 1));

		expect(bounds).toEqual({ rowStart: 0, rowEnd: 200_000, columnStart: 0, columnEnd: 1 });
	});
});
