import type { DragPoint } from '@vue-data-grid/drag-and-drop';
import { captureLayout, type MotionEngine, stopMotion } from '@vue-data-grid/flip';
import { type GeometryLayer, getColumnCellSelector } from '@vue-data-grid/core';
import { computed, onScopeDispose, shallowRef } from 'vue';

import type { DataTable } from '../data-table/use-data-table';

/**
 * Columns a drag moves apart as whole columns: the header, the body and the footer cells of each
 * move by one `translate`. The cells already there get it at once, moving; a geometry layer, kept
 * only while a column is moved, gives it to the cells that mount mid-gesture, such as rows scrolled
 * into view.
 */
export function createColumnShift(table: DataTable) {
	const shifts = shallowRef<ReadonlyMap<string, number>>(new Map());
	const layers = computed(() => {
		const result: GeometryLayer[] = [];

		for (const [name, x] of shifts.value) {
			result.push({ selector: getColumnCellSelector(name), style: { translate: `${x}px 0px` } });
		}

		return result;
	});

	let release: (() => void) | null = null;

	onScopeDispose(() => release?.());

	/** Moves each column of `changes` by its offset from its place, with `engine` as a `'gap'` or at once. */
	function shift(changes: ReadonlyMap<string, DragPoint>, engine: MotionEngine | null) {
		const next = new Map(shifts.value);

		for (const [name, { x }] of changes) {
			if (x === 0) {
				next.delete(name);
			} else {
				next.set(name, x);
			}
		}

		shifts.value = next;

		if (next.size > 0) {
			release ??= table.addLayers(layers);
		} else {
			release?.();
			release = null;
		}

		const cells: HTMLElement[] = [];
		const offsets: number[] = [];

		for (const cell of table.root.value?.querySelectorAll<HTMLElement>('[data-tc-column]') ?? []) {
			const change = changes.get(cell.dataset.tcColumn ?? '');

			if (change) {
				cells.push(cell);
				offsets.push(change.x);
			}
		}

		// Every read before the first write, or the browser would restyle the table for each cell.
		const capture = engine ? captureLayout(cells) : null;

		if (!capture) {
			stopMotion(cells);
		}

		cells.forEach((cell, index) => {
			if (offsets[index] === 0) {
				cell.style.removeProperty('translate');
			} else {
				cell.style.setProperty('translate', `${offsets[index]}px 0px`);
			}
		});

		capture?.animate(cells, engine, { kind: 'gap' });
	}

	return { shift };
}
