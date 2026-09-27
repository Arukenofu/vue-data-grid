import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { playMotion } from '../src/play';
import { fadeIn, fadeOut, slide, webAnimations } from '../src/web-animations';
import { createElements, type PlayedAnimation, stubAnimations } from './support';

let played: PlayedAnimation[];

beforeEach(() => {
	played = stubAnimations();
});

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('webAnimations', () => {
	it('slides a move by `translate`, layered over the element\'s own', () => {
		const [element] = createElements(1);

		playMotion(webAnimations(), { kind: 'rows', moves: [{ element, x: 0, y: -30 }] });

		expect(played[0].keyframes).toEqual([{ translate: '0px -30px' }, { translate: '0px 0px' }]);
		expect(played[0].options).toEqual({ duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'backwards', composite: 'add' });
	});

	it('fades an enter in and a leave out, from and to the element\'s own opacity', () => {
		const [enter, leave] = createElements(2);

		playMotion(webAnimations({ duration: 300 }), { kind: 'rows', enters: [enter], leaves: [leave] });

		expect(played.map(item => [item.element, item.keyframes, item.options])).toEqual([
			[enter, [{ opacity: 0, offset: 0 }], { duration: 300, easing: 'linear', fill: 'backwards' }],
			[leave, [{ opacity: 0 }], { duration: 300, easing: 'linear', fill: 'forwards' }],
		]);
	});

	it('without `fade` only moves', () => {
		const [element, enter, leave] = createElements(3);

		playMotion(webAnimations({ fade: false }), { kind: 'rows', moves: [{ element, x: 5, y: 0 }], enters: [enter], leaves: [leave] });

		expect(played.map(item => item.element)).toEqual([element]);
		expect(leave.isConnected).toBe(false);
	});

	it('ends the transition once every animation has finished', async () => {
		const [element, leave] = createElements(2);
		const playback = playMotion(webAnimations(), { kind: 'rows', moves: [{ element, x: 0, y: 30 }], leaves: [leave] });

		played[0].finish();
		await Promise.resolve();

		expect(leave.isConnected).toBe(true);

		played[1].finish();
		await playback.finished;

		expect(leave.isConnected).toBe(false);
	});

	it('cancels its animations when the transition is cut short', () => {
		const [element] = createElements(1);
		const playback = playMotion(webAnimations(), { kind: 'rows', moves: [{ element, x: 0, y: 30 }] });

		playback.stop();

		expect(played[0].cancelled).toBe(true);
	});

	it('does not play a move from farther than a screen away', () => {
		const [element] = createElements(1);

		playMotion(webAnimations(), { kind: 'rows', moves: [{ element, x: 0, y: window.innerHeight + 1 }] });

		expect(played).toEqual([]);
	});

	it('plays nothing for a reduced motion preference or no duration', () => {
		const [element] = createElements(1);
		const move = { element, x: 0, y: 30 };

		playMotion(webAnimations({ duration: 0 }), { kind: 'rows', moves: [move] });
		vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
		playMotion(webAnimations(), { kind: 'rows', moves: [move] });

		expect(played).toEqual([]);
	});
});

describe('slide, fadeIn and fadeOut', () => {
	it('slide stands at the start during a delay and always layers over the own `translate`', () => {
		const [element] = createElements(1);

		slide({ element, x: 10, y: 0 }, { delay: 40, composite: 'replace' });

		expect(played[0].keyframes).toEqual([{ translate: '10px 0px' }, { translate: '0px 0px' }]);
		expect(played[0].options).toMatchObject({ delay: 40, fill: 'backwards', composite: 'add' });
	});

	it('fadeIn stays hidden during a delay, and fadeOut holds the element hidden at the end', () => {
		const [enter, leave] = createElements(2);

		fadeIn(enter, { delay: 40 });
		fadeOut(leave);

		expect(played.map(item => [item.keyframes, item.options])).toEqual([
			[[{ opacity: 0, offset: 0 }], { duration: 200, easing: 'linear', fill: 'backwards', delay: 40 }],
			[[{ opacity: 0 }], { duration: 200, easing: 'linear', fill: 'forwards' }],
		]);
	});
});
