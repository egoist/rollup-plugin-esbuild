import fs from 'fs'
import JoyCon from 'joycon'
import strip from 'strip-json-comments'

const joycon = new JoyCon()

joycon.addLoader({
  test: /\.json$/,
  load: async (file) => {
    const content = await fs.promises.readFile(file, 'utf8')
    return JSON.parse(strip(content))
  },
})

export const getOptions = async (
  cwd: string,
  tsconfig?: string
): Promise<{ jsxFactory?: string; jsxFragment?: string; target?: string }> => {
  // This call is cached
  const { data, path } = await joycon.load([tsconfig || 'tsconfig.json'], cwd)
  if (path && data) {
    const { jsxFactory, jsxFragmentFactory, target } =
      data.compilerOptions || {}
    return {
      jsxFactory,
      jsxFragment: jsxFragmentFactory,
      // Lowercased value to be compatible with esbuild
      // Maybe remove in 3.0, #77
      target: target && target.toLowerCase(),
    }
  }
  return {}
}
