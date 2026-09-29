import { createRandom } from '@/data/random';

export type EventLevel = 'info' | 'warning' | 'error';

export interface LogEvent {
	id: string;
	time: string;
	level: EventLevel;
	service: string;
	message: string;
}

export interface EventPage {
	rows: readonly LogEvent[];
	/** The page before this one, or `null` at the first. */
	previous: number | null;
	/** The page after this one, or `null` at the last. */
	next: number | null;
}

/** The page the log opens at: the middle of the day, with pages before and after it. */
export const START_PAGE = 10;

const PAGE_SIZE = 30;
const PAGES = 20;
const LATENCY = 700;
const START = Date.UTC(2026, 8, 29, 6, 0, 0);

const SERVICES = ['api', 'auth', 'billing', 'search', 'worker'];
const LEVELS: readonly EventLevel[] = ['info', 'info', 'info', 'info', 'warning', 'error'];
const MESSAGES: Readonly<Record<EventLevel, readonly string[]>> = {
	info: ['Request served', 'Session started', 'Cache warmed', 'Job finished', 'Index refreshed'],
	warning: ['Slow query', 'Retrying a request', 'Queue is filling up', 'Token about to expire'],
	error: ['Payment declined', 'Upstream timed out', 'Job failed', 'Connection reset'],
};

function createEvents() {
	const random = createRandom(29);
	let time = START;

	return Array.from({ length: PAGE_SIZE * PAGES }, (_, index): LogEvent => {
		const level = random.pick(LEVELS);

		time += random.int(4, 40) * 1000;

		return {
			id: `e${index + 1}`,
			time: new Date(time).toISOString().slice(11, 19),
			level,
			service: random.pick(SERVICES),
			message: random.pick(MESSAGES[level]),
		};
	});
}

const events = createEvents();

/** A page of the log from a pretend server, with the pages around it; the size of the log is not told. */
export function fetchEvents(page: number) {
	const rows = events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

	return new Promise<EventPage>((resolve) => {
		setTimeout(() => resolve({
			rows,
			previous: page > 0 ? page - 1 : null,
			next: page + 1 < PAGES ? page + 1 : null,
		}), LATENCY);
	});
}
