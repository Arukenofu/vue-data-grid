import { createRandom } from '@/data/random';

export type Health = 'ok' | 'warning' | 'failing';

export interface Metric {
	label: string;
	unit: string;
	digits: number;
	min: number;
	max: number;
}

export interface Reading {
	id: number;
	time: string;
	device: string;
	region: string;
	health: Health;
	values: readonly number[];
}

export const METRICS: readonly Metric[] = [
	{ label: 'Temperature', unit: '°C', digits: 1, min: 18, max: 86 },
	{ label: 'Humidity', unit: '%', digits: 0, min: 12, max: 90 },
	{ label: 'Pressure', unit: ' hPa', digits: 0, min: 960, max: 1040 },
	{ label: 'Voltage', unit: ' V', digits: 2, min: 3.1, max: 5.2 },
	{ label: 'Current', unit: ' A', digits: 2, min: 0.1, max: 4 },
	{ label: 'Power', unit: ' W', digits: 1, min: 1, max: 20 },
	{ label: 'CPU', unit: '%', digits: 0, min: 1, max: 100 },
	{ label: 'Memory', unit: '%', digits: 0, min: 8, max: 98 },
	{ label: 'Disk', unit: '%', digits: 0, min: 5, max: 99 },
	{ label: 'Net in', unit: ' MB/s', digits: 1, min: 0, max: 120 },
	{ label: 'Net out', unit: ' MB/s', digits: 1, min: 0, max: 80 },
	{ label: 'Latency', unit: ' ms', digits: 0, min: 2, max: 400 },
	{ label: 'Requests', unit: '/s', digits: 0, min: 0, max: 5000 },
	{ label: 'Errors', unit: '/s', digits: 1, min: 0, max: 12 },
	{ label: 'Uptime', unit: ' h', digits: 0, min: 1, max: 9000 },
];

const REGIONS = ['eu-west', 'eu-north', 'us-east', 'us-west', 'ap-south', 'ap-east', 'sa-east'];

const DEVICES = ['edge', 'gate', 'node', 'hub', 'relay', 'probe'];

const START = Date.UTC(2026, 8, 1);

const STEP = 1700;

const TEMPERATURE = 0;

const ERRORS = 13;

function round(value: number, digits: number) {
	const scale = 10 ** digits;

	return Math.round(value * scale) / scale;
}

function pad(value: number) {
	return String(value).padStart(2, '0');
}

function formatTime(time: number) {
	const date = new Date(time);

	return `${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function getHealth(temperature: number, errors: number): Health {
	if (temperature > 80 || errors > 10) {
		return 'failing';
	}

	return temperature > 70 || errors > 7 ? 'warning' : 'ok';
}

export function createReadings(count: number): Reading[] {
	const random = createRandom(count);

	return Array.from({ length: count }, (_, index) => {
		const values = METRICS.map(metric => round(random.between(metric.min, metric.max), metric.digits));

		return {
			id: index + 1,
			time: formatTime(START + index * STEP),
			device: `${random.pick(DEVICES)}-${random.int(100, 999)}`,
			region: random.pick(REGIONS),
			health: getHealth(values[TEMPERATURE], values[ERRORS]),
			values,
		};
	});
}
