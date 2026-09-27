import type { SortDirection } from '@vue-stack/table-core';
import { defineComponent, h, type PropType, type SlotsType, type VNodeChild } from 'vue';

import { type TableBodyRow, useBodyRowContext, useDataTableContext, useHeaderCellContext } from './context';
import { useTableMessagesContext } from './messages';
import { getRenderedTag, primitiveProps, renderPrimitive } from './primitive';
import { warnMissing } from './warn';

const MARKS: Readonly<Record<SortDirection, string>> = { asc: '▲', desc: '▼' };

/** The row a part is for: its `row` prop, a key or a body row, else the `TableRow` around it. */
const rowProp = {
	type: [String, Object] as PropType<string | TableBodyRow>,
	default: undefined,
};

function useRowKey(props: { row?: string | TableBodyRow }) {
	const around = useBodyRowContext(null);

	return () => {
		const { row } = props;

		return row === undefined ? around?.().key : typeof row === 'string' ? row : row.key;
	};
}

/**
 * A native checkbox toggles itself before its click handler runs, and Vue patches `checked` only
 * when the rendered value changes: after an operation that leaves the selection as it was, such as
 * Shift+click on a row the range keeps, the box would show the opposite. This puts the model back.
 */
function syncCheckbox(event: Event, checked: boolean, partly: boolean) {
	const target = event.currentTarget;

	if (target instanceof HTMLInputElement) {
		target.checked = checked;
		target.indeterminate = partly;
	}
}

// A button clicks itself on Space; another element with the checkbox role has to be clicked.
function onCheckboxKeydown(event: KeyboardEvent) {
	const target = event.currentTarget;

	if (event.key === 'Enter') {
		event.preventDefault();
	} else if (event.key === ' ' && target instanceof HTMLElement && target.tagName !== 'BUTTON') {
		event.preventDefault();
		target.click();
	}
}

/**
 * The props of a checkbox part by the element it renders. A native checkbox takes `checked` and
 * `indeterminate`; any other element takes the `checkbox` role with `aria-checked`, a focus stop
 * unless it is a button, and Space to toggle, while Enter is left alone, as the checkbox pattern says.
 */
function getCheckboxProps(tag: string | null, selected: boolean, partly: boolean, disabled: boolean) {
	const state = {
		'data-tc-part': 'selection-checkbox',
		'data-tc-state': partly ? 'indeterminate' : selected ? 'checked' : 'unchecked',
		'data-tc-disabled': disabled ? '' : undefined,
	};

	if (tag === 'input') {
		return { ...state, type: 'checkbox', checked: selected, indeterminate: partly, disabled };
	}

	return {
		...state,
		type: tag === 'button' ? 'button' : undefined,
		role: 'checkbox',
		'aria-checked': partly ? 'mixed' : selected,
		'aria-disabled': disabled || undefined,
		disabled: tag === 'button' ? disabled : undefined,
		tabindex: tag === 'button' || tag === null ? undefined : 0,
		onKeydown: onCheckboxKeydown,
	};
}

/**
 * The sort mark of the header cell it is in: the direction and, in a multi-sort, the column's place,
 * with `data-tc-state` of `asc`, `desc` or `none`. `aria-hidden`: the header cell's `aria-sort` says
 * it. It renders while the column is unsorted too, empty, so the width it takes does not change with
 * the sort; nothing renders for a column that is not `sortable`. The default slot gets
 * `{ direction, sortIndex }`; without it the mark is `▲` or `▼` and the place.
 */
export const TableSortIndicator = defineComponent({
	name: 'TableSortIndicator',
	props: {
		...primitiveProps,
		as: { ...primitiveProps.as, default: 'span' },
	},
	slots: Object as SlotsType<{
		default?: (context: { direction: SortDirection | undefined; sortIndex: number | undefined }) => VNodeChild;
	}>,
	setup(props, { slots }) {
		const table = useDataTableContext();
		const cell = useHeaderCellContext();

		return () => {
			const { column } = cell();

			if (!column?.sortable) {
				return null;
			}

			const direction = table.scope.getSortDirection(column.name);
			const sortIndex = table.scope.getSortIndex(column.name);

			return renderPrimitive(props, {
				'aria-hidden': 'true',
				'data-tc-part': 'sort-indicator',
				'data-tc-state': direction ?? 'none',
			}, () => (slots.default
				? slots.default({ direction, sortIndex })
				: direction ? `${MARKS[direction]}${sortIndex ?? ''}` : ''));
		};
	},
});

function useSelection(part: string) {
	const { selection } = useDataTableContext();

	if (!selection) {
		warnMissing(part, 'selection');
	}

	return selection;
}

/**
 * The checkbox of a row's selection: checked, partly checked for a group with some leaves selected,
 * disabled for a row the selection refuses, with `data-tc-state` of `checked`, `unchecked` or
 * `indeterminate`. A click toggles the row; with Shift it selects the range from the last row toggled.
 * The row is `row`, else the body row it is in. A native `input` by default; any other element gets
 * `role="checkbox"` and `aria-checked`. Needs the `selection` feature.
 */
