const { REST, Routes } = require('discord.js');
const { commands: casinoCommands } = require('../interactions/commands');
const setupVerifyCommand = require('../commands/setup-verify');
const setupTicketCommand = require('../commands/setup-ticket');
const postCommand = require('../commands/post');
const setupWelcomeCommand = require('../commands/setup-welcome');
const disableWelcomeCommand = require('../commands/disable-welcome');
const setupLevelCommand = require('../commands/setup-level');

const commands = [
  ...casinoCommands,
  setupVerifyCommand,
  setupTicketCommand,
  postCommand,
  setupWelcomeCommand,
  disableWelcomeCommand,
  setupLevelCommand
];

async function registerCommands({ token, applicationId, guildId }) {
  if (!token || !applicationId) {
    throw new Error('Lipsesc tokenul Discord sau ID-ul aplicației pentru înregistrarea comenzilor slash.');
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(applicationId, guildId)
    : Routes.applicationCommands(applicationId);

  await rest.put(route, { body: commands.map((entry) => entry.data.toJSON()) });
  return commands.length;
}

module.exports = { commands, registerCommands };
