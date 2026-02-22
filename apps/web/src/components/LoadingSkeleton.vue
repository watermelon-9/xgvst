<template>
  <div class="skeleton-wrap" aria-label="loading-skeleton">
    <div class="skeleton title" />
    <div class="skeleton line" />
    <div class="skeleton line short" />
    <div class="grid">
      <div class="skeleton card" />
      <div class="skeleton card" />
      <div class="skeleton card" />
    </div>
  </div>
</template>

<style scoped>
.skeleton-wrap { width: 100%; max-width: 760px; }
.skeleton {
  position: relative;
  overflow: hidden;
  background: #1f2430;
  border-radius: 10px;
}
.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.10), transparent);
  animation: shimmer 1.2s infinite;
}
.title { height: 26px; width: 38%; margin: 0 auto 14px; }
.line { height: 14px; width: 100%; margin-bottom: 10px; }
.line.short { width: 65%; margin: 0 auto 18px; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.card { height: 90px; }
@keyframes shimmer { 100% { transform: translateX(100%); } }
</style>
