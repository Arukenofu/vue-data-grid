import { effectScope, type EffectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bindDragSource } from '../src/drag-manager';
import type { DragPayload } from '../src/model';
import { useDropTarget } from '../src/use-drop-target';
import { createList, type Frames, place, pointer, stubFrames, stubLayout } from './support';

let frames: Frames;
let scope: EffectScope | null = null;
let unbind: (() => void) | null = null;

function drag(payload: Partial<DragPayload>) {
	const { container, get } = createList(['a']);
	const bin = document.createElement('div');

	document.body.append(bin);
	place(bin, { left: 400, top: 0, right: 500, bottom: 100 });
	unbind = bindDragSource(container, {
		resolve: () => ({ element: get('a'), payload: { kind: 'row', key: 'a', origin: Symbol('x'), group: null, ...payload } }),
	});

	return { item: get('a'), bin };
}

beforeEach(() => {
	stubLayout();
	frames = stubFrames();
});

afterEach(() => {
	pointer('pointercancel', window, { x: 0, y: 0 });
	unbind?.();
	scope?.stop();
	document.body.innerHTML = '';
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('useDropTarget', () => {
	it('takes a payload of its kinds and hears it arrive and drop', () => {
		const { item, bin } = drag({});
		const onDrop = vi.fn();

		scope = effectScope();

		const target = scope.run(() => useDropTarget(bin, { kinds: ['row'], onDrop }));

		pointer('pointerdown', item, { x: 50, y: 15 });
		pointer('pointermove', window, { x: 450, y: 50 });

		expect(target?.dragging.value?.key).toBe('a');

		frames.run();

		expect(target?.over.value).toBe(true);

		pointer('pointerup', window, { x: 450, y: 50 });

		expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ key: 'a' }));
		expect(target?.dragging.value).toBeNull();
	});

	it('ignores other kinds, other groups and what `canDrop` rejects', () => {
		const { item, bin } = drag({ group: 'left' });

		scope = effectScope();

		const byKind = scope.run(() => useDropTarget(bin, { kinds: ['column'] }));
		const byGroup = scope.run(() => useDropTarget(bin, { kinds: ['row'], group: 'right' }));
		const byRule = scope.run(() => useDropTarget(bin, { kinds: ['row'], canDrop: () => false }));

		pointer('pointerdown', item, { x: 50, y: 15 });
		pointer('pointermove', window, { x: 450, y: 50 });

		expect([byKind, byGroup, byRule].map(target => target?.dragging.value)).toEqual([null, null, null]);
	});
});
