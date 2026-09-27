export interface ProductSales {
	id: string;
	product: string;
	category: 'Hardware' | 'Software' | 'Services';
	q1: number;
	q2: number;
	q3: number;
	q4: number;
	margin: number;
}

export const productSales: readonly ProductSales[] = [
	{ id: 'terminal', product: 'Terminal X', category: 'Hardware', q1: 182_400, q2: 201_300, q3: 176_900, q4: 244_100, margin: 0.31 },
	{ id: 'dock', product: 'Dock Mini', category: 'Hardware', q1: 48_200, q2: 52_900, q3: 61_400, q4: 70_800, margin: 0.42 },
	{ id: 'seat', product: 'Cloud Seat', category: 'Software', q1: 96_500, q2: 104_200, q3: 118_700, q4: 131_300, margin: 0.78 },
	{ id: 'insights', product: 'Insights', category: 'Software', q1: 73_100, q2: 69_800, q3: 88_400, q4: 97_600, margin: 0.81 },
	{ id: 'onboarding', product: 'Onboarding', category: 'Services', q1: 120_000, q2: 99_000, q3: 138_000, q4: 147_000, margin: 0.36 },
	{ id: 'care', product: 'Care Plan', category: 'Services', q1: 41_600, q2: 44_300, q3: 47_900, q4: 52_100, margin: 0.55 },
	{ id: 'sensor', product: 'Sensor Kit', category: 'Hardware', q1: 22_800, q2: 31_500, q3: 29_900, q4: 38_200, margin: 0.28 },
	{ id: 'vault', product: 'Vault Backup', category: 'Software', q1: 35_400, q2: 39_100, q3: 44_600, q4: 50_300, margin: 0.74 },
];
