<template>
	<div class="ui-toolbar">
		<slot />
	</div>
</template>

<style scoped>
.ui-toolbar {
	display: flex;
	flex: none;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	min-width: 0;
	margin-block-end: 12px;
}

.ui-toolbar :deep(:is(.ui-spacer, .ui-toolbar-spacer)) {
	flex: 1;
}

.ui-toolbar :deep(.ui-toolbar-text) {
	color: var(--ui-fg-muted);
	font: 400 12.5px/1.4 var(--ui-font);
}

.ui-toolbar :deep(.ui-separator) {
	width: 1px;
	height: 20px;
	margin: 0 4px;
	background: var(--ui-border);
}
</style>
