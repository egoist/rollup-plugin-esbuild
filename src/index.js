// @ts-check
const fs = require('fs')
const { extname, resolve, dirname } = require('path')
const esbuild = require('esbuild')

/** @typedef {import('esbuild').TransformOptions} TransformOptions */

/** @type {TransformOptions['loader'][]} */
const loaders = ['js', 'jsx', 'ts', 'tsx']

/** @typedef {import('rollup').Plugin} Plugin */
/** @typedef {{ watch?: boolean, target?: TransformOptions['target'], minify?: boolean }} Options */

/** @type {(options?: Options) => Plugin} */
module.exports = (options = {}) => {
  /** @type {import('esbuild').Service} */
  let service

  return {
    name: 'esbuild',

    async buildStart() {
      service = await esbuild.startService()
    },

    resolveId(importee, importer) {
      if (importer && importee[0] === '.') {
        const resolved = resolve(
          importer ? dirname(importer) : process.cwd(),
          importee
        )

        const exists = fs.existsSync(resolved)

        if (!exists && fs.existsSync(`${resolved}.jsx`)) {
          return `${resolved}.jsx`
        }

        if (!exists && fs.existsSync(`${resolved}.ts`)) {
          return `${resolved}.ts`
        }

        if (!exists && fs.existsSync(`${resolved}.tsx`)) {
          return `${resolved}.tsx`
        }
      }
    },

    async transform(code, id) {
      /** @type {any} */
      const loader = extname(id).slice(1)

      if (!loaders.includes(loader)) {
        return null
      }

      const result = await service.transform(code, {
        loader,
        target: options.target || 'es2015',
      })

      printWarnings(result, this)

      return {
        code: result.js,
        map: result.jsSourceMap,
      }
    },

    async renderChunk(code, chunk) {
      if (options.minify) {
        const result = await service.transform(code, {
          loader: 'js',
          target: 'esnext',
          minify: true,
        })
        printWarnings(result, this)
        return {
          code: result.js,
          map: result.jsSourceMap,
        }
      }
      return null
    },

    generateBundle() {
      if (!options.watch && service) {
        service.stop()
        service = undefined
      }
    },
  }
}

/**
 * Print esbuild transform warnings
 * @param {import('esbuild').TransformResult} result
 * @param {import('rollup').PluginContext} plugin
 */
function printWarnings(result, plugin) {
  if (result.warnings) {
    for (const warning of result.warnings) {
      plugin.warn(warning.text)
    }
  }
}
