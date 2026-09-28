export interface BudgetLine {
	id: string;
	category: string;
	planned: number;
	spent: number;
	note: string;
}

export const budget: readonly BudgetLine[] = [
	{ id: 'b1', category: 'Cloud hosting', planned: 4200, spent: 3950, note: 'Reserved instances from May' },
	{ id: 'b2', category: 'Design tools', planned: 900, spent: 960, note: 'Two new seats' },
	{ id: 'b3', category: 'Conferences', planned: 6000, spent: 2400, note: 'VueConf, two tickets' },
	{ id: 'b4', category: 'Hardware', planned: 3500, spent: 4100, note: 'Laptops for new hires' },
	{ id: 'b5', category: 'Office', planned: 1800, spent: 1750, note: '' },
	{ id: 'b6', category: 'Training', planned: 2400, spent: 800, note: 'Accessibility course' },
	{ id: 'b7', category: 'Marketing', planned: 5200, spent: 5600, note: 'Launch campaign' },
	{ id: 'b8', category: 'Support tools', planned: 1200, spent: 1100, note: '' },
];
