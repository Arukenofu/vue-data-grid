import { customRef, ref, shallowRef, watchEffect } from 'vue';
import { describe, expect, it } from 'vitest';

import { useRowSelection } from '../../src/rows/use-row-selection';

interface Row {
	id: string;
}

const rows: Row[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

interface SetupOptions {
	selection?: string[];
	selectAll?: boolean | null;
	rows?: Row[];
}

function setup(options: SetupOptions = {}) {
	const selection = ref(options.selection ?? []);
	const selectAll = ref(options.selectAll ?? null);

	const model = useRowSelection<Row>({
		rows: () => options.rows ?? rows,
		rowKey: 'id',
		selection,
		selectAll,
	});

	return { model, selection, selectAll };
}

const picked = (model: ReturnType<typeof setup>['model']) =>
	rows.filter(row => model.isSelected(row.id)).map(row => row.id);

describe('useRowSelection — regular mode', () => {
	it('nothing is selected without a selection', () => {
		const { model } = setup();

		expect(picked(model)).toEqual([]);
		expect(model.isAllSelected.value).toBe(false);
		expect(model.isSomeSelected.value).toBe(false);
	});

	it('`toggle` selects and deselects a row', () => {
		const { model, selection } = setup();

		model.toggle('b');
		expect(selection.value).toEqual(['b']);

		model.toggle('b');
		expect(selection.value).toEqual([]);
	});

	it('some selected rows give the indeterminate state', () => {
		const { model } = setup({ selection: ['a'] });

		expect(model.isSomeSelected.value).toBe(true);
		expect(model.isAllSelected.value).toBe(false);
	});

	it('all rows selected give the full state', () => {
		const { model } = setup({ selection: ['a', 'b', 'c', 'd'] });

		expect(model.isAllSelected.value).toBe(true);
		expect(model.isSomeSelected.value).toBe(false);
	});

	it('an empty list does not count as fully selected', () => {
		const { model } = setup({ rows: [] });

		expect(model.isAllSelected.value).toBe(false);
	});

	it('`toggleAll` selects every loaded row', () => {
		const { model, selection } = setup();

		model.toggleAll();

		expect(new Set(selection.value)).toEqual(new Set(['a', 'b', 'c', 'd']));
	});

	it('`toggleAll` clears a full selection', () => {
		const { model, selection } = setup({ selection: ['a', 'b', 'c', 'd'] });

		model.toggleAll();

		expect(selection.value).toEqual([]);
	});

	it('keys of rows that are not in the list stay in the model', () => {
		const { model, selection } = setup({ selection: ['gone'] });

		model.toggleAll();

		expect(selection.value).toContain('gone');
	});

	it('`selectedCount` counts selected rows of the list only', () => {
		const { model } = setup({ selection: ['b', 'd', 'gone'] });

		expect(model.selectedCount.value).toBe(2);
	});
});

describe('useRowSelection — range selection', () => {
	it('`extend` selects from the last toggled row to this one', () => {
		const { model, selection } = setup();

		model.toggle('a');
		model.extend('c');

		expect(new Set(selection.value)).toEqual(new Set(['a', 'b', 'c']));
	});

	it('a range works bottom up too', () => {
		const { model, selection } = setup();

		model.toggle('d');
		model.extend('b');

		expect(new Set(selection.value)).toEqual(new Set(['b', 'c', 'd']));
	});

	it('without an anchor `extend` selects one row', () => {
		const { model, selection } = setup();

		model.extend('c');

		expect(selection.value).toEqual(['c']);
	});

	it('a range only adds and never deselects', () => {
		const { model, selection } = setup({ selection: ['d'] });

		model.toggle('a');
		model.extend('c');

		expect(new Set(selection.value)).toEqual(new Set(['a', 'b', 'c', 'd']));
	});

	it('a second `extend` lets go of the range of the first, as Shift+click does', () => {
		const { model, selection } = setup();

		model.toggle('a');
		model.extend('d');
		model.extend('b');

		expect(new Set(selection.value)).toEqual(new Set(['a', 'b']));
	});

	it('`extend` keeps rows selected outside the range', () => {
		const { model, selection } = setup({ selection: ['d'] });

		model.toggle('a');
		model.extend('c');
		model.extend('a');

		expect(new Set(selection.value)).toEqual(new Set(['a', 'd']));
	});

	it('`toggleAll` resets the anchor', () => {
		const { model, selection } = setup();

		model.toggle('a');
		model.toggleAll();
		model.toggleAll();
		model.extend('c');

		expect(selection.value).toEqual(['c']);
	});

	it('an unknown key builds no range', () => {
		const { model, selection } = setup();

		model.toggle('a');
		model.extend('zzz');

		expect(new Set(selection.value)).toEqual(new Set(['a', 'zzz']));
	});
});

describe('useRowSelection — operations', () => {
	it('works without refs, keeping its own selection', () => {
		const model = useRowSelection<Row>({ rows, rowKey: 'id' });

		model.toggle('a');
		model.toggle('c');

		expect(model.selectedKeys.value).toEqual(['a', 'c']);
		expect(model.isSelected('c')).toBe(true);
		expect(model.selectedCount.value).toBe(2);
	});

	it('`selectedKeys` stays the same array until the model changes', () => {
		const { model, selection } = setup({ selection: ['a'] });
		const before = model.selectedKeys.value;

		expect(model.selectedKeys.value).toBe(before);
		expect(before).toBe(selection.value);

		model.toggle('b');

		expect(model.selectedKeys.value).not.toBe(before);
	});

	it('`replace` selects only this row and makes it the anchor', () => {
		const { model, selection } = setup({ selection: ['a', 'b'] });

		model.replace('c');
		model.extend('d');

		expect(new Set(selection.value)).toEqual(new Set(['c', 'd']));
	});

	it('`set` selects exactly the given rows, `clear` none', () => {
		const { model, selection } = setup({ selection: ['a'] });

		model.set(['b', 'c']);
		expect(new Set(selection.value)).toEqual(new Set(['b', 'c']));

		model.clear();
		expect(selection.value).toEqual([]);
	});

	it('`setAll` selects and deselects every row', () => {
		const { model } = setup();

		model.setAll(true);
		expect(model.isAllSelected.value).toBe(true);

		model.setAll(false);
		expect(model.selectedCount.value).toBe(0);
	});

	it('a model written from outside is read at once', () => {
		const { model, selection } = setup();

		selection.value = ['b'];

		expect(model.isSelected('b')).toBe(true);
		expect(model.selectedKeys.value).toEqual(['b']);
	});

	it('works against its own copy while a `v-model` write has not come back yet', () => {
		const parent = shallowRef<string[]>([]);
		const written: string[][] = [];
		// A `defineModel` ref reads the parent's value and only asks the parent to write.
		const selection = customRef<string[]>(() => ({
			get: () => parent.value,
			set: (next) => {
				written.push(next);
			},
		}));
		const model = useRowSelection<Row>({ rows, rowKey: 'id', selection });

		model.toggle('a');
		model.toggle('b');

		expect(model.selectedKeys.value).toEqual(['a', 'b']);
		expect(written.at(-1)).toEqual(['a', 'b']);
	});

	it('`replace`, `set` and `clear` turn the "all selected" mode off', () => {
		const { model, selectAll, selection } = setup({ selectAll: true, selection: ['b'] });

		model.replace('c');

		expect(selectAll.value).toBe(false);
		expect(selection.value).toEqual(['c']);
		expect(picked(model)).toEqual(['c']);
	});
});

describe('useRowSelection — single mode', () => {
	function setupSingle() {
		return useRowSelection<Row>({ rows, rowKey: 'id', selectionMode: 'single' });
	}

	it('`toggle` selects one row at a time and deselects it again', () => {
		const model = setupSingle();

		model.toggle('a');
		model.toggle('c');
		expect(model.selectedKeys.value).toEqual(['c']);

		model.toggle('c');
		expect(model.selectedKeys.value).toEqual([]);
	});

	it('`extend` replaces, `set` keeps the last row, selecting all does nothing', () => {
		const model = setupSingle();

		model.toggle('a');
		model.extend('c');
		expect(model.selectedKeys.value).toEqual(['c']);

		model.set(['a', 'b']);
		expect(model.selectedKeys.value).toEqual(['b']);

		model.setAll(true);
		expect(model.selectedKeys.value).toEqual(['b']);
	});
});

describe('useRowSelection — rows that cannot be selected', () => {
	const canSelect = (key: string) => key !== 'b';

	it('no operation selects them, and "all" means the rest', () => {
		const model = useRowSelection<Row>({ rows, rowKey: 'id', canSelect });

		model.toggle('b');
		model.toggle('a');
		model.extend('c');

		expect(model.selectedKeys.value).toEqual(['a', 'c']);
		expect(model.isAllSelected.value).toBe(false);

		model.toggleAll();

		expect(new Set(model.selectedKeys.value)).toEqual(new Set(['a', 'c', 'd']));
		expect(model.isAllSelected.value).toBe(true);
		expect(model.isSelectable('b')).toBe(false);
	});

	it('an operation on such a row keeps the selection and writes nothing', () => {
		const selection = ref(['a']);
		const model = useRowSelection<Row>({ rows, rowKey: 'id', canSelect, selection });
		const written = selection.value;

		model.toggle('b');
		model.replace('b');
		model.extend('b');

		expect(selection.value).toBe(written);
	});

	it('in single mode `toggle` on such a row or on a group keeps the selected row', () => {
		const children: Record<string, readonly string[]> = { root: ['g', 'b'], g: ['a', 'c'] };
		const shown = ['g', 'a', 'c', 'b'].map(id => ({ id }));
		const model = useRowSelection<Row>({
			rows: shown,
			rowKey: 'id',
			canSelect,
			selectionMode: 'single',
			getChildren: key => children[key ?? 'root'] ?? [],
		});

		model.toggle('a');
		model.toggle('b');
		model.toggle('g');

		expect(model.selectedKeys.value).toEqual(['a']);
	});

	it('a key in the model is not selected while `canSelect` refuses it', () => {
		const model = useRowSelection<Row>({ rows, rowKey: 'id', canSelect, selection: ref(['b']) });

		expect(model.isSelected('b')).toBe(false);
		expect(model.selectedCount.value).toBe(0);
	});
});

describe('useRowSelection — per-row reactivity', () => {
	it('a change wakes the readers of the rows it touches, not the others', () => {
		const model = useRowSelection<Row>({ rows, rowKey: 'id' });
		const runs = { a: 0, b: 0 };

		watchEffect(() => {
			model.isSelected('a');
			runs.a += 1;
		}, { flush: 'sync' });
		watchEffect(() => {
			model.isSelected('b');
			runs.b += 1;
		}, { flush: 'sync' });

		model.toggle('a');
		model.replace('c');

		expect(runs).toEqual({ a: 3, b: 1 });
	});

	it('a click under one group wakes the readers of that group only', () => {
		const children: Record<string, readonly string[]> = { root: ['g1', 'g2'], g1: ['a', 'b'], g2: ['c', 'd'] };
		const shown = ['g1', 'a', 'b', 'g2', 'c', 'd'].map(id => ({ id }));
		const model = useRowSelection<Row>({ rows: shown, rowKey: 'id', getChildren: key => children[key ?? 'root'] ?? [] });
		const runs = { g1: 0, g2: 0 };

		watchEffect(() => {
			model.isPartlySelected('g1');
			runs.g1 += 1;
		}, { flush: 'sync' });
		watchEffect(() => {
			model.isPartlySelected('g2');
			runs.g2 += 1;
		}, { flush: 'sync' });

		model.toggle('a');
		model.toggle('b');

		expect(runs).toEqual({ g1: 3, g2: 1 });
		expect(model.isSelected('g1')).toBe(true);
	});
});

describe('useRowSelection — all selected mode', () => {
	it('the mode makes every row selected', () => {
		const { model } = setup({ selectAll: true });

		expect(picked(model)).toEqual(['a', 'b', 'c', 'd']);
		expect(model.isAllSelected.value).toBe(true);
	});

	it('in this mode `selection` holds exceptions', () => {
		const { model } = setup({ selectAll: true, selection: ['b'] });

		expect(picked(model)).toEqual(['a', 'c', 'd']);
		expect(model.isAllSelected.value).toBe(false);
		expect(model.isSomeSelected.value).toBe(true);
	});

	it('in this mode `selectedCount` counts loaded rows that are not exceptions', () => {
		const { model } = setup({ selectAll: true, selection: ['b'] });

		expect(model.selectedCount.value).toBe(3);
	});

	it('in this mode `toggle` adds an exception', () => {
		const { model, selection } = setup({ selectAll: true });

		model.toggle('b');

		expect(selection.value).toEqual(['b']);
		expect(model.isSelected('b')).toBe(false);
	});

	it('a second `toggle` removes the exception', () => {
		const { model, selection } = setup({ selectAll: true, selection: ['b'] });

		model.toggle('b');

		expect(selection.value).toEqual([]);
		expect(model.isSelected('b')).toBe(true);
	});

	it('`toggleAll` turns the mode off and clears the exceptions', () => {
		const { model, selection, selectAll } = setup({ selectAll: true });

		model.toggleAll();

		expect(selectAll.value).toBe(false);
		expect(selection.value).toEqual([]);
	});

	it('`toggleAll` turns the mode on when it is off', () => {
		const { model, selection, selectAll } = setup({ selectAll: false, selection: ['a'] });

		model.toggleAll();

		expect(selectAll.value).toBe(true);
		expect(selection.value).toEqual([]);
	});

	it('in this mode a range removes exceptions', () => {
		const { model, selection } = setup({ selectAll: true, selection: ['a', 'b', 'c'] });

		model.toggle('a');
		model.extend('c');

		expect(selection.value).toEqual([]);
	});

	it('a newly loaded page comes selected', () => {
		const source = ref<Row[]>([{ id: 'a' }]);
		const selection = ref<string[]>([]);
		const selectAll = ref<boolean | null>(true);

		const model = useRowSelection<Row>({
			rows: source,
			rowKey: 'id',
			selection,
			selectAll,
		});

		expect(model.isSelected('a')).toBe(true);

		source.value = [{ id: 'a' }, { id: 'fresh' }];

		expect(model.isSelected('fresh')).toBe(true);
		expect(model.isAllSelected.value).toBe(true);
	});
});

describe('useRowSelection — tree', () => {
	const children: Record<string, readonly string[]> = {
		root: ['g1', 'g2', 'solo'],
		g1: ['a', 'b'],
		g2: ['c', 'g3'],
		g3: ['d'],
	};

	const getChildren = (key: string | null) => children[key ?? 'root'] ?? [];

	const shown: Row[] = ['g1', 'a', 'b', 'g2', 'c', 'g3', 'd', 'solo'].map(id => ({ id }));

	function setupTree(options: SetupOptions = {}) {
		const selection = ref(options.selection ?? []);
		const selectAll = ref(options.selectAll ?? null);

		const model = useRowSelection<Row>({ rows: shown, rowKey: 'id', selection, selectAll, getChildren });

		return { model, selection, selectAll };
	}

	it('toggling a group selects every leaf under it, on all levels', () => {
		const { model, selection } = setupTree();

		model.toggle('g2');

		expect(new Set(selection.value)).toEqual(new Set(['c', 'd']));
		expect(model.isSelected('g2')).toBe(true);
		expect(model.isSelected('g3')).toBe(true);
	});

	it('a group with some leaves selected is partly selected; a second toggle selects the rest', () => {
		const { model, selection } = setupTree({ selection: ['c'] });

		expect(model.isSelected('g2')).toBe(false);
		expect(model.isPartlySelected('g2')).toBe(true);
		expect(model.isPartlySelected('c')).toBe(false);

		model.toggle('g2');

		expect(new Set(selection.value)).toEqual(new Set(['c', 'd']));
		expect(model.isPartlySelected('g2')).toBe(false);
	});

	it('toggling a fully selected group clears its leaves only', () => {
		const { model, selection } = setupTree({ selection: ['a', 'b', 'solo'] });

		model.toggle('g1');

		expect(selection.value).toEqual(['solo']);
	});

	it('`selectedCount` counts leaves, not groups', () => {
		const { model } = setupTree({ selection: ['c', 'd'] });

		expect(model.isSelected('g2')).toBe(true);
		expect(model.selectedCount.value).toBe(2);
	});

	it('"all" means every leaf of the tree, not the shown rows', () => {
		const { model, selection } = setupTree({ selection: ['a', 'b', 'c', 'd'] });

		expect(model.isAllSelected.value).toBe(false);

		model.toggleAll();

		expect(new Set(selection.value)).toEqual(new Set(['a', 'b', 'c', 'd', 'solo']));
		expect(model.isAllSelected.value).toBe(true);
	});

	it('a range over shown rows selects the leaves of groups in it', () => {
		const { model, selection } = setupTree();

		model.toggle('b');
		model.extend('c');

		expect(new Set(selection.value)).toEqual(new Set(['b', 'c', 'd']));
	});

	it('in the "all selected" mode a group toggle writes exceptions', () => {
		const { model, selection } = setupTree({ selectAll: true });

		model.toggle('g1');

		expect(new Set(selection.value)).toEqual(new Set(['a', 'b']));
		expect(model.isSelected('g1')).toBe(false);
		expect(model.isSelected('g2')).toBe(true);
	});
});
