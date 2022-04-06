import { Plugin, InternalModuleFormat, RenderChunkHook } from 'rollup'
import { transform, TransformOptions, Format } from 'esbuild'
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

export type Options = Omit<TransformOptions, 'sourcemap'> & {
  sourceMap?: boolean
}

export const getRenderChunk = ({
  sourceMap,
  ...options
}: Options): RenderChunkHook =>
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
        sourcemap: sourceMap !== false,
        ...options,
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
  let sourceMap = false
  return {
    name: 'esbuild-minify',

    outputOptions({ sourcemap }) {
      sourceMap = options.sourceMap ?? !!sourcemap
      return null
    },

    renderChunk: getRenderChunk({
      minify: true,
      ...options,
      sourceMap,
    }),
  }
}
