import { type MotionEngine, type MotionTransition, webAnimations } from '@vue-stack/flip';
import { defineColumn, defineColumns } from '@vue-stack/table-core';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type ShallowRef, shallowRef } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TableRoot } from '../../src/components/table-root';
import { type DataTable, useDataTable } from '../../src/data-table/use-data-table';
import { type TableMotion, type TableMotionChange, type TableMotionOptions, useTableMotion } from '../../src/motion/use-table-motion';
import { place, placeTable, stubLayout } from '../support/drag';
import { renderBody, renderHeader } from '../support/parts';

interface Task {
	id: string;
}

const column = defineColumn<Task>({ movable: true, resizable: true });

const columns = defineColumns({
	name: column(row => row.id, { label: 'Name' }),
	id: column(row => row.id, { label: 'Id' }),
});

interface Played {
	element: Element;
	keyframes: Keyframe[];
	/** Ends the animation as the browser would when its time is up. */
	finish: () => void;
}

const wrappers: ReturnType<typeof mount>[] = [];

let played: Played[];

/** `withoutBody`: the parts of a table of your own that have no body, as a table on the engine may. */
function setup(options: TableMotionOptions = {}, withoutBody = false) {
	const rows: ShallowRef<Task[]> = shallowRef([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
	let table: DataTable | null = null;
	let motion: TableMotion | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			table = useDataTable({ columns, rows, rowKey: 'id', rowHeight: 30 }) as DataTable;
			motion = useTableMotion(withoutBody ? { scope: table.scope, state: table.state, root: table.root } : table, options);

			return () => h(TableRoot, { table: table as DataTable }, { default: () => [renderHeader(), renderBody()] });
		},
	}), { attachTo: document.body });

	wrappers.push(wrapper);

	const root = wrapper.get('[data-tc-part="table"]').element;

	placeTable(root);

	/** Changes the rows or the columns, and lays the table out again once it has re-rendered. */
	async function change(update: () => void) {
		update();
		void nextTick(() => placeTable(root));
		await nextTick();
	}

	const row = (id: string) => root.querySelector(`[data-tc-part="row"][data-tc-index="${rows.value.findIndex(item => item.id === id)}"]`) as Element;

	return { table: table as unknown as DataTable, motion: motion as unknown as TableMotion, rows, root, row, change };
}

function movesOf(element: Element) {
	return played.filter(item => item.element === element).map(item => item.keyframes);
}

beforeEach(() => {
	stubLayout();
	played = [];
	vi.spyOn(Element.prototype, 'animate').mockImplementation(function animate(this: Element, keyframes) {
		let finish: () => void = () => undefined;
		const animation = {
			cancel: () => undefined,
			finished: new Promise<void>((resolve) => {
				finish = resolve;
			}),
		};

		played.push({ element: this, keyframes: keyframes as Keyframe[], finish });

		return animation as unknown as Animation;
	});
});

