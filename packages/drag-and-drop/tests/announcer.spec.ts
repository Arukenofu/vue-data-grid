import { afterEach, describe, expect, it } from 'vitest';

import { announce, DEFAULT_ANNOUNCEMENTS, getInstructionsId, mountInstructions } from '../src/announcer';

afterEach(() => {
	document.body.innerHTML = '';
});

function region() {
	return document.querySelector('[aria-live]');
}

describe('announce', () => {
	it('writes to one assertive live region', () => {
		announce('Picked up a.');
		announce('a: position 2 of 3.');

		expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
		expect(region()?.textContent).toBe('a: position 2 of 3.');
		expect(region()?.getAttribute('role')).toBe('status');
	});

	it('the same message twice still changes the region, or it would not be read again', () => {
		announce('Same.');

		const first = region()?.textContent;

		announce('Same.');

		expect(region()?.textContent).not.toBe(first);
	});
});

describe('instructions', () => {
	it('the id depends only on the text', () => {
		expect(getInstructionsId('Press Space.')).toBe(getInstructionsId('Press Space.'));
		expect(getInstructionsId('Press Space.')).not.toBe(getInstructionsId('Press Enter.'));
	});

	it('are mounted once per text, under that id', () => {
		mountInstructions(DEFAULT_ANNOUNCEMENTS.instructions);
		mountInstructions(DEFAULT_ANNOUNCEMENTS.instructions);

		const elements = document.querySelectorAll(`#${getInstructionsId(DEFAULT_ANNOUNCEMENTS.instructions)}`);

		expect(elements).toHaveLength(1);
		expect(elements[0].textContent).toBe(DEFAULT_ANNOUNCEMENTS.instructions);
	});
});

describe('default announcements', () => {
	it('name the parent only inside a tree', () => {
		const context = { item: 'a', position: 2, total: 5, parent: null };

		expect(DEFAULT_ANNOUNCEMENTS.move(context)).toBe('a: position 2 of 5.');
		expect(DEFAULT_ANNOUNCEMENTS.drop({ ...context, parent: 'docs' })).toBe('Dropped a at position 2 of 5 in docs.');
	});
});
