import { createRandom, type Random } from '@/data/random';

export interface BudgetLine {
	id: string;
	item: string;
	category: string;
	owner: string;
	q1: number | null;
	q2: number | null;
	q3: number | null;
	q4: number | null;
	approved: boolean;
}

export const CATEGORIES = ['Hosting', 'Tools', 'Marketing', 'Travel', 'Hiring', 'Office'];

const ITEMS: Readonly<Record<string, readonly string[]>> = {
	Hosting: ['Cloud compute', 'Object storage', 'CDN', 'Database cluster', 'Backups'],
	Tools: ['Design licences', 'Issue tracker', 'CI minutes', 'Error monitoring', 'Password manager'],
	Marketing: ['Conference booth', 'Paid search', 'Newsletter', 'Launch video', 'Swag'],
	Travel: ['Team offsite', 'Customer visits', 'Flights', 'Hotels'],
	Hiring: ['Job boards', 'Recruiter fees', 'Onboarding kits'],
	Office: ['Rent', 'Coffee', 'Furniture', 'Internet'],
};

const OWNERS = ['Mia', 'Leo', 'Omar', 'Nora', 'Kai', 'Zoe', 'Hugo'];

const ROWS = 40;

function amount(random: Random) {
	return random.next() < 0.08 ? null : random.int(4, 240) * 50;
}

export function createBudget(): BudgetLine[] {
	const random = createRandom(2026);

	return Array.from({ length: ROWS }, (_, index) => {
		const category = random.pick(CATEGORIES);

		return {
			id: `line-${index + 1}`,
			item: random.pick(ITEMS[category]),
			category,
			owner: random.pick(OWNERS),
			q1: amount(random),
			q2: amount(random),
			q3: amount(random),
			q4: amount(random),
			approved: random.next() < 0.6,
		};
	});
}

export function getTotal(line: BudgetLine) {
	return (line.q1 ?? 0) + (line.q2 ?? 0) + (line.q3 ?? 0) + (line.q4 ?? 0);
}
