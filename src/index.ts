import { existsSync } from 'fs'
import { extname, resolve, dirname } from 'path'
import { Plugin, PluginContext } from 'rollup'
import { startService, Loader, Service, Target, TransformResult } from 'esbuild'

const loaders: Loader[] = ['js', 'jsx', 'ts', 'tsx']

export type Options = {
  watch?: boolean
  minify?: boolean
  target?: Target
  jsxFactory?: string
  jsxFragment?: string
  define?: {
    [k: string]: string
  }
}

export default (options: Options = {}): Plugin => {
  let service: Service | undefined

  return {
    name: 'esbuild',

    async buildStart() {
      service = await startService()
    },

    resolveId(importee, importer) {
      if (importer && importee[0] === '.') {
        const resolved = resolve(
          importer ? dirname(importer) : process.cwd(),
          importee
        )

        const exists = existsSync(resolved)

        if (!exists && existsSync(`${resolved}.jsx`)) {
          return `${resolved}.jsx`
        }

        if (!exists && existsSync(`${resolved}.ts`)) {
          return `${resolved}.ts`
        }

        if (!exists && existsSync(`${resolved}.tsx`)) {
          return `${resolved}.tsx`
        }
      }
    },

    async transform(code, id) {
      const loader = extname(id).slice(1) as Loader

      if (!loaders.includes(loader) || !service) {
        return null
      }

      const result = await service.transform(code, {
        loader,
        target: options.target || 'es2015',
        jsxFactory: options.jsxFactory,
        jsxFragment: options.jsxFragment,
        define: options.define,
      })

      printWarnings(result, this)

      return (
        result.js && {
          code: result.js,
          map: result.jsSourceMap,
        }
      )
    },

    async renderChunk(code) {
      if (options.minify && service) {
        const result = await service.transform(code, {
          loader: 'js',
          target: 'esnext',
          minify: true,
        })
        printWarnings(result, this)
        if (result.js) {
          return {
            code: result.js,
            map: result.jsSourceMap,
          }
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

function printWarnings(result: TransformResult, plugin: PluginContext) {
  if (result.warnings) {
    for (const warning of result.warnings) {
      plugin.warn(`[esbuild] ${warning.location}\n${warning.text}`)
    }
  }
}
