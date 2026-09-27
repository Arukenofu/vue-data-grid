import { computed, defineComponent, h, onMounted, type PropType, shallowRef, useId, watch } from 'vue';

import type { EditorContext } from '../columns/column-fields';
import { useTableMessagesContext } from '../components/messages';
import { isComposing } from '../keyboard/keys';
import { renderError } from './editor-error';

/** A choice of a list: its value, and the text for it. */
export interface SelectEditorOption<TValue> {
	value: TValue;
	label: string;
	/** Shown, but cannot be chosen. */
	disabled?: boolean;
}

/** Whether a choice matches the text typed in the list's field. */
export type SelectEditorFilter<TValue> = (option: SelectEditorOption<TValue>, text: string) => boolean;

type AnyOption = SelectEditorOption<unknown>;

/** The choices whose label holds the text, in any case. */
function includesText(option: AnyOption, text: string) {
	return option.label.toLocaleLowerCase().includes(text.toLocaleLowerCase());
}

/** The keys that move the highlight through the list, and where. */
const LIST_STEPS: Readonly<Partial<Record<string, 1 | -1>>> = { ArrowDown: 1, ArrowUp: -1 };

/** The room the list keeps from the edge of the table's view, px. */
const EDGE_GAP = 4;

/** The sticky header or footer of the table, as the list must not go under them. */
function getStickyHeight(root: Element, part: string) {
	return root.querySelector<HTMLElement>(`:scope > [data-dg-part="${part}"]`)?.offsetHeight ?? 0;
}

// The list keeps focus in its field: a press on a choice would otherwise leave the field, which saves.
function keepFocus(event: Event) {
	event.preventDefault();
}

/**
 * The list of `selectEditor`: a field that filters the choices as it is typed in, over a list of
 * them under the cell, or above it when there is more room there. The highlighted choice is the
 * draft: ↑ and ↓ move it, Enter and Tab save it, a click saves the choice clicked.
 */
export const SelectEditor = defineComponent({
	name: 'SelectEditor',
	props: {
		context: { type: Object as PropType<EditorContext<unknown, unknown>>, required: true },
		options: { type: Array as PropType<readonly AnyOption[]>, required: true },
		filter: { type: Function as PropType<SelectEditorFilter<unknown>>, default: undefined },
	},
	setup(props) {
		const messages = useTableMessagesContext();
		const id = useId();
		// The character that started editing is the first of the text.
		const query = shallowRef(props.context.text ?? '');
		const list = shallowRef<HTMLElement | null>(null);
		const side = shallowRef<'bottom' | 'top'>('bottom');
		const align = shallowRef<'start' | 'end'>('start');
		const room = shallowRef<number | null>(null);

		const matches = computed(() => {
			const text = query.value.trim();
			const test = props.filter ?? includesText;

			return text === '' ? props.options : props.options.filter(option => test(option, text));
		});

		// The draft is the highlighted choice, so what Enter, Tab and leaving save is what is highlighted.
		const active = computed(() => matches.value.findIndex(option => Object.is(option.value, props.context.draft)));

		/** Highlights the first choice that matches, or keeps the value when none does. */
		function highlightFirst() {
			const first = matches.value.find(option => !option.disabled);

			props.context.setDraft(first ? first.value : props.context.value);
		}

		function move(step: 1 | -1) {
			const options = matches.value;

			for (let index = active.value + step; index >= 0 && index < options.length; index += step) {
				if (!options[index].disabled) {
					props.context.setDraft(options[index].value);

					return;
				}
			}
		}

		function pick(option: AnyOption) {
			if (!option.disabled) {
				props.context.setDraft(option.value);
				props.context.commit('none');
			}
		}

		function onKeydown(event: KeyboardEvent) {
			const step = LIST_STEPS[event.key];

			if (step !== undefined && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !isComposing(event)) {
				event.preventDefault();
				move(step);
			}
		}

		function onInput(event: Event) {
			if (event.target instanceof HTMLInputElement) {
				query.value = event.target.value;
				highlightFirst();
			}
		}

		/** Opens the list on the side of the cell with more room, and at the end edge when it would stick out. */
		function place() {
			const element = list.value;
			const cell = element?.closest('[data-dg-column]');
			const root = element?.closest('[data-dg-part="table"]');

			if (!element || !cell || !root) {
				return;
			}

			const view = root.getBoundingClientRect();
			const top = view.top + root.clientTop + getStickyHeight(root, 'head');
			const bottom = view.top + root.clientTop + root.clientHeight - getStickyHeight(root, 'foot');
			const box = cell.getBoundingClientRect();
			const below = bottom - box.bottom - EDGE_GAP;
			const above = box.top - top - EDGE_GAP;
			const rect = element.getBoundingClientRect();
			const left = view.left + root.clientLeft;

			side.value = rect.height <= below || below >= above ? 'bottom' : 'top';
			room.value = Math.max(side.value === 'bottom' ? below : above, 0);
			align.value = rect.right > left + root.clientWidth || rect.left < left ? 'end' : 'start';
		}

		/** Scrolls the list, and only the list, to the highlighted choice. */
		function reveal() {
			const option = list.value?.querySelector<HTMLElement>('[aria-selected="true"]');
			const element = list.value;

			if (!option || !element) {
				return;
			}

			if (option.offsetTop < element.scrollTop) {
				element.scrollTop = option.offsetTop;
			} else if (option.offsetTop + option.offsetHeight > element.scrollTop + element.clientHeight) {
				element.scrollTop = option.offsetTop + option.offsetHeight - element.clientHeight;
			}
		}

		watch(active, reveal, { flush: 'post' });

		onMounted(() => {
			// Typing started editing: its character filters the list rather than being the value.
			if (query.value !== '') {
				highlightFirst();
			}

			place();
			reveal();
		});

		return () => {
			const { context } = props;
			const options = matches.value;
			const highlighted = options[active.value];
			const label = context.column.label ?? context.column.name;
			const listId = `${id}-list`;

			return [
				h('input', {
					...context.inputProps,
					type: 'text',
					role: 'combobox',
					autocomplete: 'off',
					'aria-expanded': 'true',
					'aria-controls': listId,
					'aria-autocomplete': 'list',
					'aria-activedescendant': highlighted ? `${id}-${active.value}` : undefined,
					value: query.value,
					placeholder: highlighted?.label,
					onInput,
					onKeydown: [onKeydown, context.inputProps.onKeydown],
				}),
				h('div', {
					ref: list,
					id: listId,
					role: 'listbox',
					'aria-label': label,
					'data-dg-part': 'editor-list',
					'data-dg-side': side.value,
					'data-dg-align': align.value,
					style: room.value === null ? undefined : `max-height:min(var(--dg-editor-list-max-height, 16em), ${room.value}px)`,
					onPointerdown: keepFocus,
				}, options.length === 0
					? [h('div', { role: 'option', 'aria-disabled': 'true', 'aria-selected': 'false', 'data-dg-part': 'editor-empty' }, messages.noMatches)]
					: options.map((option, index) => h('div', {
						key: option.label,
						id: `${id}-${index}`,
						role: 'option',
						'aria-selected': index === active.value ? 'true' : 'false',
						'aria-disabled': option.disabled ? 'true' : undefined,
						'data-dg-part': 'editor-option',
						'data-dg-state': Object.is(option.value, context.value) ? 'checked' : undefined,
						onClick: () => pick(option),
					}, option.label))),
				renderError(context),
			];
		};
	},
});