afterEach(() => {
	wrappers.splice(0).forEach(wrapper => wrapper.unmount());
	document.body.innerHTML = '';
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('useTableMotion', () => {
	it('slides the rows from where they were when their order changes', async () => {
		const { rows, row, change } = setup();

		await change(() => {
			rows.value = [{ id: 'b' }, { id: 'a' }, { id: 'c' }];
		});

		expect(movesOf(row('a'))).toEqual([[{ translate: '0px -30px' }, { translate: '0px 0px' }]]);
		expect(movesOf(row('b'))).toEqual([[{ translate: '0px 30px' }, { translate: '0px 0px' }]]);
		expect(movesOf(row('c'))).toEqual([]);
	});

	it('fades a new row in where it is, while the rows below slide down from over it', async () => {
		const { rows, row, change } = setup();

		await change(() => {
			rows.value = [{ id: 'a' }, { id: 'x' }, { id: 'b' }, { id: 'c' }];
		});

		expect(movesOf(row('x'))).toEqual([[{ opacity: 0, offset: 0 }]]);
		expect(movesOf(row('b'))).toEqual([[{ translate: '0px -30px' }, { translate: '0px 0px' }]]);
		expect(movesOf(row('a'))).toEqual([]);
	});

	it('fades a row that leaves out where it was, under the rows that slide up over it', async () => {
		const { rows, row, root, change } = setup();

		await change(() => {
			rows.value = [{ id: 'a' }, { id: 'c' }];
		});

		const body = root.querySelector('[data-tc-part="body"]') as HTMLElement;
		const copy = body.firstElementChild as HTMLElement;

		expect(copy.getAttribute('data-tc-state')).toBe('leaving');
		expect(copy.getAttribute('aria-hidden')).toBe('true');
		expect(copy.hasAttribute('role')).toBe(false);
		expect(copy.hasAttribute('data-tc-index')).toBe(false);
		expect(copy.style.top).toBe('30px');
		expect(movesOf(copy)).toEqual([[{ opacity: 0 }]]);
		expect(movesOf(row('c'))).toEqual([[{ translate: '0px 30px' }, { translate: '0px 0px' }]]);

		played.forEach(item => item.finish());
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(copy.isConnected).toBe(false);
	});

	it('takes the rows still fading out away at the next change', async () => {
		const { rows, root, change } = setup();

		await change(() => {
			rows.value = [{ id: 'a' }, { id: 'c' }];
		});

		const copy = root.querySelector('[data-tc-state="leaving"]');

		await change(() => {
			rows.value = [{ id: 'c' }, { id: 'a' }];
		});

		expect(copy?.isConnected).toBe(false);
	});

	it('an engine without fades shows a new row at once and lets a row that leaves go at once', async () => {
		const { rows, row, root, change } = setup({ engine: webAnimations({ fade: false }) });

		await change(() => {
			rows.value = [{ id: 'x' }, { id: 'a' }, { id: 'c' }];
		});

		expect(movesOf(row('x'))).toEqual([]);
		expect(root.querySelector('[data-tc-state="leaving"]')).toBeNull();
		expect(movesOf(row('a'))).toEqual([[{ translate: '0px -30px' }, { translate: '0px 0px' }]]);
	});

	it('slides every cell of the columns that moved, the header and the body alike', async () => {
		const { table, root, change } = setup();

		await change(() => table.scope.moveColumnTo('name', 1));

		const cells = (name: string) => [...root.querySelectorAll(`[data-tc-column="${name}"]`)];

		expect(cells('name')).toHaveLength(4);
		expect(cells('name').map(movesOf)).toEqual(Array(4).fill([[{ translate: '-100px 0px' }, { translate: '0px 0px' }]]));
		expect(cells('id').map(movesOf)).toEqual(Array(4).fill([[{ translate: '100px 0px' }, { translate: '0px 0px' }]]));
	});

	it('moves nothing when `when` says no, or for a reduced motion preference', async () => {
		const off = setup({ when: () => false });

		await off.change(() => {
			off.rows.value = [{ id: 'c' }, { id: 'b' }, { id: 'a' }];
			off.table.scope.moveColumnTo('name', 1);
		});

		expect(played).toEqual([]);

		vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));

		const reduced = setup();

		await reduced.change(() => {
			reduced.rows.value = [{ id: 'c' }, { id: 'b' }, { id: 'a' }];
		});

		expect(played).toEqual([]);
	});

	it('measures nothing when the rows change but not their order', async () => {
		const { rows, change } = setup();
		const measured = vi.mocked(Element.prototype.getBoundingClientRect);

		measured.mockClear();
		await change(() => {
			rows.value = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
		});

		expect(measured).not.toHaveBeenCalled();
		expect(played).toEqual([]);
	});

	it('leaves alone the rows of a table inside a cell', async () => {
		const { rows, row, change } = setup();
		const inner = document.createElement('div');
		const innerRow = document.createElement('div');

		inner.setAttribute('data-tc-part', 'body');
		innerRow.setAttribute('data-tc-part', 'row');
		innerRow.setAttribute('data-tc-index', '0');
		inner.append(innerRow);
		row('c').append(inner);
		place(innerRow, { left: 0, top: 500, right: 600, bottom: 530 });

		await change(() => {
			rows.value = [{ id: 'b' }, { id: 'a' }, { id: 'c' }];
		});

		expect(movesOf(innerRow)).toEqual([]);
		expect(movesOf(row('a'))).toEqual([[{ translate: '0px -30px' }, { translate: '0px 0px' }]]);
	});

	describe('control', () => {
		function record() {
			const transitions: MotionTransition[] = [];
			const engine: MotionEngine = (transition) => {
				transitions.push(transition);
			};

			return { engine, transitions };
		}

		it('hands the engine the rows that moved, came and went, of the kind `rows`', async () => {
			const { engine, transitions } = record();
			const { rows, row, change } = setup({ engine });

			await change(() => {
				rows.value = [{ id: 'x' }, { id: 'a' }, { id: 'c' }];
			});

			expect(transitions).toHaveLength(1);
			expect(transitions[0].kind).toBe('rows');
			expect(transitions[0].moves).toEqual([{ element: row('a'), x: 0, y: -30 }]);
			expect(transitions[0].enters).toEqual([row('x')]);
			expect(transitions[0].leaves.map(element => element.getAttribute('data-tc-state'))).toEqual(['leaving']);
			expect(played).toEqual([]);
		});

		it('`run` animates with its context, and `skip` does not animate', async () => {
			const { engine, transitions } = record();
			const when = vi.fn((_change: TableMotionChange) => true);
			const { rows, motion, change } = setup({ engine, when });

			await change(() => void motion.skip(() => {
				rows.value = [{ id: 'b' }, { id: 'a' }, { id: 'c' }];
			}));

			expect(transitions).toEqual([]);
			expect(when).not.toHaveBeenCalled();

			await change(() => void motion.run(() => {
				rows.value = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
			}, 'sort'));

			expect(when).toHaveBeenCalledWith({ kind: 'rows', context: 'sort' });
			expect(transitions.map(({ kind, context }) => [kind, context])).toEqual([['rows', 'sort']]);
		});

		it('`trigger: \'run\'` animates only the changes made inside `run`', async () => {
			const { engine, transitions } = record();
			const { rows, motion, table, change } = setup({ engine, trigger: 'run' });

			await change(() => {
				rows.value = [{ id: 'b' }, { id: 'a' }, { id: 'c' }];
			});

			expect(transitions).toEqual([]);

			await change(() => void motion.run(() => table.scope.moveColumnTo('name', 1), 'keyboard'));

			expect(transitions.map(({ kind, context }) => [kind, context])).toEqual([['columns', 'keyboard']]);
		});

		it('`run` follows an async update until it settles', async () => {
			const { engine, transitions } = record();
			const { rows, root, motion } = setup({ engine, trigger: 'run' });
			let load: () => void = () => undefined;
			const loaded = new Promise<void>((resolve) => {
				load = resolve;
			});
			const running = motion.run(async () => {
				await loaded;
				rows.value = [{ id: 'c' }, { id: 'b' }, { id: 'a' }];
				void nextTick(() => placeTable(root));
			}, 'load');

			load();
			await running;
			await nextTick();

			expect(transitions.map(({ context }) => context)).toEqual(['load']);
		});

		it('`when` decides by the kind of the change', async () => {
			const { engine, transitions } = record();
			const { rows, table, change } = setup({ engine, when: ({ kind }) => kind === 'columns' });

			await change(() => {
				rows.value = [{ id: 'b' }, { id: 'a' }, { id: 'c' }];
				table.scope.moveColumnTo('name', 1);
			});

			expect(transitions.map(({ kind }) => kind)).toEqual(['columns']);
		});

		it('`stop` cuts the running movement short', async () => {
			const signals: AbortSignal[] = [];
			const { rows, motion, change } = setup({
				engine: ({ signal }) => {
					signals.push(signal);

					return new Promise(() => undefined);
				},
			});

			await change(() => {
				rows.value = [{ id: 'b' }, { id: 'a' }, { id: 'c' }];
			});
			motion.stop();

			expect(signals.map(signal => signal.aborted)).toEqual([true]);
		});
	});

	describe('widths', () => {
		/** Animation frames that run only when told, at the time given. */
		function stubFrames() {
			const callbacks = new Map<number, FrameRequestCallback>();
			let id = 0;

			vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
				id += 1;
				callbacks.set(id, callback);

				return id;
			});
			vi.stubGlobal('cancelAnimationFrame', (handle: number) => callbacks.delete(handle));
			vi.spyOn(performance, 'now').mockReturnValue(1000);

			return {
				run: (now: number) => {
					const pending = [...callbacks.values()];

					callbacks.clear();
					pending.forEach(callback => callback(now));
				},
			};
		}

		/** Every render and every callback after it, the measuring of the new widths included. */
		function settled() {
			return new Promise(resolve => setTimeout(resolve, 0));
		}

		function header(root: Element, name: string) {
			return root.querySelector(`[data-tc-part="head"] [data-tc-column="${name}"]`) as Element;
		}

		function previews(spy: { mock: { calls: unknown[][] } }) {
			return spy.mock.calls.map(([widths]) => widths).filter(widths => widths !== null);
		}

		it('draws the columns from their old widths to the new ones, then leaves them to the layout', async () => {
			const frames = stubFrames();
			const { table, root } = setup();
			const preview = vi.spyOn(table.scope, 'previewWidths');

			table.scope.setWidths({ name: 160 });
			void nextTick(() => place(header(root, 'name'), { left: 0, top: 0, right: 160, bottom: 30 }));
			await settled();

			expect(previews(preview)).toEqual([{ name: 100 }]);

			frames.run(1100);

			expect(previews(preview).at(-1)).toEqual({ name: 152.5 });

			frames.run(1200);

			expect(preview).toHaveBeenLastCalledWith(null);
		});

		it('animates the widths of a table without a body, whose rows stay still', async () => {
			const frames = stubFrames();
			const { table, root, rows, change } = setup({}, true);
			const preview = vi.spyOn(table.scope, 'previewWidths');

			await change(() => {
				rows.value = [{ id: 'c' }, { id: 'b' }, { id: 'a' }];
			});

			expect(played).toEqual([]);

			table.scope.setWidths({ name: 160 });
			void nextTick(() => place(header(root, 'name'), { left: 0, top: 0, right: 160, bottom: 30 }));
			await settled();
			frames.run(1200);

			expect(previews(preview)).toEqual([{ name: 100 }]);
		});

		it('never animates a resize with the pointer, `widths: false`, or what `when` refuses', async () => {
			stubFrames();

			for (const options of [{}, { widths: false as const }, { when: ({ kind }: TableMotionChange) => kind !== 'widths' }]) {
				const { table, root } = setup(options);
				const preview = vi.spyOn(table.scope, 'previewWidths');
				const resizing = Object.keys(options).length === 0;

				if (resizing) {
					// Drawn at the new width during the gesture already.
					table.scope.resize('name', 160);
					place(header(root, 'name'), { left: 0, top: 0, right: 160, bottom: 30 });
					table.scope.commitResize();
				} else {
					table.scope.setWidths({ name: 160 });
					void nextTick(() => place(header(root, 'name'), { left: 0, top: 0, right: 160, bottom: 30 }));
				}

				await settled();

				expect(previews(preview)).toEqual([]);
			}
		});
	});
});
