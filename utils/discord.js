const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function embed(title, description, color = 0x5865f2) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
}

function buttons(items) {
  return new ActionRowBuilder().addComponents(items.map(({ id, label, style = ButtonStyle.Secondary, emoji, disabled }) => {
    const button = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(Boolean(disabled));
    if (emoji) button.setEmoji(emoji);
    return button;
  }));
}

function credits(amount) {
  return Number.isInteger(amount) ? amount.toLocaleString('en-US') : amount.toFixed(2);
}

function mention(userId) {
  return `<@${userId}>`;
}

module.exports = { embed, buttons, credits, mention, ButtonStyle };
