import { nextTick, shallowRef, watch, type WatchSource } from 'vue';

export interface UpdateRecord {
	id: number;
	label: string;
	ms: number;
	rows: number;
}

interface Measurement {
	label: string;
	start: number;
	before: number;
}

const HISTORY = 5;

export function useUpdateMeter(countRenders: () => number) {
	const records = shallowRef<readonly UpdateRecord[]>([]);
	let active: Measurement | null = null;
	let id = 0;

	function finish(measurement: Measurement) {
		active = null;
		id += 1;
		records.value = [
			{ id, label: measurement.label, ms: performance.now() - measurement.start, rows: countRenders() - measurement.before },
			...records.value,
		].slice(0, HISTORY);
	}

	function measure(label: string, change: () => void) {
		if (active) {
			change();

			return;
		}

		const measurement = { label, start: performance.now(), before: countRenders() };

		active = measurement;
		change();
		void nextTick(() => finish(measurement));
	}

	function follow(source: WatchSource, label: string) {
		watch(source, () => measure(label, () => undefined), { flush: 'pre' });
	}

	return { records, measure, follow };
}
