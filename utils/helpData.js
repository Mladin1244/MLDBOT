const command = (name, emoji, description, syntax, example, result) => ({
  name, emoji, description, syntax, example, result
});

module.exports = {
  ro: {
    languageName: 'Română',
    title: '🎮 Ajutor GlitchBot',
    selectLanguage: {
      title: '🌍 Selectează limba',
      description: 'Alege limba în care vrei să citești comenzile.',
      timeout: 'A expirat timpul pentru selectarea limbii. Încearcă din nou cu !glitchhelp.'
    },
    languageSelected: '✅ Limba selectată: 🇷🇴 Română',
    timeout: 'Meniul help a expirat.',
    closed: 'Meniul help a fost închis.',
    unauthorized: 'Doar persoana care a cerut help-ul poate folosi aceste controale.',
    menuDescription: 'Selectează o categorie pentru mai multe detalii:',
    footer: (page, total) => `Română • Pagina ${page}/${total}`,
    categoryLabels: {
      economy: '💰 ECONOMIE',
      casino: '🎰 CAZINO SINGLE',
      multiplayer: '🎮 MULTIPLAYER'
    },
    categoryDescriptions: {
      economy: '5 comenzi\nCredite, transfer, recompensă zilnică, clasament și statistici.',
      casino: '3 comenzi\nJoacă împotriva botului: Blackjack, Poker sau Craps.',
      multiplayer: '3 comenzi\nProvoacă jucători la Blackjack, Poker sau Craps.'
    },
    instructions: 'Apasă pe o categorie sau folosește meniul de selecție de mai jos.',
    navigation: { back: 'Înapoi', next: 'Înainte', close: 'Închide', select: 'Alege o categorie', home: 'Meniu principal' },
    economy: [
      command('Credite', '💳', 'Afișează soldul tău curent de credite pe server.', '!credite', '!credite', '✅ Vezi câte credite ai disponibile.'),
      command('Transfer', '💸', 'Trimite credite unui alt jucător de pe server.', '!transfer @utilizator <sumă>', '!transfer @Ion 500', '✅ Creditele sunt mutate în portofelul destinatarului.'),
      command('Recompensă zilnică', '🎁', 'Revendică 100 de credite o dată la 24 de ore.', '!daily', '!daily', '✅ Primești 100 de credite și vezi când poți revendica din nou.'),
      command('Clasament', '🏆', 'Afișează jucătorii ordonați după soldul de credite.', '!leaderboard', '!leaderboard', '🏆 Navighează printre paginile clasamentului.'),
      command('Statistici', '📊', 'Afișează statisticile tale sau ale unui jucător.', '!stats [@utilizator]', '!stats sau !stats @Ion', '📊 Victorii, înfrângeri, profit/pierdere și winrate.')
    ],
    casino: [
      command('Blackjack', '🃏', 'Joacă Blackjack împotriva dealerului cu Hit, Stand sau Double Down.', '!blackjack <miză>', '!blackjack 100', '🃏 Joc interactiv; Blackjack-ul natural plătește 3:2.'),
      command('Poker (5-Card Draw)', '♠️', 'Joacă Poker împotriva dealerului și alege cărțile pe care vrei să le schimbi.', '!poker <miză>', '!poker 250', '♠️ Mâinile sunt clasificate și comparate la showdown.'),
      command('Craps / Barbut', '🎲', 'Joacă împotriva casei și alege Pass Line sau Don’t Pass.', '!craps <miză>', '!craps 500', '🎲 Zarurile se rostogolesc până la stabilirea rezultatului.')
    ],
    multiplayer: [
      command('Blackjack cu jucător', '🃏', 'Provoacă un jucător la Blackjack; ambii mizează aceeași sumă.', '!blackjack @utilizator <miză>', '!blackjack @Ion 100', '🎮 Jucătorul are 30 de secunde să accepte sau să refuze.'),
      command('Poker cu jucător', '♠️', 'Provoacă la 5-Card Draw; cărțile rămân private până la showdown.', '!poker @utilizator <miză>', '!poker @Maria 250', '👥 Schimbați cărțile în DM, apoi comparați mâinile.'),
      command('Craps cu jucător', '🎲', 'Provoacă un jucător la Craps; fiecare alege Pass Line sau Don’t Pass.', '!craps @utilizator <miză>', '!craps @Alex 500', '🎲 Ambii joacă runda, apoi mizele se decontează automat.')
    ]
  },
  en: {
    languageName: 'English',
    title: '🎮 GlitchBot Help',
    selectLanguage: {
      title: '🌍 Select a language',
      description: 'Choose the language you want to read the commands in.',
      timeout: 'Language selection timed out. Try again with !glitchhelp.'
    },
    languageSelected: '✅ Language selected: 🇬🇧 English',
    timeout: 'The help menu has expired.',
    closed: 'The help menu has been closed.',
    unauthorized: 'Only the user who requested help can use these controls.',
    menuDescription: 'Select a category for more details:',
    footer: (page, total) => `English • Page ${page}/${total}`,
    categoryLabels: {
      economy: '💰 ECONOMY',
      casino: '🎰 CASINO SINGLE',
      multiplayer: '🎮 MULTIPLAYER'
    },
    categoryDescriptions: {
      economy: '5 commands\nCredits, transfers, daily reward, leaderboard, and statistics.',
      casino: '3 commands\nPlay against the bot: Blackjack, Poker, or Craps.',
      multiplayer: '3 commands\nChallenge players to Blackjack, Poker, or Craps.'
    },
    instructions: 'Press a category button or use the category selector below.',
    navigation: { back: 'Back', next: 'Next', close: 'Close', select: 'Choose a category', home: 'Main menu' },
    economy: [
      command('Credits', '💳', 'Display your current credit balance on this server.', '!credits', '!credits', '✅ View your available credits.'),
      command('Transfer', '💸', 'Send credits to another player on the server.', '!transfer @user <amount>', '!transfer @Ion 500', '✅ Credits are moved to the recipient’s wallet.'),
      command('Daily Reward', '🎁', 'Claim 100 credits once every 24 hours.', '!daily', '!daily', '✅ Receive 100 credits and see when you can claim again.'),
      command('Leaderboard', '🏆', 'Show players ranked by their credit balance.', '!leaderboard', '!leaderboard', '🏆 Browse through the leaderboard pages.'),
      command('Statistics', '📊', 'Display your game stats or another player’s stats.', '!stats [@user]', '!stats or !stats @Ion', '📊 Wins, losses, profit/loss, and win rate.')
    ],
    casino: [
      command('Blackjack', '🃏', 'Play Blackjack against the dealer with Hit, Stand, or Double Down.', '!blackjack <bet>', '!blackjack 100', '🃏 Interactive game; natural Blackjack pays 3:2.'),
      command('Poker (5-Card Draw)', '♠️', 'Play Poker against the dealer and choose which cards to exchange.', '!poker <bet>', '!poker 250', '♠️ Hands are ranked and compared at showdown.'),
      command('Craps / Dice', '🎲', 'Play against the house and choose Pass Line or Don’t Pass.', '!craps <bet>', '!craps 500', '🎲 The dice roll until the result is decided.')
    ],
    multiplayer: [
      command('Blackjack vs. player', '🃏', 'Challenge a player to Blackjack; both players wager the same amount.', '!blackjack @user <bet>', '!blackjack @Ion 100', '🎮 The challenged player has 30 seconds to accept or decline.'),
      command('Poker vs. player', '♠️', 'Challenge a player to 5-Card Draw; cards stay private until showdown.', '!poker @user <bet>', '!poker @Maria 250', '👥 Exchange cards in DMs, then compare hands.'),
      command('Craps vs. player', '🎲', 'Challenge a player to Craps; each player chooses Pass Line or Don’t Pass.', '!craps @user <bet>', '!craps @Alex 500', '🎲 Both play the round, then bets are settled automatically.')
    ]
  }
};
