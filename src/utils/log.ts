type TLogProps = {
  label: string;
  msgs: (string | number | undefined)[];
}

export const log = ({ label, msgs }: TLogProps): void => {
  switch (true) {
    case msgs.length > 0:
      console.log(`-- ${label}`)
      for (let i = 0, max = msgs.length; i < max; i++) {
        console.log(msgs[i])
      }
      console.log('--')
      break
    default:
      console.log(`-- ${label}`)
      break
  }
}
