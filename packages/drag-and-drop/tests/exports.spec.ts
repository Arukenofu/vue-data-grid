import * as flip from '@vue-data-grid/flip';
import { describe, expect, it } from 'vitest';

import * as dragAndDrop from '../src/index';

describe('exports', () => {
	it('re-exports the whole API of `@vue-data-grid/flip`', () => {
		for (const [name, value] of Object.entries(flip)) {
			expect(dragAndDrop).toHaveProperty(name, value);
		}
	});
});
