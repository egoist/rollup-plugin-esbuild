import type { PluginContext } from 'rollup'
import { formatMessages, type Message } from 'esbuild'

export const warn = async (
  pluginContext: PluginContext,
  messages: Message[],
): Promise<void> => {
  if (messages.length > 0) {
    const warnings = await formatMessages(messages, {
      kind: 'warning',
      color: true,
    })
    warnings.forEach((warning) => pluginContext.warn(warning))
  }
}
