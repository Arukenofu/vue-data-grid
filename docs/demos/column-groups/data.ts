import { createRandom } from '@/data/random';

export interface ProductYear {
	id: string;
	product: string;
	category: string;
	q1: number;
	q2: number;
	q3: number;
	q4: number;
	units: number;
	returns: number;
}

const PRODUCTS: readonly (readonly [string, string])[] = [
	['Terminal X', 'Hardware'],
	['Dock Mini', 'Hardware'],
	['Pocket Reader', 'Hardware'],
	['Cloud Seat', 'Software'],
	['Insights', 'Software'],
	['Fleet Manager', 'Software'],
	['Onboarding', 'Services'],
	['Care Plan', 'Services'],
	['Field Repair', 'Services'],
];

export function createProductYears(): ProductYear[] {
	const random = createRandom(8);

	return PRODUCTS.map(([product, category], index) => {
		const base = random.between(40, 320) * 1000;

		return {
			id: `product-${index + 1}`,
			product,
			category,
			q1: Math.round(base * random.between(0.8, 1.1)),
			q2: Math.round(base * random.between(0.9, 1.2)),
			q3: Math.round(base * random.between(0.95, 1.3)),
			q4: Math.round(base * random.between(1, 1.45)),
			units: random.int(300, 9000),
			returns: random.int(4, 180),
		};
	});
}

export const productYears = createProductYears();
