const esbuild = require('../src/index')

const isDev = process.env.NODE_ENV === 'development'

export default {
  input: 'example/index.js',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
  },
  plugins: [
    esbuild({
      watch: isDev,
      minify: !isDev,
    }),
  ],
}
