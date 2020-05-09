const esbuild = require('../src/index')

export default {
  input: 'example/index.js',
  output: {
    file: 'dist/index.js',
    format: 'cjs'
  },
  plugins: [
    esbuild({
      watch: process.env.NODE_ENV === 'development'
    })
  ]
}