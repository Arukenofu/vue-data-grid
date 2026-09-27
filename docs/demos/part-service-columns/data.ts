export interface WorkItem {
	id: string;
	number: number;
	parent: string | null;
	title: string;
	owner: string;
	points: number;
}

export const workItems: readonly WorkItem[] = [
	{ id: 'launch', number: 101, parent: null, title: 'Public launch', owner: 'Mia Tanaka', points: 0 },
	{ id: 'pricing', number: 102, parent: 'launch', title: 'Finalise pricing tiers', owner: 'Sara Okafor', points: 3 },
	{ id: 'landing', number: 103, parent: 'launch', title: 'Build the landing page', owner: 'Leo Rossi', points: 5 },
	{ id: 'press', number: 104, parent: 'launch', title: 'Brief the press', owner: 'Nora Berg', points: 2 },
	{ id: 'billing', number: 105, parent: null, title: 'Billing v2', owner: 'Omar Haddad', points: 0 },
	{ id: 'invoices', number: 106, parent: 'billing', title: 'Invoice PDFs', owner: 'Hugo Kim', points: 5 },
	{ id: 'taxes', number: 107, parent: 'billing', title: 'Tax by region', owner: 'Ivan Petrova', points: 8 },
	{ id: 'dunning', number: 108, parent: 'billing', title: 'Dunning emails', owner: 'Aria Meyer', points: 3 },
	{ id: 'mobile', number: 109, parent: null, title: 'Mobile polish', owner: 'Kai Walsh', points: 0 },
	{ id: 'gestures', number: 110, parent: 'mobile', title: 'Swipe gestures', owner: 'Zoe Silva', points: 3 },
	{ id: 'offline', number: 111, parent: 'mobile', title: 'Offline mode', owner: 'Theo Novak', points: 8 },
];
