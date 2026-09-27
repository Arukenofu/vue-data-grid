import IconChartColumn from '~icons/lucide/chart-column';
import IconChartCandlestick from '~icons/lucide/chart-candlestick';
import IconFolderTree from '~icons/lucide/folder-tree';
import IconGrid from '~icons/lucide/grid-3x3';
import IconKanban from '~icons/lucide/square-kanban';
import IconRows from '~icons/lucide/rows-4';
import IconUsers from '~icons/lucide/users';
import type { Component } from 'vue';

export interface Example {
	title: string;
	text: string;
	link: string;
	icon: Component;
	/** The two colours of the card's gradient. */
	colors: readonly [string, string];
	tags: readonly string[];
}

export const EXAMPLES: readonly Example[] = [
	{
		title: 'Stock screener',
		text: 'Prices stream in, cells flash up and down, and a sorted table re-sorts only the rows that moved.',
		link: '/examples/screener',
		icon: IconChartCandlestick,
		colors: ['#12a594', '#30a46c'],
		tags: ['live data', 'motion', 'pinning'],
	},
	{
		title: 'Spreadsheet',
		text: 'Ranges, editing, fill handle, copy and paste from Excel, undo and redo: a small spreadsheet.',
		link: '/examples/spreadsheet',
		icon: IconGrid,
		colors: ['#0d9488', '#2563eb'],
		tags: ['ranges', 'editing', 'clipboard'],
	},
	{
		title: 'Task board',
		text: 'Two tables that trade rows by drag and drop, with a bin to drop tasks in and rows that move into place.',
		link: '/examples/task-board',
		icon: IconKanban,
		colors: ['#7c3aed', '#db2777'],
		tags: ['drag and drop', 'motion'],
	},
	{
		title: 'File explorer',
		text: 'A tree with folder sizes that add up, keyboard expand and collapse, and files dragged into folders.',
		link: '/examples/file-explorer',
		icon: IconFolderTree,
		colors: ['#d97706', '#dc2626'],
		tags: ['tree', 'aggregates', 'drag and drop'],
	},
	{
		title: 'A million cells',
		text: 'Fifty thousand rows by twenty columns, windowed both ways, and every frame still smooth.',
		link: '/examples/big-data',
		icon: IconRows,
		colors: ['#0891b2', '#4f46e5'],
		tags: ['virtualization', 'performance'],
	},
	{
		title: 'Team directory',
		text: 'Search, selection, a column menu to hide and pin columns, and a layout remembered between visits.',
		link: '/examples/team-directory',
		icon: IconUsers,
		colors: ['#16a34a', '#65a30d'],
		tags: ['selection', 'layout', 'persistence'],
	},
	{
		title: 'Sales report',
		text: 'Rows grouped by region and product with totals on every level, and column groups that fold away.',
		link: '/examples/sales-report',
		icon: IconChartColumn,
		colors: ['#e11d48', '#ea580c'],
		tags: ['grouping', 'column groups', 'footer'],
	},
];
