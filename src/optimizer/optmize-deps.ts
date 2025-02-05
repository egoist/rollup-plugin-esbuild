import fs from 'fs'
import path from 'path'
import { build, type BuildOptions as EsbuildOptions } from 'esbuild'
import * as esModuleLexer from 'es-module-lexer'

export type OptimizeDepsOptions = {
  include: string[]
  exclude?: string[]
  cwd: string
  esbuildOptions?: EsbuildOptions
  sourceMap: boolean
}

export type Optimized = Map<string, { file: string }>

export type OptimizeDepsResult = {
  optimized: Optimized
  cacheDir: string
}

const slash = (p: string) => p.replace(/\\/g, '/')

export const optimizeDeps = async (
  options: OptimizeDepsOptions,
): Promise<OptimizeDepsResult> => {
  const cacheDir = path.join(options.cwd, 'node_modules/.optimize_deps')
  await fs.promises.mkdir(cacheDir, { recursive: true })
  await esModuleLexer.init
  await build({
    entryPoints: options.include,
    absWorkingDir: options.cwd,
    bundle: true,
    format: 'esm',
    ignoreAnnotations: true,
    metafile: true,
    splitting: true,
    outdir: cacheDir,
    sourcemap: options.sourceMap,
    ...options.esbuildOptions,
    plugins: [
      {
        name: 'optimize-deps',
        async setup(build) {
          build.onResolve({ filter: /.*/ }, async (args) => {
            if (options.exclude?.includes(args.path)) {
              return {
                external: true,
              }
            }
            if (args.pluginData?.__resolving_dep_path__) {
              return // use default resolve algorithm
            }
            if (options.include.includes(args.path)) {
              const resolved = await build.resolve(args.path, {
                resolveDir: args.resolveDir,
                kind: 'import-statement',
                pluginData: { __resolving_dep_path__: true },
              })
              if (resolved.errors.length > 0 || resolved.warnings.length > 0) {
                return resolved
              }
              return {
                path: args.path,
                namespace: 'optimize-deps',
                pluginData: {
                  resolveDir: args.resolveDir,
                  absolute: resolved.path,
                },
              }
            }
          })
          build.onLoad(
            { filter: /.*/, namespace: 'optimize-deps' },
            async (args) => {
              const { absolute, resolveDir } = args.pluginData
              const contents = await fs.promises.readFile(absolute, 'utf-8')
              const [, exported] = esModuleLexer.parse(contents)
              return {
                contents:
                  exported.length > 0
                    ? `export * from '${slash(absolute)}'`
                    : `module.exports = require('${slash(absolute)}')`,
                resolveDir,
              }
            },
          )
        },
      },
      ...(options.esbuildOptions?.plugins || []),
    ],
  })

  const optimized: Optimized = new Map()

  for (const id of options.include) {
    optimized.set(id, { file: path.join(cacheDir, `${id}.js`) })
  }

  return {
    optimized,
    cacheDir,
  }
}
