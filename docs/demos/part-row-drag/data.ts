export interface Track {
	id: string;
	number: number;
	title: string;
	artist: string;
	album: string;
	seconds: number;
	locked: boolean;
}

export const tracks: readonly Track[] = [
	{ id: 'intro', number: 1, title: 'Opening Lights', artist: 'Harbour Lines', album: 'Night Ferry', seconds: 94, locked: true },
	{ id: 'tides', number: 2, title: 'Tides of Glass', artist: 'Mira Sol', album: 'Low Sun', seconds: 237, locked: false },
	{ id: 'north', number: 3, title: 'Northbound', artist: 'The Paper Kites', album: 'Coastal', seconds: 212, locked: false },
	{ id: 'amber', number: 4, title: 'Amber Hours', artist: 'Juno Bay', album: 'Slow Hands', seconds: 254, locked: false },
	{ id: 'wires', number: 5, title: 'Quiet Wires', artist: 'Harbour Lines', album: 'Night Ferry', seconds: 199, locked: false },
	{ id: 'field', number: 6, title: 'Field Notes', artist: 'Olive & Ash', album: 'Paper Maps', seconds: 281, locked: false },
	{ id: 'drift', number: 7, title: 'Driftwood', artist: 'Mira Sol', album: 'Low Sun', seconds: 226, locked: false },
	{ id: 'lantern', number: 8, title: 'Lantern Street', artist: 'Juno Bay', album: 'Slow Hands', seconds: 243, locked: false },
	{ id: 'outro', number: 9, title: 'Last Ferry Home', artist: 'Harbour Lines', album: 'Night Ferry', seconds: 318, locked: true },
];
