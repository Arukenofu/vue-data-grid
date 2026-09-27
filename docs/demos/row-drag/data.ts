export interface Track {
	id: string;
	number: number;
	title: string;
	artist: string;
	seconds: number;
}

export const tracks: readonly Track[] = [
	{ id: 't1', number: 1, title: 'Northern Lights', artist: 'Aurora Vale', seconds: 214 },
	{ id: 't2', number: 2, title: 'Paper Boats', artist: 'The Lanterns', seconds: 187 },
	{ id: 't3', number: 3, title: 'Slow Orbit', artist: 'Kite & Keel', seconds: 256 },
	{ id: 't4', number: 4, title: 'Glass Harbour', artist: 'Mira Sol', seconds: 199 },
	{ id: 't5', number: 5, title: 'Midnight Tram', artist: 'Neon Fields', seconds: 231 },
	{ id: 't6', number: 6, title: 'Copper Sky', artist: 'Aurora Vale', seconds: 178 },
	{ id: 't7', number: 7, title: 'Low Tide', artist: 'The Lanterns', seconds: 243 },
	{ id: 't8', number: 8, title: 'Wild Honey', artist: 'Juniper Road', seconds: 205 },
	{ id: 't9', number: 9, title: 'Static Bloom', artist: 'Neon Fields', seconds: 262 },
	{ id: 't10', number: 10, title: 'Last Ferry Home', artist: 'Mira Sol', seconds: 297 },
];
