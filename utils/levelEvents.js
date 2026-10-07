const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const levelSystem = require('./levelSystem');
const serverConfig = require('./serverConfig');
const welcomeConfig = require('./welcomeConfig');

const DEFAULT_BANNER = path.join(__dirname, '..', 'assets', 'mldbot-banner.jpg');
const MISSION_COMMANDS = new Set(levelSystem.PUBLIC_MISSION_COMMANDS);

function missionCompletionText(result) {
  return result.completedMissions.length
    ? `🎯 Misiune completată! Ai primit **${result.completedMissions.length * levelSystem.MISSION_REWARD_XP} XP** pentru misiune.`
    : null;
}

async function sendLevelUp(guild, userId, level) {
  const config = serverConfig.get(guild.id);
  if (!config.levelChannelId) return;

  const channel = await guild.channels.fetch(config.levelChannelId);
  if (!channel?.isTextBased() || !('send' in channel)) {
    throw new Error(`Canalul de level-up ${config.levelChannelId} nu există sau nu este text.`);
  }

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setDescription([
      `❤️  <@${userId}>  ❤️`,
      '',
      `🔴 **A ajuns la Nivelul ${level}. Felicitări!**`,
      '🔴 Cu cât ești mai activ, cu atât crești mai repede în nivel!',
      '',
      `🔴 **Reached Level ${level}. Congratulations!**`,
      '🔴 The more active you are, the faster you level up!'
    ].join('\n'))
    .setTimestamp();

  const files = [];
  if (config.levelImageFile) {
    const imagePath = levelSystem.getImagePath(config.levelImageFile);
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Imaginea de level-up configurată lipsește: ${imagePath}`);
    }
    const attachmentName = `level-banner${path.extname(imagePath)}`;
    files.push(new AttachmentBuilder(imagePath, { name: attachmentName }));
    embed.setImage(`attachment://${attachmentName}`);
  } else if (fs.existsSync(DEFAULT_BANNER)) {
    files.push(new AttachmentBuilder(DEFAULT_BANNER, { name: 'level-banner.jpg' }));
    embed.setImage('attachment://level-banner.jpg');
  }

  await channel.send({
    embeds: [embed],
    files,
    allowedMentions: { users: [userId] }
  });
}

async function reportResult(guild, userId, result, fallbackChannel) {
  try {
    for (const level of result.levelUps) {
      await sendLevelUp(guild, userId, level);
    }

    const completion = missionCompletionText(result);
    if (completion && fallbackChannel?.isTextBased() && 'send' in fallbackChannel) {
      await fallbackChannel.send({
        content: `<@${userId}> ${completion}`,
        allowedMentions: { users: [userId] }
      });
    }
  } catch (error) {
    console.error(`Nu am putut publica progresul de level pentru utilizatorul ${userId}:`, error);
  }
}

async function recordChatMessage(message) {
  if (!message.guild || message.author.bot || message.content.trim().length < 5) return;
  if (message.content.startsWith(process.env.PREFIX || '!')) return;

  const result = levelSystem.recordActivity(
    message.guild.id,
    message.author.id,
    'message',
    message.createdTimestamp
  );
  await reportResult(message.guild, message.author.id, result, message.channel);
}

async function recordPublicCommand(guild, user, commandName, channel) {
  if (!guild || user.bot) return;
  const normalized = commandName === 'credits' ? 'credite' : commandName;
  if (!MISSION_COMMANDS.has(normalized)) return;

  const result = levelSystem.recordActivity(
    guild.id,
    user.id,
    'command',
    Date.now(),
    { commandName: normalized }
  );
  await reportResult(guild, user.id, result, channel);
}

module.exports = { recordChatMessage, recordPublicCommand };
