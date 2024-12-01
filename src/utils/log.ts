const isLogsEnabled = process.env.LOG_LEVEL === '1'

type TLogTypeDict = {
  info: string;
  warn: string;
  error: string;
  success: string;
  'cmd.db': string;
  bulb: string;
}

const emoji: TLogTypeDict = {
  info: 'ℹ️ ',
  warn: '⚠️ ',
  error: '⛔',
  success: '✅',
  'cmd.db': '💽',
  bulb: '💡',
}

type TLogProps = {
  label: string;
  msgs: (string | number | undefined | { [key: string]: any })[];
  type?: keyof TLogTypeDict;
}

export const log = ({ label, msgs, type }: TLogProps): void => {
  if (!isLogsEnabled)
    return
  else
    switch (true) {
      case msgs.length > 0:
        console.log(`╭ ${emoji[type] || '[no emoji]'} ${label}`)
        for (let i = 0, max = msgs.length; i < max; i++) {
          if (typeof msgs[i] === 'object')
            console.log(JSON.stringify(msgs[i], null, 2))
          else
            console.log(`┤ ${msgs[i]}`)
        }
        console.log('╰')
        break
      default:
        console.log(`-- ${emoji[type] || '[no emoji]'} ${label}`)
        break
    }
}
