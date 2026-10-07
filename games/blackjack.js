const { ButtonStyle } = require('discord.js');
const { shuffledDeck, cardText } = require('./cards');
const { embed, buttons, credits, mention } = require('../utils/discord');

function value(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.value === 14) {
      total += 11;
      aces += 1;
    } else if (card.value > 10) total += 10;
    else total += card.value;
  }
  while (total > 21 && aces) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function natural(hand) {
  return hand.length === 2 && value(hand) === 21;
}

function playerLabel(player) {
  return mention(player.id);
}

async function action(channel, player, wager, hand, dealer, allowDouble) {
  const choices = [
    { id: 'bj_hit', label: 'Hit', style: ButtonStyle.Primary, emoji: '➕' },
    { id: 'bj_stand', label: 'Stand', style: ButtonStyle.Secondary, emoji: '✋' }
  ];
  if (allowDouble) choices.push({ id: 'bj_double', label: 'Double Down', style: ButtonStyle.Success, emoji: '💰' });
  const gameMessage = await channel.send({
    embeds: [embed('🃏 Blackjack',
      `${playerLabel(player)} — miza curentă: **${credits(wager)}**\n**Mâna ta (${value(hand)}):** ${cardText(hand)}\n**Dealer:** ${dealer[0].text}  🂠`, 0x3498db)],
    components: [buttons(choices)]
  });
  const collector = gameMessage.createMessageComponentCollector({ time: 120000 });
  return new Promise((resolve) => {
    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== player.id) {
        await interaction.reply({ content: 'Nu este rândul tău.', ephemeral: true });
        return;
      }
      await interaction.deferUpdate();
      const choice = interaction.customId;
      resolve(choice);
      collector.stop('played');
    });
    collector.on('end', () => {
      gameMessage.edit({ components: [] }).catch(console.error);
      resolve('bj_stand');
    });
  });
}

function outcome(playerHand, dealerHand) {
  const playerScore = value(playerHand);
  const dealerScore = value(dealerHand);
  const playerNatural = natural(playerHand);
  const dealerNatural = natural(dealerHand);
  if (playerNatural && dealerNatural) return 'push';
  if (playerNatural) return 'natural';
  if (dealerNatural || playerScore > 21) return 'loss';
  if (dealerScore > 21 || playerScore > dealerScore) return 'win';
  if (playerScore < dealerScore) return 'loss';
  return 'push';
}

function payoutFor(result, wager) {
  if (result === 'natural') return wager * 2.5;
  if (result === 'win') return wager * 2;
  if (result === 'push') return wager;
  return 0;
}

async function runBlackjack({ channel, players, wager, db }) {
  let stakes = players.map(() => wager);
  let settled = false;
  try {
    const deck = shuffledDeck();
    const hands = players.map(() => [deck.pop(), deck.pop()]);
    const dealer = [deck.pop(), deck.pop()];

    if (players.length === 1) {
      let doubled = false;
      if (!natural(hands[0]) && !natural(dealer)) {
        while (value(hands[0]) < 21) {
          const current = hands[0];
          const choice = await action(channel, players[0], stakes[0], current, dealer,
            current.length === 2 && !doubled && db.getBalance(players[0].id, players[0].username) >= wager);
          if (choice === 'bj_hit') current.push(deck.pop());
          else if (choice === 'bj_double') {
            try {
              db.reserve([players[0]], wager);
              stakes[0] += wager;
              doubled = true;
              current.push(deck.pop());
            } catch (error) {
              await channel.send(`Nu poți dubla: ${error.message}`);
              continue;
            }
            break;
          } else break;
        }
      }
      while (value(dealer) < 17) dealer.push(deck.pop());
      const result = outcome(hands[0], dealer);
      const payout = payoutFor(result, stakes[0]);
      const stat = result === 'natural' || result === 'win' ? 'win' : result;
      db.settle([{ ...players[0], amount: payout, result: stat, profit: payout - stakes[0] }]);
      settled = true;
      const detail = result === 'natural' ? 'Blackjack natural! Plată 3:2.'
        : result === 'win' ? 'Ai câștigat!'
          : result === 'push' ? 'Egalitate — miza a fost returnată.'
            : 'Dealerul a câștigat.';
      await channel.send({ embeds: [embed('🃏 Rezultat Blackjack',
        `**Tu (${value(hands[0])}):** ${cardText(hands[0])}\n**Dealer (${value(dealer)}):** ${cardText(dealer)}\n${detail}\nDecontare: **${credits(payout)}** credite.`, 0x2ecc71)] });
      return;
    }

    const dealerHasNatural = natural(dealer);
    const active = hands.map((hand) => !dealerHasNatural && !natural(hand));
    for (let index = 0; index < players.length; index += 1) {
      if (!active[index]) continue;
      while (value(hands[index]) < 21) {
        const choice = await action(channel, players[index], wager, hands[index], dealer, false);
        if (choice !== 'bj_hit') break;
        hands[index].push(deck.pop());
      }
    }
    while (value(dealer) < 17) dealer.push(deck.pop());
    const dealerNatural = natural(dealer);
    const entries = players.map((player, index) => {
      const hand = hands[index];
      const gameResult = outcome(hand, dealer);
      const result = gameResult === 'natural' ? 'win' : gameResult;
      const payout = payoutFor(gameResult, wager);
      return { ...player, amount: payout, result, profit: payout - wager, hand, natural: natural(hand), dealerNatural };
    });
    db.settle(entries);
    settled = true;
    const resultLines = entries.map((entry) => {
      const outcomeText = entry.natural && !entry.dealerNatural ? 'Blackjack natural' :
        entry.result === 'win' ? 'Victorie' : entry.result === 'loss' ? 'Înfrângere' : 'Egalitate';
      return `${playerLabel(entry)}: **${cardText(entry.hand)}** (${value(entry.hand)}) — ${outcomeText}`;
    }).join('\n');
    await channel.send({ embeds: [embed('🃏 Showdown Blackjack',
      `${resultLines}\n**Dealer:** ${cardText(dealer)} (${value(dealer)})\nMiza: **${credits(wager)}** credite fiecare.`, 0x2ecc71)] });
  } catch (error) {
    if (!settled) {
      db.settle(players.map((player, index) => ({
        ...player, amount: stakes[index], result: 'push', profit: 0
      })));
    }
    throw error;
  }
}

module.exports = { runBlackjack, value, payoutFor };
