import type { RenderedGroup } from '@vue-stack/table-core';

type IndexProps = Readonly<Record<string, number>>;

const NO_PROPS: IndexProps = Object.freeze({});

const COLUMN_PROPS: IndexProps[] = [];

const GROUP_PROPS = new Map<string, IndexProps>();

/**
 * `aria-colindex` of a column cell from its `index` among the shown columns: one frozen object per
 * position, shared by all rows and tables. Nothing for a spacer (`-1`). Cells need it where their
 * order in the DOM differs from the logical one, such as under the column window.
 */
export function getColumnIndexProps(index: number): IndexProps {
	if (index < 0) {
		return NO_PROPS;
	}

	let props = COLUMN_PROPS[index];

	if (!props) {
		props = Object.freeze({ 'aria-colindex': index + 1 });
		COLUMN_PROPS[index] = props;
	}

	return props;
}

/**
 * `aria-colindex` and `aria-colspan` of a group cell from its `index` and `span`: one frozen object
 * per pair. Nothing for a spacer.
 */
export function getGroupIndexProps(cell: Pick<RenderedGroup, 'index' | 'span'>): IndexProps {
	if (cell.index < 0) {
		return NO_PROPS;
	}

	const key = `${cell.index}:${cell.span}`;
	let props = GROUP_PROPS.get(key);

	if (!props) {
		props = Object.freeze({ 'aria-colindex': cell.index + 1, 'aria-colspan': cell.span });
		GROUP_PROPS.set(key, props);
	}

	return props;
}
