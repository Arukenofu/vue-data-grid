import { describe, expect, it } from 'vitest';

import { toCsv } from '../../src/cells/csv';
import { toColumnList } from '../../src/columns/column';
import { defineColumns } from '../../src/columns/define-columns';

interface Row {
	symbol: string;
	price: number | null;
	note: string;
}

const columns = defineColumns({
	symbol: { value: (row: Row) => row.symbol, label: 'Symbol' },
	price: {
		value: (row: Row) => row.price,
		label: 'Price',
		format: (value: number | null) => value?.toFixed(2) ?? '',
	},
	note: { value: (row: Row) => row.note },
});

const list = toColumnList(columns);

describe('toCsv', () => {
	it('the first line holds headers, values go through `format`', () => {
		const text = toCsv({ columns: list, rows: [{ symbol: 'AAPL', price: 1.5, note: 'ok' }] });

		expect(text).toBe('Symbol,Price,note\r\nAAPL,1.50,ok');
	});

	it('without `format` values use `String(value)`, empty ones give an empty string', () => {
		const text = toCsv({ columns: [columns.symbol, columns.note], rows: [{ symbol: 'A', price: null, note: '' }] });

		expect(text.split('\r\n')[1]).toBe('A,');
	});

	it('a field with the delimiter, a quote or a line break is quoted, with quotes doubled', () => {
		const text = toCsv({
			columns: [columns.note],
			rows: ['a,b', 'say "hi"', 'x\ny'].map(note => ({ symbol: '', price: 0, note })),
			headers: false,
		});

		expect(text).toBe('"a,b"\r\n"say ""hi"""\r\n"x\ny"');
	});

	it('text that looks like a formula gets an apostrophe, a negative number stays as is', () => {
		const rows = [{ symbol: '=HYPERLINK("x")', price: -1.5, note: '-2+3' }];
		const text = toCsv({ columns: list, rows, headers: false });

		expect(text).toBe('"\'=HYPERLINK(""x"")",-1.50,\'-2+3');
	});

	it('leaves service columns out unless `includeService` is set', () => {
		const withService = defineColumns({
			number: { value: (row: Row) => row.symbol.length, label: '#', kind: 'service' },
			symbol: columns.symbol,
		});
		const rows = [{ symbol: 'AAPL', price: 1, note: '' }];

		expect(toCsv({ columns: toColumnList(withService), rows })).toBe('Symbol\r\nAAPL');
		expect(toCsv({ columns: toColumnList(withService), rows, includeService: true })).toBe('#,Symbol\r\n4,AAPL');
	});

	it('formula escaping can be turned off', () => {
		const text = toCsv({
			columns: [columns.symbol],
			rows: [{ symbol: '=1+1', price: 0, note: '' }],
			headers: false,
			escapeFormulas: false,
		});

		expect(text).toBe('=1+1');
	});

	it('custom delimiter, newline and headers', () => {
		const text = toCsv({
			columns: [columns.symbol, columns.price],
			rows: [{ symbol: 'A', price: 2, note: '' }],
			delimiter: '\t',
			newline: '\n',
			headers: column => column.name.toUpperCase(),
		});

		expect(text).toBe('SYMBOL\tPRICE\nA\t2.00');
	});

	it('ends with a line break when the last line is one empty field, and quotes no empty field', () => {
		const rows = ['', 'a', ''].map(note => ({ symbol: '', price: 0, note }));

		expect(toCsv({ columns: [columns.note], rows, headers: false })).toBe('\r\na\r\n\r\n');
		expect(toCsv({ columns: [columns.note], rows: rows.slice(1, 2), headers: false })).toBe('a');
	});
});
