import type { RowGroupLevel } from '@vue-stack/table';

import type { Sale } from '@/data/sales';

/** A line of the report: a sale, or a group of them with its totals and its lines under it. */
export interface ReportRow {
	id: string;
	label: string;
	units: number;
	revenue: number;
	cost: number;
	sale?: Sale;
	children?: readonly ReportRow[];
}

export type Grouping = 'region' | 'category' | 'quarter';

type SaleField = 'region' | 'country' | 'category' | 'product' | 'quarter';

function level(field: SaleField): RowGroupLevel<ReportRow> {
	return { name: field, value: row => row.sale?.[field] };
}

export const GROUPINGS: Readonly<Record<Grouping, {
	levels: readonly RowGroupLevel<ReportRow>[];
	describe: (sale: Sale) => string;
}>> = {
	region: { levels: [level('region'), level('country')], describe: sale => `${sale.product} · ${sale.quarter}` },
	category: { levels: [level('category'), level('product')], describe: sale => `${sale.country} · ${sale.quarter}` },
	quarter: { levels: [level('quarter'), level('region')], describe: sale => `${sale.product} · ${sale.country}` },
};

/** One line for each product, country and quarter, with the sales of it added up. */
export function toLines(sales: readonly Sale[], grouping: Grouping): ReportRow[] {
	const lines = new Map<string, ReportRow>();

	for (const sale of sales) {
		const id = `${sale.product}|${sale.country}|${sale.quarter}`;
		const line = lines.get(id);

		lines.set(id, line
			? { ...line, units: line.units + sale.units, revenue: line.revenue + sale.revenue, cost: line.cost + sale.cost }
			: { id, label: GROUPINGS[grouping].describe(sale), units: sale.units, revenue: sale.revenue, cost: sale.cost, sale });
	}

	return [...lines.values()];
}

/** The keys of every group row, on all levels. */
export function collectGroups(rows: readonly ReportRow[]): string[] {
	return rows.flatMap(row => (row.children ? [row.id, ...collectGroups(row.children)] : []));
}

export function getProfit(row: Pick<ReportRow, 'revenue' | 'cost'>) {
	return row.revenue - row.cost;
}

export function getMargin(rows: readonly Pick<ReportRow, 'revenue' | 'cost'>[]) {
	let revenue = 0;
	let cost = 0;

	for (const row of rows) {
		revenue += row.revenue;
		cost += row.cost;
	}

	return revenue === 0 ? null : (revenue - cost) / revenue;
}

export const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const count = new Intl.NumberFormat('en-US');
