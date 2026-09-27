export interface Sensor {
	id: string;
	index: number;
	name: string;
	site: string;
}

export const SENSOR_COUNT = 100_000;

export const DAY_COUNT = 30;

const SITES = ['North Ridge', 'Harbor', 'Delta Plant', 'Summit', 'Old Mill'];

export const sensors: readonly Sensor[] = Array.from({ length: SENSOR_COUNT }, (_, index) => ({
	id: `sensor-${index}`,
	index,
	name: `Sensor ${String(index + 1).padStart(6, '0')}`,
	site: SITES[index % SITES.length],
}));

/** The temperature a sensor read on a day, °C: computed, not stored, so a hundred thousand rows cost little. */
export function readTemperature(sensor: number, day: number) {
	const noise = Math.sin(sensor * 12.9898 + day * 78.233) * 43758.5453;

	return 11 + (noise - Math.floor(noise)) * 19;
}
