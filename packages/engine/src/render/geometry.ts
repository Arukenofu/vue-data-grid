import type { ColumnGeometry, ColumnPinSide } from '../columns/column';

const ESCAPE_MARK = '·';

function isPlainLetter(char: string) {
	return (char.codePointAt(0) ?? 0) >= 0xC0 && /[\p{L}\p{N}]/u.test(char);
}

/**
 * Column name as a `<dashed-ident>` fragment. ASCII word characters, `-` and non-Latin letters pass
 * as is; any other character becomes `·<hex>·`. The mark itself is never passed through, so the
 * mapping is injective: two columns never share a variable or a `data-dg-columns` token.
 */
function toVariableName(name: string) {
	return name.replace(/[^\w-]/gu, char => (isPlainLetter(char)
		? char
		: `${ESCAPE_MARK}${(char.codePointAt(0) ?? 0).toString(16)}${ESCAPE_MARK}`));
}

export function getWidthVariable(name: string) {
	return `--dg-width-${toVariableName(name)}`;
}

export function getPinVariable(pin: ColumnPinSide, name: string) {
	return `--dg-pin-${pin}-${toVariableName(name)}`;
}

/**
 * The grow factor of a `flex` column, set to `0` while the column has a user-set width: otherwise a
 * resize would change only the basis, the column would grow the space back, and the edge under the
 * pointer would not move.
 */
export function getGrowVariable(name: string) {
	return `--dg-grow-${toVariableName(name)}`;
}

/** Width of your service columns at one edge of the row; pinned columns on that side stick after them. */
export function getInsetVariable(side: ColumnPinSide) {
	return `--dg-inset-${side}`;
}

/**
 * A piece of geometry and where to write it. A custom property is inherited, so writing it on the
 * root restyles the whole subtree; a layer sends a change only to the elements that read it.
 */
export interface GeometryLayer {
	/** A selector within the root; `null` for the root itself. */
	selector: string | null;
	/** Properties and values, custom or not. */
	style: Readonly<Record<string, string>>;
}

/**
 * The layer of pinned cells over the cells that scroll under them, `1` by default. A variable rather
 * than a number: an inline style beats any rule, and a pinned cell may need to rise over its
 * neighbours, such as while it is being edited.
 */
const PINNED_LAYER_VARIABLE = '--dg-pinned-z-index';

/**
 * Sticking to an edge of the row after the insets and the pinned columns before it. Logical rather
 * than physical sides, so that a right-to-left table pins `start` to the right.
 */
function getPinDeclarations(pin: ColumnPinSide, name: string, offset: number) {
	const side = pin === 'start' ? 'inset-inline-start' : 'inset-inline-end';
	const inset = `var(${getInsetVariable(pin)}, 0px)`;
	const shift = `var(${getPinVariable(pin, name)}, ${offset}px)`;

	return ['position:sticky', `z-index:var(${PINNED_LAYER_VARIABLE}, 1)`, `${side}:calc(${inset} + ${shift})`];
}

function getWidthExpression(column: ColumnGeometry) {
	return column.resizable ? `var(${getWidthVariable(column.name)}, ${column.width}px)` : `${column.width}px`;
}

/**
 * The geometry of a cell in a flex row: its basis, grow factor and limits, and `position: sticky`
 * with its offset when pinned. How the cell lays out its content (`display`, alignment by
 * `data-dg-align`, `overflow`) is left to CSS, such as `@vue-data-grid/core/style.css`. A string rather
 * than an object: `createVNode` normalizes an object style by writing to `props.style`, which frozen
 * props shared by all rows would not survive.
 */
export function compileCellStyle(column: ColumnGeometry, pin: ColumnPinSide | undefined, offset: number) {
	const width = getWidthExpression(column);

	const grow = column.resizable && column.flex > 0
		? `var(${getGrowVariable(column.name)}, ${column.flex})`
		: `${column.flex}`;

	const style = [`flex:${grow} 1 ${width}`, `min-width:${width}`];

	if (column.maxWidth !== undefined) {
		style.push(`max-width:${column.maxWidth}px`);
	}

	if (pin) {
		style.push(...getPinDeclarations(pin, column.name, offset));
	}

	return style.join(';');
}

export function getFlexSpacerStyle(width: number) {
	return `flex:0 0 ${width}px;min-width:${width}px`;
}