export const TableSelectionCheckbox = defineComponent({
	name: 'TableSelectionCheckbox',
	props: {
		...primitiveProps,
		as: { ...primitiveProps.as, default: 'input' },
		/** The row: its key or its body row; the row of the `TableRow` around it by default. */
		row: rowProp,
		/** The accessible name; the table's `selectRow` message by default. */
		label: { type: String, default: undefined },
	},
	slots: Object as SlotsType<{ default?: (context: { selected: boolean; partly: boolean }) => VNodeChild }>,
	setup(props, { slots }) {
		const selection = useSelection('TableSelectionCheckbox');
		const messages = useTableMessagesContext();
		const getKey = useRowKey(props);

		function select(event: MouseEvent) {
			const key = getKey();

			if (key === undefined || !selection) {
				return;
			}

			if (event.shiftKey) {
				selection.extend(key);
			} else {
				selection.toggle(key);
			}

			syncCheckbox(event, selection.isSelected(key), selection.isPartlySelected(key));
		}

		return () => {
			const key = getKey();

			if (!selection || key === undefined) {
				return null;
			}

			const selected = selection.isSelected(key);
			const partly = selection.isPartlySelected(key);
			const content = slots.default?.({ selected, partly });

			return renderPrimitive(props, {
				...getCheckboxProps(getRenderedTag(props, content), selected, partly, !selection.isSelectable(key)),
				'aria-label': props.label ?? messages.selectRow,
				onClick: select,
			}, slots.default ? () => content : undefined);
		};
	},
});

/**
 * The checkbox that selects every row "all" means, or none: checked when all are selected, partly
 * checked when some are, with `data-tc-state` as a row's checkbox has. Disabled in `'single'`
 * selection mode. Needs the `selection` feature.
 */
export const TableSelectAllCheckbox = defineComponent({
	name: 'TableSelectAllCheckbox',
	props: {
		...primitiveProps,
		as: { ...primitiveProps.as, default: 'input' },
		/** The accessible name; the table's `selectAllRows` message by default. */
		label: { type: String, default: undefined },
	},
	slots: Object as SlotsType<{ default?: (context: { selected: boolean; partly: boolean }) => VNodeChild }>,
	setup(props, { slots }) {
		const selection = useSelection('TableSelectAllCheckbox');
		const messages = useTableMessagesContext();

		function selectAll(event: MouseEvent) {
			if (selection) {
				selection.toggleAll();
				syncCheckbox(event, selection.isAllSelected.value, selection.isSomeSelected.value);
			}
		}

		return () => {
			if (!selection) {
				return null;
			}

			const selected = selection.isAllSelected.value;
			const partly = selection.isSomeSelected.value;
			const content = slots.default?.({ selected, partly });
			const disabled = selection.selectionMode.value === 'single';

			return renderPrimitive(props, {
				...getCheckboxProps(getRenderedTag(props, content), selected, partly, disabled),
				'aria-label': props.label ?? messages.selectAllRows,
				onClick: selectAll,
			}, slots.default ? () => content : undefined);
		};
	},
});

/**
 * The button that expands or collapses a group row of the tree, with `data-tc-state` of `expanded`
 * or `collapsed`. A leaf gets an empty placeholder of the same width while the tree has groups, so
 * its text lines up with theirs, and nothing in a tree without groups. The row is `row`, else the body row it is in. The default slot gets `{ expanded }`;
 * without it the button shows `▾` or `▸`. Needs the `tree` feature.
 */
export const TableTreeToggle = defineComponent({
	name: 'TableTreeToggle',
	props: {
		...primitiveProps,
		as: { ...primitiveProps.as, default: 'button' },
		/** The row: its key or its body row; the row of the `TableRow` around it by default. */
		row: rowProp,
	},
	slots: Object as SlotsType<{ default?: (context: { expanded: boolean }) => VNodeChild }>,
	setup(props, { slots }) {
		const { tree } = useDataTableContext();
		const getKey = useRowKey(props);
		const messages = useTableMessagesContext();

		if (!tree) {
			warnMissing('TableTreeToggle', 'tree');
		}

		return () => {
			const key = getKey();
			const node = key === undefined ? undefined : tree?.getNode(key);

			if (!tree || key === undefined || !node?.group) {
				// A leaf keeps the room of a toggle to line up with the groups beside it; without groups, nothing.
				return tree?.hasGroups.value ? h('span', { 'aria-hidden': 'true', 'data-tc-part': 'tree-toggle' }) : null;
			}

			const expanded = tree.isExpanded(key);
			const content = slots.default ? slots.default({ expanded }) : expanded ? '▾' : '▸';

			return renderPrimitive(props, {
				type: getRenderedTag(props, content) === 'button' ? 'button' : undefined,
				'aria-label': expanded ? messages.collapseRow : messages.expandRow,
				'data-tc-part': 'tree-toggle',
				'data-tc-state': expanded ? 'expanded' : 'collapsed',
				onClick: () => tree.toggle(key),
			}, () => content);
		};
	},
});
