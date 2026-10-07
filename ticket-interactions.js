const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const setupTicketCommand = require("./commands/setup-ticket");
const serverConfig = require("./utils/serverConfig");

const TICKET_TYPES = {
  bug: {
    channelPrefix: "bug",
    title: "🐞 Game Bug Ticket",
    details: "Please provide a description, steps to reproduce, and screenshots or video.",
  },
  cheater: {
    channelPrefix: "cheater",
    title: "🚨 Game Cheater Ticket",
    details: "Please provide the cheater's nickname, proof, screenshots or video, and the date/time.",
  },
};

const ticketCreationLocks = new Map();
const ticketPermissions = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AddReactions,
];

function isValidId(value) {
  return typeof value === "string" && /^\d+$/.test(value);
}

function getTicketOwner(channel) {
  const match = channel.topic?.match(/(?:^|;)ticket-owner=(\d+)(?:;|$)/);
  return match?.[1] ?? null;
}

function getTicketType(channel) {
  const match = channel.topic?.match(/(?:^|;)ticket-type=(bug|cheater)(?:;|$)/);
  return match?.[1] ?? null;
}

function isClosing(channel) {
  return /(?:^|;)ticket-status=closing(?:;|$)/.test(channel.topic ?? "");
}

function isStaff(interaction) {
  const roles = interaction.member?.roles;
  const staffRoleIds = serverConfig.get(interaction.guildId).staffRoleIds || [];
  if (Array.isArray(roles)) {
    return staffRoleIds.some((roleId) => roles.includes(roleId));
  }
  return staffRoleIds.some((roleId) => roles?.cache?.has(roleId));
}

function isTicketParticipant(interaction, channel) {
  return getTicketOwner(channel) === interaction.user.id || isStaff(interaction);
}

async function replyError(interaction, content) {
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}

