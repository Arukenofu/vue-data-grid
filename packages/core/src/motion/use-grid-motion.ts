import {
	captureLayout,
	type LayoutItem,
	type MotionEngine,
	type MotionMove,
	type MotionPlayback,
	playMotion,
	prefersReducedMotion,
	webAnimations,
} from '@vue-data-grid/flip';
import { computed, type MaybeRef, type MaybeRefOrGetter, nextTick, onScopeDispose, toValue, unref, watch } from 'vue';

import type { DataGrid } from '../data-grid/use-data-grid';
import { DEFAULT_INDEX_ATTRIBUTE } from '../props/use-grid-props';

/** A change of the grid about to be animated. */
export interface GridMotionChange {
	/**
	 * `'rows'`: the rows of the body changed, in order or in number; `'columns'`: the order of the
	 * columns; `'widths'`: the widths of the columns in the layout, such as a fit or an autosize.
	 */
	kind: 'rows' | 'columns' | 'widths';
	/** What `run` passed along; `undefined` for a change made outside `run`. */
	context: unknown;
}

export interface GridMotionOptions {
	/**
	 * Plays the movement: `webAnimations()` by default. It gets transitions of the kind `'rows'` or
	 * `'columns'`, with the `context` of `run`. A ref rather than a getter: an engine is a function
	 * itself.
	 */
	engine?: MaybeRef<MotionEngine | undefined>;
	/**
	 * Which changes animate: `'change'`, every change of the order, but those made inside `skip`;
	 * `'run'`, only those made inside `run`. `'change'` by default.
	 */
	trigger?: MaybeRefOrGetter<'change' | 'run' | undefined>;
	/** Whether to animate a change the `trigger` lets through; every one by default. Asked before anything is measured. */
	when?: (change: GridMotionChange) => boolean;
	/**
	 * How the columns go from their old widths to the new ones when the layout changes them, such as
	 * `fitColumns`, an autosize or a reset; `false` for at once. A resize with the pointer is never
	 * animated: the edge follows the pointer. The engine plays no widths: they are frames of the
	 * layout, drawn through `scope.previewWidths` without a render.
	 */
	widths?: GridMotionWidths | false;
}

export interface GridMotionWidths {
	/** How long the widths take, ms; `200` by default. */
	duration?: number;
	/** The share of the way done at a share of the time, both 0 to 1; a quick start that slows into place by default. */
	easing?: (progress: number) => number;
}

export interface GridMotion {
	/**
	 * Animates the changes `update` makes, with `context` for `when` and the engine, whatever the
	 * `trigger`. An async `update` animates the changes made until it settles.
	 */
	run: <T>(update: () => T, context?: unknown) => Promise<Awaited<T>>;
	/** Makes the changes of `update` without movement, whatever the `trigger`. */
	skip: <T>(update: () => T) => Promise<Awaited<T>>;
	/** Cuts the running movement short: every row and cell jumps to its place. */
	stop: () => void;
}

interface Directive {
	animate: boolean;
	context: unknown;
}

const ROW_SELECTOR = '[data-dg-part="row"]';
const BODY_SELECTOR = '[data-dg-part="body"]';
const CELL_SELECTOR = '[data-dg-column]';
const GROUP_SELECTOR = '[data-dg-columns]';

const DEFAULT_ENGINE = webAnimations();

const WIDTHS_DURATION = 200;

function easeOut(progress: number) {
	return 1 - (1 - progress) ** 3;
}

/** How wide each column is drawn, by its first cell. */
function measureWidths(root: HTMLElement) {
	const widths = new Map<string, number>();

	for (const cell of root.querySelectorAll<HTMLElement>(CELL_SELECTOR)) {
		const name = cell.dataset.dgColumn;

		if (name !== undefined && !widths.has(name)) {
			widths.set(name, cell.getBoundingClientRect().width);
		}
	}

	return widths;
}

function isSameKeys(first: readonly string[], second: readonly string[]) {
	if (first.length !== second.length) {
		return false;
	}

	for (let index = 0; index < first.length; index += 1) {
		if (first[index] !== second[index]) {
			return false;
		}
	}

	return true;
}

/** The first cell of each column by name, which tells where the column is, and the group cells. */
function findColumnItems(root: HTMLElement) {
	const items: LayoutItem<string>[] = [];
	const names = new Set<string>();

	for (const cell of root.querySelectorAll<HTMLElement>(CELL_SELECTOR)) {
		const name = cell.dataset.dgColumn;

		if (name !== undefined && !names.has(name)) {
			names.add(name);
			items.push([name, cell]);
		}
	}

	for (const cell of root.querySelectorAll(GROUP_SELECTOR)) {
		items.push(cell);
	}

	return items;
}

/**
 * A still copy of a row that leaves, standing where the row was drawn, for the engine to see off: out
 * of the grid for assistive technology and the keyboard, with no ids, no index and no role, so that
 * nothing takes it for a row. It has `data-dg-state="leaving"`.
 */
