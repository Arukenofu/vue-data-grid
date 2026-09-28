---
layout: home
markdownStyles: false
title: Headless grids for Vue 3
---

<HomePage>
<template #anatomy>

```vue
<script setup lang="ts">
const grid = useDataGrid({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
	features: { sorting: sorting(), selection: selection() },
});
</script>

<template>
	<GridRoot :grid="grid" label="Team">
		<GridHeader>
			<GridHeaderRow v-slot="{ columns }">
				<GridHeaderCell v-for="column in columns" :key="column.key" :column="column">
					<GridHeaderContent />
					<GridSortIndicator />
					<GridResizeHandle />
				</GridHeaderCell>
			</GridHeaderRow>
		</GridHeader>
		<GridBody v-slot="{ rows }">
			<GridRow v-for="row in rows" :key="row.key" :row="row">
				<GridCells />
			</GridRow>
		</GridBody>
	</GridRoot>
</template>
```

</template>
</HomePage>
