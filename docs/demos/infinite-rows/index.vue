<script setup lang="ts">
import { QueryClient, VUE_QUERY_CLIENT } from '@tanstack/vue-query';
import { provide } from 'vue';

import EventLog from './EventLog.vue';

provide(VUE_QUERY_CLIENT, new QueryClient());
</script>

<template>
	<EventLog />
</template>
