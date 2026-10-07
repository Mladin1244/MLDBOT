const { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const welcomeConfig = require('../utils/welcomeConfig');
const { requireAdministrator } = require('../utils/requireAdministrator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disable-welcome')
    .setDescription('Oprește mesajele automate de bun venit în acest server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!(await requireAdministrator(interaction))) return;

    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'Această comandă poate fi folosită doar într-un server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    try {
      const removed = welcomeConfig.remove(interaction.guildId);
      await interaction.reply({
        content: removed
          ? 'Mesajele automate de bun venit au fost dezactivate pentru acest server.'
          : 'Mesajele de bun venit nu erau configurate pentru acest server.',
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Nu am putut dezactiva mesajele de bun venit:', error);
      await interaction.reply({
        content: 'Dezactivarea mesajelor de bun venit a eșuat. Încearcă din nou.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
