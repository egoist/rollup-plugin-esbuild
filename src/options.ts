import fs from 'fs'
import JoyCon from 'joycon'
import { parse } from 'jsonc-parser'
import { TransformOptions } from 'esbuild'

const joycon = new JoyCon()

joycon.addLoader({
  test: /\.json$/,
  load: async (file) => {
    const content = await fs.promises.readFile(file, 'utf8')
    return parse(content)
  },
})

const jsxValueMap: Record<any, Pick<TransformOptions, 'jsx' | 'jsxDev'>> = {
  preserve: {
    jsx: 'preserve',
  },
  react: {
    jsx: 'transform',
  },
  'react-jsx': {
    jsx: 'automatic',
  },
  'react-jsxdev': {
    jsx: 'automatic',
    jsxDev: true,
  },
}

export const getOptions = async (
  cwd: string,
  tsconfig?: string,
): Promise<
  Pick<
    TransformOptions,
    'jsxFactory' | 'jsxFragment' | 'target' | 'jsx' | 'jsxDev'
  >
> => {
  // This call is cached
  const { data, path } = await joycon.load([tsconfig || 'tsconfig.json'], cwd)
  if (path && data) {
    const { jsxFactory, jsxFragmentFactory, target, jsx } =
      data.compilerOptions || {}
    return {
      jsxFactory,
      jsxFragment: jsxFragmentFactory,
      // Lowercased value to be compatible with esbuild
      // Maybe remove in 3.0, #77
      target: target && target.toLowerCase(),
      ...jsxValueMap[jsx],
    }
  }
  return {}
}
