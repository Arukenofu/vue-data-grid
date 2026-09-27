import { createRandom } from './random';

export type Team = 'Design' | 'Engineering' | 'Marketing' | 'Sales' | 'Support';

export type Presence = 'active' | 'away' | 'offline';

export interface Person {
	id: string;
	name: string;
	email: string;
	role: string;
	team: Team;
	location: string;
	presence: Presence;
	salary: number;
	started: string;
	projects: number;
	rating: number;
}

const FIRST = ['Ava', 'Liam', 'Mia', 'Noah', 'Zoe', 'Ethan', 'Aria', 'Leo', 'Nora', 'Kai', 'Iris', 'Omar', 'Lena', 'Hugo', 'Maya', 'Theo', 'Sara', 'Ivan', 'Nina', 'Emil'];
const LAST = ['Novak', 'Reyes', 'Kim', 'Okafor', 'Larsen', 'Rossi', 'Tanaka', 'Silva', 'Meyer', 'Haddad', 'Petrova', 'Dubois', 'Walsh', 'Moreau', 'Singh', 'Berg'];
const LOCATIONS = ['Berlin', 'Lisbon', 'Toronto', 'Seoul', 'Austin', 'Nairobi', 'Oslo', 'Warsaw', 'Tbilisi'];
const ROLES: Readonly<Record<Team, readonly string[]>> = {
	Design: ['Product designer', 'Design lead', 'UX researcher'],
	Engineering: ['Frontend engineer', 'Backend engineer', 'Staff engineer', 'Engineering manager'],
	Marketing: ['Content strategist', 'Growth marketer', 'Brand lead'],
	Sales: ['Account executive', 'Sales engineer', 'Head of sales'],
	Support: ['Support specialist', 'Support lead', 'Technical writer'],
};
const TEAMS: readonly Team[] = ['Design', 'Engineering', 'Marketing', 'Sales', 'Support'];
const PRESENCE: readonly Presence[] = ['active', 'active', 'active', 'away', 'offline'];

function pad(value: number) {
	return String(value).padStart(2, '0');
}

export function createPeople(count: number, seed = 11): Person[] {
	const random = createRandom(seed);

	return Array.from({ length: count }, (_, index) => {
		const first = random.pick(FIRST);
		const last = random.pick(LAST);
		const team = random.pick(TEAMS);

		return {
			id: `p${index + 1}`,
			name: `${first} ${last}`,
			email: `${first}.${last}@acme.dev`.toLowerCase(),
			role: random.pick(ROLES[team]),
			team,
			location: random.pick(LOCATIONS),
			presence: random.pick(PRESENCE),
			salary: random.int(48, 180) * 1000,
			started: `${random.int(2016, 2025)}-${pad(random.int(1, 12))}-${pad(random.int(1, 28))}`,
			projects: random.int(1, 14),
			rating: random.int(20, 50) / 10,
		};
	});
}

export const people = createPeople(48);
