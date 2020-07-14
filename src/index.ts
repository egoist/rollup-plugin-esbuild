import { existsSync, statSync } from 'fs'
import { extname, resolve, dirname, join, relative } from 'path'
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
  allowJsx?: boolean
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

  const resolveFile = (resolved: string, index: boolean = false) => {
    for (const loader of loaders) {
      const file = index
        ? join(resolved, `index.${loader}`)
        : `${resolved}.${loader}`
      if (existsSync(file)) return file
    }
    return null
  }

  return {
    name: 'esbuild',

    async buildStart() {
      if (!service) {
        service = await startService()
      }
    },

    resolveId(importee, importer) {
      if (importer && importee[0] === '.') {
        const resolved = resolve(
          importer ? dirname(importer) : process.cwd(),
          importee
        )

        let file = resolveFile(resolved)
        if (file) return file
        if (!file && existsSync(resolved) && statSync(resolved).isDirectory()) {
          file = resolveFile(resolved, true)
          if (file) return file
        }
      }
    },

    async transform(code, id) {
      if (!filter(id)) {
        return null
      }

      let loader = extname(id).slice(1) as Loader

      if (!!options.allowJsx) {
        if (loader === 'js') {
          loader = 'jsx'
        } else if (loader === 'ts') {
          loader = 'tsx'
        }
      }

      if (!loaders.includes(loader) || !service) {
        return null
      }

      const result = await service.transform(code, {
        loader,
        target: options.target || 'es2017',
        jsxFactory: options.jsxFactory,
        jsxFragment: options.jsxFragment,
        define: options.define,
      })

      printWarnings(id, result, this)

      return (
        result.js && {
          code: result.js,
          map: result.jsSourceMap || null,
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
        if (result.js) {
          return {
            code: result.js,
            map: result.jsSourceMap || null,
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

function printWarnings(
  id: string,
  result: TransformResult,
  plugin: PluginContext
) {
  if (result.warnings) {
    for (const warning of result.warnings) {
      let message = `[esbuild]`
      if (warning.location) {
        message += ` (${relative(process.cwd(), id)}:${warning.location.line}:${
          warning.location.column
        })`
      }
      message += ` ${warning.text}`
      plugin.warn(message)
    }
  }
}
