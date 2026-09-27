import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { captureLayout } from '../src/capture';
import type { MotionEngine, MotionTransition } from '../src/model';
import { playMotion } from '../src/play';
import { createElements, place, stubLayout } from './support';

let transitions: MotionTransition[];

const engine: MotionEngine = (transition) => {
	transitions.push(transition);

	return new Promise(() => undefined);
};

beforeEach(() => {
	stubLayout();
	transitions = [];
});

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

describe('captureLayout', () => {
	it('finds the elements that moved, by how far they came', () => {
		const [first, second, third] = createElements(3);
		const capture = captureLayout([first, second, third]);

		place(first, 0, 30);
		place(second, 0, 0);

		expect(capture.compare([first, second, third])).toEqual({
			moves: [{ element: first, x: 0, y: -30 }, { element: second, x: 0, y: 30 }],
			enters: [],
		});
	});

	it('matches items by key, so an element that re-rendered still moves', () => {
		const [before, after] = createElements(2);
		const capture = captureLayout<string>([['a', before]]);

		place(after, 0, 90);

		expect(capture.compare([['a', after]]).moves).toEqual([{ element: after, x: 0, y: -90 }]);
	});

	it('takes an item with a key it did not capture for an enter', () => {
		const [first, second] = createElements(2);
		const capture = captureLayout<string>([['a', first]]);

		expect(capture.compare([['a', first], ['b', second]])).toEqual({ moves: [], enters: [second] });
	});

	it('cuts short the transitions of the items it captures', () => {
		const [element] = createElements(1);

		playMotion(engine, { kind: 'gap', moves: [{ element, x: 0, y: 10 }] });
		captureLayout([element]);

		expect(transitions[0].signal.aborted).toBe(true);
	});

	it('carries on what a cut short transition was moving besides the items, from where it is drawn', () => {
		const [element, other] = createElements(2);

		playMotion(engine, { kind: 'gap', moves: [{ element, x: 0, y: 10 }, { element: other, x: 0, y: 10 }] });
		// Drawn 5 px short of its place when the capture cuts its transition short.
		place(other, 0, 35);

		const capture = captureLayout([element]);

		place(other, 0, 30);
		place(element, 0, 60);

		expect(capture.compare([element]).moves).toEqual([
			{ element, x: 0, y: -60 },
			{ element: other, x: 0, y: 5 },
		]);
	});

	it('`animate` plays the changes and the leaves with the engine', () => {
		const [first, second, leaf] = createElements(3);
		const capture = captureLayout([first]);

		place(first, 0, 30);
		capture.animate([first, second], engine, { kind: 'rows', leaves: [leaf], context: 'sort' });

		expect(transitions[0]).toMatchObject({
			kind: 'rows',
			moves: [{ element: first, x: 0, y: -30 }],
			enters: [second],
			leaves: [leaf],
			context: 'sort',
		});
	});

	it('`animate` without an engine only removes the leaves', () => {
		const [first, leaf] = createElements(2);

		captureLayout([first]).animate([first], null, { kind: 'rows', leaves: [leaf] });

		expect(transitions).toEqual([]);
		expect(leaf.isConnected).toBe(false);
	});
});
