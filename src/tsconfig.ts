import { readFile } from 'fs/promises'
import JoyCon from 'joycon'

const joycon = new JoyCon()

joycon.addLoader({
  test: /\.json$/,
  load: (file) => readFile(file, 'utf8'),
})

export const getTsconfig = async (
  cwd: string,
  tsconfig?: string,
): Promise<string> => {
  // This call is cached
  const { data } = await joycon.load([tsconfig || 'tsconfig.json'], cwd)
  return data
}
