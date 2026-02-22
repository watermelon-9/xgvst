<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import LoadingSkeleton from '~/components/LoadingSkeleton.vue'
import { API_BASE_URL } from '~/config/env'
import { useMarketStore } from '~/stores/market'

defineOptions({ name: 'IndexPage' })

useHead({ title: '西瓜说股 v3' })

const market = useMarketStore()
const loading = ref(true)

onMounted(() => {
  market.enqueueTick({
    symbol: '000001.SZ',
    price: 12.34,
    ts: Date.now(),
  })

  setTimeout(() => {
    loading.value = false
  }, 850)
})

const tickCount = computed(() => market.ticks.length)
</script>

<template>
  <section class="xg-landing bg-xg-bg text-xg-text border border-xg-border">
    <h1 class="text-3xl font-800">西瓜说股 v3</h1>
    <p>独立重构项目已启动（xgvst）。</p>
    <p class="hint">当前阶段：P1.2（Cloudflare Pages 静态部署）</p>

    <div class="mt-5 w-full max-w-190 rounded-lg border border-xg-border p-4 text-left text-sm">
      <template v-if="loading">
        <LoadingSkeleton />
      </template>
      <template v-else>
        <div class="mb-2 font-700">首屏验证块（Sub-B）</div>
        <div>Watchlist 数量：{{ market.watchlist.length }}</div>
        <div>Tick 缓冲后条数：{{ tickCount }}</div>
        <div>状态管理：<code>Pinia + shallowRef + requestAnimationFrame</code></div>
        <div>API 基址（env）：<code>{{ API_BASE_URL }}</code></div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.xg-landing {
  min-height: 78vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: 12px;
  padding: 24px;
}
.hint { opacity: .7; font-size: 14px; }
</style>

<route lang="yaml">
meta:
  layout: market
</route>
