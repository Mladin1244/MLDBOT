const { SlashCommandBuilder } = require('discord.js');
const { presentHelp } = require('../../utils/help');

const data = new SlashCommandBuilder()
  .setName('glitchhelp')
  .setDescription('Show the GlitchBot help menu in your preferred language.')
  .addStringOption((option) =>
    option
      .setName('category')
      .setDescription('Choose a help category.')
      .setRequired(false)
      .addChoices(
        { name: '💰 Economy', value: 'economy' },
        { name: '🎰 Casino Single', value: 'casino' },
        { name: '🎮 Multiplayer', value: 'multiplayer' }
      ))
  .addStringOption((option) =>
    option
      .setName('language')
      .setDescription('Choose your preferred help language.')
      .setRequired(false)
      .addChoices(
        { name: '🇷🇴 Română', value: 'ro' },
        { name: '🇬🇧 English', value: 'en' }
      ))
  .addBooleanOption((option) =>
    option
      .setName('switch')
      .setDescription('Show the language selector again.')
      .setRequired(false));

async function execute(interaction, { client, prefix, db }) {
  const category = interaction.options.getString('category');
  const language = interaction.options.getString('language');
  const switchLanguage = interaction.options.getBoolean('switch') || false;
  await presentHelp({
    source: interaction,
    category,
    language,
    client,
    prefix,
    db,
    switchLanguage,
    slash: true
  });
}

module.exports = { data, execute };
