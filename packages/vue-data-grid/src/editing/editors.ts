import { h, type VNode, type VNodeChild } from 'vue';

import type { CellContext, CellEditor } from '../columns/column-fields';
import { isComposing } from '../keyboard/keys';
import { renderError } from './editor-error';
import { SelectEditor, type SelectEditorFilter, type SelectEditorOption } from './select-editor';

export interface TextEditorOptions<TValue> {
	/** The text of a value the editor starts with; `String(value)`, `''` for `null` and `undefined`, by default. */
	format?: (value: TValue) => string;
	placeholder?: string;
	maxLength?: number;
	/**
	 * Several lines, on a text area that grows over the rows below, up to
	 * `--tc-editor-text-max-height`: Alt+Enter breaks a line, Enter saves. `false` by default.
	 */
	multiline?: boolean;
}

export interface NumberEditorOptions {
	min?: number;
	max?: number;
	/** The step of ↑ and ↓; `1` by default. */
	step?: number;
	/** How many digits after the point the editor starts with; as the value has them by default. */
	digits?: number;
}

export interface SelectEditorOptions<TRow, TValue> {
	/** The choices, or a function of the row for choices that depend on it. */
	options: readonly SelectEditorOption<TValue>[] | ((row: TRow) => readonly SelectEditorOption<TValue>[]);
	/** Whether a choice matches the text typed; its label holds the text, in any case, by default. */
	filter?: SelectEditorFilter<TValue>;
}

export interface DateEditorOptions {
	/** The earliest date that can be picked, as a `Date` or `YYYY-MM-DD`. */
	min?: Date | string;
	/** The latest date that can be picked, as a `Date` or `YYYY-MM-DD`. */
	max?: Date | string;
	/** What the draft is: `'date'`, the default, a `Date` at local midnight; `'text'`, `YYYY-MM-DD`. */
	value?: 'date' | 'text';
}

/** Options of a date editor whose values are `Date`s. */
export interface DateObjectEditorOptions extends DateEditorOptions {
	value?: 'date';
}

/** Options of a date editor whose values are `YYYY-MM-DD` text. */
export interface DateTextEditorOptions extends DateEditorOptions {
	value: 'text';
}

const DATE_TEXT = /^(\d{4})-(\d{2})-(\d{2})/;

/** Text an editor reads a number from: empty is `null`, `.` and `,` both mark the fraction, else `NaN`. */
function parseNumber(text: string) {
	const trimmed = text.trim().replace(',', '.');

	return trimmed === '' ? null : Number(trimmed);
}

/** Text of a yes or a no: `true`, `1`, `yes` in any case are `true`, anything else `false`. */
function parseBoolean(text: string) {
	return /^(?:true|1|yes)$/i.test(text.trim());
}

function toText(value: unknown) {
	return value === null || value === undefined ? '' : String(value);
}

function pad(value: number) {
	return String(value).padStart(2, '0');
}

