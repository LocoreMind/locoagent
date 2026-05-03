// Stub for TungstenTool (ant-internal, not in public source)
import { buildTool } from '../../Tool.js'

export const TungstenTool = buildTool({
  name: 'Tungsten',
  searchHint: 'tmux terminal management',
  async description() {
    return 'Tungsten terminal tool (stub)'
  },
  async prompt() {
    return ''
  },
  inputJSONSchema: {
    type: 'object' as const,
    properties: {
      command: { type: 'string', description: 'Command to run' },
    },
    required: ['command'],
  },
  userFacingName() {
    return 'Tungsten'
  },
  async *call() {
    yield { type: 'result' as const, data: { result: 'TungstenTool is not available in this build' } }
  },
})
