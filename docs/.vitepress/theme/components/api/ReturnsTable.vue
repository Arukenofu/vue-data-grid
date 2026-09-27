<script setup lang="ts">
import InlineText from '../InlineText.vue';

export interface ReturnRow {
	name: string;
	type: string;
	description?: string;
}

withDefaults(defineProps<{
	data: readonly ReturnRow[];
	label?: string;
}>(), { label: 'Name' });
</script>

<template>
	<div class="site-api">
		<table>
			<thead>
				<tr>
					<th class="site-api-name">{{ label }}</th>
					<th>Type</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(row, index) in data" :key="`${index}:${row.name}`">
					<td><code class="site-api-key">{{ row.name }}</code></td>
					<td>
						<code class="site-api-value">{{ row.type }}</code>
						<p v-if="row.description" class="site-api-description"><InlineText :text="row.description" /></p>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>
