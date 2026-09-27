export interface BudgetLine {
	id: string;
	team: string;
	q1: number;
	q2: number;
	q3: number;
	q4: number;
}

export const budget: readonly BudgetLine[] = [
	{ id: 'design', team: 'Design', q1: 42000, q2: 45500, q3: 43800, q4: 51200 },
	{ id: 'platform', team: 'Platform', q1: 128400, q2: 131900, q3: 140250, q4: 138700 },
	{ id: 'mobile', team: 'Mobile', q1: 86300, q2: 91200, q3: 88900, q4: 97600 },
	{ id: 'growth', team: 'Growth', q1: 64800, q2: 72100, q3: 79500, q4: 83300 },
	{ id: 'data', team: 'Data', q1: 71200, q2: 70400, q3: 75800, q4: 78100 },
	{ id: 'security', team: 'Security', q1: 38900, q2: 41300, q3: 40100, q4: 44600 },
	{ id: 'support', team: 'Support', q1: 52700, q2: 53900, q3: 56400, q4: 55200 },
	{ id: 'sales', team: 'Sales', q1: 94100, q2: 102600, q3: 99800, q4: 118300 },
	{ id: 'marketing', team: 'Marketing', q1: 67500, q2: 81200, q3: 74900, q4: 92800 },
	{ id: 'legal', team: 'Legal', q1: 29800, q2: 31100, q3: 30600, q4: 33900 },
	{ id: 'finance', team: 'Finance', q1: 33400, q2: 34800, q3: 36200, q4: 37500 },
	{ id: 'research', team: 'Research', q1: 58600, q2: 61900, q3: 66300, q4: 70800 },
];
