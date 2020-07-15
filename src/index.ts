import { existsSync, statSync } from 'fs'
import { extname, resolve, dirname, join, relative } from 'path'
import { Plugin, PluginContext } from 'rollup'
import { startService, Loader, Service, Target, TransformResult } from 'esbuild'
import { createFilter, FilterPattern } from '@rollup/pluginutils'

const defaultLoaders: { [ext: string]: Loader } = {
  '.js': 'js',
  '.jsx': 'jsx',
  '.ts': 'ts',
  '.tsx': 'tsx',
}

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
  /**
   * Map extension to esbuild loader
   * Note that each entry (the extension) needs to start with a dot
   */
  loaders?: {
    [ext: string]: Loader | false
  }
}

export default (options: Options = {}): Plugin => {
  const loaders = {
    ...defaultLoaders,
  }
  if (options.loaders) {
    for (const key of Object.keys(options.loaders)) {
      const value = options.loaders[key]
      if (typeof value === 'string') {
        loaders[key] = value
      } else if (value === false) {
        delete loaders[key]
      }
    }
  }

  const extensions: string[] = Object.keys(loaders)
  const INCLUDE_REGEXP = new RegExp(
    `\\.(${extensions.map((ext) => ext.slice(1)).join('|')})$`
  )
  const EXCLUDE_REGEXP = /node_modules/

  const filter = createFilter(
    options.include || INCLUDE_REGEXP,
    options.exclude || EXCLUDE_REGEXP
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
    for (const ext of extensions) {
      const file = index ? join(resolved, `index${ext}`) : `${resolved}${ext}`
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

      const ext = extname(id)
      const loader = loaders[ext]

      if (!loader || !service) {
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
