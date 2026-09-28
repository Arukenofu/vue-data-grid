import { shallowReactive, type VNodeChild } from 'vue';

import type { CellContext, EditorContext, FooterContext, HeaderContext } from '../columns/column-fields';

/** What each kind of column template renders from. */
export interface GridTemplateContexts {
	cell: CellContext<unknown, unknown>;
	header: HeaderContext;
	footer: FooterContext<unknown, unknown>;
	editor: EditorContext<unknown, unknown>;
}

/** The kinds of column templates: a body cell, a header cell, a footer cell and an editor. */
export type GridTemplateKind = keyof GridTemplateContexts;

/** A column template: the content it renders from its context, nothing where its slot renders nothing. */
export type GridTemplate<TKind extends GridTemplateKind> = (context: GridTemplateContexts[TKind]) => VNodeChild;

/** A template in `GridTemplates`, from `register`. */
export interface GridTemplateRegistration<TKind extends GridTemplateKind> {
	/** Puts `template` in the place of this one, such as the slot of a new render: the cells render again. */
	update: (template: GridTemplate<TKind>) => void;
	/** Takes the template away; the next one of its column, if any, renders. */
	unregister: () => void;
}

/**
 * The column templates of a grid by kind and column name: `GridCellTemplate` and the other template
 * parts register them, and the cells render them. For a part of your own in place of a cell part or a
 * template part.
 */
export interface GridTemplates {
	/** The template of `kind` for `column`; a render that reads it renders again when it changes. */
	get<TKind extends GridTemplateKind>(kind: TKind, column: string): GridTemplate<TKind> | undefined;
	/**
	 * Registers `template` of `kind` for `column`. With two for one column, the first registered
	 * renders, and warns in development.
	 */
	register<TKind extends GridTemplateKind>(kind: TKind, column: string, template: GridTemplate<TKind>): GridTemplateRegistration<TKind>;
}

interface Entry<TKind extends GridTemplateKind> {
	template: GridTemplate<TKind>;
}

type EntryLists = { [TKind in GridTemplateKind]: Map<string, Entry<TKind>[]> };

type TemplateMaps = { [TKind in GridTemplateKind]: Map<string, GridTemplate<TKind>> };

const TEMPLATE_PARTS: Readonly<Record<GridTemplateKind, string>> = {
	cell: 'GridCellTemplate',
	header: 'GridHeaderTemplate',
	footer: 'GridFooterTemplate',
	editor: 'GridEditorTemplate',
};

function warnLate(kind: GridTemplateKind, column: string) {
	// oxlint-disable-next-line no-console
	console.warn(
		`[@vue-data-grid/core] <${TEMPLATE_PARTS[kind]}> of column "${column}" came after the cells it fills had rendered: `
		+ 'a server render leaves it out, and the page does not hydrate. '
		+ 'Put the templates first in the slot of <GridRoot>, before the header and the body.',
	);
}

function warnTwice(kind: GridTemplateKind, column: string) {
	// oxlint-disable-next-line no-console
	console.warn(`[@vue-data-grid/core] Column "${column}" has two <${TEMPLATE_PARTS[kind]}>: the first one renders.`);
}

/**
 * Makes an empty registry of column templates; `createGridTemplatesContext` gives one to each grid.
 * `isMounted` says whether the grid has mounted: in development, a template registered before that
 * for a column whose cells have rendered is out of order, and warns.
 */
export function createGridTemplates(isMounted: () => boolean): GridTemplates {
	// Every template registered, in order, by kind and column; not reactive.
	const lists: EntryLists = {
		cell: new Map(),
		header: new Map(),
		footer: new Map(),
		editor: new Map(),
	};
	// The template that renders for each column, the first of its list. Reactive by key: a template
	// that comes, goes or changes renders the cells that read its column, not every cell.
	const heads: TemplateMaps = {
		cell: shallowReactive(new Map()),
		header: shallowReactive(new Map()),
		footer: shallowReactive(new Map()),
		editor: shallowReactive(new Map()),
	};
	// The columns whose cells have looked for a template, by kind: development only.
	const looked: Readonly<Record<GridTemplateKind, Set<string>>> = {
		cell: new Set(),
		header: new Set(),
		footer: new Set(),
		editor: new Set(),
	};

	function sync<TKind extends GridTemplateKind>(kind: TKind, column: string) {
		const head = lists[kind].get(column)?.[0];

		// A reactive map triggers only on a change, so setting the same template again renders nothing.
		if (head) {
			heads[kind].set(column, head.template);
		} else {
			heads[kind].delete(column);
		}
	}

	function register<TKind extends GridTemplateKind>(kind: TKind, column: string, template: GridTemplate<TKind>) {
		const list = lists[kind].get(column) ?? [];
		const entry: Entry<TKind> = { template };

		if (__DEV__ && !isMounted() && looked[kind].has(column)) {
			warnLate(kind, column);
		}

		if (__DEV__ && list.length > 0) {
			warnTwice(kind, column);
		}

		list.push(entry);
		lists[kind].set(column, list);
		sync(kind, column);

		return {
			update(next: GridTemplate<TKind>) {
				entry.template = next;
				sync(kind, column);
			},
			unregister() {
				const index = list.indexOf(entry);

				if (index === -1) {
					return;
				}

				list.splice(index, 1);

				if (list.length === 0) {
					lists[kind].delete(column);
				}

				sync(kind, column);
			},
		};
	}

	return {
		get(kind, column) {
			if (__DEV__ && !isMounted()) {
				looked[kind].add(column);
			}

			return heads[kind].get(column);
		},
		register,
	};
}
