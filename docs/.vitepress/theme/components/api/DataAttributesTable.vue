<script setup lang="ts">
import InlineText from '../InlineText.vue';

export interface DataAttributeRow {
	attribute: string;
	/** The values it takes, or a sentence about when it is there. */
	values: string | readonly string[];
}

defineProps<{ data: readonly DataAttributeRow[] }>();
</script>

<template>
	<div class="site-api">
		<table>
			<thead>
				<tr>
					<th class="site-api-name">Data attribute</th>
					<th>Value</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(row, index) in data" :key="`${index}:${row.attribute}`">
					<td><code class="site-api-key">{{ row.attribute }}</code></td>
					<td>
						<span v-if="typeof row.values === 'string'" class="site-api-text"><InlineText :text="row.values" /></span>
						<span v-else class="site-api-values">
							<code v-for="value in row.values" :key="value" class="site-api-value">"{{ value }}"</code>
						</span>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>
