<script setup lang="ts">
import type { Stock } from '@/data/stocks';

defineProps<{ stock: Stock }>();
</script>

<template>
	<span class="symbol">
		<span class="symbol-logo" :data-sector="stock.sector" aria-hidden="true">{{ stock.symbol.slice(0, 2) }}</span>
		<span class="symbol-text">
			<span class="symbol-ticker">{{ stock.symbol }}</span>
			<span class="symbol-name">{{ stock.name }}</span>
		</span>
	</span>
</template>

<style scoped>
.symbol {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
}

.symbol-logo {
	--hue: 152;

	display: inline-flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border-radius: 8px;
	background: color-mix(in srgb, hsl(var(--hue) 65% 50%) 16%, var(--ui-bg));
	color: color-mix(in srgb, hsl(var(--hue) 65% 40%) 75%, var(--ui-fg));
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.02em;
}

.symbol-logo[data-sector='Energy'] { --hue: 32; }
.symbol-logo[data-sector='Health'] { --hue: 340; }
.symbol-logo[data-sector='Finance'] { --hue: 215; }
.symbol-logo[data-sector='Consumer'] { --hue: 270; }
.symbol-logo[data-sector='Industrials'] { --hue: 190; }

.symbol-text {
	display: grid;
	min-width: 0;
	line-height: 1.3;
}

.symbol-ticker {
	font-weight: 650;
	letter-spacing: 0.02em;
}

.symbol-name {
	overflow: hidden;
	color: var(--ui-fg-muted);
	font-size: 12px;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
