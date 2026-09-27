---
title: Primitive
description: primitiveProps, renderPrimitive and forwardElement - how every part renders the element you choose, or merges onto yours with asChild.
---

# Primitive

<Description>
Every part renders through the same three small functions, which make <code>as</code> and <code>asChild</code> work the
same way everywhere. Build a part of your own on them, and it takes an element or your own component
exactly as the built-in parts do.
</Description>

<Demo name="as-child" />

The checkboxes of this table are plain buttons of your own, rendered with `asChild`; the part merges
its role, state and handlers into them. The sort marks are icons in the slot of `TableSortIndicator`.

## `as` and `asChild`

Every part takes two props:

- **`as`** is the element or component the part renders; `div` for most parts, `button`, `span` or
  `input` for some. `<TableRow as="li">` renders a list item with every prop of a row.
- **`asChild`** renders no element of its own. The part takes the one child of its slot and merges its
  props into it: attributes the child sets itself win; classes, styles, refs and event handlers of
  both are kept.

```vue
<TableSelectionCheckbox as-child>
	<MyCheckbox class="row-check" />
</TableSelectionCheckbox>
```

The child gets `role="checkbox"`, `aria-checked`, the click that toggles the row and the rest, and
keeps its own class. With `asChild` the part takes the first element of its slot, so give it one; a
development build warns when there is none. `TableCells` and `TableRangeOverlay` render many elements, so they take only `as`.

## API

<ReturnsTable
	:data="[
		{ name: 'primitiveProps', type: '{ as, asChild }', description: 'The props every part takes: `as`, the element or component to render, `div` by default; `asChild`, render the one child of the slot instead, with the props merged into it, `false` by default. Spread them into the props of your part.' },
		{ name: 'renderPrimitive', type: '(options: PrimitiveOptions, props: Record<string, unknown>, children?: () => VNodeChild) => VNodeChild', description: 'Renders a part: its element with `props` over `children`, or with `asChild` the first element of the slot, cloned with `props` merged in. A component in `as` gets the children as its default slot.' },
		{ name: 'forwardElement', type: '(target: ShallowRef<HTMLElement | null>) => (value: Element | ComponentPublicInstance | null) => void', description: 'A function ref that writes the element of a part to `target`: the element itself, or the root element of a component rendered through `as` or `asChild`. Make it once in `setup`.' },
		{ name: 'PrimitiveOptions', type: '{ as: string | Component; asChild: boolean }', description: 'What `renderPrimitive` reads of the props of a part.' },
	]"
/>

## Usage

A part in the manner of the built-in ones: it takes `as` and `asChild`, renders one element with a
`data-tc-part`, and gives its slot what it knows.

```ts
import { primitiveProps, renderPrimitive, useDataTableContext } from 'vue-data-grid';
import { defineComponent, type SlotsType, type VNodeChild } from 'vue';

export const TableSelectedCount = defineComponent({
	name: 'TableSelectedCount',
	props: {
		...primitiveProps,
		as: { ...primitiveProps.as, default: 'span' },
	},
	slots: Object as SlotsType<{ default?: (context: { count: number }) => VNodeChild }>,
	setup(props, { slots }) {
		const table = useDataTableContext();

		return () => {
			const count = table.selection?.selectedCount.value ?? 0;

			return renderPrimitive(props, { 'data-tc-part': 'selected-count' }, () => (
				slots.default ? slots.default({ count }) : `${count} selected`
			));
		};
	},
});
```

```vue
<TableSelectedCount />

<TableSelectedCount v-slot="{ count }" as-child>
	<strong class="count">{{ count }} rows</strong>
</TableSelectedCount>
```

With `asChild` the slot is the element: the part merges its props into the `<strong>` and renders
nothing of its own.

## Examples

### Keeping the element of a part

A part that measures or listens to its element takes it through `forwardElement`, which works
whether the part renders an element, a component through `as`, or a child through `asChild`:

```ts
const element = shallowRef<HTMLElement | null>(null);
const elementRef = forwardElement(element);

return () => renderPrimitive(props, { ref: elementRef, 'data-tc-part': 'toolbar' }, () => slots.default?.());
```

Make the ref once in `setup`: a new function on every render makes Vue set the ref to `null` and back
on each one.

### A component of your design system

`as` takes a component too. The part's props go to it as attributes and its content as the default
slot:

```vue
<TableRoot :table="table" :as="Card" label="Invoices">…</TableRoot>
```

## Accessibility

- A part rendered onto your element through `asChild` still brings its roles and states: a checkbox
  part gives a `button` `role="checkbox"` and `aria-checked`, and a focus stop with the keys of the
  checkbox pattern when the element is not focusable on its own.
- Props the child sets itself win, so an `aria-label` of yours takes the place of the part's.
- When `as` changes the element, keep one that fits the role: a row as `li` or `div` is fine because
  the role comes from the props; a button as `span` loses the keyboard a native button has, which
  the parts add back only for checkboxes.

## See also

- [Contexts](/composables/contexts): how a part finds its table, row and cell.
- [Your own markup](/guides/custom-markup): `as`, `asChild` and parts of your own in a real table.
- [Selection checkbox](/components/selection-checkbox): a checkbox of Reka UI through `asChild`.
