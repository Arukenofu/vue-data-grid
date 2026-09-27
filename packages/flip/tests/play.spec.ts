import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MotionEngine, MotionTransition } from '../src/model';
import { playMotion, stopMotion } from '../src/play';
import { createElements } from './support';

/** An engine that records its transitions and ends each only when told. */
function createEngine() {
	const transitions: MotionTransition[] = [];
	const ends: (() => void)[] = [];
	const engine: MotionEngine = (transition) => {
		transitions.push(transition);

		return new Promise<void>((resolve) => {
			ends.push(resolve);
		});
	};

	return { engine, transitions, end: (index: number) => ends[index]() };
}

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

describe('playMotion', () => {
	it('hands the engine the change with its kind, context and a signal', () => {
		const [first, second, third] = createElements(3);
		const { engine, transitions } = createEngine();

		playMotion(engine, { kind: 'rows', moves: [{ element: first, x: 0, y: 30 }], enters: [second], leaves: [third], context: 'sort' });

		expect(transitions).toHaveLength(1);
		expect(transitions[0]).toMatchObject({
			kind: 'rows',
			moves: [{ element: first, x: 0, y: 30 }],
			enters: [second],
			leaves: [third],
			context: 'sort',
		});
		expect(transitions[0].signal.aborted).toBe(false);
	});

	it('removes the leaves and settles once the engine is done', async () => {
		const [leaf] = createElements(1);
		const { engine, end } = createEngine();
		const playback = playMotion(engine, { kind: 'rows', leaves: [leaf] });

		expect(leaf.isConnected).toBe(true);

		end(0);
		await playback.finished;

		expect(leaf.isConnected).toBe(false);
	});

	it('ends at once when the engine returns nothing', () => {
		const [leaf] = createElements(1);

		playMotion(() => undefined, { kind: 'rows', leaves: [leaf] });

		expect(leaf.isConnected).toBe(false);
	});

	it('without an engine calls nothing and removes the leaves', async () => {
		const [leaf] = createElements(1);
		const playback = playMotion(null, { kind: 'rows', leaves: [leaf] });

		await playback.finished;

		expect(leaf.isConnected).toBe(false);
	});

	it('does not call the engine for an empty change', () => {
		const engine = vi.fn();

		playMotion(engine, { kind: 'rows' });

		expect(engine).not.toHaveBeenCalled();
	});

	it('`stop` aborts the signal and removes the leaves', () => {
		const [element, leaf] = createElements(2);
		const { engine, transitions } = createEngine();
		const playback = playMotion(engine, { kind: 'rows', moves: [{ element, x: 0, y: 10 }], leaves: [leaf] });

		playback.stop();

		expect(transitions[0].signal.aborted).toBe(true);
		expect(leaf.isConnected).toBe(false);
	});

	it('cuts short the running transition of an element that moves again', () => {
		const [element, other] = createElements(2);
		const { engine, transitions } = createEngine();

		playMotion(engine, { kind: 'gap', moves: [{ element, x: 0, y: 10 }, { element: other, x: 0, y: 10 }] });
		playMotion(engine, { kind: 'rows', moves: [{ element, x: 0, y: 20 }] });

		expect(transitions[0].signal.aborted).toBe(true);
		expect(transitions[1].signal.aborted).toBe(false);
	});

	it('`stopMotion` cuts short the transitions of the elements, whoever started them', () => {
		const [element] = createElements(1);
		const { engine, transitions } = createEngine();

		playMotion(engine, { kind: 'gap', moves: [{ element, x: 0, y: 10 }] });
		stopMotion([element]);

		expect(transitions[0].signal.aborted).toBe(true);
	});

	it('cuts short a transition of another copy of the package through `stop` alone', () => {
		const [element] = createElements(1);
		const { engine } = createEngine();
		const stop = vi.fn();
		const registry = globalThis as typeof globalThis & { [key: symbol]: WeakMap<Element, unknown> | undefined };
		const key = Symbol.for('@vue-stack/flip/runs@1');

		registry[key] ??= new WeakMap();
		registry[key].set(element, { moves: [element], stop });
		playMotion(engine, { kind: 'rows', moves: [{ element, x: 0, y: 20 }] });

		expect(stop).toHaveBeenCalledTimes(1);
	});

	it('ends the transition when the engine throws', () => {
		const [leaf] = createElements(1);

		expect(() => playMotion(() => {
			throw new Error('broken');
		}, { kind: 'rows', leaves: [leaf] })).toThrow('broken');
		expect(leaf.isConnected).toBe(false);
	});
});
