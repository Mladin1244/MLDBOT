const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { shuffledDeck, cardText } = require('./cards');
const { evaluateHand, compareHands } = require('./handRanking');
const { embed, buttons, credits, mention } = require('../utils/discord');

function rows(selected) {
  const cardRow = new ActionRowBuilder().addComponents(Array.from({ length: 5 }, (_, index) =>
    new ButtonBuilder()
      .setCustomId(`poker_card_${index}`)
      .setLabel(`${index + 1}${selected.has(index) ? ' ✓' : ''}`)
      .setStyle(selected.has(index) ? ButtonStyle.Primary : ButtonStyle.Secondary)));
  const drawRow = buttons([{ id: 'poker_draw', label: 'Schimbă cărțile selectate', style: ButtonStyle.Success, emoji: '🔄' }]);
  return [cardRow, drawRow];
}

async function chooseDiscards(channel, player, hand, privateCards) {
  const selected = new Set();
  const cardMessage = await channel.send({
    embeds: [embed('♠️ 5-Card Draw',
      `${privateCards ? 'Alege în DM cărțile pe care vrei să le schimbi.' : 'Selectează până la 5 cărți, apoi apasă Schimbă.'}\n**Mâna ta:** ${cardText(hand)}`, 0x9b59b6)],
    components: rows(selected)
  });
  const collector = cardMessage.createMessageComponentCollector({ time: 120000 });
  return new Promise((resolve) => {
    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== player.id) {
        await interaction.reply({ content: 'Această mână nu îți aparține.', ephemeral: true });
        return;
      }
      if (interaction.customId === 'poker_draw') {
        await interaction.deferUpdate();
        resolve([...selected]);
        collector.stop('draw');
        return;
      }
      const index = Number(interaction.customId.slice('poker_card_'.length));
      if (selected.has(index)) selected.delete(index);
      else selected.add(index);
      await interaction.update({ components: rows(selected) });
    });
    collector.on('end', () => {
      cardMessage.edit({ components: [] }).catch(console.error);
      resolve([]);
    });
  });
}

function dealerDiscards(hand) {
  const ranked = evaluateHand(hand);
  if (ranked.rank >= 4) return [];
  const counts = new Map();
  for (const card of hand) counts.set(card.value, (counts.get(card.value) || 0) + 1);
  const heldValues = new Set([...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value));
  if (heldValues.size === 0) {
    const high = [...hand].sort((a, b) => b.value - a.value).slice(0, 1)[0];
    heldValues.add(high.value);
  }
  return hand.map((card, index) => heldValues.has(card.value) ? -1 : index).filter((index) => index >= 0);
}

function replaceCards(hand, indexes, deck) {
  for (const index of indexes) hand[index] = deck.pop();
}

async function runPoker({ channel, players, wager, db }) {
  let settled = false;
  try {
    const deck = shuffledDeck();
    const hands = players.map(() => Array.from({ length: 5 }, () => deck.pop()));
    let selected;
    if (players.length === 1) {
      selected = await chooseDiscards(channel, players[0], hands[0], false);
    } else {
      const privateChannels = await Promise.all(players.map(async (player) => {
        const user = await channel.client.users.fetch(player.id);
        return user.createDM();
      }));
      selected = await Promise.all(players.map((player, index) =>
        chooseDiscards(privateChannels[index], player, hands[index], true)));
    }
    selected.forEach((indexes, index) => replaceCards(hands[index], indexes, deck));

    let dealer;
    if (players.length === 1) {
      dealer = Array.from({ length: 5 }, () => deck.pop());
      replaceCards(dealer, dealerDiscards(dealer), deck);
    }

    const entries = players.length === 1
      ? (() => {
        const comparison = compareHands(hands[0], dealer);
        const result = comparison > 0 ? 'win' : comparison < 0 ? 'loss' : 'push';
        const amount = result === 'win' ? wager * 2 : result === 'push' ? wager : 0;
        return [{ ...players[0], amount, result, profit: amount - wager }];
      })()
      : (() => {
        const comparison = compareHands(hands[0], hands[1]);
        return players.map((player, index) => {
          const result = comparison === 0 ? 'push' : (comparison > 0) === (index === 0) ? 'win' : 'loss';
          const amount = result === 'win' ? wager * 2 : result === 'push' ? wager : 0;
          return { ...player, amount, result, profit: amount - wager };
        });
      })();
    db.settle(entries);
    settled = true;

    const handLines = players.map((player, index) => {
      const rank = evaluateHand(hands[index]).label;
      return `${mention(player.id)}: **${cardText(hands[index])}** — **${rank}**`;
    });
    if (dealer) handLines.push(`🤖 Dealer: **${cardText(dealer)}** — **${evaluateHand(dealer).label}**`);
    const outcome = entries.map((entry) =>
      `${mention(entry.id)} ${entry.result === 'win' ? 'a câștigat' : entry.result === 'loss' ? 'a pierdut' : 'a făcut egalitate'} (${entry.result === 'win' ? '+' : entry.result === 'loss' ? '-' : '±'}${credits(entry.result === 'push' ? 0 : wager)} credite net)`).join('\n');
    await channel.send({ embeds: [embed('♠️ Showdown — 5-Card Draw',
      `${handLines.join('\n')}\n\n${outcome}`, 0x9b59b6)] });
  } catch (error) {
    if (!settled) db.settle(players.map((player) => ({
      ...player, amount: wager, result: 'push', profit: 0
    })));
    throw error;
  }
}

module.exports = { runPoker, dealerDiscards };
