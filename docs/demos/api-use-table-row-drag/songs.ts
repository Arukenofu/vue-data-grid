export interface Song {
	id: string;
	number: number;
	title: string;
	artist: string;
	album: string;
	seconds: number;
}

export const songs: readonly Song[] = [
	{ id: 's1', number: 1, title: 'Northern Lights', artist: 'Aurora Vale', album: 'Polar', seconds: 214 },
	{ id: 's2', number: 2, title: 'Paper Boats', artist: 'The Kites', album: 'Harbour', seconds: 187 },
	{ id: 's3', number: 3, title: 'Glasshouse', artist: 'Mira Sol', album: 'Greenhouse', seconds: 241 },
	{ id: 's4', number: 4, title: 'Slow Motion', artist: 'Juno Park', album: 'Frames', seconds: 199 },
	{ id: 's5', number: 5, title: 'Tidal', artist: 'Aurora Vale', album: 'Polar', seconds: 256 },
	{ id: 's6', number: 6, title: 'Morning Static', artist: 'Low Orbit', album: 'Signals', seconds: 173 },
	{ id: 's7', number: 7, title: 'Citrus', artist: 'Mira Sol', album: 'Greenhouse', seconds: 208 },
	{ id: 's8', number: 8, title: 'Afterglow', artist: 'The Kites', album: 'Harbour', seconds: 226 },
];

export function formatDuration(seconds: number) {
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
