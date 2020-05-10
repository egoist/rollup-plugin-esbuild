import { existsSync } from 'fs'
import { extname, resolve, dirname } from 'path'
import { Plugin, PluginContext } from 'rollup'
import { startService, Loader, Service, Target, TransformResult } from 'esbuild'
import { createFilter, FilterPattern } from '@rollup/pluginutils'

const loaders: Loader[] = ['js', 'jsx', 'ts', 'tsx']

export type Options = {
  include?: FilterPattern
  exclude?: FilterPattern
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
  const filter = createFilter(
    options.include || /\.[jt]sx?$/,
    options.exclude || /node_modules/
  )

  let service: Service | undefined

  const stopService = () => {
    if (!options.watch && service) {
      service.stop()
      service = undefined
    }
  }

  // The order is:
  // buildStart -> resolveId -> transform -> buildEnd -> renderChunk -> generateBundle

  return {
    name: 'esbuild',

    async buildStart() {
      if (!service) {
        service = await startService()
      }
    },

    resolveId(importee: string, importer: string | undefined) {
      if (importer && importee[0] === '.') {
        const resolved = resolve(
          importer ? dirname(importer) : process.cwd(),
          importee
        )
        const exists = existsSync(resolved)

        for (const loader of loaders) {
          const file = `${resolved}.${loader}`
          if (!exists && existsSync(file)) {
            return file
          }  
        }     
      }
    },

    async transform(code: string, id: string) {
      if (!filter(id)) {
        return null
      }

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

    buildEnd(error) {
      // Stop the service early if there's error
      if (error) {
        stopService()
      }
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
      stopService()
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