async function logTicket(guild, message) {
  try {
    const logChannelId = serverConfig.get(guild.id).ticketLogChannelId;
    if (!logChannelId) return;

    if (!isValidId(logChannelId)) {
      throw new Error("Ticket log channel is not configured with a valid Discord channel ID.");
    }
    const channel = await guild.channels.fetch(logChannelId);
    if (!channel?.isTextBased() || !("send" in channel)) {
      throw new Error(`Ticket log channel ${logChannelId} was not found or is not text-based.`);
    }
    await channel.send({ content: message, allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("Failed to log ticket event:", error);
  }
}

function sanitizeUsername(username, userId) {
  const sanitized = username
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);

  return sanitized || userId;
}

async function withTicketCreationLock(key, callback) {
  const previous = ticketCreationLocks.get(key) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  ticketCreationLocks.set(key, current);
  await previous;

  try {
    return await callback();
  } finally {
    release();
    if (ticketCreationLocks.get(key) === current) {
      ticketCreationLocks.delete(key);
    }
  }
}

async function findOpenTicket(guild, categoryId, userId) {
  const channels = await guild.channels.fetch();
  return (
    channels?.find(
      (channel) =>
        channel.type === ChannelType.GuildText &&
        channel.parentId === categoryId &&
        getTicketOwner(channel) === userId,
    ) ?? null
  );
}

async function createSupportTicket(interaction, type) {
  const settings = serverConfig.get(interaction.guildId);
  const categoryId = settings.ticketCategoryId;
  const staffRoleIds = settings.staffRoleIds || [];
  const invalidSettings = [];

  if (!/^\d{17,20}$/.test(categoryId ?? "")) {
    invalidSettings.push("Categoria tichetelor neconfigurată. Rulează /setup-ticket.");
  }
  if (
    staffRoleIds.length === 0 ||
    staffRoleIds.some((roleId) => !/^\d{17,20}$/.test(roleId))
  ) {
    invalidSettings.push("Rolul staff nu este configurat. Rulează /setup-ticket.");
  }

  if (invalidSettings.length > 0) {
    for (const setting of invalidSettings) {
      console.error(`Ticket configuration error: ${setting}`);
    }
    await replyError(interaction, `Ticket configuration error: ${invalidSettings.join(" ")}`);
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  await withTicketCreationLock(`${interaction.guildId}:${interaction.user.id}`, async () => {
    const existing = await findOpenTicket(interaction.guild, categoryId, interaction.user.id);
    if (existing) {
      await interaction.editReply(`Ai deja un tichet deschis: ${existing}`);
      return;
    }

    const category = await interaction.guild.channels.fetch(categoryId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      throw new Error(`Ticket category ${categoryId} was not found or is not a category.`);
    }

    const staffRoles = await Promise.all(
      staffRoleIds.map((staffRoleId) => interaction.guild.roles.fetch(staffRoleId)),
    );
    const missingStaffRoleIds = staffRoleIds.filter(
      (staffRoleId, index) => !staffRoles[index],
    );
    if (missingStaffRoleIds.length > 0) {
      const errorMessage = `Configured staff roles were not found in this server: ${missingStaffRoleIds.join(", ")}.`;
      console.error(`Ticket configuration error: ${errorMessage}`);
      await interaction.editReply(`Ticket configuration error: ${errorMessage}`);
      return;
    }

    const config = TICKET_TYPES[type];
    const username = sanitizeUsername(interaction.user.username, interaction.user.id);
    const staffMentions = staffRoles.map((role) => role.toString()).join(" ");
    const channel = await interaction.guild.channels.create({
      name: `${config.channelPrefix}-${username}`,
      type: ChannelType.GuildText,
      parent: categoryId,
      topic: `ticket-owner=${interaction.user.id};ticket-type=${type}`,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: ticketPermissions,
        },
        ...staffRoleIds.map((staffRoleId) => ({
          id: staffRoleId,
          allow: [
            ...ticketPermissions,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ManageChannels,
          ],
        })),
        {
          id: interaction.client.user.id,
          allow: [
            ...ticketPermissions,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
    });

    const ticketEmbed = new EmbedBuilder()
      .setColor(0x0526da)
      .setTitle(config.title)
      .setDescription(
        `${interaction.user} ${staffMentions}\n\n${config.details}`,
      );
    const closeButton = new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("🔒 Close Ticket")
      .setStyle(ButtonStyle.Danger);

    await channel.send({
      content: `${interaction.user} ${staffMentions}`,
      embeds: [ticketEmbed],
      components: [new ActionRowBuilder().addComponents(closeButton)],
      allowedMentions: { users: [interaction.user.id], roles: staffRoleIds },
    });

    await interaction.editReply(`Ticket creat: ${channel}`);

    await logTicket(
      interaction.guild,
      `Ticket opened | type: ${type} | user: ${interaction.user.tag} (${interaction.user.id}) | channel: ${channel} | time: ${new Date().toISOString()}`,
    );
  });
}

async function openSuggestionModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("suggestion_modal")
    .setTitle("Game Suggestion")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("suggestion_text")
          .setLabel("Sugestia ta / Your suggestion")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMinLength(10)
          .setMaxLength(1000),
      ),
    );

  await interaction.showModal(modal);
}

