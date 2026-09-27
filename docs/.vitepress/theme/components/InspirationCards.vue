<script setup lang="ts">
import IconArrowUpRight from '~icons/lucide/arrow-up-right';

interface Inspiration {
	name: string;
	logo: 'reka' | 'ag-grid' | 'tanstack';
	link: string;
	/** The colour of the glow behind the logo. */
	tint: string;
	lesson: string;
}

const INSPIRATIONS: readonly Inspiration[] = [
	{
		name: 'Reka UI',
		logo: 'reka',
		link: 'https://reka-ui.com',
		tint: '#00c58a',
		lesson: 'Small unstyled parts, rendering onto your own elements, and accessibility as the default.',
	},
	{
		name: 'AG Grid',
		logo: 'ag-grid',
		link: 'https://www.ag-grid.com',
		tint: '#55b2c6',
		lesson: 'What a real data grid has to do, and how a spreadsheet user expects it to feel.',
	},
	{
		name: 'TanStack Table',
		logo: 'tanstack',
		link: 'https://tanstack.com/table',
		tint: '#f97316',
		lesson: 'Headless logic, features as plugins, and types that flow from the data.',
	},
];
</script>

<template>
	<div class="site-inspirations">
		<a v-for="item in INSPIRATIONS" :key="item.name" :href="item.link" target="_blank" rel="noreferrer" class="site-inspiration">
			<span class="site-inspiration-mark" :style="{ '--tint': item.tint }" aria-hidden="true">
				<svg v-if="item.logo === 'reka'" viewBox="20 38 244 218" class="site-inspiration-logo">
					<defs>
						<linearGradient id="inspiration-reka-body" x1="241.666" y1="264.867" x2="88.9331" y2="7.73334" gradientUnits="userSpaceOnUse">
							<stop stop-color="#00996c" />
							<stop offset="1" stop-color="#7affd8" />
						</linearGradient>
						<radialGradient id="inspiration-reka-tip" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(185.6 110.2) rotate(147.858) scale(129.006 128.619)">
							<stop offset="0.48614" stop-color="#00c58a" />
							<stop offset="1" stop-color="#8ef0cf" />
						</radialGradient>
					</defs>
					<path d="M226.269 52.4044L226.274 52.4067C237.406 58.2619 245.614 66.3008 250.94 76.5218C256.285 86.7776 258.969 98.4614 258.969 111.596C258.969 124.732 256.285 136.34 250.943 146.446C245.618 156.521 237.447 164.451 226.389 170.234C221.59 172.712 219.355 178.881 222.459 183.542L257.922 236.789C261.773 242.571 257.628 250.311 250.681 250.311H196.906C193.806 250.311 190.939 248.661 189.382 245.98L79.3991 56.5686C76.0313 50.7687 80.2159 43.5 86.9227 43.5H183.394C200.888 43.5 215.161 46.4896 226.269 52.4044Z" fill="url(#inspiration-reka-body)" />
					<path d="M116.722 247.228C113.004 253.687 103.684 253.687 99.9661 247.228L26.2042 119.085C22.4947 112.64 27.1462 104.596 34.5821 104.596L182.106 104.596C189.542 104.596 194.193 112.64 190.484 119.085L116.722 247.228Z" fill="url(#inspiration-reka-tip)" />
				</svg>
				<svg v-else-if="item.logo === 'ag-grid'" viewBox="168 14 56 40" class="site-inspiration-logo">
					<path d="m169.996 47.988 7 .012h4v-4l3.992-4-14.992-.047v8.035ZM179.996 36h9l4 .002V32l4-4h-17v8ZM174.996 16h30v8h-30z" fill="#b4bbbf" />
					<path d="m176.996 48.01 4-4.01h14v8h-18v-3.99Z" fill="#ff0000" />
					<path d="M206.996 40v-7.995h-14L184.988 40h22.008Z" fill="#ff8b00" />
					<path d="M221.996 20h-17l-8 8h25v-8Z" fill="#55b2c6" />
				</svg>
				<svg v-else viewBox="0 0 24 24" class="site-inspiration-logo site-inspiration-logo-mono">
					<path fill="currentColor" d="M12 0c6.627 0 9.166 4.102 9.166 12S18.626 24 12 24s-9.166-4.096-9.166-12c0-7.898 2.54-12 9.166-12m3.031 17.485c-.861 0-1.33.234-1.708.423c-.327.164-.582.292-1.148.292c-.567 0-.822-.128-1.148-.292c-.378-.189-.848-.423-1.71-.423c-.86 0-1.33.234-1.708.423c-.327.164-.581.292-1.148.292v1.251c.862 0 1.331-.234 1.709-.423c.326-.163.581-.292 1.148-.292s.821.129 1.148.292c.378.189.847.423 1.709.423c.861 0 1.33-.234 1.709-.423c.326-.163.58-.292 1.147-.292s.822.129 1.148.292c.378.189.848.423 1.71.423v-1.25c-.565 0-.822-.13-1.149-.293c-.377-.189-.847-.423-1.709-.423m.41-12.536c.65-.586 0-1.648-.813-1.328c-.45.18-.873.438-1.251.779a4.2 4.2 0 0 0-1.202 1.94a4.2 4.2 0 0 0-1.203-1.94a4.3 4.3 0 0 0-1.25-.779c-.814-.32-1.463.742-.814 1.328l2.385 2.153a4.860 4.860 0 0 0-2.731-.839c-.552 0-1.082.09-1.58.26c-.836.284-.604 1.532.275 1.532h3.326a4.2 4.2 0 0 0-2.012.988a4 4 0 0 0-.9 1.165c-.403.776.588 1.529 1.237.948l2.686-2.42l-.2 6.656c0 .08-.047.158-.107.223a5 5 0 0 1-.257-.123c-.378-.189-.848-.423-1.71-.423c-.861 0-1.33.234-1.708.423c-.327.164-.581.292-1.148.292v1.251c.861 0 1.33-.234 1.709-.423c.326-.164.58-.292 1.148-.292c.566 0 .821.128 1.148.292c.377.189.847.423 1.708.423c.862 0 1.332-.234 1.71-.423c.326-.164.58-.292 1.147-.292s.822.128 1.148.292c.378.189.848.423 1.71.423v-1.25c-.565 0-.822-.13-1.149-.293v-.005c-.378-.19-.847-.424-1.709-.424c-.861 0-1.33.235-1.709.424c-.097.045-.189.094-.283.131a.34.34 0 0 1-.12-.232l-.2-6.69l2.722 2.457c.65.587 1.64-.166 1.236-.948a4.110 4.110 0 0 0-2.911-2.153h3.326c.882 0 1.108-1.245.275-1.531a4.880 4.880 0 0 0-4.311.578l2.385-2.152z" />
				</svg>
			</span>
			<span class="site-inspiration-name">
				{{ item.name }}
				<IconArrowUpRight class="site-inspiration-arrow" aria-hidden="true" />
			</span>
			<span class="site-inspiration-lesson">{{ item.lesson }}</span>
		</a>
	</div>
