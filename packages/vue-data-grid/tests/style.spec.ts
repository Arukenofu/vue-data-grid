import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Read from disk: Vitest hands CSS imports to tests empty.
const styles = readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8');

function readValues(attribute: string) {
	const pattern = new RegExp(String.raw`\[${attribute}(?:='([\w-]+)')?\]`, 'g');

	return new Set([...styles.matchAll(pattern)].map(match => match[1] ?? ''));
}

describe('style.css', () => {
	// A pseudo-element cannot sit inside :where(): it weighs as an element, less than any class of yours.
	it('every rule has no specificity: selectors sit inside :where()', () => {
		const selectors = styles
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.split('}')
			.map(block => block.split('{')[0].trim())
			.filter(Boolean);

		expect(selectors.length).toBeGreaterThan(10);
		expect(selectors.filter(selector => !/^:where\(.*\)(::[\w-]+)?$/.test(selector))).toEqual([]);
	});

	it('styles the parts `useTableProps` and the table parts name, and no other', () => {
		expect(readValues('data-tc-part')).toEqual(
			new Set(['table', 'head', 'foot', 'body', 'row', 'cell-text', 'resize-handle', 'sort-indicator', 'tree-indent', 'tree-toggle', 'announcer', 'empty', 'empty-cell', 'loading', 'drag-handle', 'drag-preview', 'drag-overlay', 'range', 'range-cell', 'editor', 'editor-error', 'editor-list', 'editor-option', 'editor-empty', 'cell-checkbox', 'fill-handle']),
		);
		expect(readValues('data-tc-row-layout')).toEqual(new Set(['positioned']));
	});
});
