<script setup lang="ts">
defineProps<{
	cells: number;
	numbers: readonly number[];
}>();

function formatAmount(value: number) {
	return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function sum(values: readonly number[]) {
	return values.reduce((total, value) => total + value, 0);
}
</script>

<template>
	<p class="status" aria-live="polite">
		<span v-if="cells > 1">{{ cells }} cells</span>
		<template v-if="numbers.length > 0">
			<span>Sum <strong>{{ formatAmount(sum(numbers)) }}</strong></span>
			<span>Average <strong>{{ formatAmount(sum(numbers) / numbers.length) }}</strong></span>
			<span>Count <strong>{{ numbers.length }}</strong></span>
		</template>
		<span v-else-if="cells <= 1" class="status-hint">Select cells to see their sum</span>
	</p>
</template>

<style scoped>
.status {
	display: flex;
	justify-content: flex-end;
	gap: 18px;
	min-height: 20px;
	margin: 10px 2px 0;
	color: var(--ui-fg-muted);
	font-size: 12.5px;
	font-variant-numeric: tabular-nums;
}

.status strong {
	color: var(--ui-fg);
	font-weight: 600;
}

.status-hint {
	color: var(--ui-fg-subtle);
}
</style>
