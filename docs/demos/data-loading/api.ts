import type { TableSort } from '@vue-stack/table';

import { createPeople, type Person } from '@/data/people';

export interface PeopleRequest {
	query: string;
	sort: readonly TableSort[];
	offset: number;
	limit: number;
	/** How long the fake server takes to answer, ms. */
	latency: number;
}

export interface PeoplePage {
	rows: readonly Person[];
	total: number;
}

const everyone = createPeople(500, 7);

const FIELDS: Readonly<Record<string, (person: Person) => string | number>> = {
	name: person => person.name,
	team: person => person.team,
	location: person => person.location,
	salary: person => person.salary,
};

function compare(first: Person, second: Person, sort: readonly TableSort[]) {
	for (const { name, direction } of sort) {
		const read = FIELDS[name];
		const a = read(first);
		const b = read(second);

		if (a !== b) {
			return (a < b ? -1 : 1) * (direction === 'asc' ? 1 : -1);
		}
	}

	return 0;
}

function answer(request: PeopleRequest): PeoplePage {
	const text = request.query.trim().toLowerCase();
	const found = everyone.filter(person => `${person.name} ${person.team} ${person.location}`.toLowerCase().includes(text));
	const sorted = request.sort.length > 0 ? [...found].sort((first, second) => compare(first, second, request.sort)) : found;

	return { rows: sorted.slice(request.offset, request.offset + request.limit), total: found.length };
}

/** A page of people from a pretend server, after `latency` ms. */
export function fetchPeople(request: PeopleRequest) {
	return new Promise<PeoplePage>((resolve) => {
		setTimeout(() => resolve(answer(request)), request.latency);
	});
}
