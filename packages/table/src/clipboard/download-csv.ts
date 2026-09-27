export interface DownloadCsvOptions {
	/** The file name; `.csv` is added when it is not there. `'table'` by default. */
	name?: string;
}

/** How long the file stays behind its link after the click, ms: a browser may start the download later. */
const REVOKE_DELAY = 40_000;

/**
 * Saves CSV, such as `toCsv` gives, as a file through a download link. It starts with a byte order
 * mark, so that Excel reads UTF-8.
 */
export function downloadCsv(csv: string, options: DownloadCsvOptions = {}) {
	const name = options.name ?? 'table';
	const link = document.createElement('a');
	const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));

	link.href = url;
	link.download = /\.csv$/i.test(name) ? name : `${name}.csv`;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY);
}
