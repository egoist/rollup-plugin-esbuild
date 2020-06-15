import { builtinModules } from 'module'
import { rollup } from 'rollup'

import dts from 'rollup-plugin-dts'
import esbuild from '../src/index'

const pkg: { [k: string]: any } = require('../package.json')
const deps = Object.keys(pkg.dependencies)

async function main() {
  const external = [...deps, ...builtinModules]

  async function build() {
    const bundle = await rollup({
      input: './src/index.ts',
      external,
      plugins: [esbuild()],
    })

    await bundle.write({ file: './dist/index.js', format: 'cjs' })
  }

  async function createDtsFile() {
    const bundle = await rollup({
      input: './src/index.ts',
      external,
      plugins: [dts()],
    })

    await bundle.write({ file: './dist/index.d.ts' })
  }

  await Promise.all([build(), createDtsFile()])
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
