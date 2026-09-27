import { useRowStream } from 'vue-data-grid';
import { onBeforeUnmount, onMounted, type Ref, shallowRef, watch } from 'vue';

import { createRandom } from '@/data/random';
import { createStocks, type Stock, tickStock } from '@/data/stocks';

export type Pace = 'calm' | 'busy' | 'frantic';

const INTERVALS: Readonly<Record<Pace, number>> = { calm: 900, busy: 300, frantic: 70 };

const QUOTES_PER_TICK = 3;

export function useMarket(pace: Ref<Pace>, running: Ref<boolean>) {
	const random = createRandom(42);
	const stream = useRowStream<Stock>({ rows: createStocks(), rowKey: 'id' });
	const updates = shallowRef(0);
	let timer: ReturnType<typeof setInterval> | undefined;

	function tick() {
		const quotes = Array.from({ length: QUOTES_PER_TICK }, () => random.pick(stream.rows.value));

		stream.apply({ update: quotes.map(stock => tickStock(stock, random)) });
		updates.value += quotes.length;
	}

	function restart() {
		clearInterval(timer);
		timer = running.value ? setInterval(tick, INTERVALS[pace.value]) : undefined;
	}

	onMounted(() => watch([pace, running], restart, { immediate: true }));
	onBeforeUnmount(() => clearInterval(timer));

	return { quotes: stream.rows, updates };
}
