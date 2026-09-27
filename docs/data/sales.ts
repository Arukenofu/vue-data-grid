import { createRandom } from './random';

export type Region = 'Americas' | 'Europe' | 'Asia Pacific';

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type Category = 'Hardware' | 'Software' | 'Services';

export interface Sale {
	id: string;
	region: Region;
	country: string;
	product: string;
	category: Category;
	quarter: Quarter;
	units: number;
	revenue: number;
	cost: number;
}

const COUNTRIES: Readonly<Record<Region, readonly string[]>> = {
	'Americas': ['United States', 'Canada', 'Brazil'],
	'Europe': ['Germany', 'France', 'Poland', 'Spain'],
	'Asia Pacific': ['Japan', 'Korea', 'Australia'],
};

const REGIONS: readonly Region[] = ['Americas', 'Europe', 'Asia Pacific'];

const PRODUCTS: readonly (readonly [string, Category, number])[] = [
	['Terminal X', 'Hardware', 1200],
	['Dock Mini', 'Hardware', 240],
	['Cloud Seat', 'Software', 480],
	['Insights', 'Software', 900],
	['Onboarding', 'Services', 3000],
	['Care Plan', 'Services', 650],
];

const QUARTERS: readonly Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

export function createSales(count: number, seed = 3): Sale[] {
	const random = createRandom(seed);

	return Array.from({ length: count }, (_, index) => {
		const region = random.pick(REGIONS);
		const [product, category, price] = random.pick(PRODUCTS);
		const units = random.int(4, 160);
		const revenue = Math.round(units * price * random.between(0.85, 1.1));

		return {
			id: `s${index + 1}`,
			region,
			country: random.pick(COUNTRIES[region]),
			product,
			category,
			quarter: random.pick(QUARTERS),
			units,
			revenue,
			cost: Math.round(revenue * random.between(0.35, 0.8)),
		};
	});
}

export const sales = createSales(160);
