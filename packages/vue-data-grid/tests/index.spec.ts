import * as core from '@vue-data-grid/core';
import { describe, expect, it } from 'vitest';

import * as table from '../src/index';

describe('entry point', () => {
	it('re-exports every runtime export of the core', () => {
		expect(Object.keys(core).filter(name => !(name in table))).toEqual([]);
	});

	it('re-exports the core itself, not a copy: one injection key, one engine', () => {
		expect(table.TABLE_SCOPE).toBe(core.TABLE_SCOPE);
		expect(table.useTableEngine).toBe(core.useTableEngine);
	});
});
