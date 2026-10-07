const fs = require('node:fs');
const path = require('node:path');

const filePath = path.resolve(process.env.CASINO_CONFIG_FILE || './data/casino-config.json');
const DEFAULT_SETTINGS = Object.freeze({
  games: Object.freeze({ blackjack: true, poker: true, craps: true }),
  minBet: 1,
  maxBet: Number.MAX_SAFE_INTEGER
});

function validateSettings(guildId, settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings) ||
      !settings.games || typeof settings.games !== 'object' ||
      !['blackjack', 'poker', 'craps'].every((game) => typeof settings.games[game] === 'boolean') ||
      !Number.isSafeInteger(settings.minBet) || settings.minBet < 1 ||
      !Number.isSafeInteger(settings.maxBet) || settings.maxBet < settings.minBet ||
      settings.maxBet > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Configurație de cazino invalidă pentru serverul ${guildId} în ${filePath}.`);
  }
}

function get(guildId) {
  if (typeof guildId !== 'string' || !/^\d{17,20}$/.test(guildId)) {
    throw new Error('ID-ul serverului Discord nu este valid pentru configurația cazinoului.');
  }
  if (!fs.existsSync(filePath)) return structuredClone(DEFAULT_SETTINGS);

  const configs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!configs || typeof configs !== 'object' || Array.isArray(configs)) {
    throw new Error(`Structură invalidă în configurația cazinoului ${filePath}.`);
  }
  const settings = configs[guildId];
  if (!settings) return structuredClone(DEFAULT_SETTINGS);
  validateSettings(guildId, settings);
  return structuredClone(settings);
}

function getAll() {
  if (!fs.existsSync(filePath)) return {};
  const configs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!configs || typeof configs !== 'object' || Array.isArray(configs)) {
    throw new Error(`Structură invalidă în configurația cazinoului ${filePath}.`);
  }
  for (const [guildId, settings] of Object.entries(configs)) {
    if (!/^\d{17,20}$/.test(guildId)) {
      throw new Error(`ID-ul serverului ${guildId} este invalid în configurația cazinoului ${filePath}.`);
    }
    validateSettings(guildId, settings);
  }
  return structuredClone(configs);
}

function set(guildId, settings) {
  if (typeof guildId !== 'string' || !/^\d{17,20}$/.test(guildId)) {
    throw new Error('ID-ul serverului Discord nu este valid pentru configurația cazinoului.');
  }
  validateSettings(guildId, settings);
  const configs = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
    : {};
  if (!configs || typeof configs !== 'object' || Array.isArray(configs)) {
    throw new Error(`Structură invalidă în configurația cazinoului ${filePath}.`);
  }
  configs[guildId] = structuredClone(settings);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(configs, null, 2), { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
}

module.exports = { DEFAULT_SETTINGS, get, getAll, set };
