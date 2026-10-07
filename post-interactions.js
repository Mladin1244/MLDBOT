const {
  ActionRowBuilder,
  AttachmentBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const postCommand = require("./commands/post");

const ASSETS_DIR = path.join(__dirname, "assets");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const SESSION_TTL_MS = 10 * 60 * 1000;

const sessions = new Map();

function getAssetImageFiles() {
  if (!fs.existsSync(ASSETS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(ASSETS_DIR)
    .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
}

function setSession(userId, data) {
  const existing = sessions.get(userId);
  if (existing?.timeout) {
    clearTimeout(existing.timeout);
  }
  const timeout = setTimeout(() => sessions.delete(userId), SESSION_TTL_MS);
  sessions.set(userId, { ...data, timeout });
}

function getSession(userId) {
  return sessions.get(userId) ?? null;
}

function clearSession(userId) {
  const existing = sessions.get(userId);
  if (existing?.timeout) {
    clearTimeout(existing.timeout);
  }
  sessions.delete(userId);
}

function buildPostEmbed(message, imageAttachmentName) {
  const embed = new EmbedBuilder()
    .setColor(0x0526da)
    .setDescription(["———————————", message, "———————————"].join("\n"))
    .setFooter({ text: "MLDBOT Server" });

  if (imageAttachmentName) {
    embed.setImage(`attachment://${imageAttachmentName}`);
  }

  return embed;
}

async function finalizePost(interaction, session) {
  const channel = await interaction.client.channels.fetch(session.channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !("send" in channel)) {
    throw new Error("Selected channel was not found or is not text-based.");
  }

  const files = [];
  let embed;

  if (session.imageType === "asset") {
    const imagePath = path.join(ASSETS_DIR, session.imageValue);
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Asset image is missing: ${imagePath}`);
    }
    const attachmentName = `post-image${path.extname(session.imageValue)}`;
    files.push(new AttachmentBuilder(imagePath, { name: attachmentName }));
    embed = buildPostEmbed(session.message, attachmentName);
  } else if (session.imageType === "link") {
    embed = buildPostEmbed(session.message);
    embed.setImage(session.imageValue);
  } else {
    embed = buildPostEmbed(session.message);
  }

  await channel.send({ embeds: [embed], files });
  return channel;
}

function buildChannelSelectRow() {
  const select = new ChannelSelectMenuBuilder()
    .setCustomId("post_channel_select")
    .setPlaceholder("Alege canalul")
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
  return new ActionRowBuilder().addComponents(select);
}

function buildImageChoiceRow() {
  const select = new StringSelectMenuBuilder()
    .setCustomId("post_image_choice_select")
    .setPlaceholder("Alege o imagine (opțional)")
    .addOptions(
      { label: "Fără imagine", value: "none", description: "Trimite doar textul" },
      {
        label: "Alege din assets",
        value: "assets",
        description: "Folosește o imagine din folderul assets",
      },
      { label: "Link personalizat", value: "link", description: "Introdu un URL de imagine" },
    );
  return new ActionRowBuilder().addComponents(select);
}

function buildAssetSelectRow() {
  const files = getAssetImageFiles();
  const select = new StringSelectMenuBuilder()
    .setCustomId("post_image_asset_select")
    .setPlaceholder("Alege fișierul din assets");

  if (files.length === 0) {
    select.setPlaceholder("Niciun fișier găsit în assets").setDisabled(true);
    select.addOptions({ label: "—", value: "none" });
  } else {
    select.addOptions(files.map((file) => ({ label: file, value: file })));
  }

  return new ActionRowBuilder().addComponents(select);
}

function buildImageLinkModal() {
  return new ModalBuilder()
    .setCustomId("post_image_link_modal")
    .setTitle("Link imagine")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("post_image_link_input")
          .setLabel("URL-ul imaginii")
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
    );
}

async function replyError(interaction, content) {
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}

async function expireSession(interaction) {
  const content = "Sesiunea a expirat. Rulează din nou /post.";
  if (interaction.isFromMessage?.()) {
    await interaction.update({ content, components: [] });
  } else {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}

async function handlePostInteraction(interaction) {
  const isPostCommand =
    interaction.isChatInputCommand() && interaction.commandName === postCommand.data.name;
  const isMessageModal =
    interaction.isModalSubmit() && interaction.customId === "post_message_modal";
  const isChannelSelect =
    interaction.isChannelSelectMenu() && interaction.customId === "post_channel_select";
  const isImageChoiceSelect =
    interaction.isStringSelectMenu() && interaction.customId === "post_image_choice_select";
  const isAssetSelect =
    interaction.isStringSelectMenu() && interaction.customId === "post_image_asset_select";
  const isLinkModal =
    interaction.isModalSubmit() && interaction.customId === "post_image_link_modal";

  if (
    !isPostCommand &&
    !isMessageModal &&
    !isChannelSelect &&
    !isImageChoiceSelect &&
    !isAssetSelect &&
    !isLinkModal
  ) {
    return false;
  }

  try {
    if (isPostCommand) {
      await postCommand.execute(interaction);
    } else if (isMessageModal) {
      const message = interaction.fields.getTextInputValue("post_message_input");
      setSession(interaction.user.id, { message });
      await interaction.reply({
        content: "Alege canalul în care vrei să trimiți mesajul:",
        components: [buildChannelSelectRow()],
        flags: MessageFlags.Ephemeral,
      });
    } else if (isChannelSelect) {
      const session = getSession(interaction.user.id);
      if (!session) {
        await expireSession(interaction);
        return true;
      }
      session.channelId = interaction.values[0];
      setSession(interaction.user.id, session);
      await interaction.update({
        content: "Alege imaginea pentru mesaj:",
        components: [buildImageChoiceRow()],
      });
    } else if (isImageChoiceSelect) {
      const session = getSession(interaction.user.id);
      if (!session) {
        await expireSession(interaction);
        return true;
      }

      const choice = interaction.values[0];
      if (choice === "none") {
        session.imageType = "none";
        const channel = await finalizePost(interaction, session);
        clearSession(interaction.user.id);
        await interaction.update({
          content: `✅ Mesajul a fost trimis în ${channel}.`,
          components: [],
        });
      } else if (choice === "assets") {
        setSession(interaction.user.id, session);
        await interaction.update({
          content: "Alege imaginea din assets:",
          components: [buildAssetSelectRow()],
        });
      } else if (choice === "link") {
        setSession(interaction.user.id, session);
        await interaction.showModal(buildImageLinkModal());
      }
    } else if (isAssetSelect) {
      const session = getSession(interaction.user.id);
      if (!session) {
        await expireSession(interaction);
        return true;
      }
      session.imageType = "asset";
      session.imageValue = interaction.values[0];
      const channel = await finalizePost(interaction, session);
      clearSession(interaction.user.id);
      await interaction.update({
        content: `✅ Mesajul a fost trimis în ${channel}.`,
        components: [],
      });
    } else if (isLinkModal) {
      const session = getSession(interaction.user.id);
      if (!session) {
        await expireSession(interaction);
        return true;
      }
      const url = interaction.fields.getTextInputValue("post_image_link_input").trim();
      if (!/^https?:\/\/\S+$/i.test(url)) {
        await replyError(interaction, "URL-ul imaginii este invalid.");
        return true;
      }
      session.imageType = "link";
      session.imageValue = url;
      const channel = await finalizePost(interaction, session);
      clearSession(interaction.user.id);
      if (interaction.isFromMessage?.()) {
        await interaction.update({
          content: `✅ Mesajul a fost trimis în ${channel}.`,
          components: [],
        });
      } else {
        await interaction.reply({
          content: `✅ Mesajul a fost trimis în ${channel}.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } catch (error) {
    console.error("Post interaction failed:", error);
    await replyError(
      interaction,
      "Trimiterea mesajului a eșuat. Verifică permisiunile botului și datele introduse.",
    );
  }

  return true;
}

module.exports = { handlePostInteraction };
