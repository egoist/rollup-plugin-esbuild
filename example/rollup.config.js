const esbuild = require('../dist/index')

export default {
  input: 'example/index.js',
  output: {
    file: 'example/dist/index.js',
    format: 'cjs',
  },
  plugins: [
    esbuild({
      minify: !isDev,
    }),
  ],
}
