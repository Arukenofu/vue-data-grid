export type Category = 'audio' | 'camera' | 'desk' | 'light';

export interface Product {
	id: string;
	name: string;
	category: Category;
	price: number | null;
	stock: number | null;
	restock: string | null;
	published: boolean;
	notes: string;
}

export const CATEGORIES: readonly { value: Category; label: string }[] = [
	{ value: 'audio', label: 'Audio' },
	{ value: 'camera', label: 'Cameras' },
	{ value: 'desk', label: 'Desk setup' },
	{ value: 'light', label: 'Lighting' },
];

export const products: readonly Product[] = [
	{ id: 'p1', name: 'Studio headphones', category: 'audio', price: 189, stock: 42, restock: '2026-10-14', published: true, notes: 'Closed back, 38 Ω' },
	{ id: 'p2', name: 'USB microphone', category: 'audio', price: 129, stock: 8, restock: '2026-10-02', published: true, notes: '' },
	{ id: 'p3', name: '4K webcam', category: 'camera', price: 159, stock: 0, restock: '2026-11-01', published: false, notes: 'Waiting for the new batch' },
	{ id: 'p4', name: 'Mirrorless body', category: 'camera', price: 1249, stock: 5, restock: null, published: true, notes: '' },
	{ id: 'p5', name: 'Standing desk', category: 'desk', price: 549, stock: 17, restock: '2026-10-20', published: true, notes: 'Two motors' },
	{ id: 'p6', name: 'Monitor arm', category: 'desk', price: 89, stock: 64, restock: null, published: true, notes: '' },
	{ id: 'p7', name: 'Key light', category: 'light', price: 199, stock: 12, restock: '2026-10-09', published: false, notes: '' },
	{ id: 'p8', name: 'Desk lamp', category: 'light', price: 69, stock: 33, restock: null, published: true, notes: 'Warm white' },
];
