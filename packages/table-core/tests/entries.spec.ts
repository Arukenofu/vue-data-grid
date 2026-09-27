import { describe, expect, it } from 'vitest';

import * as cells from '../src/cells';
import * as columnGroups from '../src/column-groups';
import * as columns from '../src/columns';
import * as engine from '../src/engine';
import * as root from '../src/index';
import * as internals from '../src/internals';
import * as persist from '../src/persist';
import * as render from '../src/render';
import * as rows from '../src/rows';
import * as shared from '../src/shared';
import * as virtual from '../src/virtual';

/** Runtime exports only: types leave no trace to compare. */
const barrels = {
	...persist,
	...columns,
	...columnGroups,
	...engine,
	...virtual,
	...render,
	...rows,
	...cells,
	...shared,
};

describe('entry points', () => {
	it('every export of the modules is in exactly one entry point', () => {
		const misplaced = Object.keys(barrels).filter(name => (name in root) === (name in internals));

		expect(misplaced).toEqual([]);
	});

	it('entry points export nothing the modules do not', () => {
		const unknown = [...Object.keys(root), ...Object.keys(internals)].filter(name => !(name in barrels));

		expect(unknown).toEqual([]);
	});
});