/** What the group style function receives: the columns under the cell, their pin and their grow. */
export interface GroupGeometry {
	/** Shown columns under the cell, in display order. */
	columns: readonly ColumnGeometry[];
	pin: ColumnPinSide | undefined;
	/** Offset of a pinned cell from its edge: the offset of its outermost column on that side. */
	offset: number;
	/** The sum of the columns' grow factors, with user-sized columns counted as `0`. */
	grow: number;
}

/**
 * The style of a group cell in a flex row: the basis is the sum of its columns' bases and the grow is
 * the sum of their grow factors, so the cell stays above its columns. The grow is a number rather
 * than a `calc()` of variables, which older Safari does not accept in `flex-grow`. A growing column
 * with `maxWidth` breaks this at its limit: its row neighbours take the rest, and the group row does
 * not know.
 */
export function compileGroupStyle(group: GroupGeometry) {
	const width = `calc(${group.columns.map(getWidthExpression).join(' + ')})`;
	const style = [`flex:${group.grow} 1 ${width}`, `min-width:${width}`];
	const edge = group.pin === 'end' ? group.columns[group.columns.length - 1] : group.columns[0];

	if (group.pin && edge) {
		style.push(...getPinDeclarations(group.pin, edge.name, group.offset));
	}

	return style.join(';');
}

/**
 * How geometry becomes styles. Flex, grid and `<table>` rows read the same width and pin variables
 * and differ only in these strings. Each function runs once per column or group cell when its
 * geometry changes, not once per row, and must read only its arguments: the cache key is built from
 * them, and anything else it reads will not reach the style.
 */
export interface TableCellStyles {
	cell: (column: ColumnGeometry, pin: ColumnPinSide | undefined, offset: number) => string;
	/** The header cell style; without it headers use the body style. */
	header?: (column: ColumnGeometry, pin: ColumnPinSide | undefined, offset: number) => string;
	/** The group cell style; without it group cells get no style. */
	group?: (group: GroupGeometry) => string;
	/** The style of a column-window spacer `width` px wide. */
	spacer: (width: number) => string;
}

/**
 * Styles for a flex row: `compileCellStyle` for cells and headers, `compileGroupStyle` for groups,
 * `getFlexSpacerStyle` for spacers. Geometry only; the look of the cells is CSS.
 */
export const FLEX_CELL_STYLES: TableCellStyles = Object.freeze({
	cell: compileCellStyle,
	group: compileGroupStyle,
	spacer: getFlexSpacerStyle,
});

/**
 * The offset of each pinned column from its edge by declared widths: what the server renders, and the
 * `var()` fallback that resizing overrides.
 */
export function getPinOffsets(
	columns: readonly Pick<ColumnGeometry, 'name' | 'width'>[],
	getPin: (name: string) => ColumnPinSide | undefined,
) {
	const offsets = new Map<string, number>();
	let start = 0;
	let end = 0;

	for (const column of columns) {
		if (getPin(column.name) === 'start') {
			offsets.set(column.name, start);
			start += column.width;
		}
	}

	for (let index = columns.length - 1; index >= 0; index -= 1) {
		const column = columns[index];

		if (getPin(column.name) === 'end') {
			offsets.set(column.name, end);
			end += column.width;
		}
	}

	return offsets;
}

/** The column's token in the space-separated `data-dg-columns` of a group cell. */
export function getColumnToken(name: string) {
	return toVariableName(name);
}

/**
 * The cells of one column, by their `data-dg-column`. Only quotes and backslashes are escaped: nothing
 * else matters inside a quoted string, and `CSS.escape` is for identifiers and needs a browser.
 */
export function getColumnCellSelector(name: string) {
	return `[data-dg-column="${name.replace(/["\\]/g, '\\$&')}"]`;
}

/**
 * The cells of a column plus the group cells above it, found by `data-dg-columns`: both size from the same
 * variables.
 */
export function getColumnSelector(name: string) {
	return `${getColumnCellSelector(name)},[data-dg-columns~="${getColumnToken(name)}"]`;
}

/**
 * The cache key of cell props: everything the style and `data-dg-align` depend on and nothing else, so
 * changing a handler or a right rewrites no attribute in the DOM.
 */
export function getGeometryKey(column: ColumnGeometry, pin: ColumnPinSide | undefined, offset: number) {
	return `${column.width}|${column.minWidth}|${column.maxWidth}|${column.flex}|${column.align}`
		+ `|${column.resizable}|${pin}|${offset}`;
}
