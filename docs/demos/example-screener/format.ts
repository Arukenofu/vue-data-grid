const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export function formatPrice(value: number) {
	return value.toFixed(2);
}

export function formatChange(value: number) {
	return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function formatVolume(value: number) {
	return compact.format(value);
}

export function formatCap(value: number) {
	return `$${compact.format(value * 1e9)}`;
}
