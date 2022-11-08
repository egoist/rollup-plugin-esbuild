import { Plugin, InternalModuleFormat } from 'rollup'
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
  sourceMap = true,
  ...options
}: Options): Plugin["renderChunk"] =>
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
        sourcemap: sourceMap,
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

export const minify = ({
  sourceMap = true,
  ...options
}: Options = {}): Plugin => {
  return {
    name: 'esbuild-minify',

    renderChunk: getRenderChunk({
      minify: true,
      ...options,
      sourceMap,
    }),
  }
}
