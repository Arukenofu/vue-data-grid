import { createRandom } from '@/data/random';

export type OrderStatus = 'new' | 'packed' | 'shipped' | 'cancelled';

export interface Order {
	id: string;
	customer: string;
	city: string;
	items: number;
	total: number;
	status: OrderStatus;
}

const CUSTOMERS = ['Ava Novak', 'Liam Reyes', 'Mia Kim', 'Noah Okafor', 'Zoe Larsen', 'Ethan Rossi', 'Aria Tanaka', 'Leo Silva', 'Nora Meyer', 'Kai Haddad'];
const CITIES = ['Berlin', 'Lisbon', 'Toronto', 'Seoul', 'Austin', 'Oslo', 'Warsaw'];
const STATUSES: readonly OrderStatus[] = ['new', 'new', 'new', 'packed', 'packed', 'shipped', 'cancelled'];

export function createOrders(count: number): Order[] {
	const random = createRandom(42);

	return Array.from({ length: count }, (_, index) => ({
		id: `#${1040 + index}`,
		customer: random.pick(CUSTOMERS),
		city: random.pick(CITIES),
		items: random.int(1, 6),
		total: Math.round(random.between(18, 640) * 100) / 100,
		status: random.pick(STATUSES),
	}));
}
