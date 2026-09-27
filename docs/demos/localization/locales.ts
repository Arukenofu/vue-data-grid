import type { SortMessageItem, TableMessages } from '@vue-data-grid/core';

export type LocaleName = 'en' | 'de' | 'ru' | 'kk' | 'ar';

export interface Locale {
	/** The name of the language in itself, for the switch. */
	label: string;
	tag: string;
	dir: 'ltr' | 'rtl';
	title: string;
	columns: { selection: string; name: string; team: string; location: string; started: string; salary: string };
	messages: TableMessages;
}

function joinSort(sort: readonly SortMessageItem[], describe: (item: SortMessageItem) => string, separator: string) {
	return sort.map(describe).join(separator);
}

const russianRows = new Intl.PluralRules('ru');

const RUSSIAN_ROWS: Readonly<Record<string, string>> = { one: 'строка', few: 'строки', many: 'строк', other: 'строки' };

export const LOCALES: Readonly<Record<LocaleName, Locale>> = {
	en: {
		label: 'English',
		tag: 'en-US',
		dir: 'ltr',
		title: 'Team members',
		columns: { selection: 'Selection', name: 'Name', team: 'Team', location: 'Office', started: 'Started', salary: 'Salary' },
		messages: {
			selectRow: 'Select row',
			selectAllRows: 'Select all rows',
			expandRow: 'Expand',
			collapseRow: 'Collapse',
			expandGroup: label => `Expand ${label}`,
			collapseGroup: label => `Collapse ${label}`,
			resizeColumn: label => `Resize ${label}`,
			dragRow: label => `Drag ${label}`,
			columnWidth: width => `${width} px`,
			empty: 'No rows',
			loading: 'Loading…',
			noMatches: 'No matches',
			sorted: sort => (sort.length === 0
				? 'Not sorted'
				: `Sorted by ${joinSort(sort, item => `${item.label} ${item.direction === 'asc' ? 'ascending' : 'descending'}`, ', then ')}`),
			selected: count => (count === 1 ? '1 row selected' : `${count} rows selected`),
		},
	},
	de: {
		label: 'Deutsch',
		tag: 'de-DE',
		dir: 'ltr',
		title: 'Teammitglieder',
		columns: { selection: 'Auswahl', name: 'Name', team: 'Team', location: 'Standort', started: 'Beginn', salary: 'Gehalt' },
		messages: {
			selectRow: 'Zeile auswählen',
			selectAllRows: 'Alle Zeilen auswählen',
			expandRow: 'Aufklappen',
			collapseRow: 'Zuklappen',
			expandGroup: label => `${label} aufklappen`,
			collapseGroup: label => `${label} zuklappen`,
			resizeColumn: label => `Breite von ${label} ändern`,
			dragRow: label => `${label} ziehen`,
			columnWidth: width => `${width} Pixel`,
			empty: 'Keine Zeilen',
			loading: 'Wird geladen…',
			noMatches: 'Keine Treffer',
			sorted: sort => (sort.length === 0
				? 'Nicht sortiert'
				: `Sortiert nach ${joinSort(sort, item => `${item.label} ${item.direction === 'asc' ? 'aufsteigend' : 'absteigend'}`, ', dann ')}`),
			selected: count => (count === 1 ? '1 Zeile ausgewählt' : `${count} Zeilen ausgewählt`),
		},
	},
	ru: {
		label: 'Русский',
		tag: 'ru-RU',
		dir: 'ltr',
		title: 'Сотрудники',
		columns: { selection: 'Выбор', name: 'Имя', team: 'Команда', location: 'Офис', started: 'Начало', salary: 'Зарплата' },
		messages: {
			selectRow: 'Выбрать строку',
			selectAllRows: 'Выбрать все строки',
			expandRow: 'Развернуть',
			collapseRow: 'Свернуть',
			expandGroup: label => `Развернуть «${label}»`,
			collapseGroup: label => `Свернуть «${label}»`,
			resizeColumn: label => `Изменить ширину «${label}»`,
			dragRow: label => `Перетащить «${label}»`,
			columnWidth: width => `${width} пикс.`,
			empty: 'Нет строк',
			loading: 'Загрузка…',
			noMatches: 'Ничего не найдено',
			sorted: sort => (sort.length === 0
				? 'Без сортировки'
				: `Сортировка: ${joinSort(sort, item => `${item.label} по ${item.direction === 'asc' ? 'возрастанию' : 'убыванию'}`, ', затем ')}`),
			selected: count => `Выбрано: ${count} ${RUSSIAN_ROWS[russianRows.select(count)]}`,
		},
	},
	kk: {
		label: 'Қазақша',
		tag: 'kk-KZ',
		dir: 'ltr',
		title: 'Команда мүшелері',
		columns: { selection: 'Таңдау', name: 'Аты-жөні', team: 'Команда', location: 'Кеңсе', started: 'Басталуы', salary: 'Жалақы' },
		messages: {
			selectRow: 'Жолды таңдау',
			selectAllRows: 'Барлық жолдарды таңдау',
			expandRow: 'Ашу',
			collapseRow: 'Жию',
			expandGroup: label => `«${label}» тобын ашу`,
			collapseGroup: label => `«${label}» тобын жию`,
			resizeColumn: label => `«${label}» енін өзгерту`,
			dragRow: label => `«${label}» жолын сүйреу`,
			columnWidth: width => `${width} пиксель`,
			empty: 'Жолдар жоқ',
			loading: 'Жүктелуде…',
			noMatches: 'Сәйкестік табылмады',
			sorted: sort => (sort.length === 0
				? 'Сұрыпталмаған'
				: `Сұрыптау: ${joinSort(sort, item => `${item.label} ${item.direction === 'asc' ? 'өсу ретімен' : 'кему ретімен'}`, ', содан кейін ')}`),
			selected: count => `Таңдалған жолдар: ${count}`,
		},
	},
	ar: {
		label: 'العربية',
		tag: 'ar-EG',
		dir: 'rtl',
		title: 'أعضاء الفريق',
		columns: { selection: 'التحديد', name: 'الاسم', team: 'الفريق', location: 'المكتب', started: 'تاريخ البدء', salary: 'الراتب' },
		messages: {
			selectRow: 'تحديد الصف',
			selectAllRows: 'تحديد كل الصفوف',
			expandRow: 'توسيع',
			collapseRow: 'طي',
			expandGroup: label => `توسيع ${label}`,
			collapseGroup: label => `طي ${label}`,
			resizeColumn: label => `تغيير عرض ${label}`,
			dragRow: label => `سحب ${label}`,
			columnWidth: width => `${width} بكسل`,
			empty: 'لا توجد صفوف',
			loading: 'جارٍ التحميل…',
			noMatches: 'لا توجد نتائج',
			sorted: sort => (sort.length === 0
				? 'غير مرتب'
				: `مرتب حسب ${joinSort(sort, item => `${item.label} ${item.direction === 'asc' ? 'تصاعديًا' : 'تنازليًا'}`, '، ثم ')}`),
			selected: count => `عدد الصفوف المحددة: ${count}`,
		},
	},
};
