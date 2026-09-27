<script setup lang="ts">
import InlineText from '../InlineText.vue';

export interface EmitRow {
	name: string;
	payload: string;
	description?: string;
}

defineProps<{ data: readonly EmitRow[] }>();
</script>

<template>
	<div class="site-api">
		<table>
			<thead>
				<tr>
					<th class="site-api-name">Event</th>
					<th>Payload</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(row, index) in data" :key="`${index}:${row.name}`">
					<td><code class="site-api-key">@{{ row.name }}</code></td>
					<td>
						<code class="site-api-value">{{ row.payload }}</code>
						<p v-if="row.description" class="site-api-description"><InlineText :text="row.description" /></p>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>
