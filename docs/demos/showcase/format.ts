const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });

const MINUTES_IN_HOUR = 60;
const MINUTES_IN_DAY = 60 * 24;

export function formatMoney(value: number) {
	return currency.format(value);
}

export function formatPercent(value: number) {
	return `${Math.round(value * 100)}%`;
}

export function formatMinutesAgo(minutes: number) {
	if (minutes < MINUTES_IN_HOUR) {
		return relative.format(-minutes, 'minute');
	}

	if (minutes < MINUTES_IN_DAY) {
		return relative.format(-Math.round(minutes / MINUTES_IN_HOUR), 'hour');
	}

	return relative.format(-Math.round(minutes / MINUTES_IN_DAY), 'day');
}
