const { AttachmentBuilder, EmbedBuilder, Events } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { InviteTracker } = require('../utils/inviteTracker');
const welcomeConfig = require('../utils/welcomeConfig');

const tracker = new InviteTracker();
const welcomeImagePath = path.join(__dirname, '..', 'assets', 'mldbot-banner.jpg');

module.exports = (client) => {
  tracker.initialize();

  client.once(Events.ClientReady, async (readyClient) => {
    for (const guild of readyClient.guilds.cache.values()) {
      try {
        await tracker.syncGuild(guild);
      } catch (error) {
        console.error(`Nu am putut sincroniza invitațiile pentru serverul ${guild.id}:`, error);
      }
    }
  });

  client.on(Events.GuildCreate, async (guild) => {
    try {
      await tracker.syncGuild(guild);
    } catch (error) {
      console.error(`Nu am putut sincroniza invitațiile pentru serverul ${guild.id}:`, error);
    }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    let attribution = { inviterId: null, inviteCount: null };
    try {
      attribution = await tracker.handleMemberJoin(member);
    } catch (error) {
      console.error(`Nu am putut identifica invitația pentru membrul ${member.id}:`, error);
    }

    let config;
    try {
      config = welcomeConfig.get(member.guild.id);
    } catch (error) {
      console.error(`Nu am putut citi configurarea de bun venit pentru serverul ${member.guild.id}:`, error);
      return;
    }
    if (!config) return;

    try {
      const channel = await member.guild.channels.fetch(config.channelId);
      if (!channel?.isTextBased() || !('send' in channel)) {
        throw new Error(`Canalul de bun venit ${config.channelId} nu există sau nu este text.`);
      }

      const inviter = attribution.inviterId
        ? `<@${attribution.inviterId}>`
        : 'necunoscut / unknown';
      const description = attribution.inviteCount === null
        ? `${member} a fost invitat de ${inviter}.`
        : `${member} a fost invitat de ${inviter}, care are acum ${attribution.inviteCount} invitații.\n` +
          `${member} was invited by ${inviter}, who now has ${attribution.inviteCount} invites.`;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription(description)
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();
      const files = [];

      if (config.imageFile) {
        const imagePath = welcomeConfig.getImagePath(config.imageFile);
        if (!fs.existsSync(imagePath)) {
          throw new Error(`Imaginea de bun venit configurată lipsește: ${imagePath}`);
        }
        const attachmentName = `welcome-banner${path.extname(imagePath)}`;
        files.push(new AttachmentBuilder(imagePath, { name: attachmentName }));
        embed.setImage(`attachment://${attachmentName}`);
      } else if (fs.existsSync(welcomeImagePath)) {
        files.push(new AttachmentBuilder(welcomeImagePath, { name: 'welcome-banner.jpg' }));
        embed.setImage('attachment://welcome-banner.jpg');
      }

      await channel.send({
        embeds: [embed],
        files,
        allowedMentions: { users: [member.id, ...(attribution.inviterId ? [attribution.inviterId] : [])] }
      });
    } catch (error) {
      console.error(`Nu am putut trimite mesajul de bun venit pentru membrul ${member.id}:`, error);
    }
  });
};
