const { SlashCommandBuilder } = require('discord.js');
const economy = require('../../commands/economy');
const admin = require('../../commands/admin');
const casino = require('../../commands/casino');
const glitchhelp = require('./glitchhelp');
const leveling = require('../../commands/leveling');

function command(name, description) {
  return new SlashCommandBuilder().setName(name).setDescription(description);
}

function amountOption(optionName, description) {
  return (option) => option
    .setName(optionName)
    .setDescription(description)
    .setMinValue(1)
    .setRequired(true);
}

const commands = [
  {
    data: command('credite', 'Afișează soldul tău de credite.'),
    execute: (interaction, services) => executeEconomy('credite', interaction, services)
  },
  {
    data: command('credits', 'Show your current credit balance.'),
    execute: (interaction, services) => executeEconomy('credite', interaction, services)
  },
  {
    data: command('transfer', 'Transferă credite altui jucător.')
      .addUserOption((option) => option.setName('user').setDescription('Destinatarul').setRequired(true))
      .addIntegerOption(amountOption('amount', 'Numărul de credite de transferat.')),
    execute: (interaction, services) => executeEconomy('transfer', interaction, services, ['user', 'amount'])
  },
  {
    data: command('daily', 'Revendică recompensa zilnică de 100 credite.'),
    execute: (interaction, services) => executeEconomy('daily', interaction, services)
  },
  {
    data: command('leaderboard', 'Afișează clasamentul jucătorilor după credite.'),
    execute: (interaction, services) => executeEconomy('leaderboard', interaction, services)
  },
  {
    data: command('stats', 'Afișează statisticile de joc ale unui utilizator.')
      .addUserOption((option) => option.setName('user').setDescription('Utilizatorul (implicit: tu)').setRequired(false)),
    execute: (interaction, services) => executeEconomy('stats', interaction, services, ['user'])
  },
  ...['blackjack', 'poker', 'craps'].map((game) => ({
    data: command(game, `Joacă ${game} cu credite.`)
      .addIntegerOption(amountOption('bet', 'Miza jocului.'))
      .addUserOption((option) => option.setName('opponent').setDescription('Provocă un jucător (opțional)').setRequired(false)),
    execute: (interaction, services) => executeCasino(game, interaction, services)
  })),
  {
    data: command('admin_add_credits', 'Adaugă credite unui utilizator.')
      .addUserOption((option) => option.setName('user').setDescription('Utilizatorul').setRequired(true))
      .addIntegerOption(amountOption('amount', 'Credite de adăugat.')),
    execute: (interaction, services) => executeAdmin('admin_add_credits', interaction, services, true)
  },
  {
    data: command('admin_remove_credits', 'Elimină credite de la un utilizator.')
      .addUserOption((option) => option.setName('user').setDescription('Utilizatorul').setRequired(true))
      .addIntegerOption(amountOption('amount', 'Credite de eliminat.')),
    execute: (interaction, services) => executeAdmin('admin_remove_credits', interaction, services, true)
  },
  {
    data: command('admin_reset', 'Resetează contul utilizatorului la 1.000 credite.')
      .addUserOption((option) => option.setName('user').setDescription('Utilizatorul').setRequired(true)),
    execute: (interaction, services) => executeAdmin('admin_reset', interaction, services, false)
  },
  glitchhelp,
  ...leveling.commands
];

function createMessageAdapter(interaction, args, target = null) {
  return {
    author: interaction.user,
    member: interaction.member,
    channel: interaction.channel,
    guild: interaction.guild,
    mentions: { users: { first: () => target || null } },
    reply: async (payload) => {
      if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
      return interaction.reply(payload);
    },
    args
  };
}

async function executeEconomy(action, interaction, services, optionNames = []) {
  const args = optionNames.map((name) => {
    if (name === 'amount') return String(interaction.options.getInteger(name));
    if (name === 'user') return interaction.options.getUser(name);
    return null;
  }).filter(Boolean);
  const target = action === 'transfer'
    ? interaction.options.getUser('user')
    : action === 'stats' ? interaction.options.getUser('user') : null;
  const message = createMessageAdapter(interaction, args, target);
  await economy.execute(action, {
    ...services,
    message,
    args,
    prefix: process.env.PREFIX || '!'
  });
}

async function executeAdmin(action, interaction, services, hasAmount) {
  const user = interaction.options.getUser('user');
  const args = hasAmount ? [String(interaction.options.getInteger('amount'))] : [];
  const message = createMessageAdapter(interaction, args, user);
  await admin.execute(action, {
    ...services,
    message,
    args,
    prefix: process.env.PREFIX || '!'
  });
}

async function executeCasino(game, interaction, services) {
  const wager = interaction.options.getInteger('bet');
  const opponent = interaction.options.getUser('opponent');
  await interaction.deferReply();
  await interaction.editReply(`🎲 Comanda **/${game}** a fost primită. Rezultatele jocului vor apărea în acest canal.`);
  const args = [String(wager)];
  const message = createMessageAdapter(interaction, args, opponent);
  await casino.execute(game, {
    ...services,
    message,
    args,
    prefix: process.env.PREFIX || '!'
  });
}

const commandsByName = new Map(commands.map((entry) => [entry.data.name, entry]));

module.exports = {
  commands,
  commandsByName
};
