<script setup lang="ts">
import IconMinus from '~icons/radix-icons/minus';

import InlineText from '../InlineText.vue';

export interface PropRow {
	name: string;
	type: string;
	default?: string;
	required?: boolean;
	description?: string;
}

withDefaults(defineProps<{
	data: readonly PropRow[];
	/** What a row is: a prop of a part, an option of a composable. */
	label?: string;
}>(), { label: 'Prop' });
</script>

<template>
	<div class="site-api">
		<table>
			<thead>
				<tr>
					<th class="site-api-name">{{ label }}</th>
					<th class="site-api-default">Default</th>
					<th>Type</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(row, index) in data" :key="`${index}:${row.name}`">
					<td><code class="site-api-key">{{ row.name }}{{ row.required ? '*' : '' }}</code></td>
					<td>
						<code v-if="row.default" class="site-api-value">{{ row.default }}</code>
						<IconMinus v-else class="site-api-none" aria-label="No default" />
					</td>
					<td>
						<code class="site-api-value">{{ row.type }}</code>
						<p v-if="row.description" class="site-api-description"><InlineText :text="row.description" /></p>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>
