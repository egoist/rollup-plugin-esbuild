const fs = require('fs')
const { extname, resolve, dirname } = require('path')
const esbuild = require('esbuild')

const loaders = ['js', 'jsx', 'ts', 'tsx']

/** @typedef {import('rollup').Plugin} Plugin*/
/** @typedef {{ watch?: boolean }} Options */

/** @type {(options?: Options) => Plugin} */
module.exports = (options = {}) => {
  /** @type {import('esbuild').Service} */
  let service

  return {
    name: 'esbuild',

    async buildStart() {
      service = await esbuild.startService()
    },

    buildEnd() {
      if (!options.watch) {
        service.stop()
      }
    },

    resolveId(importee, importer) {
      if (importer && importee[0] === '.') {
        const resolved = resolve(
          importer ? dirname(importer) : process.cwd(),
          importee
        )

        if (!fs.existsSync(resolved) && fs.existsSync(`${resolved}.jsx`)) {
          return `${resolved}.jsx`
        }

        if (!fs.existsSync(resolved) && fs.existsSync(`${resolved}.ts`)) {
          return `${resolved}.ts`
        }

        if (!fs.existsSync(resolved) && fs.existsSync(`${resolved}.tsx`)) {
          return `${resolved}.tsx`
        }
      }
    },

    async transform(code, id) {
      const loader = extname(id).slice(1)

      if (!loaders.includes(loader)) {
        return null
      }

      const result = await service.transform(code, { loader })

      if (result.warnings) {
        for (const warning of result.warnings) {
          this.warn(warning.text)
        }
      }

      return {
        code: result.js,
        map: result.jsSourceMap,
      }
    },
  }
}
