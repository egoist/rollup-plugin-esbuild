import { existsSync, statSync } from 'fs'
import { extname, resolve, dirname, join } from 'path'
import { Plugin as RollupPlugin } from 'rollup'
import {
  transform,
  Loader,
  CommonOptions,
  Plugin as EsbuildPlugin,
} from 'esbuild'
import { createFilter, FilterPattern } from '@rollup/pluginutils'
import { getOptions } from './options'
import { Bundled, bundleWithEsbuild } from './bundle'
import { minify, getRenderChunk } from './minify'
import { warn } from './warn'

export { minify }

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
  keepNames?: boolean
  legalComments?: CommonOptions['legalComments']
  target?: string | string[]
  /**
   * Requires esbuild >= 0.12.1
   */
  jsx?: 'transform' | 'preserve'
  jsxFactory?: string
  jsxFragment?: string
  define?: {
    [k: string]: string
  }
  experimentalBundling?: {
    filter:
      | (string | RegExp)[]
      | ((id: string, importer: string | undefined) => boolean)
    esbuildPlugins?: EsbuildPlugin[]
    rollupPlugins?: RollupPlugin[]
  }
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
  pure?: string[]
}

export default (options: Options = {}): RollupPlugin => {
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

  const experimentalBundling = options.experimentalBundling
  const bundleCache: Map<string, Bundled> = new Map()

  const enabledExperimentalBundling = (
    id: string,
    importer: string | undefined
  ) => {
    if (!experimentalBundling) return
    if (Array.isArray(experimentalBundling.filter)) {
      return experimentalBundling.filter.some((pattern) =>
        typeof pattern === 'string' ? pattern === id : pattern.test(id)
      )
    }
    if (typeof experimentalBundling.filter === 'function') {
      return experimentalBundling.filter(id, importer)
    }
  }

  return {
    name: 'esbuild',

    buildStart() {
      bundleCache.clear()
    },

    async resolveId(id, importer) {
      if (enabledExperimentalBundling(id, importer)) {
        const bundled = await bundleWithEsbuild(id, {
          cwd: importer ? dirname(importer) : process.cwd(),
          loaders,
          target,
          esbuildPlugins: experimentalBundling?.esbuildPlugins,
          rollupPlugins: experimentalBundling?.rollupPlugins,
          rollupPluginContext: this,
        })
        if (bundled) {
          bundleCache.set(bundled.id, bundled)
          return bundled.id
        }
      }

      if (importer && id[0] === '.') {
        const resolved = resolve(
          importer ? dirname(importer) : process.cwd(),
          id
        )

        let file = resolveFile(resolved)
        if (file) return file
        if (!file && existsSync(resolved) && statSync(resolved).isDirectory()) {
          file = resolveFile(resolved, true)
          if (file) return file
        }
      }
    },

    load(id) {
      if (bundleCache.has(id)) {
        const bundled = bundleCache.get(id)!
        return {
          code: bundled.code,
          map: bundled.map,
        }
      }
    },

    async transform(code, id) {
      // In bundle mode transformation is handled by esbuild too
      if (!filter(id) || bundleCache.has(id)) {
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
        jsx: options.jsx,
        jsxFactory: options.jsxFactory || defaultOptions.jsxFactory,
        jsxFragment: options.jsxFragment || defaultOptions.jsxFragment,
        define: options.define,
        sourcemap: options.sourceMap !== false,
        sourcefile: id,
        pure: options.pure,
        legalComments: options.legalComments,
      })

      await warn(this, result.warnings)

      return (
        result.code && {
          code: result.code,
          map: result.map || null,
        }
      )
    },

    renderChunk: getRenderChunk(options),
  }
}