function copyLeavingRow(row: HTMLElement, box: DOMRect, body: DOMRect, indexAttribute: string) {
	const copy = row.cloneNode(true) as HTMLElement;

	for (const name of copy.getAttributeNames()) {
		if (name === 'id' || name === 'role' || name === 'tabindex' || name === indexAttribute || name.startsWith('aria-')) {
			copy.removeAttribute(name);
		}
	}

	for (const element of copy.querySelectorAll('[id]')) {
		element.removeAttribute('id');
	}

	copy.setAttribute('aria-hidden', 'true');
	copy.setAttribute('data-dg-state', 'leaving');
	copy.inert = true;
	Object.assign(copy.style, {
		position: 'absolute',
		top: `${box.top - body.top}px`,
		left: `${box.left - body.left}px`,
		width: `${box.width}px`,
		height: `${box.height}px`,
		margin: '0',
		translate: 'none',
		pointerEvents: 'none',
	});

	return copy;
}

/**
 * What `useGridMotion` animates: the grid of `useDataGrid`, or the same parts of a grid built on
 * the engine of the core. The rows move only with a `body`, the element of `getBodyProps`, whose rows
 * carry `indexAttribute`, `data-dg-index` by default; the columns and their widths need only the
 * `root`.
 */
export type MotionGrid<TRow = unknown> = Pick<DataGrid<TRow>, 'scope' | 'state' | 'root'>
	& Partial<Pick<DataGrid<TRow>, 'body' | 'indexAttribute'>>;

/**
 * Animates the rows and the columns of a grid whenever their order changes, from wherever the
 * change comes: a drag or its keyboard, a sort, a group expanded or collapsed, `moveColumnTo`, your
 * data. The grid measures and the engine plays: rows that stay are moves from where they were drawn,
 * rows that come are enters, and rows that go are leaves, still copies where they stood; the cells
 * of a column move with it. The widths of the columns go to the new ones too, when the layout changes
 * them.
 *
 * What animates is yours to say: `trigger` and `when` for every change, `run` and `skip` for one.
 * How is the engine's: `webAnimations()` by default, or GSAP, anime.js, Motion, your own. Call it in
 * `setup`, with the grid of `useDataGrid`.
 */
