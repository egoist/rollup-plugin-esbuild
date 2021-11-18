import { Plugin, InternalModuleFormat, RenderChunkHook } from 'rollup'
import { transform, CommonOptions, Format } from 'esbuild'
import { warn } from './warn'

const getEsbuildFormat = (
  rollupFormat: InternalModuleFormat
): Format | undefined => {
  if (rollupFormat === 'es') {
    return 'esm'
  }
  if (rollupFormat === 'cjs') {
    return rollupFormat
  }
}

export type Options = {
  sourceMap?: boolean
  minify?: boolean
  minifyWhitespace?: boolean
  minifyIdentifiers?: boolean
  minifySyntax?: boolean
  keepNames?: boolean
  legalComments?: CommonOptions['legalComments']
}

export const getRenderChunk = (options: Options): RenderChunkHook =>
  async function (code, _, rollupOptions) {
    if (
      options.minify ||
      options.minifyWhitespace ||
      options.minifyIdentifiers ||
      options.minifySyntax
    ) {
      const format = getEsbuildFormat(rollupOptions.format)
      const result = await transform(code, {
        format,
        loader: 'js',
        minify: options.minify,
        minifyWhitespace: options.minifyWhitespace,
        minifyIdentifiers: options.minifyIdentifiers,
        minifySyntax: options.minifySyntax,
        keepNames: options.keepNames,
        legalComments: options.legalComments,
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
  }

export const minify = (options: Options = {}): Plugin => {
  return {
    name: 'esbuild-minify',

    renderChunk: getRenderChunk({
      minify: true,
      ...options,
    }),
  }
}
