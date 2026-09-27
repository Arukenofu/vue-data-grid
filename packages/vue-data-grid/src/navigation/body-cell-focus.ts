import type { CellAddress, FocusedCell } from '@vue-data-grid/core';
import type { Ref } from 'vue';

/**
 * Focus of the body cells by address, which range selection, editing and the clipboard read and move:
 * `cells` of `useGridNavigation` fits, and so does `useCellFocus()` of the core, for a grid that keeps
 * DOM focus on itself and points at the cell with `aria-activedescendant`.
 */
export interface BodyCellFocus {
	/** The focused body cell; `null` while focus is on no body cell. */
	focused: Readonly<Ref<FocusedCell | null>>;
	/** Focuses a body cell. */
	focus: (cell: CellAddress) => unknown;
}
