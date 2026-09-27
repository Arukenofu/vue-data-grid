<script setup lang="ts">
import { computed } from 'vue';

import InlineText from '../InlineText.vue';

export interface KeyboardRow {
	/** Shortcuts that do the same, each keys joined by `+`, such as `Ctrl+C`. */
	keys: readonly string[];
	description: string;
}

const props = defineProps<{ data: readonly KeyboardRow[] }>();

const rows = computed(() => props.data.map(row => ({
	...row,
	shortcuts: row.keys.map(shortcut => shortcut.split(/(?<=.)\+/)),
})));
</script>

<template>
	<div class="site-api">
		<table>
			<thead>
				<tr>
					<th class="site-api-name">Key</th>
					<th>What it does</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(row, index) in rows" :key="`${index}:${row.keys.join()}`">
					<td>
						<span class="site-api-shortcuts">
							<template v-for="(shortcut, index) in row.shortcuts" :key="index">
								<span v-if="index > 0" class="site-api-or">or</span>
								<span class="site-api-shortcut">
									<kbd v-for="key in shortcut" :key="key">{{ key }}</kbd>
								</span>
							</template>
						</span>
					</td>
					<td class="site-api-text"><InlineText :text="row.description" /></td>
				</tr>
			</tbody>
		</table>
	</div>
</template>
