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
        'ticketPanelMessageId',
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

      for (const [field, maxLength] of [
        ['verifyTitle', 256],
        ['verifyDescription', 4000],
        ['verifyEmoji', 100],
        ['ticketPanelTitle', 256],
        ['ticketPanelDescription', 4000],
        ['ticketPanelPrompt', 150]
      ]) {
        const value = config[field];
        if (value !== undefined &&
            (typeof value !== 'string' || value.length > maxLength)) {
          throw new Error(`Câmpul ${field} este invalid pentru serverul ${guildId}.`);
        }
      }

      if (config.ticketTypes !== undefined) {
        if (!Array.isArray(config.ticketTypes) || config.ticketTypes.length < 1 ||
            config.ticketTypes.length > 25) {
          throw new Error(`Lista categoriilor de tichete este invalidă pentru serverul ${guildId}.`);
        }
        const ticketTypeKeys = new Set();
        for (const type of config.ticketTypes) {
          if (!type || typeof type !== 'object' || Array.isArray(type) ||
              typeof type.key !== 'string' || !/^[a-z0-9_-]{1,50}$/.test(type.key) ||
              ticketTypeKeys.has(type.key) ||
              typeof type.label !== 'string' || !type.label || type.label.length > 100 ||
              typeof type.description !== 'string' || !type.description ||
              type.description.length > 100 ||
              typeof type.emoji !== 'string' || !type.emoji || type.emoji.length > 100 ||
              typeof type.details !== 'string' || type.details.length > 1500 ||
              !['ticket', 'suggestion'].includes(type.action) ||
              (type.action === 'ticket' && !type.details)) {
            throw new Error(`O categorie de tichet este invalidă pentru serverul ${guildId}.`);
          }
          ticketTypeKeys.add(type.key);
        }
      }

      if (config.levelImageFile !== undefined && config.levelImageFile !== null &&
          (typeof config.levelImageFile !== 'string' ||
            path.basename(config.levelImageFile) !== config.levelImageFile ||
            !config.levelImageFile.startsWith(`${guildId}-`) ||
            !['.jpg', '.png', '.gif', '.webp'].includes(path.extname(config.levelImageFile)))) {
        throw new Error(`Imaginea de level-up este invalidă pentru serverul ${guildId}.`);
      }

      for (const module of ['welcome', 'leave']) {
        const settings = config[module];
        if (settings === undefined) continue;
        if (!settings || typeof settings !== 'object' || Array.isArray(settings) ||
            typeof settings.enabled !== 'boolean' ||
            ((settings.channelId ?? '') !== '' && !/^\d{17,20}$/.test(settings.channelId)) ||
            typeof (settings.emoji ?? '') !== 'string' ||
            !settings.types || typeof settings.types !== 'object' || Array.isArray(settings.types)) {
          throw new Error(`Configurația ${module} este invalidă pentru serverul ${guildId}.`);
        }
        for (const [type, message] of Object.entries(settings.types)) {
          if (!message || typeof message !== 'object' ||
              typeof message.messageText !== 'string' || message.messageText.length > 2000 ||
              typeof message.embedEnabled !== 'boolean' ||
              typeof message.bannerEnabled !== 'boolean' ||
              !Array.isArray(message.bannerLayers) || message.bannerLayers.length > 15) {
            throw new Error(`Mesajul ${type} din modulul ${module} este invalid pentru serverul ${guildId}.`);
          }
        }
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

  function getAll() {
    return load();
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

  return { get, getAll, update };
}

module.exports = createServerConfig();
module.exports.createServerConfig = createServerConfig;
