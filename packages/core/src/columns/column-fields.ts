import type { AggregateResult, ColumnGroup, RowNode, RuntimeColumn, SortDirection } from '@vue-data-grid/engine';
import type { ClassValue, VNodeChild } from 'vue';

/** What a body cell renders from. */
export interface CellContext<TRow, TValue> {
	row: TRow;
	value: TValue;
	/** The key of the row, as the engine's `rowKey` gives it. */
	key: string;
	/** Position of the row in the list passed as `rows`. */
	index: number;
	/** The column of the cell. */
	column: RuntimeColumn;
	/** The row's node from `useRowTree`, in a tree; `undefined` in a flat grid. */
	node?: RowNode;
	/**
	 * Writes a value into the cell at once, as an edit with the source `'edit'`: for a control in the
	 * cell, such as `checkboxCell()`. Present with the `editing` feature on a cell that can be edited,
	 * so a control is disabled without it.
	 */
	// A method, not a property: its parameter stays bivariant, so a column of any value fits a list of columns.
	write?(value: TValue): void;
}

/**
 * Where focus goes after an editor commits: to a neighbour, to the `next` or `previous` cell, which
 * go on to the next or previous row at the end of one, as Tab does, or nowhere.
 */
export type EditorMove = 'down' | 'up' | 'right' | 'left' | 'next' | 'previous' | 'none';

/**
 * How editing started. `'quick'`: a character typed on the cell, as in a spreadsheet, so the arrows
 * save and go to the next cell, for typing value after value. `'full'`: Enter, F2 or a double click,
 * so the arrows move within the editor. F2 switches.
 */
export type EditorMode = 'quick' | 'full';

/** What an editor renders from: the cell, the draft and what to do with it. */
export interface EditorContext<TRow, TValue> extends CellContext<TRow, TValue> {
	/** How editing started, which tells what the arrows do; F2 switches. */
	mode: EditorMode;
	/** The value being typed, which a commit writes. */
	draft: TValue;
	/** The text typed, when the draft comes from text; `undefined` while it is a value. */
	text: string | undefined;
	/** What the column's `validate` says of the draft; `null` while it is right. */
	error: string | null;
	/** The id for an element with the error, which `inputProps` points `aria-describedby` at. */
	errorId: string;
	// Methods, not properties: their parameters stay bivariant, so a column of any value fits a list of columns.
	setDraft(value: TValue): void;
	/**
	 * Sets the draft from text, keeping the text as typed: through the column's `parse`, or `draft`
	 * when the editor reads the text itself.
	 */
	setText(text: string, draft?: TValue): void;
	/** Commits the draft and moves focus; with an invalid draft the editor stays. */
	commit: (move?: EditorMove) => void;
	/** Ends editing without a write; focus goes back to the cell. */
	cancel: () => void;
	/**
	 * Props for the element that takes input: it takes focus when it mounts, and gets the keys of
	 * `useGridEditing` (Enter commits and goes down, Tab across, Escape cancels, the arrows in the
	 * `'quick'` mode save and move, F2 switches the mode), a commit when focus leaves it, its label,
	 * `data-dg-state` with the mode, and `aria-invalid` with an error. Its keys run after an
	 * `onKeydown` of the editor's own that comes first in an array: `event.preventDefault()` there
	 * keeps a key, as a list keeps ↑ and ↓.
	 */
	inputProps: Readonly<Record<string, unknown>>;
}

/**
 * An editor of a column: a function of its context that renders the editor, such as `numberEditor()`.
 * Bind `inputProps` to the element that takes input.
 */
export interface CellEditor<TRow = unknown, TValue = unknown> {
	(context: EditorContext<TRow, TValue>): VNodeChild;
	/**
	 * What a character typed on the cell does: `'text'`, the default, starts editing with that
	 * character in place of the value, in the `'quick'` mode; `'value'` starts with the value, in the
	 * `'full'` mode, for an editor that cannot take part of a value, such as a date field.
	 */
	typing?: 'text' | 'value';
}

/** What a header cell renders from. */
export interface HeaderContext {
	/** The column of the header cell. */
	column: RuntimeColumn;
	direction?: SortDirection;
	/** 1-based position of the column in a multi-sort; `undefined` while only one column sorts. */
	sortIndex?: number;
}

/** What a footer cell renders from. */
export interface FooterContext<TRow, TAggregate = unknown> {
	/** The column of the footer cell. */
	column: RuntimeColumn;
	rows: readonly TRow[];
	/**
	 * The column's `aggregate` over the footer rows; `undefined` for a column without `aggregate`.
	 * Typed by the `aggregate` of a column made with `defineColumn`.
	 */
	aggregate: TAggregate;
}

/** What the header cell of a column group renders from. */
export interface GroupHeaderContext {
	group: ColumnGroup;
	/** Whether the group is collapsed now; always `false` for a group that cannot collapse. */
	collapsed: boolean;
}

declare module '@vue-data-grid/engine' {
	// Type parameters must repeat the core declaration exactly, or the interfaces do not merge.
	interface ColumnExtension<TRow, TValue, TAggregate> {
		/** The header cell, when the column's `label` is not enough. */
		header?: (context: HeaderContext) => VNodeChild;
		/** The body cell; the cell text from `format` without it. */
		cell?: (context: CellContext<TRow, TValue>) => VNodeChild;
		cellClass?: (context: CellContext<TRow, TValue>) => ClassValue;
		/**
		 * The editor of a cell of an `editable` column, such as `numberEditor()`; `textEditor()` without
		 * it. `false` for a column whose cell edits itself with a control that calls `write`, such as
		 * `checkboxCell()`: no editor opens, and Enter and Space go to the control. Bind `inputProps` to
		 * the element that takes input.
		 */
		editor?: CellEditor<TRow, TValue> | false;
		/**
		 * The footer cell. A function `aggregate` types `aggregate` here when it comes before `footer` in
		 * the object: TypeScript types the functions of an object literal in order.
		 */
		footer?: (context: FooterContext<TRow, AggregateResult<TValue, TAggregate>>) => VNodeChild;
		/**
		 * The column shows the tree, so → and ← of `useCellNavigation` expand and collapse rows in it.
		 * `treeColumn()` sets it.
		 */
		tree?: boolean;
	}

	interface ColumnGroupExtension {
		/** The group header cell, when the group's `label` is not enough. */
		header?: (context: GroupHeaderContext) => VNodeChild;
	}
}
