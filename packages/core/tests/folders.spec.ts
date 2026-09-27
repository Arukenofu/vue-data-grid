/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>('../src/*/*.ts', { query: '?raw', import: 'default', eager: true });

/** The layer of each source folder: a folder imports only folders of lower layers. */
const LAYERS: Readonly<Record<string, number>> = {
	shared: 0,
	persist: 0,
	columns: 1,
	render: 2,
	rows: 2,
	'column-groups': 3,
	virtual: 3,
	engine: 4,
	cells: 5,
};

function getFolderGraph() {
	const graph = new Map<string, Set<string>>();

	for (const [path, source] of Object.entries(sources)) {
		const folder = path.split('/')[2];
		const targets = graph.get(folder) ?? new Set<string>();

		for (const [, target] of source.matchAll(/from\s+'\.\.\/([\w-]+)\//g)) {
			if (target !== folder) {
				targets.add(target);
			}
		}

		graph.set(folder, targets);
	}

	return graph;
}

describe('source folders', () => {
	it('each have a layer', () => {
		expect([...getFolderGraph().keys()].filter(folder => LAYERS[folder] === undefined)).toEqual([]);
	});

	it('import only folders of lower layers', () => {
		const upward: string[] = [];

		for (const [folder, targets] of getFolderGraph()) {
			for (const target of targets) {
				if (!(LAYERS[target] < LAYERS[folder])) {
					upward.push(`${folder} → ${target}`);
				}
			}
		}

		expect(upward).toEqual([]);
	});
});
