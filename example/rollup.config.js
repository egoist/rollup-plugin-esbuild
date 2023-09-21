import path from 'path'
import nodeResolve from '@rollup/plugin-node-resolve'
import cjs from '@rollup/plugin-commonjs'

// @ts-check
const esbuild = require('../dist/index')
const optimize = !!process.env.OPTIMIZE

export default {
  input: path.join(__dirname, 'index.js'),
  output: {
    dir: path.join(__dirname, 'dist'),
    format: 'cjs',
  },
  plugins: [
    esbuild.default({
      minify: process.env.NODE_ENV === 'production',
      optimizeDeps: {
        include: optimize ? ['vue', 'react', 'three', 'lodash'] : [],
      },
      loaders: {
        txt: 'text',
        png: 'dataurl',
      },
    }),
    !optimize && cjs(),
    !optimize && nodeResolve(),
  ],
}
