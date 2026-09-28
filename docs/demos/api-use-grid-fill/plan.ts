export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun'] as const;

export type Month = (typeof MONTHS)[number];

export interface PlanLine {
	id: string;
	channel: string;
	signups: Readonly<Record<Month, number | null>>;
}

function line(id: string, channel: string, jan: number, feb: number): PlanLine {
	return { id, channel, signups: { jan, feb, mar: null, apr: null, may: null, jun: null } };
}

export const plan: readonly PlanLine[] = [
	line('newsletter', 'Newsletter', 120, 150),
	line('ads', 'Search ads', 400, 380),
	line('partners', 'Partners', 60, 90),
	line('events', 'Meetups', 25, 25),
	line('referrals', 'Referrals', 200, 260),
];
