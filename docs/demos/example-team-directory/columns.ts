import { defineColumn, defineColumns, selectionColumn } from '@vue-data-grid/core';
import { h } from 'vue';

import type { Person, Presence, Team } from '@/data/people';
import { type BadgeTone, UiBadge } from '@/ui';

import PersonCell from './PersonCell.vue';

const PRESENCE: Readonly<Record<Presence, { label: string; tone: BadgeTone }>> = {
	active: { label: 'Active', tone: 'green' },
	away: { label: 'Away', tone: 'amber' },
	offline: { label: 'Offline', tone: 'gray' },
};

const TEAM_TONES: Readonly<Record<Team, BadgeTone>> = {
	Design: 'violet',
	Engineering: 'blue',
	Marketing: 'amber',
	Sales: 'green',
	Support: 'gray',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function formatMonth(date: string) {
	const [year, month] = date.split('-');

	return `${MONTHS[Number(month) - 1]} ${year}`;
}

const column = defineColumn<Person>({ sortable: true, resizable: true, movable: true, hideable: true });

export const columns = defineColumns({
	select: selectionColumn(),
	name: column(person => person.name, {
		label: 'Name',
		width: 250,
		pinned: 'start',
		pinnable: true,
		movable: false,
		hideable: false,
		cell: ({ row }) => h(PersonCell, { person: row }),
	}),
	role: column(person => person.role, { label: 'Role', width: 190 }),
	team: column(person => person.team, {
		label: 'Team',
		width: 130,
		cell: ({ value }) => h(UiBadge, { tone: TEAM_TONES[value] }, () => value),
	}),
	location: column(person => person.location, { label: 'Location', width: 120 }),
	presence: column(person => person.presence, {
		label: 'Status',
		width: 116,
		cell: ({ value }) => h(UiBadge, { tone: PRESENCE[value].tone, dot: true }, () => PRESENCE[value].label),
	}),
	started: column(person => person.started, { label: 'Started', width: 116, format: formatMonth }),
	projects: column(person => person.projects, { label: 'Projects', width: 100, align: 'right' }),
	rating: column(person => person.rating, { label: 'Rating', width: 96, align: 'right', format: rating => rating.toFixed(1) }),
	salary: column(person => person.salary, {
		label: 'Salary',
		width: 120,
		align: 'right',
		pinned: 'end',
		pinnable: true,
		format: salary => money.format(salary),
	}),
});
