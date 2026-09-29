<script setup lang="ts">
import { QueryClient, VUE_QUERY_CLIENT } from '@tanstack/vue-query';
import { provide } from 'vue';

import PeoplePages from './PeoplePages.vue';

provide(VUE_QUERY_CLIENT, new QueryClient());
</script>

<template>
	<PeoplePages />
</template>
