const fs = require('node:fs');
const path = require('node:path');

function createServerConfig(filePath = path.resolve('./data/server-config.json')) {
  function validate(configs) {
    if (!configs || typeof configs !== 'object' || Array.isArray(configs)) {
      throw new Error(`Structură invalidă în configurația serverelor ${filePath}.`);
    }

    for (const [guildId, config] of Object.entries(configs)) {
      if (!/^\d{17,20}$/.test(guildId) || !config || typeof config !== 'object') {
        throw new Error(`Configurație invalidă pentru serverul ${guildId}.`);
      }

      for (const field of [
        'verifyChannelId',
        'verifyRoleId',
        'ticketCategoryId',
        'ticketPanelChannelId',
        'suggestionsChannelId',
        'ticketLogChannelId',
        'levelChannelId'
      ]) {
        const value = config[field];
        if (value !== undefined && value !== null &&
            (typeof value !== 'string' || !/^\d{17,20}$/.test(value))) {
          throw new Error(`Câmpul ${field} are un ID invalid pentru serverul ${guildId}.`);
        }
      }

      if (config.staffRoleIds !== undefined &&
          (!Array.isArray(config.staffRoleIds) ||
            config.staffRoleIds.some((roleId) =>
              typeof roleId !== 'string' || !/^\d{17,20}$/.test(roleId)))) {
        throw new Error(`Lista rolurilor staff este invalidă pentru serverul ${guildId}.`);
      }

      if (config.levelImageFile !== undefined && config.levelImageFile !== null &&
          (typeof config.levelImageFile !== 'string' ||
            path.basename(config.levelImageFile) !== config.levelImageFile ||
            !config.levelImageFile.startsWith(`${guildId}-`) ||
            !['.jpg', '.png', '.gif', '.webp'].includes(path.extname(config.levelImageFile)))) {
        throw new Error(`Imaginea de level-up este invalidă pentru serverul ${guildId}.`);
      }
    }
  }

  function load() {
    if (!fs.existsSync(filePath)) return {};
    const configs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    validate(configs);
    return configs;
  }

  function save(configs) {
    validate(configs);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(configs, null, 2), 'utf8');
    fs.renameSync(temporaryPath, filePath);
  }

  function get(guildId) {
    return load()[guildId] || {};
  }

  function update(guildId, patch) {
    if (!/^\d{17,20}$/.test(guildId)) {
      throw new Error('ID-ul serverului Discord nu este valid.');
    }
    const configs = load();
    configs[guildId] = { ...(configs[guildId] || {}), ...patch };
    save(configs);
    return configs[guildId];
  }

  return { get, update };
}

module.exports = createServerConfig();
module.exports.createServerConfig = createServerConfig;
