const { ButtonStyle } = require('discord.js');
const { embed, buttons, credits } = require('../utils/discord');
const { runBlackjack } = require('../games/blackjack');
const { runPoker } = require('../games/poker');
const { runCraps } = require('../games/craps');
const { numberArg } = require('./economy');
const casinoConfig = require('../utils/casinoConfig');

const GAME_RUNNERS = {
  blackjack: runBlackjack,
  poker: runPoker,
  craps: runCraps
};

async function challenge(ctx, game, opponent, wager) {
  const challenger = ctx.message.author;
  if (opponent.bot || opponent.id === challenger.id) {
    throw new Error('Nu poți provoca un bot sau pe tine însuți.');
  }
  if (ctx.db.getBalance(challenger.id, challenger.username) < wager) {
    throw new Error('Nu ai suficiente credite pentru această miză.');
  }
  if (ctx.db.getBalance(opponent.id, opponent.username) < wager) {
    throw new Error(`${opponent.username} nu are suficiente credite pentru această miză.`);
  }

  const invitation = await ctx.message.channel.send({
    embeds: [embed(`🎲 Provocare ${game}`, `${opponent} — ${challenger} te provoacă la **${game}** pentru **${credits(wager)}** credite.\nAi 30 de secunde să răspunzi.`, 0xf1c40f)],
    components: [buttons([
      { id: 'challenge_accept', label: 'Accept', style: ButtonStyle.Success, emoji: '✅' },
      { id: 'challenge_reject', label: 'Reject', style: ButtonStyle.Danger, emoji: '❌' }
    ])]
  });
  const collector = invitation.createMessageComponentCollector({ time: 30000 });

  let response;
  try {
    response = await new Promise((resolve) => {
      collector.on('collect', async (interaction) => {
        if (interaction.user.id !== opponent.id) {
          await interaction.reply({ content: 'Doar utilizatorul provocat poate răspunde.', ephemeral: true });
          return;
        }
        resolve({ interaction, accepted: interaction.customId === 'challenge_accept' });
        collector.stop('answered');
      });
      collector.on('end', (_collected, reason) => {
        if (reason !== 'answered') resolve({ timedOut: true });
      });
    });
    await invitation.edit({ components: [buttons([
      { id: 'challenge_accept', label: 'Accept', style: ButtonStyle.Success, disabled: true },
      { id: 'challenge_reject', label: 'Reject', style: ButtonStyle.Danger, disabled: true }
    ])] });
    if (response.timedOut) {
      await invitation.reply(`${opponent} nu a răspuns la timp. Jocul a fost anulat.`);
      return;
    }
    await response.interaction.deferUpdate();
    if (!response.accepted) {
      await invitation.reply(`${opponent} a refuzat provocarea.`);
      return;
    }
    const players = [challenger, opponent].map((user) => ({ id: user.id, username: user.username }));
    ctx.db.reserve(players, wager);
    await invitation.reply({ embeds: [embed('✅ Provocare acceptată',
      `${challenger} și ${opponent} joacă **${game}** pentru **${credits(wager)}** credite fiecare.`, 0x2ecc71)] });
    await GAME_RUNNERS[game]({ channel: ctx.message.channel, players, wager, db: ctx.db });
  } catch (error) {
    await invitation.reply(`❌ Jocul nu a putut începe: ${error.message}`);
  }
}

async function execute(command, ctx) {
  try {
    const guildId = ctx.message.guild?.id;
    if (!guildId) throw new Error('Jocurile de cazino pot fi folosite doar într-un server.');
    const settings = casinoConfig.get(guildId);
    if (!Object.hasOwn(GAME_RUNNERS, command)) throw new Error('Jocul selectat nu există.');
    if (!settings.games[command]) throw new Error(`Jocul ${command} este dezactivat de un administrator.`);

    const game = command;
    const opponent = ctx.message.mentions.users.first();
    const wagerArg = ctx.args.find((arg) => /^\d+$/.test(arg));
    const wager = numberArg(wagerArg, 'Miza');
    if (wager < settings.minBet || wager > settings.maxBet) {
      throw new Error(`Miza trebuie să fie între ${settings.minBet} și ${settings.maxBet} credite.`);
    }
    const runner = GAME_RUNNERS[game];
    const player = ctx.message.author;

    if (opponent) {
      await challenge(ctx, game, opponent, wager);
      return;
    }
    if (ctx.db.getBalance(player.id, player.username) < wager) {
      throw new Error('Nu ai suficiente credite pentru această miză.');
    }
    const players = [{ id: player.id, username: player.username }];
    ctx.db.reserve(players, wager);
    await runner({ channel: ctx.message.channel, players, wager, db: ctx.db });
  } catch (error) {
    await ctx.message.reply(`❌ ${error.message}`);
  }
}

module.exports = { execute };
