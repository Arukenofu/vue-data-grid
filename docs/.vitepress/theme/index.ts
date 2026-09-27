import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { defineAsyncComponent } from 'vue';

// After the default theme, whose variables these override.
import '@vue-stack/table/style.css';
import '@/ui/tokens.css';
import '@/ui/table.css';
import './styles/vars.css';
import './styles/chrome.css';
import './styles/doc.css';
import './styles/components.css';
import './styles/home.css';

import CssVariablesTable from './components/api/CssVariablesTable.vue';
import DataAttributesTable from './components/api/DataAttributesTable.vue';
import EmitsTable from './components/api/EmitsTable.vue';
import KeyboardTable from './components/api/KeyboardTable.vue';
import PropsTable from './components/api/PropsTable.vue';
import ReturnsTable from './components/api/ReturnsTable.vue';
import SlotsTable from './components/api/SlotsTable.vue';
import Demo from './components/Demo.vue';
import Description from './components/Description.vue';
import FlowSteps from './components/FlowSteps.vue';
import Highlights from './components/Highlights.vue';
import InspirationCards from './components/InspirationCards.vue';
import InstallTabs from './components/InstallTabs.vue';
import ExampleGallery from './examples/ExampleGallery.vue';
import Layout from './Layout.vue';

export default {
	extends: DefaultTheme,
	Layout,
	enhanceApp({ app }) {
		app.component('Demo', Demo);
		app.component('Description', Description);
		app.component('Highlights', Highlights);
		app.component('FlowSteps', FlowSteps);
		app.component('InspirationCards', InspirationCards);
		app.component('InstallTabs', InstallTabs);
		app.component('PropsTable', PropsTable);
		app.component('ReturnsTable', ReturnsTable);
		app.component('SlotsTable', SlotsTable);
		app.component('EmitsTable', EmitsTable);
		app.component('DataAttributesTable', DataAttributesTable);
		app.component('CssVariablesTable', CssVariablesTable);
		app.component('KeyboardTable', KeyboardTable);
		app.component('ExampleGallery', ExampleGallery);
		// The home page brings GSAP and a live table: loaded with the home page only, not with every page.
		app.component('HomePage', defineAsyncComponent(() => import('./home/HomePage.vue')));
	},
} satisfies Theme;
