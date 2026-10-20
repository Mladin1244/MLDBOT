const { ButtonBuilder, ButtonStyle } = require('discord.js');

const IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp']
]);
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

async function downloadImage(attachment) {
  const contentType = attachment.contentType?.split(';')[0].toLowerCase();
  const extension = IMAGE_TYPES.get(contentType);
  if (!extension || attachment.size > MAX_IMAGE_SIZE) {
    throw new Error('Alege o imagine JPEG, PNG, GIF sau WebP de cel mult 8 MB.');
  }

  const url = new URL(attachment.url);
  if (url.protocol !== 'https:' ||
      !['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname)) {
    throw new Error('Imaginea trebuie încărcată direct în Discord.');
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Descărcarea imaginii a eșuat (HTTP ${response.status}).`);
  const responseType = response.headers.get('content-type')?.split(';')[0].toLowerCase();
  if (responseType !== contentType) throw new Error('Tipul imaginii încărcate nu este valid.');

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error('Imaginea trebuie să aibă cel mult 8 MB.');
  }
  return { buffer, extension };
}

async function resolveServerEmoji(guild, value) {
  const customMatch = /^(?:<a?:[A-Za-z0-9_]+:(\d{17,20})>|(\d{17,20}))$/.exec(value);
  if (customMatch) {
    const emojiId = customMatch[1] || customMatch[2];
    const emoji = guild.emojis.cache.get(emojiId) || await guild.emojis.fetch(emojiId);
    if (!emoji || emoji.guild.id !== guild.id) {
      throw new Error('Emojiul personalizat trebuie să aparțină acestui server.');
    }
    return { id: emoji.id, name: emoji.name, animated: emoji.animated };
  }

  const namedEmoji = guild.emojis.cache.find((emoji) => emoji.name === value);
  if (namedEmoji) {
    return { id: namedEmoji.id, name: namedEmoji.name, animated: namedEmoji.animated };
  }
  if (!value || value.length > 100 || /\s/.test(value) || /<@/.test(value)) {
    throw new Error('Introdu un emoji Unicode valid sau selectează un emoji din acest server.');
  }

  new ButtonBuilder().setCustomId('emoji_validation').setStyle(ButtonStyle.Secondary).setEmoji(value);
  return value;
}

module.exports = { downloadImage, resolveServerEmoji };
