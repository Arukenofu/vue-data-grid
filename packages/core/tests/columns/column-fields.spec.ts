import {
	type ColumnInput,
	defineColumn,
	defineColumnGroups,
	defineColumns,
	type RenderedColumn,
	type RenderedGroup,
	type RowNode,
	type RuntimeColumn,
} from '@vue-data-grid/engine';
import { h, type VNodeChild } from 'vue';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { CellContext, CellEditor, CellTyping, EditorContext, EditorMode, GroupHeaderContext, HeaderContext } from '../../src/columns/column-fields';
import { checkboxCell, dateField, textEditor } from '../../src/editing/editors';

interface Row {
	id: string;
	price: number;
}

const column = defineColumn<Row>();

describe('column render fields', () => {
	it('`write` of a cell takes a value of the column', () => {
		column(row => row.price, {
			cell: ({ write }) => {
				expectTypeOf(write).toEqualTypeOf<((value: number) => void) | undefined>();

				return null;
			},
		});
	});

	it('`checkboxCell` fits a column of booleans, and `editor: false` turns the editor off', () => {
		const flag = defineColumn<Row & { active: boolean }>();

		flag(row => row.active, { cell: checkboxCell(), editor: false });
		// @ts-expect-error: a checkbox shows booleans, not numbers.
		column(row => row.price, { cell: checkboxCell() });
		// @ts-expect-error: `editor` is an editor or `false`.
		column(row => row.price, { editor: true });
	});

	it('an editor takes the draft of the column, and its context says the mode', () => {
		column(row => row.price, {
			editor: (context) => {
				expectTypeOf(context).toEqualTypeOf<EditorContext<Row, number>>();
				expectTypeOf(context.mode).toEqualTypeOf<EditorMode>();

				return null;
			},
		});

		expectTypeOf(textEditor<Row, number>()).toEqualTypeOf<CellEditor<Row, number>>();
		expectTypeOf<CellEditor['typing']>().toEqualTypeOf<'text' | 'value' | undefined>();
	});

	it('a column says what a typed character does with `typing`, and `dateField` sets `value`', () => {
		expectTypeOf<ColumnInput<Row, string>['typing']>().toEqualTypeOf<CellTyping | undefined>();
		expect(dateField({ value: 'text' }).typing).toBe('value');
		expect(column(row => row.id, { ...dateField({ value: 'text' }) }).typing).toBe('value');
	});

	it('`cellFrame` takes the cell context typed by the column and the content', () => {
		column(row => row.price, {
			cellFrame: (context, content) => {
				expectTypeOf(context).toEqualTypeOf<CellContext<Row, number>>();
				expectTypeOf(content).toEqualTypeOf<VNodeChild>();

				return [content];
			},
		});
	});

	it('`cell` and `cellClass` take the row and the value typed by the column', () => {
		column(row => row.price, {
			cell: ({ row, value }) => {
				expectTypeOf(row).toEqualTypeOf<Row>();
				expectTypeOf(value).toEqualTypeOf<number>();

				return value.toFixed(2);
			},
			cellClass: ({ value }) => (value < 0 ? 'down' : 'up'),
		});
	});

	it('a cell knows its column, the row key and, in a tree, the node', () => {
		column(row => row.price, {
			cell: ({ column: own, key, node }) => {
				expectTypeOf(own).toEqualTypeOf<RuntimeColumn>();
				expectTypeOf(key).toEqualTypeOf<string>();
				expectTypeOf(node).toEqualTypeOf<RowNode | undefined>();

				return `${own.name}:${key}:${node?.level ?? 0}`;
			},
		});
	});

	it('`header` takes its column and the sort state', () => {
		column(row => row.id, {
			label: 'Symbol',
			header: (context) => {
				expectTypeOf(context).toEqualTypeOf<HeaderContext>();
				expectTypeOf(context.column).toEqualTypeOf<RuntimeColumn>();

				return context.direction ?? '';
			},
		});
	});

	it('the fields reach `RenderedColumn.column`, and the core keeps them on the column', () => {
		const cell = ({ value }: CellContext<Row, number>) => h('b', value);
		const columns = defineColumns({ price: column(row => row.price, { cell }) });

		expectTypeOf<NonNullable<RenderedColumn['column']>['cell']>()
			.toEqualTypeOf<((context: CellContext<unknown, unknown>) => VNodeChild) | undefined>();
		expect(columns.price.cell).toBe(cell);
	});

	it('a group takes a `header` too, with the group and whether it is collapsed', () => {
		const groups = defineColumnGroups({
			quote: {
				label: 'Quote',
				children: ['price'],
				header: ({ group, collapsed }) => `${group.label ?? group.name}${collapsed ? ' +' : ''}`,
			},
		});

		expectTypeOf<NonNullable<RenderedGroup['group']>['header']>()
			.toEqualTypeOf<((context: GroupHeaderContext) => VNodeChild) | undefined>();
		expect(groups.quote.header?.({ group: groups.quote, collapsed: true })).toBe('Quote +');
	});
});

describe('column render fields — footer aggregate type', () => {
	it('`sum` and `avg` give a number or `null`', () => {
		column(row => row.price, {
			aggregate: 'sum',
			footer: ({ aggregate }) => {
				expectTypeOf(aggregate).toEqualTypeOf<number | null>();

				return null;
			},
		});
	});

	it('`min` and `max` give the value or `null`', () => {
		column(row => row.id, {
			aggregate: 'max',
			footer: ({ aggregate }) => {
				expectTypeOf(aggregate).toEqualTypeOf<string | null>();

				return null;
			},
		});
	});

	it('`count` gives a number', () => {
		column(row => row.id, {
			aggregate: 'count',
			footer: ({ aggregate }) => {
				expectTypeOf(aggregate).toEqualTypeOf<number>();

				return null;
			},
		});
	});

	it('a function gives what it returns', () => {
		column(row => row.price, {
			aggregate: values => values.map(value => value.toFixed(0)),
			footer: ({ aggregate }) => {
				expectTypeOf(aggregate).toEqualTypeOf<string[]>();

				return null;
			},
		});
	});

	it('no aggregate gives `undefined`', () => {
		column(row => row.price, {
			footer: ({ aggregate }) => {
				expectTypeOf(aggregate).toEqualTypeOf<undefined>();

				return null;
			},
		});
	});

	it('typed columns still fit into `defineColumns`', () => {
		const columns = defineColumns({
			price: column(row => row.price, { aggregate: 'avg', footer: ({ aggregate }) => aggregate?.toFixed(2) }),
			id: column(row => row.id, { aggregate: values => values.length }),
		});

		expect(columns.price.aggregate).toBe('avg');
	});
});
