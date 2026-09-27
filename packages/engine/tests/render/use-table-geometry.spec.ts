import { effectScope, nextTick, shallowRef } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import type { GeometryLayer } from '../../src/render/geometry';
import { useTableGeometry } from '../../src/render/use-table-geometry';

function createTable() {
	const root = document.createElement('div');

	root.innerHTML = [
		'<div role="row"><i data-dg-column="price"></i><i data-dg-column="cap"></i></div>',
		'<div role="row"><i data-dg-column="price"></i><i data-dg-column="cap"></i></div>',
	].join('');

	document.body.append(root);

	return root;
}

const cells = (root: HTMLElement, column: string) =>
	[...root.querySelectorAll<HTMLElement>(`[data-dg-column="${column}"]`)];

const inline = (element: HTMLElement, name: string) => element.style.getPropertyValue(name);

function setup(root: HTMLElement, initial: readonly GeometryLayer[] = []) {
	const layers = shallowRef<readonly GeometryLayer[]>(initial);
	const scope = effectScope();

	scope.run(() => useTableGeometry(() => root, layers));

	return { layers, scope };
}

let scopes: ReturnType<typeof effectScope>[] = [];

afterEach(() => {
	scopes.forEach(scope => scope.stop());
	scopes = [];
	document.body.innerHTML = '';
});

function track(result: ReturnType<typeof setup>) {
	scopes.push(result.scope);

	return result;
}

describe('useTableGeometry — root layer', () => {
	it('writes properties on the root itself', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [{ selector: null, style: { '--dg-width-price': '200px', '--dg-inset-start': '44px' } }];
		await nextTick();

		expect(inline(root, '--dg-width-price')).toBe('200px');
		expect(inline(root, '--dg-inset-start')).toBe('44px');
	});

	it('removes a property that is no longer in the layer', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [{ selector: null, style: { '--a': '1px', '--b': '2px' } }];
		await nextTick();

		layers.value = [{ selector: null, style: { '--a': '1px' } }];
		await nextTick();

		expect(inline(root, '--a')).toBe('1px');
		expect(inline(root, '--b')).toBe('');
	});

	it('layers with one selector are merged', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [
			{ selector: null, style: { '--a': '1px' } },
			{ selector: null, style: { '--b': '2px' } },
		];
		await nextTick();

		expect(inline(root, '--a')).toBe('1px');
		expect(inline(root, '--b')).toBe('2px');
	});

	it('a later layer overrides an earlier one for the same property', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [
			{ selector: null, style: { '--a': '1px' } },
			{ selector: null, style: { '--a': '9px' } },
		];
		await nextTick();

		expect(inline(root, '--a')).toBe('9px');
	});
});

describe('useTableGeometry — selector layer', () => {
	it('writes to every cell of the column and leaves the root alone', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [{ selector: '[data-dg-column="price"]', style: { '--dg-width-price': '240px' } }];
		await nextTick();

		expect(cells(root, 'price').map(cell => inline(cell, '--dg-width-price'))).toEqual(['240px', '240px']);
		expect(inline(root, '--dg-width-price')).toBe('');
	});

	it('leaves other columns alone', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [{ selector: '[data-dg-column="price"]', style: { '--dg-width-price': '240px' } }];
		await nextTick();

		expect(cells(root, 'cap').every(cell => inline(cell, '--dg-width-price') === '')).toBe(true);
	});

	it('a removed layer takes everything with it, or a resize override would outlive the gesture', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [{ selector: '[data-dg-column="price"]', style: { '--dg-width-price': '240px' } }];
		await nextTick();

		layers.value = [];
		await nextTick();

		expect(cells(root, 'price').every(cell => inline(cell, '--dg-width-price') === '')).toBe(true);
	});

	it('a layer writes regular properties too, not only variables', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [{ selector: '[role="row"]', style: { 'min-width': '900px' } }];
		await nextTick();

		expect([...root.querySelectorAll<HTMLElement>('[role="row"]')].map(row => inline(row, 'min-width')))
			.toEqual(['900px', '900px']);
	});

	it('a selector that matches nothing does not throw', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [{ selector: '[data-dg-column="zzz"]', style: { '--a': '1px' } }];

		await expect(nextTick()).resolves.not.toThrow();
	});
});

describe('useTableGeometry — fresh elements', () => {
	it('an element rendered in this frame gets the whole layer', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [{ selector: '[data-dg-column="price"]', style: { '--dg-width-price': '240px' } }];
		await nextTick();

		const row = document.createElement('div');

		row.innerHTML = '<i data-dg-column="price"></i>';
		root.append(row);

		layers.value = [{ selector: '[data-dg-column="price"]', style: { '--dg-width-price': '240px' } }];
		await nextTick();

		expect(cells(root, 'price').map(cell => inline(cell, '--dg-width-price')))
			.toEqual(['240px', '240px', '240px']);
	});

	it('the root stays the same between frames: an unchanged property is not rewritten', async () => {
		const root = createTable();
		const { layers } = track(setup(root));
		const writes: string[] = [];
		const original = root.style.setProperty.bind(root.style);

		layers.value = [{ selector: null, style: { '--a': '1px' } }];
		await nextTick();

		root.style.setProperty = (name: string, value: string | null) => {
			writes.push(name);
			original(name, value);
		};

		layers.value = [{ selector: null, style: { '--a': '1px', '--b': '2px' } }];
		await nextTick();

		expect(writes).toEqual(['--b']);
	});
});

