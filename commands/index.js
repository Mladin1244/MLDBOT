const economy = require('./economy');
const admin = require('./admin');
const casino = require('./casino');
const glitchhelp = require('./utility/glitchhelp');
const leveling = require('./leveling');

const cooldowns = new Map();
const PREFIX = process.env.PREFIX || '!';
const COOLDOWN_MS = 3000;
const PUBLIC_COMMANDS = [
  'glitchhelp', 'credite', 'credits', 'transfer', 'daily', 'leaderboard', 'stats',
  'blackjack', 'poker', 'craps'
];

function suggestionFor(input) {
  const distance = (left, right) => {
    const row = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const current = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
        previous = current;
      }
    }
    return row[right.length];
  };
  const closest = PUBLIC_COMMANDS
    .map((command) => ({ command, distance: distance(input, command) }))
    .sort((a, b) => a.distance - b.distance)[0];
  return closest && closest.distance <= Math.max(1, Math.floor(input.length / 3))
    ? closest.command
    : null;
}

async function handleMessage(message, services) {
  if (!message.content.startsWith(PREFIX)) return;
  const parts = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = (parts.shift() || '').toLowerCase();
  if (!command) return;

  const now = Date.now();
  const lastUsed = cooldowns.get(message.author.id) || 0;
  if (now - lastUsed < COOLDOWN_MS) {
    const remaining = ((COOLDOWN_MS - (now - lastUsed)) / 1000).toFixed(1);
    await message.reply(`Așteaptă ${remaining} secunde înainte de următoarea comandă.`);
    return;
  }
  cooldowns.set(message.author.id, now);

  const ctx = { message, args: parts, ...services, prefix: PREFIX };
  if (command === 'glitchhelp') {
    await glitchhelp.execute(ctx);
    await ctx.onPublicCommand?.(command);
  } else if (command === 'level' || command === 'missions') {
    await leveling.handlePrefixCommand(command, ctx);
  } else if (['credite', 'credits', 'transfer', 'daily', 'leaderboard', 'stats'].includes(command)) {
    await economy.execute(command === 'credits' ? 'credite' : command, ctx);
    if (PUBLIC_COMMANDS.includes(command)) await ctx.onPublicCommand?.(command);
  } else if (command.startsWith('admin_')) {
    await admin.execute(command, ctx);
  } else if (['blackjack', 'poker', 'craps'].includes(command)) {
    await casino.execute(command, ctx);
    await ctx.onPublicCommand?.(command);
  } else {
    const suggestion = suggestionFor(command);
    if (suggestion) {
      await message.reply(`Comandă necunoscută. Ai vrut să spui \`${PREFIX}${suggestion}\`?`);
    }
  }
}

module.exports = { handleMessage, suggestionFor, PUBLIC_COMMANDS, PREFIX };
