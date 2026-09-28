import * as core from '@vue-data-grid/engine';
import { describe, expect, it } from 'vitest';

import * as grid from '../src/index';

describe('entry point', () => {
	it('re-exports every runtime export of the core', () => {
		expect(Object.keys(core).filter(name => !(name in grid))).toEqual([]);
	});

	it('re-exports the core itself, not a copy: one injection key, one engine', () => {
		expect(grid.GRID_SCOPE).toBe(core.GRID_SCOPE);
		expect(grid.useGridEngine).toBe(core.useGridEngine);
	});
});
