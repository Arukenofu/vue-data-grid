import { effectScope, nextTick, shallowRef } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type RowStreamOptions, useRowStream } from '../../src/rows/use-row-stream';

interface Row {
	id: string;
	price: number;
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
		stream.apply({ add: [{ id: 'c', price: 3 }] });

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

		stream.apply({ update: [{ id: 'x', price: 1 }] });

		expect(stream.getRow('x')).toBeUndefined();
		expect(stream.patch('x', { price: 2 })).toBe(false);

		runFrame();

		expect(stream.rows.value).toBe(initial);
	});

	it('a pending add, then an update of it, is a row before the batch', () => {
		const { stream } = createStream();

		stream.apply({ add: [{ id: 'x', price: 1 }] });
		stream.apply({ update: [{ id: 'x', price: 2 }] });

		expect(stream.getRow('x')).toEqual({ id: 'x', price: 2 });

		runFrame();

		expect(stream.rows.value.at(-1)).toEqual({ id: 'x', price: 2 });
	});

	it('an update after a removal of a present row brings it back, before and after the batch', () => {
		const { stream } = createStream();

		stream.apply({ remove: ['a'] });
		stream.apply({ update: [{ id: 'a', price: 5 }] });

		expect(stream.getRow('a')).toEqual({ id: 'a', price: 5 });

		runFrame();

		expect(stream.rows.value[0]).toEqual({ id: 'a', price: 5 });
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

		stream.apply({ remove: ['a'] });
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

	it('stopping the scope cancels the frame', () => {
		const cancel = vi.fn();

		vi.stubGlobal('cancelAnimationFrame', cancel);

		const { stream, stop } = createStream();

		stream.patch('a', { price: 10 });
		stop();

		expect(cancel).toHaveBeenCalledTimes(1);
	});
});
