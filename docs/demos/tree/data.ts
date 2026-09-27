export interface Employee {
	id: string;
	manager: string | null;
	name: string;
	title: string;
	salary: number;
}

export interface OrgMember extends Employee {
	/** Everyone who reports to this person, directly or not. */
	reports: number;
	/** The salaries of this person and everyone under them. */
	cost: number;
}

const EMPLOYEES: readonly Employee[] = [
	{ id: 'maya', manager: null, name: 'Maya Rossi', title: 'Chief executive', salary: 240_000 },
	{ id: 'omar', manager: 'maya', name: 'Omar Haddad', title: 'Chief technology officer', salary: 210_000 },
	{ id: 'ivan', manager: 'omar', name: 'Ivan Petrova', title: 'Engineering manager', salary: 158_000 },
	{ id: 'zoe', manager: 'ivan', name: 'Zoe Silva', title: 'Frontend engineer', salary: 118_000 },
	{ id: 'liam', manager: 'ivan', name: 'Liam Reyes', title: 'Backend engineer', salary: 124_000 },
	{ id: 'noah', manager: 'ivan', name: 'Noah Okafor', title: 'Backend engineer', salary: 112_000 },
	{ id: 'kai', manager: 'omar', name: 'Kai Walsh', title: 'Staff engineer', salary: 172_000 },
	{ id: 'aria', manager: 'omar', name: 'Aria Meyer', title: 'Design lead', salary: 146_000 },
	{ id: 'mia', manager: 'aria', name: 'Mia Tanaka', title: 'Product designer', salary: 109_000 },
	{ id: 'leo', manager: 'aria', name: 'Leo Rossi', title: 'UX researcher', salary: 101_000 },
	{ id: 'lena', manager: 'maya', name: 'Lena Dubois', title: 'Chief operating officer', salary: 198_000 },
	{ id: 'theo', manager: 'lena', name: 'Theo Novak', title: 'Head of sales', salary: 166_000 },
	{ id: 'sara', manager: 'theo', name: 'Sara Okafor', title: 'Account executive', salary: 98_000 },
	{ id: 'ethan', manager: 'theo', name: 'Ethan Larsen', title: 'Account executive', salary: 96_000 },
	{ id: 'iris', manager: 'theo', name: 'Iris Kim', title: 'Sales engineer', salary: 121_000 },
	{ id: 'nora', manager: 'lena', name: 'Nora Berg', title: 'Support lead', salary: 112_000 },
	{ id: 'hugo', manager: 'nora', name: 'Hugo Moreau', title: 'Support specialist', salary: 72_000 },
	{ id: 'emil', manager: 'nora', name: 'Emil Singh', title: 'Technical writer', salary: 84_000 },
	{ id: 'nina', manager: 'maya', name: 'Nina Walsh', title: 'Chief financial officer', salary: 205_000 },
	{ id: 'ava', manager: 'nina', name: 'Ava Novak', title: 'Financial analyst', salary: 91_000 },
	{ id: 'theo-b', manager: 'nina', name: 'Theo Berg', title: 'Accountant', salary: 79_000 },
];

function collect(id: string, children: ReadonlyMap<string | null, readonly Employee[]>): { reports: number; cost: number } {
	let reports = 0;
	let cost = 0;

	for (const child of children.get(id) ?? []) {
		const below = collect(child.id, children);

		reports += 1 + below.reports;
		cost += child.salary + below.cost;
	}

	return { reports, cost };
}

function createOrg(employees: readonly Employee[]): OrgMember[] {
	const children = new Map<string | null, Employee[]>();

	for (const employee of employees) {
		children.set(employee.manager, [...children.get(employee.manager) ?? [], employee]);
	}

	return employees.map((employee) => {
		const below = collect(employee.id, children);

		return { ...employee, reports: below.reports, cost: employee.salary + below.cost };
	});
}

export const org = createOrg(EMPLOYEES);

/** The people with someone under them: the rows of the tree that open. */
export const managers = [...new Set(EMPLOYEES.map(employee => employee.manager))].filter(key => key !== null);
