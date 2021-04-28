import { existsSync, statSync } from 'fs'
import { extname, resolve, dirname, join } from 'path'
import { Plugin, PluginContext } from 'rollup'
import { transform, Loader, formatMessages, Message } from 'esbuild'
import { createFilter, FilterPattern } from '@rollup/pluginutils'
import { getOptions } from './options'
import { bundle } from './bundle'

const defaultLoaders: { [ext: string]: Loader } = {
  '.js': 'js',
  '.jsx': 'jsx',
  '.ts': 'ts',
  '.tsx': 'tsx',
}

export type Options = {
  include?: FilterPattern
  exclude?: FilterPattern
  sourceMap?: boolean
  minify?: boolean
  minifyWhitespace?: boolean
  minifyIdentifiers?: boolean
  minifySyntax?: boolean
  target?: string | string[]
  jsxFactory?: string
  jsxFragment?: string
  define?: {
    [k: string]: string
  }
  experimentalBundling?: boolean
  /**
   * Use this tsconfig file instead
   * Disable it by setting to `false`
   */
  tsconfig?: string | false
  /**
   * Map extension to esbuild loader
   * Note that each entry (the extension) needs to start with a dot
   */
  loaders?: {
    [ext: string]: Loader | false
  }
}

const warn = async (pluginContext: PluginContext, messages: Message[]) => {
  if (messages.length > 0) {
    const warnings = await formatMessages(messages, {
      kind: 'warning',
      color: true,
    })
    warnings.forEach((warning) => pluginContext.warn(warning))
  }
}

export default (options: Options = {}): Plugin => {
  let target: string | string[]

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

  const resolveFile = (resolved: string, index: boolean = false) => {
    for (const ext of extensions) {
      const file = index ? join(resolved, `index${ext}`) : `${resolved}${ext}`
      if (existsSync(file)) return file
    }
    return null
  }

  let plugins: Plugin[] = []

  return {
    name: 'esbuild',

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

    options(options) {
      plugins = options.plugins || []
      return null
    },

    async load(id) {
      if (options.experimentalBundling) {
        const bundled = await bundle(id, this, plugins, loaders)
        if (bundled.code) {
          return {
            code: bundled.code,
            map: bundled.map,
          }
        }
      }
    },

    async transform(code, id) {
      if (!filter(id)) {
        return null
      }

      const ext = extname(id)
      const loader = loaders[ext]

      if (!loader) {
        return null
      }

      const defaultOptions =
        options.tsconfig === false
          ? {}
          : await getOptions(dirname(id), options.tsconfig)

      target = options.target || defaultOptions.target || 'es2017'

      const result = await transform(code, {
        loader,
        target,
        jsxFactory: options.jsxFactory || defaultOptions.jsxFactory,
        jsxFragment: options.jsxFragment || defaultOptions.jsxFragment,
        define: options.define,
        sourcemap: options.sourceMap !== false,
        sourcefile: id,
      })

      await warn(this, result.warnings)

      return (
        result.code && {
          code: result.code,
          map: result.map || null,
        }
      )
    },

    async renderChunk(code) {
      if (options.minify || options.minifyWhitespace || options.minifyIdentifiers || options.minifySyntax) {
        const result = await transform(code, {
          loader: 'js',
          minify: options.minify,
          minifyWhitespace: options.minifyWhitespace,
          minifyIdentifiers: options.minifyIdentifiers,
          minifySyntax: options.minifySyntax,
          target,
          sourcemap: options.sourceMap !== false,
        })
        await warn(this, result.warnings)
        if (result.code) {
          return {
            code: result.code,
            map: result.map || null,
          }
        }
      }
      return null
    },
  }
}
