const { EmbedBuilder, ButtonStyle } = require('discord.js');
const { embed, buttons, credits, mention } = require('../utils/discord');

const DAY = 24 * 60 * 60 * 1000;

function targetUser(ctx) {
  return ctx.message.mentions.users.first();
}

function numberArg(value, label = 'Suma') {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`${label} trebuie să fie un număr întreg mai mare decât zero.`);
  }
  return amount;
}

async function leaderboard(ctx) {
  const users = ctx.db.leaderboard();
  const pages = Math.max(1, Math.ceil(users.length / 10));
  let page = 0;
  const render = () => {
    const rows = users.slice(page * 10, page * 10 + 10);
    const body = rows.length
      ? rows.map((user, index) =>
        `**${page * 10 + index + 1}.** ${mention(user.id)} — **${credits(user.credits)}** credite`).join('\n')
      : 'Nu există încă jucători în clasament.';
    const card = embed('🏆 Leaderboard', body, 0xf1c40f)
      .setFooter({ text: `Pagina ${page + 1}/${pages}` });
    return { embeds: [card], components: pages > 1 ? [buttons([
      { id: 'lb_prev', label: 'Anterior', style: ButtonStyle.Primary, disabled: page === 0 },
      { id: 'lb_next', label: 'Următoarea', style: ButtonStyle.Primary, disabled: page === pages - 1 }
    ])] : [] };
  };

  const response = await ctx.message.reply(render());
  if (pages < 2) return;
  const collector = response.createMessageComponentCollector({ time: 120000 });
  collector.on('collect', async (interaction) => {
    if (interaction.user.id !== ctx.message.author.id) {
      await interaction.reply({ content: 'Doar persoana care a deschis clasamentul îl poate controla.', ephemeral: true });
      return;
    }
    page += interaction.customId === 'lb_next' ? 1 : -1;
    await interaction.update(render());
  });
  collector.on('end', () => response.edit({ components: [] }).catch(console.error));
}

async function showStats(ctx) {
  const user = targetUser(ctx) || ctx.message.author;
  const data = ctx.db.getUser(user.id, user.username);
  const games = data.stats.wins + data.stats.losses + data.stats.pushes;
  const rate = games ? ((data.stats.wins / games) * 100).toFixed(1) : '0.0';
  const card = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`📊 Statistici — ${user.username}`)
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: 'Credite', value: credits(data.credits), inline: true },
      { name: 'Victorii', value: String(data.stats.wins), inline: true },
      { name: 'Înfrângeri', value: String(data.stats.losses), inline: true },
      { name: 'Egaluri', value: String(data.stats.pushes), inline: true },
      { name: 'Profit / pierdere', value: `${data.stats.profit >= 0 ? '+' : ''}${credits(data.stats.profit)}`, inline: true },
      { name: 'Winrate', value: `${rate}%`, inline: true }
    )
    .setTimestamp();
  await ctx.message.reply({ embeds: [card] });
}

async function execute(command, ctx) {
  try {
    if (command === 'credite') {
      const balance = ctx.db.getBalance(ctx.message.author.id, ctx.message.author.username);
      await ctx.message.reply({ embeds: [embed('💰 Portofel', `Ai **${credits(balance)}** credite.` , 0x2ecc71)] });
    } else if (command === 'transfer') {
      const recipient = targetUser(ctx);
      if (!recipient || recipient.bot || recipient.id === ctx.message.author.id) {
        throw new Error('Menționează un alt utilizator uman: `!transfer @utilizator <sumă>`.');
      }
      const amount = numberArg(ctx.args.find((arg) => /^\d+$/.test(arg)));
      ctx.db.transfer(
        ctx.message.author.id, ctx.message.author.username,
        recipient.id, recipient.username, amount
      );
      await ctx.message.reply({ embeds: [embed('✅ Transfer efectuat',
        `${mention(ctx.message.author.id)} a trimis **${credits(amount)}** credite către ${mention(recipient.id)}.`, 0x2ecc71)] });
    } else if (command === 'daily') {
      const result = ctx.db.daily(ctx.message.author.id, ctx.message.author.username, Date.now(), DAY);
      if (!result.claimed) {
        await ctx.message.reply(`Ai revendicat deja recompensa. Poți reveni <t:${Math.ceil(result.nextAt / 1000)}:R> ( <t:${Math.ceil(result.nextAt / 1000)}:t> ).`);
        return;
      }
      await ctx.message.reply({ embeds: [embed('🎁 Recompensa zilnică',
        `Ai primit **100** credite! Următoarea recompensă: <t:${Math.ceil(result.nextAt / 1000)}:R>.`, 0x2ecc71)] });
    } else if (command === 'leaderboard') {
      await leaderboard(ctx);
    } else if (command === 'stats') {
      await showStats(ctx);
    }
  } catch (error) {
    await ctx.message.reply(`❌ ${error.message}`);
  }
}

module.exports = { execute, numberArg };
