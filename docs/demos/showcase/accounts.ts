import { createRandom } from '@/data/random';

export type Plan = 'Free' | 'Starter' | 'Pro' | 'Enterprise';

export type AccountStatus = 'active' | 'trial' | 'past-due' | 'churned';

export interface Account {
	id: string;
	company: string;
	contact: string;
	email: string;
	plan: Plan;
	status: AccountStatus;
	mrr: number;
	seats: number;
	seatsUsed: number;
	country: string;
	countryCode: string;
	lastActive: number;
}

const NAMES = ['Northwind', 'Lumen', 'Arcadia', 'Bluefin', 'Cobalt', 'Driftwood', 'Ember', 'Fjord', 'Granite', 'Halcyon', 'Ironbark', 'Juniper', 'Kestrel', 'Larkspur', 'Meridian', 'Nimbus', 'Orchard', 'Pinecrest', 'Quill', 'Redwood', 'Solstice', 'Tamarack', 'Vesper', 'Willow', 'Zephyr'];
const KINDS = ['Labs', 'Studio', 'Health', 'Logistics', 'Analytics', 'Foods', 'Systems', 'Energy', 'Capital', 'Robotics'];
const PEOPLE = ['Ava Novak', 'Liam Reyes', 'Mia Kim', 'Noah Okafor', 'Zoe Larsen', 'Ethan Rossi', 'Aria Tanaka', 'Leo Silva', 'Nora Meyer', 'Kai Haddad', 'Iris Petrova', 'Omar Dubois', 'Lena Walsh', 'Hugo Moreau', 'Maya Singh', 'Theo Berg', 'Aigerim Sultan', 'Dias Nurlan'];
const COUNTRIES: readonly (readonly [string, string])[] = [
	['US', 'United States'],
	['DE', 'Germany'],
	['GB', 'United Kingdom'],
	['FR', 'France'],
	['JP', 'Japan'],
	['BR', 'Brazil'],
	['CA', 'Canada'],
	['KZ', 'Kazakhstan'],
	['IN', 'India'],
	['AU', 'Australia'],
	['NL', 'Netherlands'],
	['SE', 'Sweden'],
];
const PLANS: readonly Plan[] = ['Free', 'Starter', 'Starter', 'Pro', 'Pro', 'Pro', 'Enterprise'];
const STATUSES: readonly AccountStatus[] = ['active', 'active', 'active', 'active', 'trial', 'past-due', 'churned'];

const SEATS: Readonly<Record<Plan, readonly [number, number]>> = {
	Free: [3, 3],
	Starter: [5, 15],
	Pro: [10, 60],
	Enterprise: [50, 400],
};

const PRICE_PER_SEAT: Readonly<Record<Plan, number>> = {
	Free: 0,
	Starter: 12,
	Pro: 29,
	Enterprise: 54,
};

const MINUTES_IN_40_DAYS = 60 * 24 * 40;

const PLAN_ORDER: readonly Plan[] = ['Free', 'Starter', 'Pro', 'Enterprise'];

export function createAccounts(count: number, seed = 21): Account[] {
	const random = createRandom(seed);

	return Array.from({ length: count }, (_, index) => {
		const company = `${NAMES[index % NAMES.length]} ${KINDS[(index * 7 + 3) % KINDS.length]}`;
		const contact = random.pick(PEOPLE);
		const [countryCode, country] = random.pick(COUNTRIES);
		const plan = random.pick(PLANS);
		const status = plan === 'Free' ? 'active' : random.pick(STATUSES);
		const [minSeats, maxSeats] = SEATS[plan];
		const seats = random.int(minSeats, maxSeats);
		const paying = status === 'active' || status === 'past-due';

		return {
			id: `acc-${1000 + index}`,
			company,
			contact,
			email: `${contact.split(' ')[0]}@${company.split(' ')[0]}.io`.toLowerCase(),
			plan,
			status,
			mrr: paying ? seats * PRICE_PER_SEAT[plan] : 0,
			seats,
			seatsUsed: status === 'churned' ? 0 : random.int(Math.ceil(seats * 0.3), seats),
			country,
			countryCode,
			lastActive: status === 'churned' ? random.int(MINUTES_IN_40_DAYS / 2, MINUTES_IN_40_DAYS) : random.int(1, MINUTES_IN_40_DAYS / 4),
		};
	});
}

export function canUpgrade(account: Account) {
	return account.plan !== 'Enterprise' && account.status !== 'churned';
}

export function upgrade(account: Account): Account {
	const plan = PLAN_ORDER[Math.min(PLAN_ORDER.indexOf(account.plan) + 1, PLAN_ORDER.length - 1)];
	const paying = account.status === 'active' || account.status === 'past-due';

	return { ...account, plan, mrr: paying ? account.seats * PRICE_PER_SEAT[plan] : account.mrr };
}
