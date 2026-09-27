export type Category = 'Audio' | 'Video' | 'Lighting' | 'Cables';

export interface Product {
	id: string;
	name: string;
	category: Category;
	price: number | null;
	stock: number | null;
	restock: string | null;
	active: boolean;
}

export const CATEGORIES: readonly { value: Category; label: string }[] = [
	{ value: 'Audio', label: 'Audio' },
	{ value: 'Video', label: 'Video' },
	{ value: 'Lighting', label: 'Lighting' },
	{ value: 'Cables', label: 'Cables' },
];

export const products: readonly Product[] = [
	{ id: 'p1', name: 'Studio monitors', category: 'Audio', price: 349, stock: 18, restock: '2026-10-14', active: true },
	{ id: 'p2', name: 'Condenser mic', category: 'Audio', price: 189.5, stock: 4, restock: '2026-10-02', active: true },
	{ id: 'p3', name: '4K capture card', category: 'Video', price: 229, stock: 11, restock: null, active: true },
	{ id: 'p4', name: 'LED panel', category: 'Lighting', price: 119, stock: 26, restock: '2026-11-05', active: true },
	{ id: 'p5', name: 'XLR cable, 5 m', category: 'Cables', price: 14.9, stock: 140, restock: null, active: true },
	{ id: 'p6', name: 'Field monitor 7"', category: 'Video', price: 279, stock: 2, restock: '2026-09-30', active: false },
	{ id: 'p7', name: 'Audio interface', category: 'Audio', price: 219, stock: 9, restock: '2026-10-21', active: true },
	{ id: 'p8', name: 'Softbox kit', category: 'Lighting', price: 89, stock: 0, restock: '2026-10-09', active: false },
	{ id: 'p9', name: 'HDMI cable, 2 m', category: 'Cables', price: 24, stock: 88, restock: null, active: true },
	{ id: 'p10', name: 'Gimbal stabiliser', category: 'Video', price: 399, stock: 7, restock: '2026-11-12', active: true },
];
