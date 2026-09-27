/**
 * Replaced with `process.env.NODE_ENV !== 'production'` at build time, so the consumer's bundler
 * strips dev-only code. `import.meta.env.DEV` would not work: in library mode Vite inlines it when
 * this package is built.
 */
declare const __DEV__: boolean;