/** A date as `YYYY-MM-DD`, by its local calendar day, as a date field shows it. */
function toDateText(value: unknown) {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? '' : `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
	}

	return typeof value === 'string' ? DATE_TEXT.exec(value)?.[0] ?? '' : '';
}

/** `YYYY-MM-DD` as a `Date` at local midnight of that day; `null` for other text. */
function toDate(text: string) {
	const match = DATE_TEXT.exec(text.trim());

	return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

/** `YYYY-MM-DD` at the start of text; `null` for other text. */
function toDateOnlyText(text: string) {
	return DATE_TEXT.exec(text.trim())?.[0] ?? null;
}

/** How a date field reads text: as a `Date`, or as `YYYY-MM-DD`. */
function getDateParser(options: DateEditorOptions) {
	return options.value === 'text' ? toDateOnlyText : toDate;
}

function getInputValue(event: Event) {
	const field = event.target;

	return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field.value : '';
}

/**
 * A text area as tall as its text. `field-sizing: content` of the structural styles does it where it
 * is supported; elsewhere the height follows the text here.
 */
function fitHeight(element: unknown) {
	if (element instanceof HTMLTextAreaElement && !globalThis.CSS?.supports?.('field-sizing', 'content')) {
		element.style.height = 'auto';
		element.style.height = `${element.scrollHeight}px`;
	}
}

function fitMounted(vnode: VNode) {
	fitHeight(vnode.el);
}

/** Alt+Enter in a text area breaks the line, as in a spreadsheet: Enter alone saves. */
function breakLine(event: KeyboardEvent) {
	const field = event.target;

	if (event.key !== 'Enter' || !event.altKey || event.ctrlKey || event.metaKey || isComposing(event) || !(field instanceof HTMLTextAreaElement)) {
		return;
	}

	event.preventDefault();
	field.setRangeText('\n', field.selectionStart, field.selectionEnd, 'end');
	field.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * An editor of text: the draft comes through the column's `parse`, and the text stays as typed. The
 * editor of an `editable` column without `editor`; with `multiline`, a text area for several lines.
 */
export function textEditor<TRow = unknown, TValue = unknown>(options: TextEditorOptions<TValue> = {}): CellEditor<TRow, TValue> {
	const format = options.format ?? toText;

	return (context) => {
		const onInput = (event: Event) => {
			fitHeight(event.target);
			context.setText(getInputValue(event));
		};
		const value = context.text ?? format(context.draft);

		return [
			options.multiline
				? h('textarea', {
					...context.inputProps,
					rows: 1,
					value,
					placeholder: options.placeholder,
					maxlength: options.maxLength,
					onInput,
					onKeydown: [breakLine, context.inputProps.onKeydown],
					onVnodeMounted: fitMounted,
				})
				: h('input', {
					...context.inputProps,
					type: 'text',
					value,
					placeholder: options.placeholder,
					maxlength: options.maxLength,
					onInput,
				}),
			renderError(context),
		];
	};
}

/** The step ↑ and ↓ take a number, `0` for any other key. */
function getArrowStep(key: string) {
	if (key === 'ArrowUp') {
		return 1;
	}

	return key === 'ArrowDown' ? -1 : 0;
}

/**
 * An editor of a number, on a text field with a numeric keyboard: `.` and `,` both mark the fraction,
 * empty text is `null`, and text that is not a number is `NaN`, for `validate` to refuse. In the
 * `'full'` mode ↑ and ↓ step by `step` within `min` and `max`; in the `'quick'` mode they save and
 * move, as the other arrows do. `numberField` gives it with the column's `parse`.
 */
export function numberEditor<TRow = unknown>(options: NumberEditorOptions = {}): CellEditor<TRow, number | null> {
	const step = options.step ?? 1;

	function format(value: number | null) {
		if (value === null || value === undefined) {
			return '';
		}

		return options.digits === undefined ? String(value) : value.toFixed(options.digits);
	}

	function clamp(value: number) {
		return Math.min(options.max ?? Number.POSITIVE_INFINITY, Math.max(options.min ?? Number.NEGATIVE_INFINITY, value));
	}

	return (context) => {
		const onKeydown = (event: KeyboardEvent) => {
			const direction = getArrowStep(event.key);

			if (direction === 0 || context.mode !== 'full' || event.altKey || event.ctrlKey || event.metaKey || isComposing(event)) {
				return;
			}

			event.preventDefault();

			const current = parseNumber(context.text ?? format(context.draft));

			context.setDraft(clamp((current === null || Number.isNaN(current) ? 0 : current) + direction * step));
		};

		return [
			h('input', {
				...context.inputProps,
				type: 'text',
				inputmode: 'decimal',
				role: 'spinbutton',
				'aria-valuemin': options.min,
				'aria-valuemax': options.max,
				'aria-valuenow': typeof context.draft === 'number' && !Number.isNaN(context.draft) ? context.draft : undefined,
				value: context.text ?? format(context.draft),
				onInput: (event: Event) => {
					const text = getInputValue(event);

					context.setText(text, parseNumber(text));
				},
				onKeydown: [onKeydown, context.inputProps.onKeydown],
			}),
			renderError(context),
		];
	};
}

/**
 * An editor that picks one of `options`, as a combobox: its field filters the choices as it is typed
 * in, a character typed on the cell included, and the list opens under the cell, or above it where
 * there is more room. ↑ and ↓ move the highlight, which is the draft; Enter and Tab save it, as does
 * leaving the field, and a click saves the choice clicked. The value of the cell carries
 * `data-tc-state="checked"` in the list.
 */
export function selectEditor<TRow = unknown, TValue = unknown>(options: SelectEditorOptions<TRow, TValue>): CellEditor<TRow, TValue> {
	return context => h(SelectEditor, {
		context,
		options: typeof options.options === 'function' ? options.options(context.row) : options.options,
		// The list takes choices of any value, and calls the filter only with the choices given with it.
		filter: options.filter as SelectEditorFilter<unknown> | undefined,
	});
}

/**
 * An editor of a date on the browser's date field, within `min` and `max`, by the local calendar: a
 * `Date` stands for its local day, and a picked day is a `Date` at local midnight, or `YYYY-MM-DD` with
 * `value: 'text'`; an empty field is `null`. A date field cannot start from one typed character, so a
 * character on the cell opens it with the value. `dateField` gives it with the column's `parse`.
 */
export function dateEditor<TRow = unknown>(options?: DateObjectEditorOptions): CellEditor<TRow, Date | null>;
export function dateEditor<TRow = unknown>(options: DateTextEditorOptions): CellEditor<TRow, string | null>;
export function dateEditor(options: DateEditorOptions = {}) {
	return createDateEditor(options);
}

function createDateEditor(options: DateEditorOptions): CellEditor<unknown, Date | string | null> {
	const parse = getDateParser(options);
	const min = options.min === undefined ? undefined : toDateText(options.min);
	const max = options.max === undefined ? undefined : toDateText(options.max);

	const editor: CellEditor<unknown, Date | string | null> = context => [
		h('input', {
			...context.inputProps,
			type: 'date',
			min,
			max,
			value: toDateText(context.draft),
			onInput: (event: Event) => context.setDraft(parse(getInputValue(event))),
		}),
		renderError(context),
	];

	editor.typing = 'value';

	return editor;
}

// One handler for each `write` of a cell, which lives as long as its row: listeners are not patched again on every render.
const toggleHandlers = new WeakMap<(value: boolean) => void, (event: Event) => void>();

function getToggleHandler(write: (value: boolean) => void) {
	let handler = toggleHandlers.get(write);

	if (!handler) {
		handler = (event: Event) => {
			const input = event.target;

			if (!(input instanceof HTMLInputElement)) {
				return;
			}

			const { checked } = input;

			// The value decides what the box shows: a write that is refused leaves it as it was.
			input.checked = !checked;
			write(checked);
		};
		toggleHandlers.set(write, handler);
	}

	return handler;
}

/**
 * A checkbox for the `cell` of a column of yes and no, which writes a click at once, as Enter and
 * Space do through the grid navigation. It is disabled where the cell cannot be edited. `checkboxField`
 * gives it with the rest a column of yes and no needs.
 */
export function checkboxCell<TRow = unknown>(): (context: CellContext<TRow, boolean>) => VNodeChild {
	return context => h('input', {
		type: 'checkbox',
		'data-tc-part': 'cell-checkbox',
		checked: context.value === true,
		disabled: context.write === undefined,
		'aria-label': context.column.label ?? context.column.name,
		onChange: context.write ? getToggleHandler(context.write) : undefined,
	});
}

/**
 * The editing fields of a column of numbers, to spread into it next to `editable` and `setValue`: the
 * `numberEditor` and a `parse` that reads text as it does, so a paste and a cleared cell give numbers
 * and `null` too.
 */
export function numberField<TRow = unknown>(options: NumberEditorOptions = {}) {
	return { editor: numberEditor<TRow>(options), parse: parseNumber };
}

/**
 * The editing fields of a column of dates, to spread into it next to `editable` and `setValue`: the
 * `dateEditor` and a `parse` that reads `YYYY-MM-DD` as the editor gives it, and anything else as
 * `null`.
 */
export function dateField<TRow = unknown>(options?: DateObjectEditorOptions): {
	editor: CellEditor<TRow, Date | null>;
	parse: (text: string) => Date | null;
};
export function dateField<TRow = unknown>(options: DateTextEditorOptions): {
	editor: CellEditor<TRow, string | null>;
	parse: (text: string) => string | null;
};
export function dateField(options: DateEditorOptions = {}): { editor: CellEditor<never, never>; parse: (text: string) => unknown } {
	return { editor: createDateEditor(options), parse: getDateParser(options) };
}

/**
 * The fields of a column of yes and no, to spread into it next to `editable` and `setValue`: the
 * `checkboxCell` as its cell, no editor, as the checkbox edits the cell, and a `parse` for a paste,
 * where `true`, `1` and `yes` in any case are `true` and anything else `false`.
 */
export function checkboxField<TRow = unknown>() {
	return { cell: checkboxCell<TRow>(), editor: false as const, parse: parseBoolean };
}
