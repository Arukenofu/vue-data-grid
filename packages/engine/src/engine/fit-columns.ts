export interface FitColumn {
	name: string;
	width: number;
	minWidth: number;
	maxWidth?: number;
}

function clampToBounds(column: FitColumn, width: number) {
	if (width < column.minWidth) {
		return column.minWidth;
	}

	return column.maxWidth !== undefined && width > column.maxWidth ? column.maxWidth : null;
}

/**
 * Widths that share `available` pixels among the columns in proportion to their current widths,
 * within `minWidth` and `maxWidth`. A column that hits a limit stops there, and the rest is shared
 * among the others again. Widths are whole numbers that add up to `available` while no limit gets in
 * the way.
 */
export function fitColumnWidths(columns: readonly FitColumn[], available: number) {
	const result: Record<string, number> = {};
	let pending = [...columns];
	let space = available;

	while (pending.length > 0) {
		const total = pending.reduce((sum, column) => sum + column.width, 0);
		const scale = total > 0 ? space / total : 0;
		const bounded = pending.filter(column => clampToBounds(column, column.width * scale) !== null);

		if (bounded.length === 0) {
			const widths = pending.map(column => Math.floor(column.width * scale));
			let rest = Math.round(space) - widths.reduce((sum, width) => sum + width, 0);

			pending.forEach((column, index) => {
				const extra = rest > 0 && (column.maxWidth === undefined || widths[index] < column.maxWidth) ? 1 : 0;

				rest -= extra;
				result[column.name] = widths[index] + extra;
			});

			break;
		}

		for (const column of bounded) {
			const width = clampToBounds(column, column.width * scale) ?? column.width;

			result[column.name] = width;
			space -= width;
		}

		pending = pending.filter(column => !bounded.includes(column));
	}

	return result;
}
