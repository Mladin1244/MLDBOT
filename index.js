require('dotenv').config();

const { Client, Events, GatewayIntentBits, MessageFlags, Partials } = require('discord.js');
const db = require('./db');
const setupVerifyCommand = require('./commands/setup-verify');
const setupTicketCommand = require('./commands/setup-ticket');
const postCommand = require('./commands/post');
const setupWelcomeCommand = require('./commands/setup-welcome');
const disableWelcomeCommand = require('./commands/disable-welcome');
const setupLevelCommand = require('./commands/setup-level');
const levelSystem = require('./utils/levelSystem');
const serverConfig = require('./utils/serverConfig');
const cloudDashboardSync = require('./utils/cloudDashboardSync');
const { handleTicketInteraction } = require('./ticket-interactions');
const { handlePostInteraction } = require('./post-interactions');

const configuredTokens = [process.env.DISCORD_TOKEN, process.env.TOKEN].filter(Boolean);
if (new Set(configuredTokens).size > 1) {
  throw new Error('DISCORD_TOKEN și TOKEN trebuie să aibă aceeași valoare sau să fie configurată doar una.');
}

const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
if (!token) {
  throw new Error('Configurează DISCORD_TOKEN (sau TOKEN) în fișierul .env.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

require('./events/ready')(client);
require('./events/messageCreate')(client, { db });
require('./events/interactionCreate')(client, { db, prefix: process.env.PREFIX || '!' });
require('./events/inviteTracker')(client);

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === setupTicketCommand.data.name) {
      await handleTicketInteraction(interaction);
      return;
    }
    if (interaction.commandName === postCommand.data.name) {
      await handlePostInteraction(interaction);
      return;
    }
    if (interaction.commandName === setupWelcomeCommand.data.name) {
      await setupWelcomeCommand.execute(interaction);
      return;
    }
    if (interaction.commandName === disableWelcomeCommand.data.name) {
      await disableWelcomeCommand.execute(interaction);
      return;
    }
    if (interaction.commandName === setupLevelCommand.data.name) {
      await setupLevelCommand.execute(interaction);
      return;
    }
    if (interaction.commandName === setupVerifyCommand.data.name) {
      await setupVerifyCommand.execute(interaction);
    }
    return;
  }

  if (await handleTicketInteraction(interaction)) return;
  if (await handlePostInteraction(interaction)) return;
  if (!interaction.isButton() || interaction.customId !== 'verify_button') return;

  if (!interaction.guild) {
    await interaction.reply({
      content: 'Acest buton poate fi folosit doar într-un server. / This button can only be used in a server.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  try {
    const verifyRoleId = serverConfig.get(interaction.guild.id).verifyRoleId;
    if (!verifyRoleId) {
      await interaction.reply({
        content: 'Rolul de verificare nu este configurat. Un administrator trebuie să ruleze /setup-verify.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (member.roles.cache.has(verifyRoleId)) {
      await interaction.reply({
        content: 'Ești deja verificat! / You are already verified!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await member.roles.add(verifyRoleId);
    await interaction.reply({
      content: '✅ Ai fost verificat cu succes! / You have been verified successfully!',
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    console.error('Failed to verify member:', error);
    const errorMessage =
      'Nu am putut să-ți acord rolul. Verifică permisiunile botului și ierarhia rolurilor. / ' +
      "I couldn't assign your role. Check the bot's permissions and role hierarchy.";

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
    }
  }
});

db.initialize();
levelSystem.initialize();
cloudDashboardSync.start();
client.login(token).catch((error) => {
  console.error('Conectarea la Discord a eșuat:', error);
  process.exitCode = 1;
});
