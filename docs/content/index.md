---
layout: home
markdownStyles: false
title: Headless tables for Vue 3
---

<HomePage>
<template #anatomy>

```vue
<script setup lang="ts">
const table = useDataTable({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
	features: { sorting: sorting(), selection: selection() },
});
</script>

<template>
	<TableRoot :table="table" label="Team">
		<TableHeader>
			<TableHeaderRow v-slot="{ columns }">
				<TableHeaderCell v-for="column in columns" :key="column.key" :column="column">
					<TableHeaderContent />
					<TableSortIndicator />
					<TableResizeHandle />
				</TableHeaderCell>
			</TableHeaderRow>
		</TableHeader>
		<TableBody v-slot="{ rows }">
			<TableRow v-for="row in rows" :key="row.key" :row="row">
				<TableCells />
			</TableRow>
		</TableBody>
	</TableRoot>
</template>
```

</template>
</HomePage>
