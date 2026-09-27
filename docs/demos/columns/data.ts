import { createRandom } from '@/data/random';

export type InvoiceStatus = 'paid' | 'open' | 'overdue' | 'credit';

export interface Invoice {
	id: string;
	number: string;
	customer: string;
	email: string;
	status: InvoiceStatus;
	issued: string;
	amount: number;
	paid: number;
}

const CUSTOMERS = [
	'Northwind Traders',
	'Blue Harbor Studio',
	'Kettle & Co',
	'Lumen Labs',
	'Fjord Outfitters',
	'Maple Analytics',
	'Quill Publishing',
	'Rowan Dental',
	'Sable Architects',
	'Tandem Bikes',
];

const STATUSES: readonly InvoiceStatus[] = ['paid', 'paid', 'paid', 'open', 'open', 'overdue', 'credit'];

function pad(value: number) {
	return String(value).padStart(2, '0');
}

function getPaid(status: InvoiceStatus, part: number) {
	if (status === 'paid' || status === 'credit') {
		return 100;
	}

	return status === 'open' ? Math.round(part * 60) : Math.round(part * 30);
}

export function createInvoices(count: number): Invoice[] {
	const random = createRandom(21);

	return Array.from({ length: count }, (_, index) => {
		const customer = random.pick(CUSTOMERS);
		const status = random.pick(STATUSES);
		const amount = Math.round(random.between(180, 9800)) * (status === 'credit' ? -0.25 : 1);

		return {
			id: `inv-${index + 1}`,
			number: `INV-${2400 + index}`,
			customer,
			email: `billing@${customer.toLowerCase().replace(/[^a-z]+/g, '')}.com`,
			status,
			issued: `2026-${pad(random.int(6, 9))}-${pad(random.int(1, 28))}`,
			amount,
			paid: getPaid(status, random.next()),
		};
	});
}

export const invoices = createInvoices(32);
