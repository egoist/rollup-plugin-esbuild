import { rollup } from 'rollup'
import { clean } from 'aria-fs'

import dts from 'rollup-plugin-dts'
import esbuild from './src/index'

(async function() {
  const external = [ 'fs', 'path', 'esbuild', '@rollup/pluginutils' ]

  async function build() {
    const bundle = await rollup({
      input: './src/index.ts',
      external,
      plugins: [ esbuild() ]
    })

    await bundle.write({ file: './dist/index.js', format: 'cjs' })
  }
  
  async function createDtsFile() {
    const bundle = await rollup({
      input: './src/index.ts',
      external,
      plugins: [ dts() ]
    })

    await bundle.write({ file: './dist/index.d.ts' })
  }

  await clean('dist')
  await Promise.all([ build(), createDtsFile() ])
})()