async function submitSuggestion(interaction) {
  const suggestionsChannelId = serverConfig.get(interaction.guildId).suggestionsChannelId;
  if (!isValidId(suggestionsChannelId)) {
    await replyError(
      interaction,
      "Canalul de sugestii nu este configurat. Rulează /setup-ticket.",
    );
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel = await interaction.guild.channels.fetch(suggestionsChannelId);
  if (!channel?.isTextBased() || !("send" in channel)) {
    await interaction.editReply(
      "Nu am găsit canalul de sugestii configurat. Rulează din nou /setup-ticket.",
    );
    return;
  }

  const suggestionText = interaction.fields.getTextInputValue("suggestion_text");
  const suggestionEmbed = new EmbedBuilder()
    .setColor(0x0526da)
    .setTitle("💡 New Suggestion")
    .setDescription(suggestionText)
    .setAuthor({
      name: interaction.user.tag,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setTimestamp()
    .setFooter({ text: "MLDBOT Suggestions" });

  const message = await channel.send({ embeds: [suggestionEmbed] });
  await message.react("👍");
  await message.react("👎");

  await interaction.editReply(
    `Sugestia ta a fost trimisă în ${channel}! / Your suggestion has been posted!`,
  );
}

async function handleCloseButton(interaction) {
  const channel = interaction.channel;
  if (!channel || !getTicketOwner(channel)) {
    await replyError(interaction, "This channel is not an active ticket.");
    return;
  }
  if (!isTicketParticipant(interaction, channel)) {
    await replyError(interaction, "Doar autorul tichetului sau staff-ul îl poate închide. / Only the ticket owner or staff can close it.");
    return;
  }
  if (isClosing(channel)) {
    await replyError(interaction, "This ticket is already closing.");
    return;
  }

  const confirmation = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close_confirm")
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("ticket_close_cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    content: "Are you sure you want to close this ticket?",
    components: [confirmation],
    flags: MessageFlags.Ephemeral,
  });
}

async function confirmTicketClose(interaction) {
  const channel = interaction.channel;
  if (!channel || !getTicketOwner(channel)) {
    await replyError(interaction, "This channel is not an active ticket.");
    return;
  }
  if (!isTicketParticipant(interaction, channel)) {
    await replyError(interaction, "Doar autorul tichetului sau staff-ul îl poate închide. / Only the ticket owner or staff can close it.");
    return;
  }
  if (isClosing(channel)) {
    await replyError(interaction, "This ticket is already closing.");
    return;
  }

  await interaction.deferUpdate();

  const ownerId = getTicketOwner(channel);
  const type = getTicketType(channel) ?? "unknown";
  await channel.setTopic(`${channel.topic};ticket-status=closing`);
  await channel.send("Ticketul se va închide în 5 secunde...");
  await interaction.editReply({
    content: "Ticketul se va închide în 5 secunde...",
    components: [],
  });

  await logTicket(
    interaction.guild,
    `Ticket closed | type: ${type} | owner: ${ownerId} | closed by: ${interaction.user.tag} (${interaction.user.id}) | time: ${new Date().toISOString()}`,
  );

  await new Promise((resolve) => setTimeout(resolve, 5000));
  await channel.delete("Ticket closed by its owner or staff.");
}

async function handleTicketInteraction(interaction) {
  const isTicketCommand =
    interaction.isChatInputCommand() &&
    interaction.commandName === setupTicketCommand.data.name;
  const isTicketSelect =
    interaction.isStringSelectMenu() && interaction.customId === "ticket_menu";
  const isSuggestionModal =
    interaction.isModalSubmit() && interaction.customId === "suggestion_modal";
  const isTicketButton =
    interaction.isButton() &&
    [
      "ticket_close",
      "ticket_close_confirm",
      "ticket_close_cancel",
    ].includes(interaction.customId);

  if (!isTicketCommand && !isTicketSelect && !isSuggestionModal && !isTicketButton) {
    return false;
  }

  try {
    if (isTicketCommand) {
      await setupTicketCommand.execute(interaction);
    } else if (isTicketSelect) {
      const selectedType = interaction.values[0];
      if (selectedType === "suggestion") {
        await openSuggestionModal(interaction);
      } else if (TICKET_TYPES[selectedType]) {
        if (!interaction.guild) {
          throw new Error("Ticket creation is only available in a server.");
        }
        await createSupportTicket(interaction, selectedType);
      } else {
        await replyError(interaction, "Unknown ticket category.");
      }
    } else if (isSuggestionModal) {
      if (!interaction.guild) {
        throw new Error("Suggestions can only be submitted in a server.");
      }
      await submitSuggestion(interaction);
    } else if (interaction.customId === "ticket_close") {
      await handleCloseButton(interaction);
    } else if (interaction.customId === "ticket_close_confirm") {
      await confirmTicketClose(interaction);
    } else if (interaction.customId === "ticket_close_cancel") {
      await interaction.update({
        content: "Ticket close cancelled.",
        components: [],
      });
    }
  } catch (error) {
    console.error("Ticket interaction failed:", error);
    await replyError(
      interaction,
      "A ticket action failed. Check that the bot has the required channel permissions and that the ticket configuration is valid.",
    );
  }

  return true;
}

module.exports = { handleTicketInteraction };
