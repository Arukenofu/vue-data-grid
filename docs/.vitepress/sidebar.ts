import type { DefaultTheme } from 'vitepress';

const docs: DefaultTheme.SidebarItem[] = [
	{
		text: 'Overview',
		items: [
			{ text: 'Introduction', link: '/overview/introduction' },
			{ text: 'Getting started', link: '/overview/getting-started' },
			{ text: 'How it fits together', link: '/overview/concepts' },
			{ text: 'Accessibility', link: '/overview/accessibility' },
			{ text: 'Styling', link: '/overview/styling' },
			{ text: 'Performance', link: '/overview/performance' },
			{ text: 'Inspiration', link: '/overview/inspiration' },
		],
	},
	{
		text: 'Guides',
		items: [
			{ text: 'Columns', link: '/guides/columns' },
			{ text: 'Cell content', link: '/guides/cells' },
			{ text: 'Sorting', link: '/guides/sorting' },
			{ text: 'Column layout', link: '/guides/column-layout' },
			{ text: 'Column groups', link: '/guides/column-groups' },
			{ text: 'Virtualization', link: '/guides/virtualization' },
			{ text: 'Row selection', link: '/guides/selection' },
			{ text: 'Trees and grouping', link: '/guides/trees-and-grouping' },
			{ text: 'Keyboard navigation', link: '/guides/keyboard-navigation' },
			{ text: 'Cell ranges and clipboard', link: '/guides/cell-ranges' },
			{ text: 'Editing', link: '/guides/editing' },
			{ text: 'Drag and drop', link: '/guides/drag-and-drop' },
			{ text: 'Animation', link: '/guides/animation' },
			{ text: 'Live data', link: '/guides/live-data' },
			{ text: 'Loading and empty states', link: '/guides/data-loading' },
			{ text: 'Your own markup', link: '/guides/custom-markup' },
			{ text: 'Localization', link: '/guides/localization' },
			{ text: 'TypeScript', link: '/guides/typescript' },
			{ text: 'Server rendering and Nuxt', link: '/guides/server-rendering' },
		],
	},
];

const components: DefaultTheme.SidebarItem[] = [
	{
		text: 'Structure',
		items: [
			{ text: 'Root', link: '/components/root' },
			{ text: 'Header', link: '/components/header' },
			{ text: 'Column groups', link: '/components/column-groups' },
			{ text: 'Body', link: '/components/body' },
			{ text: 'Footer', link: '/components/footer' },
			{ text: 'Empty and loading', link: '/components/empty-and-loading' },
		],
	},
	{
		text: 'Controls',
		items: [
			{ text: 'Sort indicator', link: '/components/sort-indicator' },
			{ text: 'Resize handle', link: '/components/resize-handle' },
			{ text: 'Selection checkbox', link: '/components/selection-checkbox' },
			{ text: 'Tree toggle', link: '/components/tree-toggle' },
			{ text: 'Range overlay', link: '/components/range-overlay' },
		],
	},
	{
		text: 'Columns',
		items: [
			{ text: 'Column templates', link: '/components/column-templates' },
			{ text: 'Service columns', link: '/components/service-columns' },
			{ text: 'Editors', link: '/components/editors' },
		],
	},
	{
		text: 'Drag and drop',
		items: [
			{ text: 'Row drag', link: '/components/row-drag' },
			{ text: 'Column drag', link: '/components/column-drag' },
			{ text: 'Drag preview and overlay', link: '/components/drag-preview' },
			{ text: 'Drop zone', link: '/components/drop-zone' },
		],
	},
];

const composables: DefaultTheme.SidebarItem[] = [
	{
		text: 'The grid',
		items: [
			{ text: 'useDataGrid', link: '/composables/use-data-grid' },
			{ text: 'Features', link: '/composables/features' },
			{ text: 'useGridMotion', link: '/composables/use-grid-motion' },
			{ text: 'useGridProps', link: '/composables/use-grid-props' },
		],
	},
	{
		text: 'Behaviour',
		items: [
			{ text: 'useCellNavigation', link: '/composables/use-cell-navigation' },
			{ text: 'useHeaderCell', link: '/composables/use-header-cell' },
			{ text: 'useColumnResize', link: '/composables/use-column-resize' },
			{ text: 'useRangeSelection', link: '/composables/use-range-selection' },
			{ text: 'useClipboard', link: '/composables/use-clipboard' },
			{ text: 'useGridEditing', link: '/composables/use-grid-editing' },
			{ text: 'useGridHistory', link: '/composables/use-grid-history' },
			{ text: 'useGridFill', link: '/composables/use-grid-fill' },
			{ text: 'useGridRowDrag', link: '/composables/use-grid-row-drag' },
			{ text: 'useGridColumnDrag', link: '/composables/use-grid-column-drag' },
		],
	},
	{
		text: 'Utilities',
		items: [
			{ text: 'autosizeColumns', link: '/composables/autosize-columns' },
			{ text: 'useStickyOffset', link: '/composables/use-sticky-offset' },
			{ text: 'useGridAnnouncer', link: '/composables/use-grid-announcer' },
			{ text: 'Messages', link: '/composables/messages' },
			{ text: 'Render memo', link: '/composables/render-memo' },
			{ text: 'Grid attributes', link: '/composables/grid-attributes' },
		],
	},
	{
		text: 'Contexts',
		items: [
			{ text: 'Contexts', link: '/composables/contexts' },
			{ text: 'Primitive', link: '/composables/primitive' },
		],
	},
	{
		text: 'Building blocks',
		items: [
			{ text: 'useAutoScroll', link: '/composables/use-auto-scroll' },
			{ text: 'useCellDrag', link: '/composables/use-cell-drag' },
			{ text: 'The core', link: '/composables/core' },
		],
	},
];

const examples: DefaultTheme.SidebarItem[] = [
	{
		text: 'Examples',
		items: [
			{ text: 'Gallery', link: '/examples/' },
			{ text: 'Stock screener', link: '/examples/screener' },
			{ text: 'Spreadsheet', link: '/examples/spreadsheet' },
			{ text: 'Task board', link: '/examples/task-board' },
			{ text: 'File explorer', link: '/examples/file-explorer' },
			{ text: 'A million cells', link: '/examples/big-data' },
			{ text: 'Team directory', link: '/examples/team-directory' },
			{ text: 'Sales report', link: '/examples/sales-report' },
		],
	},
];

export const sidebar: DefaultTheme.Sidebar = {
	'/overview/': docs,
	'/guides/': docs,
	'/components/': components,
	'/composables/': composables,
	'/examples/': examples,
};

export const nav: DefaultTheme.NavItem[] = [
	{ text: 'Docs', link: '/overview/introduction', activeMatch: '^/(overview|guides)/' },
	{ text: 'Components', link: '/components/root', activeMatch: '^/components/' },
	{ text: 'Composables', link: '/composables/use-data-grid', activeMatch: '^/composables/' },
	{ text: 'Examples', link: '/examples/', activeMatch: '^/examples/' },
];
