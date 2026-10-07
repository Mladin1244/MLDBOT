const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const levelSystem = require('../utils/levelSystem');
const PREFIX = process.env.PREFIX || '!';

function progressBar(current, target, size = 12) {
  const filled = Math.min(size, Math.floor((current / target) * size));
  return `${'█'.repeat(filled)}${'░'.repeat(size - filled)}`;
}

function displayCommand(name) {
  return `\`${PREFIX}${name}\` or \`/${name}\``;
}

function createLevelCommands() {
  return [
    {
      data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Afișează nivelul și XP-ul tău sau al unui membru.')
        .addUserOption((option) => option
          .setName('utilizator')
          .setDescription('Membrul al cărui nivel vrei să-l vezi.')
          .setRequired(false)),
      async execute(interaction) {
        if (!interaction.inGuild()) {
          await interaction.reply('Comanda poate fi folosită doar într-un server.');
          return;
        }
        const target = interaction.options.getUser('utilizator') || interaction.user;
        const profile = levelSystem.getUser(interaction.guildId, target.id);
        const requiredXp = levelSystem.xpForNextLevel(profile.level);
        const embed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(`⭐ Nivelul lui ${target}`)
          .setDescription(
            `Nivel **${profile.level}**\n` +
            `${progressBar(profile.xp, requiredXp)} **${profile.xp}/${requiredXp} XP**`
          )
          .setThumbnail(target.displayAvatarURL());
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('missions')
        .setDescription('Afișează progresul misiunilor zilnice de level.'),
      async execute(interaction) {
        if (!interaction.inGuild()) {
          await interaction.reply('Comanda poate fi folosită doar într-un server.');
          return;
        }
        const profile = levelSystem.getUser(interaction.guildId, interaction.user.id);
        await interaction.reply({
          embeds: [buildMissionsEmbed(profile)]
        });
      }
    }
  ];
}

function buildMissionsEmbed(profile) {
  const chat = profile.missions.chat;
  const command = profile.missions.command;
  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('🎯 Misiunile zilnice')
    .setDescription([
      `${chat.completed ? '✅' : '🔸'} **Scrie în chat**`,
      `${progressBar(chat.progress, chat.target)} ${chat.progress}/${chat.target} mesaje`,
      '',
      `${command.completed ? '✅' : '🔸'} **Folosește comanda ${displayCommand(command.name)}**`,
      `${progressBar(command.progress, command.target)} ${command.progress}/${command.target} folosiri`,
      '',
      `Fiecare misiune completată oferă **${levelSystem.MISSION_REWARD_XP} XP**.`
    ].join('\n'));
}

async function handlePrefixCommand(command, ctx) {
  if (!ctx.message.guild) {
    await ctx.message.reply('Comenzile de level pot fi folosite doar într-un server.');
    return;
  }

  if (command === 'level') {
    const target = ctx.message.mentions.users.first() || ctx.message.author;
    const profile = levelSystem.getUser(ctx.message.guild.id, target.id);
    const requiredXp = levelSystem.xpForNextLevel(profile.level);
    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`⭐ Nivelul lui ${target}`)
      .setDescription(
        `Nivel **${profile.level}**\n` +
        `${progressBar(profile.xp, requiredXp)} **${profile.xp}/${requiredXp} XP**`
      )
      .setThumbnail(target.displayAvatarURL());
    await ctx.message.reply({ embeds: [embed] });
  } else {
    const profile = levelSystem.getUser(ctx.message.guild.id, ctx.message.author.id);
    await ctx.message.reply({ embeds: [buildMissionsEmbed(profile)] });
  }
}

module.exports = {
  commands: createLevelCommands(),
  handlePrefixCommand,
  buildMissionsEmbed,
  progressBar
};
