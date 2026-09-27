<script setup lang="ts">
import IconMinus from '~icons/radix-icons/minus';

import InlineText from '../InlineText.vue';

export interface CssVariableRow {
	name: string;
	default?: string;
	description: string;
}

defineProps<{ data: readonly CssVariableRow[] }>();
</script>

<template>
	<div class="site-api">
		<table>
			<thead>
				<tr>
					<th class="site-api-name">CSS variable</th>
					<th class="site-api-default">Default</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(row, index) in data" :key="`${index}:${row.name}`">
					<td><code class="site-api-key">{{ row.name }}</code></td>
					<td>
						<code v-if="row.default" class="site-api-value">{{ row.default }}</code>
						<IconMinus v-else class="site-api-none" aria-label="No default" />
					</td>
					<td class="site-api-text"><InlineText :text="row.description" /></td>
				</tr>
			</tbody>
		</table>
	</div>
</template>
