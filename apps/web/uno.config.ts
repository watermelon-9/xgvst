import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  theme: {
    colors: {
      'xg-bg': 'var(--xg-bg)',
      'xg-surface': 'var(--xg-surface)',
      'xg-text': 'var(--xg-text)',
      'xg-text-dim': 'var(--xg-text-dim)',
      'xg-border': 'var(--xg-border)',
      'xg-accent': 'var(--xg-accent)',
    },
  },
  shortcuts: [
    ['btn', 'px-4 py-1 rounded inline-block bg-xg-accent text-white cursor-pointer !outline-none hover:opacity-90 disabled:cursor-default disabled:opacity-50'],
    ['icon-btn', 'inline-block cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-xg-accent'],
  ],
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
    }),
    presetTypography(),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  safelist: 'prose prose-sm m-auto text-left'.split(' '),
})
