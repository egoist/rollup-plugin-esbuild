import {
  build,
  Loader,
  OnLoadArgs,
  OnLoadOptions,
  OnLoadResult,
  OnResolveArgs,
  OnResolveOptions,
  OnResolveResult,
  Plugin as EsbuildPlugin,
  PluginBuild,
} from 'esbuild'
import {
  PluginContext as RollupPluginContext,
  Plugin as RollupPlugin,
  LoadResult,
} from 'rollup'
import { isBinary } from 'istextorbinary'
import path from 'path'

export type BundleOptions = {
  cwd: string
  loaders?: {
    [ext: string]: Loader
  }
  target?: string | string[]
  esbuildPlugins?: EsbuildPlugin[]
  rollupPlugins?: RollupPlugin[]
  rollupPluginContext: RollupPluginContext
  isEntry?: boolean
}

type MaybePromise<T> = T | Promise<T>

const JS_RE = /\.(js|mjs|json|jsx|tsx|ts|cjs)$/

export type Bundled = {
  code: string
  map?: string
  id: string
}

export const bundleWithEsbuild = async (
  id: string,
  options: BundleOptions
): Promise<null | Bundled> => {
  const rollupPlugins = options.rollupPlugins || []
  const esbuildPlugins = options.esbuildPlugins || []

  const result = await build({
    entryPoints: [id],
    format: 'esm',
    target: options.target,
    bundle: true,
    write: false,
    sourcemap: 'external',
    outdir: 'dist',
    platform: 'node',
    loader: options.loaders,
    plugins: [
      {
        name: 'rollup',
        setup: (build) => {
          const onResolves: {
            pluginName: string
            options: OnResolveOptions
            callback: (
              args: OnResolveArgs
            ) => MaybePromise<null | undefined | OnResolveResult>
          }[] = []
          const onLoads: {
            pluginName: string
            options: OnLoadOptions
            callback: (
              args: OnLoadArgs
            ) => MaybePromise<null | undefined | OnLoadResult>
          }[] = []

          for (const plugin of esbuildPlugins) {
            const buildProxy: PluginBuild = {
              ...build,
              onResolve(options, callback) {
                onResolves.push({ pluginName: plugin.name, options, callback })
              },
              onLoad(options, callback) {
                onLoads.push({ pluginName: plugin.name, options, callback })
              },
            }
            plugin.setup(buildProxy)
          }

          // Try to resolve id with Esbuild plugins
          for (const onResolve of onResolves) {
            build.onResolve(onResolve.options, async (args) => {
              const result = await Promise.resolve(
                onResolve.callback(args)
              ).catch((error) => {
                return {
                  errors: [
                    { text: error.message, pluginName: onResolve.pluginName },
                  ],
                } as OnResolveResult
              })
              if (result) {
                result.pluginName = onResolve.pluginName
              }
              if (result?.watchFiles) {
                result.watchFiles.forEach((id) =>
                  options.rollupPluginContext.addWatchFile(id)
                )
              }
              return result
            })
          }

          // Try to resolve id with Rollup plugins
          build.onResolve({ filter: /.+/ }, async (args) => {
            for (const plugin of rollupPlugins) {
              if (plugin.resolveId) {
                const resolved = await plugin.resolveId.call(
                  options.rollupPluginContext,
                  args.path,
                  args.importer,
                  { isEntry: !!options.isEntry }
                )
                if (resolved == null) continue
                if (resolved === false) {
                  return { external: true }
                }
                if (typeof resolved === 'string') {
                  return { path: resolved }
                }
                return {
                  path: resolved.id,
                  external: !!resolved.external,
                }
              }
            }
          })

          build.onLoad({ filter: /.+/ }, async (args) => {
            if (isBinary(args.path)) {
              return
            }

            let contents: string | Uint8Array | undefined
            let resolveDir: string | undefined

            // Try loading the contents with rollup plugins
            for (const plugin of rollupPlugins) {
              if (plugin.load && plugin.name !== 'esbuild') {
                const loaded = (await plugin.load.call(
                  options.rollupPluginContext,
                  args.path
                )) as LoadResult
                if (loaded == null) {
                  continue
                } else if (typeof loaded === 'string') {
                  contents = loaded
                  break
                } else if (loaded) {
                  contents = loaded.code
                  break
                }
              }
            }

            if (contents == null) {
              // Try loading the contents with esbuild plugins
              for (const onLoad of onLoads) {
                if (
                  onLoad.options.filter.test(args.path) &&
                  (onLoad.options.namespace || 'file') === args.namespace
                ) {
                  const result = await Promise.resolve(
                    onLoad.callback(args)
                  ).catch((error) => {
                    return {
                      errors: [
                        { text: error.message, pluginName: onLoad.pluginName },
                      ],
                    } as OnLoadResult
                  })
                  if (result?.watchFiles) {
                    result.watchFiles.forEach((id) =>
                      options.rollupPluginContext.addWatchFile(id)
                    )
                  }

                  if (result) {
                    if (
                      (result.errors || []).length > 0 ||
                      (result.warnings || []).length > 0
                    ) {
                      return result
                    }
                    result.pluginName = onLoad.pluginName
                    if (result.contents) {
                      contents = result.contents
                    }
                    if (result.resolveDir) {
                      resolveDir = result.resolveDir
                    }
                    break
                  }
                }
              }
            }

            // No contents
            // Let esbuild handle it
            if (contents == null) {
              return
            }

            return {
              contents,
              resolveDir,
            }
          })
        },
      },
    ],
  })

  const jsFile = result.outputFiles.find((file) => file.path.endsWith('.js'))

  if (!jsFile) return null

  for (const file of result.outputFiles) {
    if (!JS_RE.test(file.path) && !file.path.endsWith('.map')) {
      options.rollupPluginContext.emitFile({
        type: 'asset',
        // TODO: the filename is mostly wrong
        fileName: file.path,
        source: file.contents,
      })
    }
  }

  return {
    id: jsFile.path,
    code: jsFile.text,
    map: result.outputFiles.find((file) => file.path.endsWith('.map'))?.text,
  }
}
