import { getColumnCellSelector } from '@vue-data-grid/engine';

// The copy keeps the attributes of the cell, and so the padding and the type the styles give it, but
// not the containment that keeps a cell from growing with its content.
const MEASURE_STYLE = {
	position: 'absolute',
	top: '0',
	left: '0',
	visibility: 'hidden',
	width: 'max-content',
	minWidth: '0',
	maxWidth: 'none',
	flex: 'none',
	contain: 'none',
};

const TEXT_SAMPLE = 64;

export interface MeasureColumnsOptions {
	/**
	 * Cell texts by column name, to also cover rows outside the row window. Each text is measured in the
	 * font of a body cell, plus what the body cell takes beyond its text, so the texts must match what
	 * the cells show.
	 */
	texts?: ReadonlyMap<string, readonly string[]>;
	/** The attribute of body rows: a cell inside such a row is a body cell. `data-dg-index` by default. */
	bodyAttribute?: string;
	/** Text width in a font, px; measured with a canvas by default. `null` when it cannot be measured. */
	measureText?: (text: string, font: string) => number | null;
}

let context: CanvasRenderingContext2D | null | undefined;

function measureWithCanvas(text: string, font: string) {
	context ??= document.createElement('canvas').getContext('2d');

	if (!context) {
		return null;
	}

	context.font = font;

	return context.measureText(text).width;
}

function findTextElement(cell: HTMLElement) {
	const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);

	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (node.textContent?.trim() && node.parentElement) {
			return node.parentElement;
		}
	}

	return null;
}

function getFont(element: HTMLElement) {
	const style = getComputedStyle(element);

	return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function sampleLongest(texts: readonly string[]) {
	const unique = [...new Set(texts)];

	return unique.length <= TEXT_SAMPLE
		? unique
		: unique.sort((first, second) => second.length - first.length).slice(0, TEXT_SAMPLE);
}

interface MeasuredCell {
	cell: HTMLElement;
	width: number;
}

function measureTexts(
	cells: readonly MeasuredCell[],
	texts: readonly string[],
	bodyAttribute: string,
	measureText: (text: string, font: string) => number | null,
) {
	let font: string | null = null;
	let extra: number | null = null;

	for (const { cell, width } of cells) {
		const element = cell.closest(`[${bodyAttribute}]`) ? findTextElement(cell) : null;

		if (!element) {
			continue;
		}

		font ??= getFont(element);

		const text = measureText(cell.textContent?.trim() ?? '', font);

		if (text === null) {
			return null;
		}

		extra = Math.max(extra ?? Number.NEGATIVE_INFINITY, width - text);
	}

	if (font === null || extra === null) {
		return null;
	}

	let result = 0;

	for (const text of sampleLongest(texts)) {
		result = Math.max(result, (measureText(text, font) ?? 0) + extra);
	}

	return result;
}

/**
 * Content widths of columns from their rendered header, body and footer cells; columns without cells
 * are left out. Each cell is measured through a copy placed next to it: the same ancestors and so the
 * same CSS, but out of flow and without a set width. All copies are inserted, read in one layout pass
 * and removed in the same task. With a row window only rendered rows count, unless `texts` are given.
 */
export function measureColumnsContent(
	root: HTMLElement,
	names: readonly string[],
	options: MeasureColumnsOptions = {},
) {
	const groups = names
		.map(name => ({ name, cells: [...root.querySelectorAll<HTMLElement>(getColumnCellSelector(name))] }))
		.filter(group => group.cells.length > 0);

	const copies = groups.map(group => group.cells.map((cell) => {
		const copy = cell.cloneNode(true) as HTMLElement;

		copy.setAttribute('aria-hidden', 'true');
		Object.assign(copy.style, MEASURE_STYLE);
		cell.after(copy);

		return copy;
	}));

	const measured = groups.map((group, index) => group.cells.map((cell, position) => ({
		cell,
		width: copies[index][position].getBoundingClientRect().width,
	})));

	for (const copy of copies.flat()) {
		copy.remove();
	}

	const result = new Map<string, number>();

	groups.forEach((group, index) => {
		const cells = measured[index];
		const texts = options.texts?.get(group.name);
		let width = Math.max(...cells.map(cell => cell.width));

		if (texts && texts.length > 0) {
			const byText = measureTexts(
				cells,
				texts,
				options.bodyAttribute ?? 'data-dg-index',
				options.measureText ?? measureWithCanvas,
			);

			width = Math.max(width, byText ?? 0);
		}

		result.set(group.name, Math.ceil(width));
	});

	return result;
}
