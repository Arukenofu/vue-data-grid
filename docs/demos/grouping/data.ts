import { type Category, type Quarter, type Region, sales } from '@/data/sales';

export interface SalesRow {
	id: string;
	label: string;
	region: Region;
	country: string;
	category: Category;
	product: string;
	quarter: Quarter | null;
	units: number;
	revenue: number;
	cost: number;
	/** How many sales a group row holds; `0` for a sale. */
	count: number;
	children?: readonly SalesRow[];
}

export const salesRows: readonly SalesRow[] = sales.map(sale => ({
	id: sale.id,
	label: `${sale.product} · ${sale.country}`,
	region: sale.region,
	country: sale.country,
	category: sale.category,
	product: sale.product,
	quarter: sale.quarter,
	units: sale.units,
	revenue: sale.revenue,
	cost: sale.cost,
	count: 0,
}));
