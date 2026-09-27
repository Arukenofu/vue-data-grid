import { playwright } from '@vitest/browser-playwright';
import { defineConfig, type ViteUserConfigFnObject } from 'vitest/config';

import tableConfig from './vite.config.ts';

// What happy-dom cannot check, with no layout: autosize, scrolling from under sticky blocks, focus.
// The same sources and aliases as the happy-dom project, in headless Chromium.
export default defineConfig((env) => {
	const base = (tableConfig as ViteUserConfigFnObject)(env);

	return {
		...base,
		test: {
			name: 'core-browser',
			include: ['tests/**/*.browser.spec.ts'],
			browser: {
				enabled: true,
				headless: true,
				provider: playwright(),
				instances: [{ browser: 'chromium' }],
			},
		},
	};
});
