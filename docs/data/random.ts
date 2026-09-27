/**
 * A seeded random generator: the same numbers on the server and in the browser, so a demo rendered
 * ahead of time hydrates as it was rendered.
 */
export function createRandom(seed: number) {
	let state = seed >>> 0;

	function next() {
		state = (state + 0x6d2b79f5) >>> 0;

		let value = state;

		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	}

	return {
		next,
		between: (min: number, max: number) => min + next() * (max - min),
		int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
		pick: <TItem>(items: readonly TItem[]) => items[Math.floor(next() * items.length)],
	};
}

export type Random = ReturnType<typeof createRandom>;
