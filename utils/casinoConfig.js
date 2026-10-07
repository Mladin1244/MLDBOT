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
      settings.maxBet > 1_000_000_000) {
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

module.exports = { DEFAULT_SETTINGS, get };
