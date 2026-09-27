export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun'] as const;

export type Month = (typeof MONTHS)[number];

export interface BudgetLine {
	id: string;
	category: string;
	months: Readonly<Record<Month, number>>;
}

export const budget: readonly BudgetLine[] = [
	{ id: 'rent', category: 'Office rent', months: { jan: 4200, feb: 4200, mar: 4200, apr: 4350, may: 4350, jun: 4350 } },
	{ id: 'payroll', category: 'Payroll', months: { jan: 38_000, feb: 38_000, mar: 41_500, apr: 41_500, may: 41_500, jun: 44_000 } },
	{ id: 'cloud', category: 'Cloud hosting', months: { jan: 2900, feb: 3100, mar: 3350, apr: 3600, may: 3900, jun: 4200 } },
	{ id: 'ads', category: 'Advertising', months: { jan: 6000, feb: 4500, mar: 7500, apr: 5000, may: 8000, jun: 6500 } },
	{ id: 'travel', category: 'Travel', months: { jan: 1200, feb: 900, mar: 2400, apr: 600, may: 1800, jun: 3000 } },
	{ id: 'software', category: 'Software', months: { jan: 1450, feb: 1450, mar: 1520, apr: 1520, may: 1600, jun: 1600 } },
	{ id: 'training', category: 'Training', months: { jan: 800, feb: 0, mar: 1500, apr: 0, may: 900, jun: 0 } },
	{ id: 'events', category: 'Events', months: { jan: 0, feb: 3500, mar: 0, apr: 0, may: 9000, jun: 0 } },
];
