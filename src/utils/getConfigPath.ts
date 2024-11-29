export const getConfigPath = (nodeEnv?: string): string => {
  const isDev = nodeEnv === 'development';
  const isTest = nodeEnv === 'test';
  console.log(`nodeEnv= ${nodeEnv}; isDev= ${String(isDev)}; isTest= ${String(isTest)}`)

  let configFile
  switch (true) {
    case isDev:
      configFile = './config/config.dev.yaml'
      break
    case isTest:
      configFile = './config/config.test.yaml'
      break
    default:
      configFile = './config/config.yaml'
      break
  }
  return configFile
}