export function useGridMotion<TRow>(grid: MotionGrid<TRow>, options: GridMotionOptions = {}): GridMotion {
	const { scope } = grid;
	const indexAttribute = grid.indexAttribute ?? DEFAULT_INDEX_ATTRIBUTE;

	let directive: Directive | null = null;
	let rowsPlayback: MotionPlayback | null = null;
	let columnsPlayback: MotionPlayback | null = null;
	let widthsFrame: number | null = null;
	// Settles once the first frame of a change of widths is in the DOM: the columns measure after it.
	let widthsDrawn: Promise<void> | null = null;

	function stopWidths() {
		if (widthsFrame !== null) {
			cancelAnimationFrame(widthsFrame);
			widthsFrame = null;
		}

		scope.previewWidths(null);
	}

	function stop() {
		rowsPlayback?.stop();
		columnsPlayback?.stop();
		rowsPlayback = null;
		columnsPlayback = null;
		stopWidths();
	}

	onScopeDispose(stop);

	/** The engine and the context of a change, or `null` when it does not animate. */
	function resolve(kind: GridMotionChange['kind']) {
		const current = directive;
		const animate = current ? current.animate : (toValue(options.trigger) ?? 'change') === 'change';
		const context = current?.context;

		if (!animate || (options.when && !options.when({ kind, context }))) {
			return null;
		}

		return { engine: unref(options.engine) ?? DEFAULT_ENGINE, context };
	}

	/** The changes `update` makes follow `own` until it settles and the grid has rendered them. */
	async function direct<T>(own: Directive, update: () => T): Promise<Awaited<T>> {
		const previous = directive;

		directive = own;

		try {
			return await update();
		} finally {
			await nextTick();

			if (directive === own) {
				directive = previous;
			}
		}
	}

	/** The rows of the body by key: its own, not those of a grid inside a cell, nor leaving copies. */
	function findRows(body: HTMLElement, keys: readonly string[]) {
		const own = body.matches(BODY_SELECTOR);
		const rows: { row: HTMLElement; key: string }[] = [];

		for (const row of body.querySelectorAll<HTMLElement>(ROW_SELECTOR)) {
			const key = keys[Number(row.getAttribute(indexAttribute) ?? Number.NaN)];

			if (key !== undefined && (!own || row.closest(BODY_SELECTOR) === body)) {
				rows.push({ row, key });
			}
		}

		return rows;
	}

	// Before the render: the rows are where the old order drew them, and their indexes are the old ones.
	watch(() => scope.rowKeys.value, (keys, previous) => {
		const body = grid.body?.value;

		if (!body || !previous || isSameKeys(keys, previous)) {
			return;
		}

		const motion = resolve('rows');

		if (!motion) {
			rowsPlayback?.stop();
			rowsPlayback = null;

			return;
		}

		const rows = findRows(body, previous);
		const bodyBox = body.getBoundingClientRect();
		// A row gone from the grid, not only from view: copied now, while it is still what it was.
		const copies = rows
			.filter(({ key }) => scope.getRowIndex(key) === -1)
			.map(({ row }) => copyLeavingRow(row, row.getBoundingClientRect(), bodyBox, indexAttribute));
		const capture = captureLayout(rows.map(({ row, key }) => [key, row] as const));

		rowsPlayback?.stop();

		// After the flush, the effects that clear a drag's gap included.
		void nextTick(() => {
			// First in the body, so that the rows moving over the place they leave cover them.
			body.prepend(...copies);
			rowsPlayback = capture.animate(
				findRows(body, keys).map(({ row, key }) => [key, row] as const),
				motion.engine,
				{ kind: 'rows', leaves: copies, context: motion.context },
			);
		});
	}, { flush: 'pre' });

	/** From the widths drawn before a change to those after it, frame by frame, starting now. */
	function playWidths(from: ReadonlyMap<string, number>, to: ReadonlyMap<string, number>) {
		const settings = options.widths || {};
		const duration = settings.duration ?? WIDTHS_DURATION;
		const easing = settings.easing ?? easeOut;
		const names = [...to.keys()].filter(name => from.has(name) && Math.abs((from.get(name) ?? 0) - (to.get(name) ?? 0)) >= 1);

		if (names.length === 0 || duration <= 0) {
			return;
		}

		function at(progress: number) {
			return Object.fromEntries(names.map((name) => {
				const start = from.get(name) ?? 0;

				return [name, start + ((to.get(name) ?? 0) - start) * progress];
			}));
		}

		const started = performance.now();

		function step(now: number) {
			const progress = Math.min(Math.max((now - started) / duration, 0), 1);

			if (progress >= 1) {
				widthsFrame = null;
				scope.previewWidths(null);

				return;
			}

			scope.previewWidths(at(easing(progress)));
			widthsFrame = requestAnimationFrame(step);
		}

		scope.previewWidths(at(0));
		widthsFrame = requestAnimationFrame(step);
	}

	// By value: a layout written for another reason, such as the order, may bring a new object of the same widths.
	const widths = computed(() => Object.entries(grid.state.layout.value?.widths ?? {})
		.sort(([first], [second]) => (first < second ? -1 : 1))
		.join(';'));

	// Before the render: the columns are drawn at the old widths, or where a running change has them.
	watch(widths, () => {
		const root = grid.root.value;
		const before = root && options.widths !== false && resolve('widths') && !prefersReducedMotion()
			? measureWidths(root)
			: null;

		stopWidths();

		if (!root || !before) {
			return;
		}

		const drawn: Promise<void> = nextTick(() => {
			playWidths(before, measureWidths(root));

			return nextTick();
		}).then(() => {
			if (widthsDrawn === drawn) {
				widthsDrawn = null;
			}
		});

		widthsDrawn = drawn;
	}, { flush: 'pre' });

	const order = computed(() => scope.columns.value.map(item => item.column?.name ?? '').join('\u0000'));

	watch(order, () => {
		const root = grid.root.value;

		if (!root) {
			return;
		}

		const motion = resolve('columns');

		if (!motion) {
			columnsPlayback?.stop();
			columnsPlayback = null;

			return;
		}

		const capture = captureLayout(findColumnItems(root));

		columnsPlayback?.stop();

		function play(host: HTMLElement, from: typeof capture, change: NonNullable<typeof motion>) {
			const after = findColumnItems(host);
			const firsts = new Map<Element, string>();

			for (const item of after) {
				if (!(item instanceof Element)) {
					firsts.set(item[1], item[0]);
				}
			}

			// A column appears in place: its enters are not played.
			const { moves } = from.compare(after);
			const shifts = new Map<string, number>();
			const result: MotionMove[] = [];
			const moved = new Set<Element>();

			for (const move of moves) {
				const name = firsts.get(move.element);

				if (name === undefined) {
					result.push(move);
					moved.add(move.element);
				} else {
					shifts.set(name, move.x);
				}
			}

			if (shifts.size > 0) {
				for (const cell of host.querySelectorAll<HTMLElement>(CELL_SELECTOR)) {
					const x = shifts.get(cell.dataset.dgColumn ?? '');

					if (x !== undefined && !moved.has(cell)) {
						result.push({ element: cell, x, y: 0 });
					}
				}
			}

			columnsPlayback = playMotion(change.engine, { kind: 'columns', moves: result, context: change.context });
		}

		void nextTick(() => {
			// Measured where a change of widths starts from, when there is one: the widths then carry
			// the columns the rest of the way.
			if (widthsDrawn) {
				void widthsDrawn.then(() => play(root, capture, motion));
			} else {
				play(root, capture, motion);
			}
		});
	}, { flush: 'pre' });

	return {
		run: (update, context) => direct({ animate: true, context }, update),
		skip: update => direct({ animate: false, context: undefined }, update),
		stop,
	};
}
