// Parts that have warned: a part renders once per row, and one warning says it all.
const warned = new Set<string>();

/** Warns once in development that a part needs a feature of `useDataTable` the table does not have. */
export function warnMissing(part: string, feature: string) {
	if (__DEV__ && !warned.has(part)) {
		warned.add(part);
		// oxlint-disable-next-line no-console
		console.warn(`[vue-data-grid] <${part}> needs the \`${feature}\` feature of useDataTable.`);
	}
}
