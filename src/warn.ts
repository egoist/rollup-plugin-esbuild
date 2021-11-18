import { PluginContext } from 'rollup'
import {
	formatMessages,
	Message,
} from 'esbuild'

export const warn = async (pluginContext: PluginContext, messages: Message[]) => {
	if (messages.length > 0) {
		const warnings = await formatMessages(messages, {
		kind: 'warning',
		color: true,
		})
		warnings.forEach((warning) => pluginContext.warn(warning))
	}
}
