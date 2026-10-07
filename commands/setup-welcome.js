const {
  AttachmentBuilder,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} = require('discord.js');
const welcomeConfig = require('../utils/welcomeConfig');
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
  const imageType = attachment.contentType?.split(';')[0].toLowerCase();
  const extension = IMAGE_TYPES.get(imageType);
  if (!extension || attachment.size > MAX_IMAGE_SIZE) {
    throw new Error('Alege o imagine JPEG, PNG, GIF sau WebP de cel mult 8 MB.');
  }

  const imageUrl = new URL(attachment.url);
  if (imageUrl.protocol !== 'https:' ||
      !['cdn.discordapp.com', 'media.discordapp.net'].includes(imageUrl.hostname)) {
    throw new Error('Imaginea trebuie încărcată direct în Discord.');
  }

  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`Descărcarea imaginii încărcate a eșuat (HTTP ${response.status}).`);
  }

  const responseType = response.headers.get('content-type')?.split(';')[0].toLowerCase();
  if (responseType !== imageType) {
    throw new Error('Tipul imaginii primite de la Discord nu corespunde fișierului încărcat.');
  }
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE) {
    throw new Error('Imaginea trebuie să aibă cel mult 8 MB.');
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());
  if (imageBuffer.length > MAX_IMAGE_SIZE) {
    throw new Error('Imaginea trebuie să aibă cel mult 8 MB.');
  }
  return { imageBuffer, imageExtension: extension };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-welcome')
    .setDescription('Configurează canalul și imaginea mesajului de bun venit.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) => option
      .setName('canal')
      .setDescription('Canalul unde va apărea mesajul de bun venit.')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true))
    .addAttachmentOption((option) => option
      .setName('imagine')
      .setDescription('Imagine opțională pentru banner; implicit se folosește imaginea MLDBOT.')
      .setRequired(false)),

  async execute(interaction) {
    if (!(await requireAdministrator(interaction))) return;

    try {
      if (!interaction.inGuild()) {
        await interaction.reply({
          content: 'Această comandă poate fi folosită doar într-un server.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const channel = interaction.options.getChannel('canal');
      const image = interaction.options.getAttachment('imagine');
      const uploadedImage = image ? await downloadImage(image) : {};
      await welcomeConfig.set(interaction.guildId, {
        channelId: channel.id,
        ...uploadedImage
      });
      const previous = serverConfig.get(interaction.guildId).welcome || {};
      const types = Object.fromEntries(
        ['normal', 'vanity', 'unknown', 'bot'].map((type) => [type, {
          messageText: type === 'normal'
            ? '%member_mention% a fost invitat de %inviter% și are acum %inviter_invites% invitații.'
            : '',
          embedEnabled: type === 'normal',
          embedJson: {
            title: '',
            description: type === 'normal'
              ? '%member_mention% a fost invitat de %inviter% și are acum %inviter_invites% invitații.'
              : '',
            color: '#5865f2',
            footer: '',
            thumbnailMember: true,
            imageBanner: true
          },
          bannerEnabled: type === 'normal',
          bannerLayers: [],
          bannerImageKey: null,
          ...(previous.types?.[type] || {})
        }])
      );
      await cloudDashboardSync.pushServerPatch(interaction.guildId, {
        welcome: {
          enabled: true,
          channelId: channel.id,
          emoji: previous.emoji || '',
          types
        }
      });

      await interaction.editReply({
        content: image
          ? `Mesajele de bun venit vor fi trimise în ${channel}, folosind imaginea încărcată.`
          : `Mesajele de bun venit vor fi trimise în ${channel}, folosind bannerul MLDBOT implicit.`
      });
    } catch (error) {
      console.error('Nu am putut configura mesajul de bun venit:', error);
      const reply = {
        content: error.message || 'Configurarea mesajului de bun venit a eșuat. Încearcă din nou.',
        flags: MessageFlags.Ephemeral
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  }
};
