import { effectScope, nextTick, shallowRef } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type RowStreamOptions, useRowStream } from '../../src/rows/use-row-stream';

interface Row {
	id: string;
	price: number;
	parent?: string | null;
	children?: Row[];
}

const initial: Row[] = [{ id: 'a', price: 1 }, { id: 'b', price: 2 }];

let frames: FrameRequestCallback[] = [];

function runFrame() {
	const pending = frames;

	frames = [];
	pending.forEach(callback => callback(0));
}

beforeEach(() => {
	frames = [];
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
	vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

function createStream(options: Partial<RowStreamOptions<Row>> = {}) {
	const scope = effectScope();
	const stream = scope.run(() => useRowStream<Row>({ rows: initial, rowKey: 'id', ...options }));

	return { stream: stream as NonNullable<typeof stream>, stop: () => scope.stop() };
}

describe('useRowStream', () => {
	it('changes collect until the frame and are applied in one batch', () => {
		const { stream } = createStream();

		stream.patch('a', { price: 10 });
		stream.patch('b', { price: 20 });
		stream.apply([{ type: 'add', row: { id: 'c', price: 3 } }]);

		expect(stream.rows.value).toBe(initial);
		expect(frames).toHaveLength(1);

		runFrame();

		expect(stream.rows.value).toEqual([{ id: 'a', price: 10 }, { id: 'b', price: 20 }, { id: 'c', price: 3 }]);
	});

	it('a row no change touched stays the same object', () => {
		const { stream } = createStream();

		stream.patch('a', { price: 10 });
		runFrame();

		expect(stream.rows.value[1]).toBe(initial[1]);
	});

	it('changes to one row within a frame collapse', () => {
		const { stream } = createStream();

		stream.patch('a', { price: 10 });
		stream.patch('a', { price: 11 });
		runFrame();

		expect(stream.rows.value[0]).toEqual({ id: 'a', price: 11 });
		expect(stream.getRow('a')).toEqual({ id: 'a', price: 11 });
	});

	it('a change to an unknown row answers `false` and requests no frame', () => {
		const { stream } = createStream();

		expect(stream.patch('x', { price: 1 })).toBe(false);
		expect(frames).toHaveLength(0);
	});

	it('a pending update of an unknown key has no row, since the batch drops it', () => {
		const { stream } = createStream();

		stream.apply([{ type: 'update', row: { id: 'x', price: 1 } }]);

		expect(stream.getRow('x')).toBeUndefined();
		expect(stream.patch('x', { price: 2 })).toBe(false);

		runFrame();

		expect(stream.rows.value).toBe(initial);
	});

	it('a pending add, then an update of it, is a row before the batch', () => {
		const { stream } = createStream();

		stream.apply([{ type: 'add', row: { id: 'x', price: 1 } }]);
		stream.apply([{ type: 'update', row: { id: 'x', price: 2 } }]);

		expect(stream.getRow('x')).toEqual({ id: 'x', price: 2 });

		runFrame();

		expect(stream.rows.value.at(-1)).toEqual({ id: 'x', price: 2 });
	});

	it('skips an update after a removal, as in order, and an add brings the row back last', () => {
		const { stream } = createStream();

		stream.apply([{ type: 'remove', key: 'a' }]);
		stream.apply([{ type: 'update', row: { id: 'a', price: 5 } }]);

		expect(stream.getRow('a')).toBeUndefined();

		stream.apply([{ type: 'add', row: { id: 'a', price: 6 } }]);

		expect(stream.getRow('a')).toEqual({ id: 'a', price: 6 });

		runFrame();

		expect(stream.rows.value.at(-1)).toEqual({ id: 'a', price: 6 });
	});

	it('`wait` collects changes on a timer instead of a frame', () => {
		vi.useFakeTimers();

		const { stream } = createStream({ wait: 100 });

		stream.patch('a', { price: 10 });
		vi.advanceTimersByTime(99);
		expect(stream.rows.value).toBe(initial);

		vi.advanceTimersByTime(1);
		expect(stream.rows.value[0].price).toBe(10);
	});

	it('`flush` applies at once', () => {
		const { stream } = createStream();

		stream.apply([{ type: 'remove', key: 'a' }]);
		stream.flush();

		expect(stream.rows.value).toEqual([initial[1]]);
	});

	it('a new snapshot drops pending changes', async () => {
		const snapshot = shallowRef(initial);
		const { stream } = createStream({ rows: snapshot });

		stream.patch('a', { price: 10 });
		snapshot.value = [{ id: 'a', price: 100 }];
		await nextTick();
		runFrame();

		expect(stream.rows.value).toEqual([{ id: 'a', price: 100 }]);
	});

	it('a move keeps its place among the changes, and the changes by key around it merge', () => {
		const { stream } = createStream();

		stream.patch('a', { price: 10 });
		stream.apply([{ type: 'move', key: 'a', index: 1 }]);
		stream.patch('a', { price: 11 });
		stream.patch('a', { price: 12 });
		stream.apply([{ type: 'add', row: { id: 'c', price: 3 }, before: 'b' }]);
		runFrame();

		expect(stream.rows.value).toEqual([{ id: 'c', price: 3 }, initial[1], { id: 'a', price: 12 }]);
	});

	it('finds a row across pending moves and adds at a place', () => {
		const { stream } = createStream();

		stream.apply([{ type: 'remove', key: 'b' }]);
		stream.apply([{ type: 'add', row: { id: 'c', price: 3 }, index: 0 }]);

		expect(stream.getRow('c')).toEqual({ id: 'c', price: 3 });
		expect(stream.getRow('b')).toBeUndefined();
		expect(stream.patch('c', { price: 30 })).toBe(true);
		expect(stream.getRow('c')).toEqual({ id: 'c', price: 30 });

		runFrame();

		expect(stream.rows.value).toEqual([{ id: 'c', price: 30 }, initial[0]]);
		expect(stream.getRow('c')).toEqual({ id: 'c', price: 30 });
	});

	it('sees the parent a pending move writes, so a patch after it keeps it', () => {
		const rows: Row[] = [{ id: 'folder', price: 0, parent: null }, { id: 'file', price: 1, parent: null }];
		const scope = effectScope();
		const stream = scope.run(() => useRowStream<Row>({ rows, rowKey: 'id', parentKey: 'parent' }))!;

		stream.apply([{ type: 'move', key: 'file', parent: 'folder' }]);
		stream.patch('file', { price: 2 });
		runFrame();

		expect(stream.rows.value[1]).toEqual({ id: 'file', price: 2, parent: 'folder' });
		scope.stop();
	});

	it('changes the rows of a nested tree by key, and copies only the rows above a change', () => {
		const leaf = { id: 'leaf', price: 1 };
		const other = { id: 'other', price: 2 };
		const rows: Row[] = [{ id: 'group', price: 0, children: [leaf] }, other];
		const scope = effectScope();
		const stream = scope.run(() => useRowStream<Row>({ rows, rowKey: 'id', childrenField: 'children' }))!;

		expect(stream.getRow('leaf')).toBe(leaf);
		expect(stream.patch('leaf', { price: 10 })).toBe(true);
		runFrame();

		expect(stream.rows.value).toEqual([{ id: 'group', price: 0, children: [{ id: 'leaf', price: 10 }] }, other]);
		expect(stream.rows.value[1]).toBe(other);
		expect(stream.getRow('leaf')).toEqual({ id: 'leaf', price: 10 });
		scope.stop();
	});

	it('stopping the scope cancels the frame', () => {
		const cancel = vi.fn();

		vi.stubGlobal('cancelAnimationFrame', cancel);

		const { stream, stop } = createStream();

		stream.patch('a', { price: 10 });
		stop();

		expect(cancel).toHaveBeenCalledTimes(1);
	});
});

describe('useRowStream — pending changes', () => {
	it('has no row under a row a pending removal takes', () => {
		const { stream } = createStream({
			rows: [{ id: 'p', price: 1, parent: null }, { id: 'c', price: 2, parent: 'p' }],
			parentKey: 'parent',
		});

		stream.apply([{ type: 'remove', key: 'p' }]);

		expect(stream.getRow('c')).toBeUndefined();
		expect(stream.patch('c', { price: 3 })).toBe(false);
	});

	it('has no row under a nested row a pending removal takes', () => {
		const { stream } = createStream({
			rows: [{ id: 'p', price: 1, children: [{ id: 'c', price: 2 }] }],
			childrenField: 'children',
		});

		expect(stream.getRow('c')).toEqual({ id: 'c', price: 2 });

		stream.apply([{ type: 'remove', key: 'p' }]);

		expect(stream.getRow('c')).toBeUndefined();
	});

	it('folds an update and an add of a key as they apply in order to a key with a row and to one without', () => {
		const { stream } = createStream();

		stream.apply([{ type: 'update', row: { id: 'a', price: 5 } }, { type: 'add', row: { id: 'a', price: 9 } }]);
		stream.apply([{ type: 'update', row: { id: 'x', price: 5 } }, { type: 'add', row: { id: 'x', price: 9 } }]);

		expect(stream.getRow('a')).toEqual({ id: 'a', price: 5 });
		expect(stream.getRow('x')).toEqual({ id: 'x', price: 9 });

		runFrame();

		expect(stream.rows.value).toEqual([{ id: 'a', price: 5 }, { id: 'b', price: 2 }, { id: 'x', price: 9 }]);
	});

	it('replaces a row in place with an add of `existing: "replace"`', () => {
		const { stream } = createStream();

		stream.apply([{ type: 'add', row: { id: 'a', price: 7 }, existing: 'replace' }]);
		runFrame();

		expect(stream.rows.value).toEqual([{ id: 'a', price: 7 }, initial[1]]);
	});

	it('patches a row on top of the moves before it', () => {
		const { stream } = createStream({
			rows: [{ id: 'a', price: 1, parent: null }, { id: 'b', price: 2, parent: null }],
			parentKey: 'parent',
		});

		stream.apply([{ type: 'move', key: 'b', parent: 'a' }]);
		stream.patch('b', { price: 3 });
		stream.apply([{ type: 'move', key: 'a', index: 0 }]);
		stream.patch('b', { price: 4 });

		expect(stream.getRow('b')).toEqual({ id: 'b', price: 4, parent: 'a' });

		runFrame();

		expect(stream.rows.value).toContainEqual({ id: 'b', price: 4, parent: 'a' });
	});

	it('drops a batch that throws instead of trying it again every frame', () => {
		const { stream } = createStream({
			rows: [{ id: 'a', price: 1, parent: null }, { id: 'b', price: 2, parent: null }],
			parentKey: row => row.parent ?? null,
		});

		stream.apply([{ type: 'move', key: 'b', parent: 'a' }]);

		expect(() => runFrame()).toThrow('needs `setParent`');

		stream.patch('a', { price: 5 });
		runFrame();

		expect(stream.rows.value[0]).toEqual({ id: 'a', price: 5, parent: null });
	});
});
