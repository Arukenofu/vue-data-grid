import type { MotionChange, MotionEngine, MotionPlayback, MotionTransition } from './model';

/**
 * A running transition as the registry holds it: all that another copy of the package, of any
 * version, may rely on. A change of this shape takes a new registry key.
 */
export interface SharedRun {
	/** The elements it moves, which a new change carries on from where they are drawn. */
	readonly moves: readonly Element[];
	/** Cuts the transition short; does nothing once it has ended. */
	stop: () => void;
}

interface Run extends SharedRun {
	controller: AbortController;
	/** Every element the transition animates. */
	elements: readonly Element[];
	leaves: readonly Element[];
	ended: boolean;
	resolve: () => void;
}

/**
 * The transition each element is in. A global symbol rather than a module variable: two copies of the
 * package on a page, such as one bundled by a grid and one by the app, still see each other's
 * transitions, so that a new one cuts the running one short rather than playing on top of it. The
 * key names the version of `SharedRun`, so that copies that disagree on it keep apart.
 */
const RUNS: unique symbol = Symbol.for('@vue-data-grid/flip/runs@1');

type Registry = typeof globalThis & { [RUNS]?: WeakMap<Element, SharedRun> };

function getRuns() {
	const registry = globalThis as Registry;

	registry[RUNS] ??= new WeakMap();

	return registry[RUNS];
}

const DONE: MotionPlayback = Object.freeze({ finished: Promise.resolve(), stop: () => undefined });

function end(run: Run) {
	if (run.ended) {
		return;
	}

	run.ended = true;

	const runs = getRuns();

	for (const element of run.elements) {
		if (runs.get(element) === run) {
			runs.delete(element);
		}
	}

	for (const element of run.leaves) {
		element.remove();
	}

	run.resolve();
}

/** The running transitions the elements are in, whichever copy of the package started them. */
export function findRuns(elements: Iterable<Element>) {
	const runs = getRuns();
	const found = new Set<SharedRun>();

	for (const element of elements) {
		const run = runs.get(element);

		if (run) {
			found.add(run);
		}
	}

	return found;
}

/**
 * Cuts short the transitions the elements are in, whoever started them: every element of those
 * transitions jumps to its final state, and their leaves go. For a change made without movement,
 * so that nothing keeps moving towards a place that is gone.
 */
export function stopMotion(elements: Iterable<Element>) {
	for (const run of findRuns(elements)) {
		run.stop();
	}
}

/**
 * Plays a change that has already happened in the DOM with `engine`. The elements' running
 * transitions are cut short first. Without an engine, or with nothing to animate, it ends at once:
 * leaves are removed.
 */
export function playMotion(engine: MotionEngine | null | undefined, change: MotionChange): MotionPlayback {
	const moves = change.moves ?? [];
	const enters = change.enters ?? [];
	const leaves = change.leaves ?? [];

	if (!engine || moves.length + enters.length + leaves.length === 0) {
		for (const element of leaves) {
			element.remove();
		}

		return DONE;
	}

	const elements = [...moves.map(move => move.element), ...enters, ...leaves];

	stopMotion(elements);

	let resolve: () => void = () => undefined;
	const finished = new Promise<void>((settle) => {
		resolve = settle;
	});
	const run: Run = {
		controller: new AbortController(),
		elements,
		moves: moves.map(move => move.element),
		leaves,
		ended: false,
		resolve,
		stop() {
			if (!run.ended) {
				run.controller.abort();
				end(run);
			}
		},
	};
	const runs = getRuns();

	for (const element of elements) {
		runs.set(element, run);
	}

	const transition: MotionTransition = {
		kind: change.kind,
		moves,
		enters,
		leaves,
		context: change.context,
		signal: run.controller.signal,
	};
	let result: PromiseLike<unknown> | void;

	try {
		result = engine(transition);
	} catch (error) {
		end(run);
		throw error;
	}

	if (result && typeof result.then === 'function') {
		result.then(() => end(run), () => end(run));
	} else {
		end(run);
	}

	return { finished, stop: run.stop };
}
