const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const previousConfigFile = process.env.CASINO_CONFIG_FILE;
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mldbot-casino-config-'));
process.env.CASINO_CONFIG_FILE = path.join(temporaryDirectory, 'casino-config.json');
const casinoConfig = require('../utils/casinoConfig');

after(() => {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  if (previousConfigFile === undefined) delete process.env.CASINO_CONFIG_FILE;
  else process.env.CASINO_CONFIG_FILE = previousConfigFile;
});

test('returns default casino settings when a guild has no configuration', () => {
  assert.deepEqual(casinoConfig.get('12345678901234567'), {
    games: { blackjack: true, poker: true, craps: true },
    minBet: 1,
    maxBet: Number.MAX_SAFE_INTEGER
  });
});

test('loads guild-specific casino settings and rejects malformed settings', () => {
  const filePath = process.env.CASINO_CONFIG_FILE;
  fs.writeFileSync(filePath, JSON.stringify({
    '12345678901234567': {
      games: { blackjack: false, poker: true, craps: false },
      minBet: 25,
      maxBet: 2500
    }
  }));
  assert.deepEqual(casinoConfig.get('12345678901234567'), {
    games: { blackjack: false, poker: true, craps: false },
    minBet: 25,
    maxBet: 2500
  });

  fs.writeFileSync(filePath, JSON.stringify({
    '12345678901234567': {
      games: { blackjack: true, poker: true, craps: true },
      minBet: 100,
      maxBet: 50
    }
  }));
  assert.throws(() => casinoConfig.get('12345678901234567'), /Configurație de cazino invalidă/);
});

test('rejects disabled casino games and wagers outside guild limits', async () => {
  const filePath = process.env.CASINO_CONFIG_FILE;
  fs.writeFileSync(filePath, JSON.stringify({
    '12345678901234567': {
      games: { blackjack: false, poker: true, craps: true },
      minBet: 25,
      maxBet: 2500
    }
  }));
  const casino = require('../commands/casino');
  const replies = [];
  const context = (game, amount) => ({
    message: {
      guild: { id: '12345678901234567' },
      mentions: { users: { first: () => null } },
      reply: async (message) => replies.push(message)
    },
    args: [String(amount)]
  });

  await casino.execute('blackjack', context('blackjack', 100));
  await casino.execute('poker', context('poker', 10));
  await casino.execute('craps', context('craps', 2501));

  assert.match(replies[0], /dezactivat/);
  assert.match(replies[1], /între 25 și 2500/);
  assert.match(replies[2], /între 25 și 2500/);
});
