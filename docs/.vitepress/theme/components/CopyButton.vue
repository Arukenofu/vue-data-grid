<script setup lang="ts">
import IconCheck from '~icons/lucide/check';
import IconCopy from '~icons/lucide/copy';
import { onBeforeUnmount, shallowRef } from 'vue';

const props = defineProps<{ text: string }>();

const COPIED_FOR = 1600;

const copied = shallowRef(false);
let timer: ReturnType<typeof setTimeout> | undefined;

async function copy() {
	await navigator.clipboard.writeText(props.text);
	copied.value = true;
	clearTimeout(timer);
	timer = setTimeout(() => {
		copied.value = false;
	}, COPIED_FOR);
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
	<button type="button" class="site-copy" :aria-label="copied ? 'Copied' : 'Copy to clipboard'" @click="copy">
		<IconCheck v-if="copied" />
		<IconCopy v-else />
	</button>
</template>

<style scoped>
.site-copy {
	display: inline-flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border-radius: 8px;
	color: #a8a29e;
	font-size: 15px;
	transition: background-color 0.2s, color 0.2s;
}

.site-copy:hover {
	background: rgb(255 255 255 / 8%);
	color: #fafaf9;
}
</style>
