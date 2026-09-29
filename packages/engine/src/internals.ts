/**
 * The building blocks of `useGridEngine` and the row pipeline: column reconciliation, groups, order,
 * row and column windows, the stream queue, incremental sorting. For building your own engine.
 *
 * Not covered by semver: signatures here change with the engine, in minor releases too. Everything
 * stable is exported from the package root, and nothing from the root is repeated here.
 */
export type { ColumnGeometry, ColumnLayout, ColumnOrder } from './columns';
export {
	clampColumnWidth,
	DEFAULT_COLUMN_WIDTH,
	DEFAULT_SORT_ORDER,
	getChangedFields,
	isFunctionOnlyChange,
	keepsFixedColumns,
	moveColumn,
	normalizeColumn,
	reconcileColumns,
	resolveRowHeaders,
	toggleSort,
	toRuntimeColumn,
} from './columns';
export type { GroupCellDraft } from './column-groups';
export {
	getGroupDepth,
	isCollapsibleGroup,
	keepsGroupsTogether,
	resolveCollapsedColumns,
	resolveGroupPaths,
	resolveGroupRows,
	toGroupList,
	useColumnGroups,
} from './column-groups';
export type { FitColumn } from './engine';
export { fitColumnWidths, useGridColumns } from './engine';
export type {
	AnchorSnapshot,
	AnchorTarget,
	ColumnWindow,
	ItemMetrics,
	ItemRange,
	ScrollTarget,
	ScrollViewport,
	VirtualColumnsOptions,
	VirtualRowsOptions,
} from './virtual';
export {
	collectIndexes,
	createItemMetrics,
	expandRange,
	isSameRange,
	resolveAnchorShift,
	resolveColumnWindow,
	resolvePageStep,
	resolveScrollPosition,
	resolveVirtualItems,
	resolveVisibleRange,
	useScrollViewport,
	useVirtualColumns,
	useVirtualRows,
} from './virtual';
export type { ColumnRunGeometry, ColumnSpanOptions } from './render';
export { getColumnRunGeometry, getColumnRunGrow, getGeometryKey, getPinOffsets, resolveColumnSpan } from './render';
export type {
	AggregatePart,
	AggregateParts,
	GroupCacheEntry,
	QueuedRow,
	RowGroupCache,
	RowQueue,
	SortFrame,
	SortKey,
} from './rows';
export { applyRowQueue, buildRowGroups, queueTransaction, resolveSortedRows } from './rows';
export {
	applyCellEdits,
	containsRangeBounds,
	getEdgeRow,
	isSameCellValue,
	replaceRows,
	subtractRangeBounds,
	validateCell,
} from './cells';
export type { RowToken } from './shared';
export { stableComputed, useModelRef, useRowToken } from './shared';
