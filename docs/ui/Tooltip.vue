<script setup lang="ts">
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui';

defineProps<{ text: string }>();

defineSlots<{ default: () => unknown }>();
</script>

<template>
	<TooltipProvider :delay-duration="300">
		<TooltipRoot>
			<TooltipTrigger as-child>
				<slot />
			</TooltipTrigger>
			<TooltipPortal>
				<TooltipContent class="ui-tooltip" :side-offset="6">
					{{ text }}
					<TooltipArrow class="ui-tooltip-arrow" :width="10" :height="5" />
				</TooltipContent>
			</TooltipPortal>
		</TooltipRoot>
	</TooltipProvider>
</template>

<style>
.ui-tooltip {
	z-index: 100;
	padding: 5px 9px;
	border-radius: 6px;
	background: var(--ui-fg);
	color: var(--ui-bg);
	font-size: 12px;
	font-weight: 500;
	box-shadow: var(--ui-shadow-lg);
}

.ui-tooltip-arrow {
	fill: var(--ui-fg);
}
</style>