</template>

<style scoped>
.site-inspirations {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 14px;
	margin-block: 24px 8px;
}

.site-inspiration {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 20px;
	border: 1px solid var(--vp-c-divider);
	border-radius: 16px;
	background: var(--vp-c-bg-alt);
	color: inherit !important;
	text-decoration: none !important;
	transition: border-color 0.2s, translate 0.2s, box-shadow 0.2s;
}

.site-inspiration:hover {
	border-color: color-mix(in srgb, var(--vp-c-brand-1) 40%, transparent);
	box-shadow: var(--site-shadow);
	translate: 0 -2px;
}

.site-inspiration-mark {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 48px;
	height: 48px;
	margin-block-end: 6px;
	border: 1px solid color-mix(in srgb, var(--tint) 25%, var(--vp-c-divider));
	border-radius: 14px;
	background:
		radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--tint) 22%, transparent), transparent 70%),
		var(--vp-c-bg);
	box-shadow: 0 6px 18px -8px color-mix(in srgb, var(--tint) 60%, transparent);
}

.site-inspiration-logo {
	width: 28px;
	height: 28px;
}

.site-inspiration-logo-mono {
	color: #111;
}

:where(.dark) .site-inspiration-logo-mono {
	color: #f5f5f4;
}

.site-inspiration-name {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 16px;
	font-weight: 700;
}

.site-inspiration-arrow {
	color: var(--vp-c-text-3);
	transition: color 0.2s, translate 0.2s;
}

.site-inspiration:hover .site-inspiration-arrow {
	color: var(--vp-c-brand-1);
	translate: 2px -2px;
}

.site-inspiration-lesson {
	color: var(--vp-c-text-2);
	font-size: 14px;
	line-height: 1.6;
}
</style>
