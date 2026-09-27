import { afterEach, describe, expect, it, vi } from 'vitest';

import { defineMotionEngine } from '../src/define';
import type { MotionTransition } from '../src/model';
import { playMotion } from '../src/play';
import { createElements } from './support';

/** An animation that finishes only when told, and records whether it was stopped. */
function createAnimation() {
	let finish: () => void = () => undefined;
	const animation = {
		finished: new Promise<void>((resolve) => {
			finish = resolve;
		}),
		stopped: false,
	};

	return { animation, finish: () => finish() };
}

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('defineMotionEngine', () => {
	it('ends the transition once every animation `play` returned has finished', async () => {
		const [element, leaf] = createElements(2);
		const first = createAnimation();
		const second = createAnimation();
		const engine = defineMotionEngine({
			play: () => [first.animation, second.animation],
			stop: (animation) => {
				animation.stopped = true;
			},
		});
		const playback = playMotion(engine, { kind: 'rows', moves: [{ element, x: 0, y: 30 }], leaves: [leaf] });

		first.finish();
		await Promise.resolve();

		expect(leaf.isConnected).toBe(true);

		second.finish();
		await playback.finished;

		expect(leaf.isConnected).toBe(false);
		expect(first.animation.stopped).toBe(false);
	});

	it('takes one animation, a promise-like, or nothing', async () => {
		// Elements of their own: a new transition of an element cuts its running one short.
		const [first, second, third] = createElements(3);
		const single = createAnimation();
		let settle: () => void = () => undefined;
		const thenable: PromiseLike<void> = new Promise<void>((resolve) => {
			settle = resolve;
		});
		const one = playMotion(defineMotionEngine({ play: () => single.animation, stop: () => undefined }), { kind: 'rows', moves: [{ element: first, x: 0, y: 30 }] });
		const promised = playMotion(defineMotionEngine({ play: () => thenable, stop: () => undefined }), { kind: 'rows', moves: [{ element: second, x: 0, y: 30 }] });
		const play = vi.fn();
		const none = playMotion(defineMotionEngine({ play, stop: () => undefined }), { kind: 'rows', moves: [{ element: third, x: 0, y: 30 }] });
		let ended = 0;

		void one.finished.then(() => (ended += 1));
		void promised.finished.then(() => (ended += 1));
		await none.finished;

		expect(play).toHaveBeenCalledOnce();
		expect(ended).toBe(0);

		single.finish();
		settle();
		await Promise.all([one.finished, promised.finished]);

		expect(ended).toBe(2);
	});

	it('plays each move, enter and leave with its index, together with `play`', async () => {
		const [first, second, enter, leave] = createElements(4);
		const calls: string[] = [];
		const animations = Array.from({ length: 5 }, () => createAnimation());
		let next = 0;
		const take = (call: string) => {
			calls.push(call);
			next += 1;

			return animations[next - 1].animation;
		};
		const engine = defineMotionEngine({
			play: ({ kind }) => take(`play ${kind}`),
			move: ({ y }, index, { kind }) => take(`move ${index} ${y} ${kind}`),
			enter: (element, index) => take(`enter ${index} ${element === enter}`),
			leave: (element, index) => take(`leave ${index} ${element === leave}`),
			stop: () => undefined,
		});
		const playback = playMotion(engine, {
			kind: 'rows',
			moves: [{ element: first, x: 0, y: 10 }, { element: second, x: 0, y: 20 }],
			enters: [enter],
			leaves: [leave],
		});

		expect(calls).toEqual(['play rows', 'move 0 10 rows', 'move 1 20 rows', 'enter 0 true', 'leave 0 true']);

		animations.slice(0, 4).forEach(item => item.finish());
		await Promise.resolve();

		expect(leave.isConnected).toBe(true);

		animations[4].finish();
		await playback.finished;

		expect(leave.isConnected).toBe(false);
	});

	it('stops every animation when the transition is cut short', () => {
		const [element] = createElements(1);
		const animations = [createAnimation().animation, createAnimation().animation];
		const engine = defineMotionEngine({
			play: () => animations,
			stop: (animation) => {
				animation.stopped = true;
			},
		});

		playMotion(engine, { kind: 'rows', moves: [{ element, x: 0, y: 30 }] }).stop();

		expect(animations.map(animation => animation.stopped)).toEqual([true, true]);
	});

	it('cancels an animation of the Web Animations API without a `stop`', () => {
		class FakeAnimation {
			finished = new Promise<void>(() => undefined);
			cancel = vi.fn();
		}

		vi.stubGlobal('Animation', FakeAnimation);

		const [element] = createElements(1);
		const animation = new FakeAnimation() as unknown as Animation;
		const engine = defineMotionEngine({ play: () => animation });

		playMotion(engine, { kind: 'rows', moves: [{ element, x: 0, y: 30 }] }).stop();

		expect(animation.cancel).toHaveBeenCalledOnce();
	});

	it('ends the transition when an animation rejects', async () => {
		const [leaf] = createElements(1);
		const engine = defineMotionEngine({ play: () => Promise.reject(new Error('cancelled')), stop: () => undefined });

		await playMotion(engine, { kind: 'rows', leaves: [leaf] }).finished;

		expect(leaf.isConnected).toBe(false);
	});

	it('leaves out the moves from farther than a screen away, unless `farMoves` is `\'play\'`', () => {
		const [near, far] = createElements(2);
		const moves = [{ element: near, x: 0, y: 30 }, { element: far, x: 0, y: window.innerHeight + 1 }];
		const seen: MotionTransition[] = [];
		const play = (transition: MotionTransition) => {
			seen.push(transition);
		};

		playMotion(defineMotionEngine({ play, stop: () => undefined }), { kind: 'rows', moves });
		playMotion(defineMotionEngine({ play, stop: () => undefined, farMoves: 'play' }), { kind: 'rows', moves });

		expect(seen.map(transition => transition.moves.map(move => move.element))).toEqual([[near], [near, far]]);
	});

	it('plays nothing for a reduced motion preference, unless `reducedMotion` is `\'play\'`', () => {
		vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));

		const [element] = createElements(1);
		const play = vi.fn();

		playMotion(defineMotionEngine({ play, stop: () => undefined }), { kind: 'rows', moves: [{ element, x: 0, y: 30 }] });

		expect(play).not.toHaveBeenCalled();

		playMotion(defineMotionEngine({ play, stop: () => undefined, reducedMotion: 'play' }), { kind: 'rows', moves: [{ element, x: 0, y: 30 }] });

		expect(play).toHaveBeenCalledOnce();
	});

	it('takes a function alone for `play`', async () => {
		const [element, leaf] = createElements(2);
		const played: MotionTransition[] = [];
		const engine = defineMotionEngine((transition) => {
			played.push(transition);
		});

		await playMotion(engine, { kind: 'rows', moves: [{ element, x: 0, y: 30 }], leaves: [leaf] }).finished;

		expect(played).toHaveLength(1);
		expect(leaf.isConnected).toBe(false);
	});

	it('leaves an animation to `play` without a `stop`', () => {
		const [element] = createElements(1);
		const { animation } = createAnimation();
		let aborted = false;
		const engine = defineMotionEngine(({ signal }) => {
			signal.addEventListener('abort', () => {
				aborted = true;
			});

			return animation;
		});

		playMotion(engine, { kind: 'rows', moves: [{ element, x: 0, y: 30 }] }).stop();

		expect(aborted).toBe(true);
		expect(animation.stopped).toBe(false);
	});
});
