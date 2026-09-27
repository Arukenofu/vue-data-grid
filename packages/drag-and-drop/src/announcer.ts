/** What an announcement is about: the item and the place it is at or goes to. */
export interface DragAnnouncement {
	/** Label of the dragged item. */
	item: string;
	/** 1-based position among the siblings at the place. */
	position: number;
	/** How many siblings the place has, the item included. */
	total: number;
	/** Label of the parent at the place; `null` at the top level. */
	parent: string | null;
}

/** What screen readers hear during a keyboard drag. */
export interface DragAnnouncements {
	/** How to drag, read when an item gets focus: bind `aria-describedby` to `describedBy`. */
	instructions: string;
	pickUp: (context: DragAnnouncement) => string;
	move: (context: DragAnnouncement) => string;
	drop: (context: DragAnnouncement) => string;
	cancel: (context: DragAnnouncement) => string;
}

function describePlace({ position, total, parent }: DragAnnouncement) {
	return parent === null ? `position ${position} of ${total}` : `position ${position} of ${total} in ${parent}`;
}

export const DEFAULT_ANNOUNCEMENTS: DragAnnouncements = {
	instructions: 'To move, press Space or Enter, then the arrow keys. Space or Enter drops, Escape cancels.',
	pickUp: context => `Picked up ${context.item}, ${describePlace(context)}.`,
	move: context => `${context.item}: ${describePlace(context)}.`,
	drop: context => `Dropped ${context.item} at ${describePlace(context)}.`,
	cancel: context => `Cancelled. ${context.item} stays at ${describePlace(context)}.`,
};

const HIDDEN_STYLE: Partial<CSSStyleDeclaration> = {
	position: 'absolute',
	width: '1px',
	height: '1px',
	margin: '-1px',
	padding: '0',
	overflow: 'hidden',
	clipPath: 'inset(50%)',
	whiteSpace: 'nowrap',
	border: '0',
};

const instructionElements = new Map<string, HTMLElement>();

let region: HTMLElement | null = null;

function createHidden() {
	const element = document.createElement('div');

	Object.assign(element.style, HIDDEN_STYLE);
	document.body.append(element);

	return element;
}

/** Reads `message` out through a shared live region. */
export function announce(message: string) {
	if (!region?.isConnected) {
		region = createHidden();
		region.setAttribute('role', 'status');
		region.setAttribute('aria-live', 'assertive');
		region.setAttribute('aria-atomic', 'true');
	}

	// The same text twice in a row would not be read again.
	region.textContent = region.textContent === message ? `${message} ` : message;
}

function hash(text: string) {
	let value = 5381;

	for (let index = 0; index < text.length; index += 1) {
		value = ((value << 5) + value + text.charCodeAt(index)) >>> 0;
	}

	return value.toString(36);
}

/** The id of the hidden element with these instructions: the same text gives the same id everywhere. */
export function getInstructionsId(text: string) {
	return `drag-instructions-${hash(text)}`;
}

/** Puts the instructions into the document, once per text; call it on the client only. */
export function mountInstructions(text: string) {
	const existing = instructionElements.get(text);

	if (existing?.isConnected) {
		return;
	}

	const element = createHidden();

	element.id = getInstructionsId(text);
	element.textContent = text;
	instructionElements.set(text, element);
}
