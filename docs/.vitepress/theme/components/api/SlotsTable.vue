<script setup lang="ts">
import InlineText from '../InlineText.vue';

export interface SlotRow {
	name: string;
	/** What the slot gets, as a type. */
	scope?: string;
	description?: string;
}

defineProps<{ data: readonly SlotRow[] }>();
</script>

<template>
	<div class="site-api">
		<table>
			<thead>
				<tr>
					<th class="site-api-name">Slot</th>
					<th>Scope</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(row, index) in data" :key="`${index}:${row.name}`">
					<td><code class="site-api-key">{{ row.name }}</code></td>
					<td>
						<code v-if="row.scope" class="site-api-value">{{ row.scope }}</code>
						<p v-if="row.description" class="site-api-description"><InlineText :text="row.description" /></p>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>