describe('useTableGeometry — root and layers together', () => {
	it('committed geometry lives on the root, resize overrides on the cells', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [
			{ selector: null, style: { '--dg-width-price': '120px' } },
			{ selector: '[data-dg-column="price"]', style: { '--dg-width-price': '240px' } },
		];
		await nextTick();

		expect(inline(root, '--dg-width-price')).toBe('120px');
		expect(cells(root, 'price').map(cell => inline(cell, '--dg-width-price'))).toEqual(['240px', '240px']);
	});

	it('the end of a gesture removes the overlay and leaves the root with the new committed width', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [
			{ selector: null, style: { '--dg-width-price': '120px' } },
			{ selector: '[data-dg-column="price"]', style: { '--dg-width-price': '240px' } },
		];
		await nextTick();

		layers.value = [{ selector: null, style: { '--dg-width-price': '240px' } }];
		await nextTick();

		expect(inline(root, '--dg-width-price')).toBe('240px');
		expect(cells(root, 'price').every(cell => inline(cell, '--dg-width-price') === '')).toBe(true);
	});
});

describe('useTableGeometry — no root yet', () => {
	it('writes nothing and does not throw before mount', async () => {
		const host = shallowRef<HTMLElement | null>(null);
		const layers = shallowRef<readonly GeometryLayer[]>([{ selector: null, style: { '--a': '1px' } }]);
		const scope = effectScope();

		scope.run(() => useTableGeometry(host, layers));
		scopes.push(scope);

		await expect(nextTick()).resolves.not.toThrow();
	});

	it('a root that appears gets the geometry', async () => {
		const root = createTable();
		const host = shallowRef<HTMLElement | null>(null);
		const layers = shallowRef<readonly GeometryLayer[]>([{ selector: null, style: { '--a': '1px' } }]);
		const scope = effectScope();

		scope.run(() => useTableGeometry(host, layers));
		scopes.push(scope);

		host.value = root;
		await nextTick();

		expect(inline(root, '--a')).toBe('1px');
	});
});

const mutations = () => new Promise(resolve => setTimeout(resolve));

describe('useTableGeometry — what is written stays written', () => {
	it('the root gets its properties back when its `style` is replaced as a whole', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [{ selector: null, style: { '--dg-width-price': '200px' } }];
		await nextTick();

		root.style.cssText = 'height: 300px';
		await mutations();

		expect(inline(root, '--dg-width-price')).toBe('200px');
		expect(inline(root, 'height')).toBe('300px');
	});

	it('a cell mounted while a selector layer is active gets the layer', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [{ selector: '[data-dg-column="price"]', style: { '--dg-width-price': '240px' } }];
		await nextTick();

		const row = document.createElement('div');

		row.innerHTML = '<i data-dg-column="price"></i><i data-dg-column="cap"></i>';
		root.append(row);
		await mutations();

		expect(cells(root, 'price').map(cell => inline(cell, '--dg-width-price'))).toEqual(['240px', '240px', '240px']);
		expect(cells(root, 'cap').every(cell => inline(cell, '--dg-width-price') === '')).toBe(true);
	});

	it('the end of the layer clears the cells mounted during it too', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [{ selector: '[data-dg-column="price"]', style: { '--dg-width-price': '240px' } }];
		await nextTick();

		const row = document.createElement('div');

		row.innerHTML = '<i data-dg-column="price"></i>';
		root.append(row);
		await mutations();

		layers.value = [];
		await nextTick();

		expect(cells(root, 'price').every(cell => inline(cell, '--dg-width-price') === '')).toBe(true);
	});

	it('without a selector layer mounted cells are left alone', async () => {
		const root = createTable();
		const { layers } = track(setup(root));

		layers.value = [{ selector: null, style: { '--a': '1px' } }];
		await nextTick();

		const row = document.createElement('div');

		row.innerHTML = '<i data-dg-column="price"></i>';
		root.append(row);
		await mutations();

		expect(inline(row.firstElementChild as HTMLElement, '--a')).toBe('');
	});

	it('a new root gets every property, not only the changed ones', async () => {
		const first = createTable();
		const second = createTable();
		const host = shallowRef<HTMLElement | null>(first);
		const layers = shallowRef<readonly GeometryLayer[]>([{ selector: null, style: { '--a': '1px' } }]);
		const scope = effectScope();

		scope.run(() => useTableGeometry(host, layers));
		scopes.push(scope);
		await nextTick();

		host.value = second;
		await nextTick();

		expect(inline(second, '--a')).toBe('1px');
	});
});
