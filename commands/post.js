const {
  ActionRowBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { requireAdministrator } = require("../utils/requireAdministrator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("post")
    .setDescription("Trimite un mesaj formatat într-un canal, pas cu pas.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!(await requireAdministrator(interaction))) return;

    const modal = new ModalBuilder()
      .setCustomId("post_message_modal")
      .setTitle("Mesaj nou")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("post_message_input")
            .setLabel("Mesajul de trimis")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(4000),
        ),
      );

    await interaction.showModal(modal);
  },
};
