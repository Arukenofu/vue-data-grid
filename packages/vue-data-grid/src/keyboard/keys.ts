/** The `keyCode` of a key an input method takes. */
const IME_KEY_CODE = 229;

/**
 * Whether a key with Ctrl or ⌘ is this letter's shortcut. A Latin layout names the letter in `key`; a
 * layout of another script names its own letter there, so its shortcuts go by the physical key.
 */
export function isShortcutLetter(event: KeyboardEvent, letter: string) {
	return /^[a-z]$/i.test(event.key)
		? event.key.toLowerCase() === letter
		: event.code === `Key${letter.toUpperCase()}`;
}

/**
 * Whether a key belongs to the composition of an input method, such as Enter choosing a candidate of
 * Japanese or Chinese input: it is the input method's, not a command. Safari reports such keys with
 * `keyCode` 229 only.
 */
export function isComposing(event: KeyboardEvent) {
	return event.isComposing || event.keyCode === IME_KEY_CODE;
}

/** Whether an element lays out right to left, so that ← and → swap their meaning. */
export function isRtl(element: Element | null | undefined) {
	return element !== null && element !== undefined && getComputedStyle(element).direction === 'rtl';
}
