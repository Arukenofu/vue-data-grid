import * as flip from '@vue-stack/flip';
import { describe, expect, it } from 'vitest';

import * as dragAndDrop from '../src/index';

describe('exports', () => {
	it('re-exports the whole API of `@vue-stack/flip`', () => {
		for (const [name, value] of Object.entries(flip)) {
			expect(dragAndDrop).toHaveProperty(name, value);
		}
	});
});
