const fs = require('fs')

const CONFIG_FILE = 'config.json'

const DEFAULT_CONFIG = {
  mqttServer: 'tcp://localhost:1883',
  mqttTopics: [
    '+/connected',
    '+/status/#'
  ],
  telegramBotToken: '123:abc'
}

function loadConfig() {
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8')
    const config = JSON.parse(content)
    const withDefaults = {
      ...DEFAULT_CONFIG,
      ...config
    }

    // Save again to fix possible formatting issues
    saveConfig(withDefaults)

    return withDefaults
  } catch (error) {
    saveConfig(DEFAULT_CONFIG)
    throw new Error('No config file found. Created one. Edit ' + CONFIG_FILE + ' to your needs and restart the bot.')
  }
}

function saveConfig(config) {
  const content = JSON.stringify(config, null, '  ') + '\n'
  fs.writeFileSync(CONFIG_FILE, content, 'utf8')
}

module.exports = {
  loadConfig
}
