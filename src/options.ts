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
  cwd: string
): Promise<{ jsxFactory?: string; jsxFragment?: string; target?: string }> => {
  // This call is cached
  const { data, path } = await joycon.load(['tsconfig.json'], cwd)
  if (path && data) {
    return {
      jsxFactory: data.compilerOptions?.jsxFactory,
      jsxFragment: data.compilerOptions?.jsxFragmentFactory,
      target: data.compilerOptions?.target,
    }
  }
  return {}
}
