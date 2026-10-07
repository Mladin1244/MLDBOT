const { AttachmentBuilder, EmbedBuilder, Events, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { InviteTracker } = require('../utils/inviteTracker');
const { memberMessageVariables, replaceMessageVariables } = require('../utils/messageVariables');
const { renderBanner } = require('../utils/bannerRenderer');
const serverConfig = require('../utils/serverConfig');
const welcomeConfig = require('../utils/welcomeConfig');

const tracker = new InviteTracker();
const welcomeImagePath = path.join(__dirname, '..', 'assets', 'mldbot-banner.jpg');

function logMissingPermissions(member, channel, names) {
  const me = member.guild.members.me;
  const permissions = channel.permissionsFor(me);
  const missing = names.filter((name) => !permissions?.has(PermissionFlagsBits[name]));
  if (missing.length) {
    console.error(`Mesajul automat nu poate fi trimis în canalul ${channel.id} din serverul ${member.guild.id}; lipsesc permisiunile: ${missing.join(', ')}.`);
  }
  return missing;
}

async function messagePayload(module, config, type, member, attribution, canAttach) {
  const selected = config.types?.[type] || config.types?.normal;
  if (!selected) throw new Error(`Nu există conținut configurat pentru tipul ${type}.`);
  const variables = memberMessageVariables(member, attribution);
  const messageText = replaceMessageVariables(selected.messageText || '', variables);
  const files = [];
  if (selected.bannerEnabled && canAttach) {
    const image = await renderBanner(member.guild.id, selected, member, variables, module);
    files.push(new AttachmentBuilder(image, { name: `${module}-banner.png` }));
  }
  const payload = {
    allowedMentions: {
      parse: [],
      users: [member.id, ...(attribution.inviterId ? [attribution.inviterId] : [])],
      roles: [],
      repliedUser: false
    },
    files
  };

  if (selected.embedEnabled) {
    const embed = selected.embedJson || {};
    const description = replaceMessageVariables(embed.description || messageText, variables);
    const builder = new EmbedBuilder()
      .setColor(Number.parseInt((embed.color || '#5865f2').slice(1), 16))
      .setDescription(description);
    if (embed.thumbnailMember !== false) builder.setThumbnail(member.user.displayAvatarURL());
    if (embed.title) builder.setTitle(replaceMessageVariables(embed.title, variables));
    if (embed.footer) builder.setFooter({ text: replaceMessageVariables(embed.footer, variables) });
    if (selected.bannerEnabled && canAttach && embed.imageBanner !== false) {
      builder.setImage(`attachment://${module}-banner.png`);
    }
    payload.embeds = [builder];
  } else {
    payload.content = messageText;
  }
  return payload;
}

async function sendConfiguredMessage(member, module, attribution = {}) {
  const guildSettings = serverConfig.get(member.guild.id);
  const settings = guildSettings[module];
  let legacyWelcome = null;
  if (!settings && module === 'welcome') legacyWelcome = welcomeConfig.get(member.guild.id);
  if (!settings?.enabled && !legacyWelcome) return;
  if (settings && (!settings.enabled || !settings.channelId)) return;

  const channelId = settings?.channelId || legacyWelcome.channelId;
  let channel;
  try {
    channel = await member.guild.channels.fetch(channelId);
  } catch (error) {
    console.error(`Nu am putut încărca canalul configurat pentru ${module} (${channelId}) în serverul ${member.guild.id}:`, error.message);
    return;
  }
  if (!channel?.isTextBased() || !('send' in channel)) {
    console.error(`Canalul configurat pentru ${module} (${channelId}) nu este un canal text valid în serverul ${member.guild.id}.`);
    return;
  }

  const configType = member.user.bot
    ? 'bot'
    : attribution.kind === 'vanity'
      ? 'vanity'
      : attribution.kind === 'unknown'
        ? 'unknown'
        : 'normal';
  const type = settings
    ? (settings.types?.[configType] ? configType : 'normal')
    : 'normal';
  const selected = settings?.types?.[type];
  const needsEmbed = selected?.embedEnabled || legacyWelcome;
  const required = ['ViewChannel', 'SendMessages'];
  if (needsEmbed) required.push('EmbedLinks');
  if (legacyWelcome?.imageFile || (!legacyWelcome && settings?.types?.[type]?.bannerEnabled)) {
    required.push('AttachFiles');
  }
  const missing = logMissingPermissions(member, channel, required);
  if (missing.some((name) => ['ViewChannel', 'SendMessages'].includes(name))) return;

  const files = [];
  let payload;
  if (settings) {
    payload = await messagePayload(module, settings, type, member, attribution, !missing.includes('AttachFiles'));
  } else {
    const inviterId = attribution.inviterId;
    const inviter = inviterId ? `<@${inviterId}>` : 'necunoscut';
    const description = attribution.inviteCount === null || attribution.inviteCount === undefined
      ? `${member} a fost invitat de ${inviter}.`
      : `${member} a fost invitat de ${inviter}, care are acum ${attribution.inviteCount} invitații.`;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setDescription(description)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();
    if (legacyWelcome.imageFile) {
      const imagePath = welcomeConfig.getImagePath(legacyWelcome.imageFile);
      if (!fs.existsSync(imagePath)) {
        console.error(`Imaginea welcome configurată lipsește pentru serverul ${member.guild.id}.`);
        return;
      }
      const attachmentName = `welcome-banner${path.extname(imagePath)}`;
      files.push(new AttachmentBuilder(imagePath, { name: attachmentName }));
      embed.setImage(`attachment://${attachmentName}`);
    } else if (fs.existsSync(welcomeImagePath)) {
      files.push(new AttachmentBuilder(welcomeImagePath, { name: 'welcome-banner.jpg' }));
      embed.setImage('attachment://welcome-banner.jpg');
    }
    payload = {
      embeds: [embed],
      files,
      allowedMentions: {
        parse: [],
        users: [member.id, ...(inviterId ? [inviterId] : [])],
        roles: [],
        repliedUser: false
      }
    };
  }

  if (missing.includes('AttachFiles')) {
    payload.files = [];
    for (const embed of payload.embeds || []) delete embed.data.image;
  }
  try {
    const sent = await channel.send(payload);
    if (settings?.emoji) {
      if (logMissingPermissions(member, channel, ['AddReactions']).length) return;
      try {
        await sent.react(settings.emoji);
      } catch (error) {
        console.error(`Mesajul ${module} a fost trimis, dar reacția ${settings.emoji} nu a putut fi adăugată în serverul ${member.guild.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Nu am putut trimite mesajul ${module} în serverul ${member.guild.id}, canalul ${channel.id}:`, error.message);
  }
}

module.exports = (client) => {
  tracker.initialize();

  client.once(Events.ClientReady, async (readyClient) => {
    if (!readyClient.options.intents.has(GatewayIntentBits.GuildMembers)) {
      console.warn('Intentul GuildMembers trebuie activat în Discord Developer Portal pentru mesajele Welcome și Leave.');
    }
    if (!readyClient.options.intents.has(GatewayIntentBits.GuildInvites)) {
      console.warn('Intentul GuildInvites trebuie activat în Discord Developer Portal pentru urmărirea invitațiilor.');
    }
    for (const guild of readyClient.guilds.cache.values()) {
      try {
        await tracker.syncGuild(guild);
      } catch (error) {
        console.error(`Nu am putut sincroniza invitațiile pentru serverul ${guild.id}. Verifică permisiunea Manage Guild:`, error.message);
      }
    }
  });

  client.on(Events.GuildCreate, async (guild) => {
    try {
      await tracker.syncGuild(guild);
    } catch (error) {
      console.error(`Nu am putut sincroniza invitațiile pentru serverul ${guild.id}. Verifică permisiunea Manage Guild:`, error.message);
    }
  });

  for (const event of [Events.InviteCreate, Events.InviteDelete]) {
    client.on(event, async (invite) => {
      try {
        await tracker.syncGuild(invite.guild);
      } catch (error) {
        console.error(`Nu am putut actualiza cache-ul invitațiilor pentru serverul ${invite.guild?.id || 'necunoscut'}:`, error.message);
      }
    });
  }

  client.on(Events.GuildMemberAdd, async (member) => {
    let attribution = { inviterId: null, inviteCount: null, inviteCode: null, kind: 'unknown' };
    try {
      attribution = await tracker.handleMemberJoin(member);
    } catch (error) {
      console.error(`Nu am putut identifica invitația pentru membrul ${member.id} din serverul ${member.guild.id}. Verifică permisiunea Manage Guild:`, error.message);
    }
    await sendConfiguredMessage(member, 'welcome', attribution);
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    await sendConfiguredMessage(member, 'leave', { kind: 'unknown' });
  });
};
