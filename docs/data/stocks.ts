import { createRandom, type Random } from './random';

export type Sector = 'Technology' | 'Energy' | 'Health' | 'Finance' | 'Consumer' | 'Industrials';

export interface Stock {
	id: string;
	symbol: string;
	name: string;
	sector: Sector;
	price: number;
	open: number;
	volume: number;
	marketCap: number;
	history: readonly number[];
}

const COMPANIES: readonly (readonly [string, string, Sector])[] = [
	['AURA', 'Aurora Systems', 'Technology'],
	['BRKT', 'Brackett Energy', 'Energy'],
	['CLVR', 'Clover Health Labs', 'Health'],
	['DYNA', 'Dynamo Robotics', 'Industrials'],
	['EVRG', 'Evergreen Foods', 'Consumer'],
	['FNCH', 'Finch Capital', 'Finance'],
	['GLYF', 'Glyph Software', 'Technology'],
	['HLIX', 'Helix Therapeutics', 'Health'],
	['IONQ', 'Ion Quarry', 'Energy'],
	['JUNO', 'Juno Payments', 'Finance'],
	['KITE', 'Kite Mobility', 'Industrials'],
	['LUMA', 'Luma Optics', 'Technology'],
	['MOSS', 'Moss Outdoor', 'Consumer'],
	['NOVA', 'Nova Semiconductors', 'Technology'],
	['ORCA', 'Orca Shipping', 'Industrials'],
	['PIKE', 'Pike Insurance', 'Finance'],
	['QRTZ', 'Quartz Diagnostics', 'Health'],
	['RIVR', 'River Hydro', 'Energy'],
	['SAGE', 'Sage Grocers', 'Consumer'],
	['TIDE', 'Tidewater Cloud', 'Technology'],
	['UMBR', 'Umbra Security', 'Technology'],
	['VALE', 'Vale Biotech', 'Health'],
	['WREN', 'Wren Airlines', 'Industrials'],
	['XENO', 'Xeno Materials', 'Industrials'],
];

const HISTORY = 24;

function round(value: number) {
	return Math.round(value * 100) / 100;
}

export function createStocks(seed = 5): Stock[] {
	const random = createRandom(seed);

	return COMPANIES.map(([symbol, name, sector]) => {
		const open = round(random.between(12, 480));
		const history: number[] = [open];

		for (let step = 1; step < HISTORY; step += 1) {
			history.push(round(history[step - 1] * (1 + random.between(-0.02, 0.021))));
		}

		return {
			id: symbol,
			symbol,
			name,
			sector,
			price: history[HISTORY - 1],
			open,
			volume: random.int(200, 9000) * 1000,
			marketCap: round(random.between(2, 900)),
			history,
		};
	});
}

/** The stock a moment later: a new object with a new price, as a feed would send it. */
export function tickStock(stock: Stock, random: Random): Stock {
	const price = round(Math.max(1, stock.price * (1 + random.between(-0.012, 0.0125))));

	return {
		...stock,
		price,
		volume: stock.volume + random.int(0, 40) * 100,
		history: [...stock.history.slice(1), price],
	};
}

/** The change since the open, percent. */
export function getChange(stock: Pick<Stock, 'price' | 'open'>) {
	return ((stock.price - stock.open) / stock.open) * 100;
}

export const stocks = createStocks();
