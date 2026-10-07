const { MessageFlags, PermissionFlagsBits } = require('discord.js');

async function requireAdministrator(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  const response = {
    content: 'Această comandă poate fi folosită doar de membrii cu permisiunea Administrator.',
    flags: MessageFlags.Ephemeral
  };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(response);
  } else {
    await interaction.reply(response);
  }
  return false;
}

module.exports = { requireAdministrator };
