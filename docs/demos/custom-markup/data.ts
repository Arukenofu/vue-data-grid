export type InvoiceStatus = 'paid' | 'due' | 'overdue';

export interface Invoice {
	id: string;
	number: string;
	customer: string;
	issued: string;
	amount: number;
	status: InvoiceStatus;
}

export const invoices: readonly Invoice[] = [
	{ id: 'i1', number: 'INV-1042', customer: 'Northwind Traders', issued: '2026-09-02', amount: 4820, status: 'paid' },
	{ id: 'i2', number: 'INV-1043', customer: 'Blue Harbor Co.', issued: '2026-09-04', amount: 1290.5, status: 'due' },
	{ id: 'i3', number: 'INV-1044', customer: 'Kestrel Labs', issued: '2026-09-05', amount: 12400, status: 'overdue' },
	{ id: 'i4', number: 'INV-1045', customer: 'Maple & Stone', issued: '2026-09-09', amount: 760, status: 'paid' },
	{ id: 'i5', number: 'INV-1046', customer: 'Orbit Foods', issued: '2026-09-11', amount: 3315.25, status: 'due' },
	{ id: 'i6', number: 'INV-1047', customer: 'Quill Studio', issued: '2026-09-15', amount: 980, status: 'paid' },
	{ id: 'i7', number: 'INV-1048', customer: 'Riverbend Clinic', issued: '2026-09-18', amount: 6150, status: 'overdue' },
	{ id: 'i8', number: 'INV-1049', customer: 'Tandem Bikes', issued: '2026-09-21', amount: 2240, status: 'due' },
	{ id: 'i9', number: 'INV-1050', customer: 'Vireo Analytics', issued: '2026-09-24', amount: 8800, status: 'paid' },
];
