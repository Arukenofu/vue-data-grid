/** Marks an item of a drag list that may be dragged now; `steps` when Alt with the arrows moves it too. */
export const DRAGGABLE_ATTRIBUTE = 'data-dg-draggable';

/** The drag handle of a row: with `handle`, drags start only on it. */
export const DRAG_HANDLE_SELECTOR = '[data-dg-part="drag-handle"]';

/**
 * Controls inside a cell that keep their own gestures and keys: a press on them, a list's scrollbar
 * included, neither starts a drag nor selects cells. A drag handle is never one of them.
 */
export const CONTROL_SELECTOR = [
	'a[href]',
	'audio',
	'button',
	'input',
	'label',
	'select',
	'summary',
	'textarea',
	'video',
	'[contenteditable]:not([contenteditable="false"])',
	...[
		'button',
		'checkbox',
		'combobox',
		'link',
		'listbox',
		'menu',
		'menuitem',
		'menuitemcheckbox',
		'menuitemradio',
		'option',
		'radio',
		'searchbox',
		'separator',
		'slider',
		'spinbutton',
		'switch',
		'tab',
		'textbox',
	].map(role => `[role="${role}"]`),
].map(selector => `${selector}:not(${DRAG_HANDLE_SELECTOR})`).join(', ');

/** Elements that take text themselves: a paste, a cut, a copy and a double click in them are theirs. */
export const TEXT_FIELD_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
