export type FileKind = 'folder' | 'image' | 'code' | 'document' | 'video' | 'archive';

export interface FileEntry {
	id: string;
	parent: string | null;
	name: string;
	kind: FileKind;
	/** Bytes; a folder has none of its own, its files add up. */
	size: number;
	modified: string;
}

const KB = 1024;
const MB = KB * KB;
const GB = MB * KB;

export const files: readonly FileEntry[] = [
	{ id: 'design', parent: null, name: 'Design', kind: 'folder', size: 0, modified: '2026-09-18' },
	{ id: 'brand', parent: 'design', name: 'Brand', kind: 'folder', size: 0, modified: '2026-09-02' },
	{ id: 'logo', parent: 'brand', name: 'logo.svg', kind: 'image', size: 14 * KB, modified: '2026-08-30' },
	{ id: 'palette', parent: 'brand', name: 'palette.png', kind: 'image', size: 2.4 * MB, modified: '2026-09-02' },
	{ id: 'type', parent: 'brand', name: 'typography.pdf', kind: 'document', size: 6.1 * MB, modified: '2026-07-21' },
	{ id: 'screens', parent: 'design', name: 'Screens', kind: 'folder', size: 0, modified: '2026-09-18' },
	{ id: 'home', parent: 'screens', name: 'home.fig', kind: 'image', size: 38 * MB, modified: '2026-09-18' },
	{ id: 'checkout', parent: 'screens', name: 'checkout.fig', kind: 'image', size: 24 * MB, modified: '2026-09-11' },
	{ id: 'source', parent: null, name: 'Source', kind: 'folder', size: 0, modified: '2026-09-26' },
	{ id: 'app', parent: 'source', name: 'app', kind: 'folder', size: 0, modified: '2026-09-26' },
	{ id: 'main', parent: 'app', name: 'main.ts', kind: 'code', size: 3.2 * KB, modified: '2026-09-26' },
	{ id: 'router', parent: 'app', name: 'router.ts', kind: 'code', size: 5.8 * KB, modified: '2026-09-24' },
	{ id: 'store', parent: 'app', name: 'store.ts', kind: 'code', size: 11.4 * KB, modified: '2026-09-25' },
	{ id: 'components', parent: 'source', name: 'components', kind: 'folder', size: 0, modified: '2026-09-23' },
	{ id: 'orders', parent: 'components', name: 'OrdersTable.vue', kind: 'code', size: 9.1 * KB, modified: '2026-09-23' },
	{ id: 'chart', parent: 'components', name: 'RevenueChart.vue', kind: 'code', size: 7.6 * KB, modified: '2026-09-20' },
	{ id: 'readme', parent: 'source', name: 'README.md', kind: 'document', size: 4.4 * KB, modified: '2026-09-12' },
	{ id: 'media', parent: null, name: 'Media', kind: 'folder', size: 0, modified: '2026-09-15' },
	{ id: 'launch', parent: 'media', name: 'launch-film.mp4', kind: 'video', size: 412 * MB, modified: '2026-09-15' },
	{ id: 'teaser', parent: 'media', name: 'teaser.mp4', kind: 'video', size: 88 * MB, modified: '2026-09-09' },
	{ id: 'photos', parent: 'media', name: 'Photos', kind: 'folder', size: 0, modified: '2026-08-27' },
	{ id: 'office', parent: 'photos', name: 'office.jpg', kind: 'image', size: 5.2 * MB, modified: '2026-08-27' },
	{ id: 'crew', parent: 'photos', name: 'team.jpg', kind: 'image', size: 6.8 * MB, modified: '2026-08-27' },
	{ id: 'backup', parent: null, name: 'backup-2026-09.zip', kind: 'archive', size: 1.6 * GB, modified: '2026-09-01' },
	{ id: 'notes', parent: null, name: 'notes.md', kind: 'document', size: 2.1 * KB, modified: '2026-09-26' },
];

const UNITS = ['B', 'KB', 'MB', 'GB'];

/** Bytes as people read them: `2.4 MB`. */
export function formatSize(bytes: number) {
	let value = bytes;
	let unit = 0;

	while (value >= KB && unit < UNITS.length - 1) {
		value /= KB;
		unit += 1;
	}

	return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`;
}
