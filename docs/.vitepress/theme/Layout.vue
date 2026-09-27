<script setup lang="ts">
import { ConfigProvider } from 'reka-ui';
import type { DefaultTheme } from 'vitepress';
import { useRoute } from 'vitepress';
import Theme from 'vitepress/theme';
import { computed } from 'vue';

import { sidebar } from '../sidebar';

const { Layout } = Theme;
const route = useRoute();

function hasLink(items: readonly DefaultTheme.SidebarItem[] | undefined, path: string): boolean {
	return (items ?? []).some(item => item.link === path || hasLink(item.items, path));
}

/** The group of the sidebar the page is in, shown above its title. */
const section = computed(() => {
	const path = route.path.replace(/\.html$/, '');
	const groups = Object.values(sidebar).flatMap(value => (Array.isArray(value) ? value : value.items));

	return groups.find(group => hasLink(group.items, path))?.text;
});
</script>

<template>
	<!-- The page keeps the room of its scrollbar (`scrollbar-gutter`), so a menu that locks the scroll adds no padding. -->
	<ConfigProvider :scroll-body="false">
		<Layout>
			<template #doc-before>
				<div v-if="section" class="site-section-label">
					{{ section }}
				</div>
			</template>
		</Layout>
	</ConfigProvider>
</template>
