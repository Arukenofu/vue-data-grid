import type { TableSort } from '@vue-data-grid/core';

import type { FileEntry, FileKind } from '@/data/files';

export interface FileRow extends FileEntry {
	/** Files under a folder, on all levels; none for a file. */
	items?: number;
}

export const KIND_LABELS: Readonly<Record<FileKind, string>> = {
	folder: 'Folder',
	image: 'Image',
	code: 'Source code',
	document: 'Document',
	video: 'Video',
	archive: 'Archive',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(date: string) {
	const [year, month, day] = date.split('-');

	return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

/** Every folder with the size and the number of the files under it, on all levels. */
export function withFolderTotals(files: readonly FileEntry[]): FileRow[] {
	const children = new Map<string | null, FileEntry[]>();

	for (const file of files) {
		const siblings = children.get(file.parent);

		if (siblings) {
			siblings.push(file);
		} else {
			children.set(file.parent, [file]);
		}
	}

	function measure(folder: FileEntry) {
		let size = 0;
		let items = 0;

		for (const child of children.get(folder.id) ?? []) {
			const inner = child.kind === 'folder' ? measure(child) : { size: child.size, items: 1 };

			size += inner.size;
			items += inner.items;
		}

		return { size, items };
	}

	return files.map(file => (file.kind === 'folder' ? { ...file, ...measure(file) } : file));
}

/** The folders a file is in, from the top. */
export function getFolders(files: readonly FileEntry[], id: string): FileEntry[] {
	const byId = new Map(files.map(file => [file.id, file]));
	const folders: FileEntry[] = [];
	let parent = byId.get(id)?.parent ?? null;

	while (parent !== null) {
		const folder = byId.get(parent);

		if (!folder || folders.includes(folder)) {
			break;
		}

		folders.unshift(folder);
		parent = folder.parent;
	}

	return folders;
}

const COMPARE: Readonly<Record<string, (first: FileRow, second: FileRow) => number>> = {
	name: (first, second) => first.name.localeCompare(second.name),
	kind: (first, second) => KIND_LABELS[first.kind].localeCompare(KIND_LABELS[second.kind]),
	size: (first, second) => first.size - second.size,
	modified: (first, second) => first.modified.localeCompare(second.modified),
};

function isFolder(file: FileRow) {
	return file.kind === 'folder' ? 1 : 0;
}

/** Folders first, then by the first column of the sort, as a file manager lists them. */
export function sortFiles(files: readonly FileRow[], sort: readonly TableSort[]): FileRow[] {
	const [first] = sort;
	const compare = COMPARE[first?.name ?? 'name'] ?? COMPARE.name;
	const direction = first?.direction === 'desc' ? -1 : 1;

	return [...files].sort((a, b) => isFolder(b) - isFolder(a) || direction * compare(a, b));
}
