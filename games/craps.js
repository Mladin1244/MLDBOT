const { ButtonStyle } = require('discord.js');
const { embed, buttons, credits, mention } = require('../utils/discord');

const FACE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function roll() {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  return { die1, die2, total: die1 + die2 };
}

async function chooseLine(channel, player) {
  const prompt = await channel.send({
    embeds: [embed('🎲 Craps — Pass Line',
      `${mention(player.id)}, alege tipul pariului tău:`, 0xe67e22)],
    components: [buttons([
      { id: 'craps_pass', label: 'Pass Line', style: ButtonStyle.Success, emoji: '✅' },
      { id: 'craps_dont', label: "Don't Pass", style: ButtonStyle.Danger, emoji: '🚫' }
    ])]
  });
  const collector = prompt.createMessageComponentCollector({ time: 60000 });
  return new Promise((resolve) => {
    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== player.id) {
        await interaction.reply({ content: 'Nu este rândul tău.', ephemeral: true });
        return;
      }
      const pass = interaction.customId === 'craps_pass';
      await interaction.update({
        embeds: [embed('🎲 Pariul selectat', `${mention(player.id)} a ales ${pass ? '**Pass Line**' : "**Don't Pass**"}.`, 0xe67e22)],
        components: []
      });
      resolve(pass);
      collector.stop('selected');
    });
    collector.on('end', () => {
      prompt.edit({ components: [] }).catch(console.error);
      resolve(null);
    });
  });
}

async function playLine(channel, player, pass, round) {
  const comeOut = roll();
  await channel.send({ embeds: [embed('🎲 Come Out Roll',
    `${mention(player.id)} — ${FACE[comeOut.die1 - 1]} + ${FACE[comeOut.die2 - 1]} = **${comeOut.total}**`, 0xe67e22)] });
  await wait(700);

  let result;
  let point = null;
  let rolls = 1;
  if (pass) {
    if ([7, 11].includes(comeOut.total)) result = 'win';
    else if ([2, 3, 12].includes(comeOut.total)) result = 'loss';
  } else {
    if ([2, 3].includes(comeOut.total)) result = 'win';
    else if (comeOut.total === 12) result = 'push';
    else if ([7, 11].includes(comeOut.total)) result = 'loss';
  }
  point = result ? null : comeOut.total;

  while (!result) {
    const next = roll();
    rolls += 1;
    await channel.send({ embeds: [embed(`🎲 Roll #${rolls} — Point ${point}`,
      `${mention(player.id)} — ${FACE[next.die1 - 1]} + ${FACE[next.die2 - 1]} = **${next.total}**`, 0xe67e22)] });
    await wait(400);
    if (pass) {
      if (next.total === point) result = 'win';
      else if (next.total === 7) result = 'loss';
    } else {
      if (next.total === 7) result = 'win';
      else if (next.total === point) result = 'loss';
    }
  }
  return { result, point, rolls, pass, comeOut };
}

async function runCraps({ channel, players, wager, db }) {
  let settled = false;
  try {
    const lines = [];
    for (const player of players) lines.push(await chooseLine(channel, player));
    if (lines.some((line) => line === null)) {
      throw new Error('Alegerea Pass Line a expirat; pariurile au fost returnate.');
    }
    const rounds = [];
    for (let index = 0; index < players.length; index += 1) {
      rounds.push(await playLine(channel, players[index], lines[index], index + 1));
    }
    const entries = players.map((player, index) => {
      const result = rounds[index].result;
      const amount = result === 'win' ? wager * 2 : result === 'push' ? wager : 0;
      return { ...player, amount, result, profit: amount - wager };
    });
    db.settle(entries);
    settled = true;
    const summary = entries.map((entry, index) => {
      const round = rounds[index];
      const line = round.pass ? 'Pass Line' : "Don't Pass";
      const result = entry.result === 'win' ? 'victorie' : entry.result === 'loss' ? 'înfrângere' : 'push (12 la come-out)';
      return `${mention(entry.id)} — **${line}**, ${round.rolls} roll(s), ${round.point ? `point ${round.point}, ` : ''}${result}.`;
    }).join('\n');
    await channel.send({ embeds: [embed('🎲 Rezultate Craps',
      `${summary}\nMiza fiecărui jucător: **${credits(wager)}** credite.`, 0xe67e22)] });
  } catch (error) {
    if (!settled) db.settle(players.map((player) => ({
      ...player, amount: wager, result: 'push', profit: 0
    })));
    throw error;
  }
}

module.exports = { runCraps, playLine };
