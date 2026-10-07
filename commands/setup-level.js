const {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} = require('discord.js');
const fs = require('node:fs');
const levelSystem = require('../utils/levelSystem');
const serverConfig = require('../utils/serverConfig');
const cloudDashboardSync = require('../utils/cloudDashboardSync');
const { requireAdministrator } = require('../utils/requireAdministrator');

const IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp']
]);
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

async function downloadImage(attachment) {
  const type = attachment.contentType?.split(';')[0].toLowerCase();
  const extension = IMAGE_TYPES.get(type);
  if (!extension || attachment.size > MAX_IMAGE_SIZE) {
    throw new Error('Imaginea trebuie să fie JPEG, PNG, GIF sau WebP și să aibă maximum 8 MB.');
  }

  const url = new URL(attachment.url);
  if (url.protocol !== 'https:' ||
      !['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname)) {
    throw new Error('Încarcă imaginea direct în Discord.');
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Descărcarea imaginii a eșuat (HTTP ${response.status}).`);
  const responseType = response.headers.get('content-type')?.split(';')[0].toLowerCase();
  if (responseType !== type) throw new Error('Tipul imaginii încărcate nu este valid.');

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_IMAGE_SIZE) throw new Error('Imaginea trebuie să aibă maximum 8 MB.');
  return { buffer, extension };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-level')
    .setDescription('Configurează canalul și imaginea mesajelor de level-up.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) => option
      .setName('canal')
      .setDescription('Canalul unde se anunță creșterea de level.')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true))
    .addAttachmentOption((option) => option
      .setName('imagine')
      .setDescription('Banner opțional; implicit se folosește imaginea MLDBOT.')
      .setRequired(false)),

  async execute(interaction) {
    if (!(await requireAdministrator(interaction))) return;
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'Această comandă poate fi folosită doar într-un server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    let savedImage;
    let configSaved = false;
    try {
      const channel = interaction.options.getChannel('canal');
      const attachment = interaction.options.getAttachment('imagine');
      const previousImage = serverConfig.get(interaction.guildId).levelImageFile;

      if (attachment) {
        const image = await downloadImage(attachment);
        savedImage = levelSystem.storeImage(
          interaction.guildId,
          image.buffer,
          image.extension
        );
      }

      const patch = {
        levelChannelId: channel.id,
        levelImageFile: savedImage?.filename || null
      };
      serverConfig.update(interaction.guildId, patch);
      await cloudDashboardSync.pushServerPatch(interaction.guildId, patch);
      configSaved = true;

      if (previousImage && previousImage !== savedImage?.filename) {
        fs.rmSync(levelSystem.getImagePath(previousImage), { force: true });
      }

      await interaction.editReply(
        attachment
          ? `Canalul de level-up este ${channel}; bannerul încărcat a fost salvat.`
          : `Canalul de level-up este ${channel}; se va folosi bannerul MLDBOT implicit.`
      );
    } catch (error) {
      if (savedImage && !configSaved) fs.rmSync(savedImage.imagePath, { force: true });
      console.error('Nu am putut configura sistemul de level:', error);
      await interaction.editReply(error.message || 'Configurarea sistemului de level a eșuat.');
    }
  }
};
