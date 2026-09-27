export interface Player {
	id: string;
	number: number;
	name: string;
	team: string;
	points: number;
	wins: number;
}

export const players: readonly Player[] = [
	{ id: 'p1', number: 7, name: 'Mia Tanaka', team: 'Falcons', points: 2480, wins: 31 },
	{ id: 'p2', number: 10, name: 'Omar Haddad', team: 'Otters', points: 2315, wins: 27 },
	{ id: 'p3', number: 23, name: 'Zoe Silva', team: 'Comets', points: 2790, wins: 36 },
	{ id: 'p4', number: 4, name: 'Kai Walsh', team: 'Falcons', points: 1960, wins: 22 },
	{ id: 'p5', number: 11, name: 'Aria Meyer', team: 'Lynx', points: 2655, wins: 33 },
	{ id: 'p6', number: 9, name: 'Ivan Petrova', team: 'Otters', points: 2104, wins: 25 },
	{ id: 'p7', number: 15, name: 'Lena Dubois', team: 'Comets', points: 1875, wins: 20 },
];

export const newcomers: readonly Player[] = [
	{ id: 'n1', number: 18, name: 'Hugo Kim', team: 'Lynx', points: 2230, wins: 26 },
	{ id: 'n2', number: 3, name: 'Nora Berg', team: 'Falcons', points: 2540, wins: 30 },
	{ id: 'n3', number: 21, name: 'Theo Novak', team: 'Otters', points: 1720, wins: 18 },
	{ id: 'n4', number: 30, name: 'Sara Okafor', team: 'Comets', points: 2870, wins: 38 },
];
