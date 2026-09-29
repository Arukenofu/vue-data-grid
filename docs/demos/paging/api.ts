import type { GridSort } from '@vue-data-grid/core';

import { createPeople, type Person } from '@/data/people';

export interface PeoplePageRequest {
	page: number;
	size: number;
	sort: readonly GridSort[];
}

export interface PeoplePage {
	rows: readonly Person[];
	/** How many people come before the first one of the page. */
	offset: number;
	total: number;
}

const LATENCY = 700;

const everyone = createPeople(500, 7);

const FIELDS: Readonly<Record<string, (person: Person) => string | number>> = {
	name: person => person.name,
	team: person => person.team,
	location: person => person.location,
	salary: person => person.salary,
};

function compare(first: Person, second: Person, sort: readonly GridSort[]) {
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

/** A page of people from a pretend server, sorted there. */
export function fetchPeoplePage(request: PeoplePageRequest) {
	const sorted = request.sort.length > 0 ? [...everyone].sort((first, second) => compare(first, second, request.sort)) : everyone;
	const offset = request.page * request.size;

	return new Promise<PeoplePage>((resolve) => {
		setTimeout(() => resolve({ rows: sorted.slice(offset, offset + request.size), offset, total: everyone.length }), LATENCY);
	});
}
