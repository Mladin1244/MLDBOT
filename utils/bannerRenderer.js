const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('node:fs');
const path = require('node:path');
const { replaceMessageVariables } = require('./messageVariables');
const cloudDashboardSync = require('./cloudDashboardSync');
const welcomeConfig = require('./welcomeConfig');

const SAFE_FONTS = new Set(['Arial', 'Georgia', 'Verdana', 'Trebuchet MS', 'Impact']);
const imageCache = new Map();

async function loadStoredImage(guildId, key) {
  let pending = imageCache.get(key);
  if (!pending) {
    pending = cloudDashboardSync.fetchBanner(guildId, key).then((bytes) => loadImage(bytes));
    imageCache.set(key, pending);
    if (imageCache.size > 100) imageCache.delete(imageCache.keys().next().value);
  }
  return pending;
}

function drawWrappedText(context, text, layer) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > layer.width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  const lineHeight = Math.ceil(layer.fontSize * 1.2);
  context.textAlign = layer.align || 'left';
  context.textBaseline = 'top';
  for (const [index, item] of lines.entries()) {
    const y = layer.y + index * lineHeight;
    if (y + lineHeight > layer.y + layer.height) break;
    const x = layer.align === 'center'
      ? layer.x + layer.width / 2
      : layer.align === 'right'
        ? layer.x + layer.width
        : layer.x;
    context.fillText(item, x, y);
  }
}

async function renderBanner(guildId, config, member, variables, module) {
  const canvas = createCanvas(1024, 320);
  const context = canvas.getContext('2d');
  context.fillStyle = '#182235';
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (config.bannerImageKey) {
    const image = await loadStoredImage(guildId, config.bannerImageKey);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  } else if (module === 'welcome') {
    const legacy = welcomeConfig.get(guildId);
    const imagePath = legacy?.imageFile
      ? welcomeConfig.getImagePath(legacy.imageFile)
      : path.resolve(__dirname, '..', 'assets', 'mldbot-banner.jpg');
    if (fs.existsSync(imagePath)) {
      const image = await loadImage(imagePath);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
  }

  for (const layer of config.bannerLayers || []) {
    if (layer.type === 'rect') {
      context.fillStyle = layer.color || '#5ab9dd';
      context.fillRect(layer.x, layer.y, layer.width, layer.height);
    } else if (layer.type === 'circle') {
      context.fillStyle = layer.color || '#5ab9dd';
      context.beginPath();
      context.arc(
        layer.x + layer.width / 2,
        layer.y + layer.height / 2,
        Math.min(layer.width, layer.height) / 2,
        0,
        Math.PI * 2
      );
      context.fill();
    } else if (layer.type === 'avatar') {
      const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
      context.save();
      context.beginPath();
      context.arc(
        layer.x + layer.width / 2,
        layer.y + layer.height / 2,
        Math.min(layer.width, layer.height) / 2,
        0,
        Math.PI * 2
      );
      context.clip();
      context.drawImage(avatar, layer.x, layer.y, layer.width, layer.height);
      context.restore();
    } else if (layer.type === 'text') {
      const font = SAFE_FONTS.has(layer.font) ? layer.font : 'Arial';
      context.fillStyle = layer.color || '#ffffff';
      context.font = `${layer.fontSize || 36}px "${font}"`;
      const bannerVariables = {
        ...variables,
        '%member_mention%': `@${member.displayName || member.user.username}`,
        '%member_avatar%': 'avatar'
      };
      drawWrappedText(context, replaceMessageVariables(layer.text || '', bannerVariables), layer);
    } else if (layer.type === 'image') {
      const image = await loadStoredImage(guildId, layer.imageKey);
      context.drawImage(image, layer.x, layer.y, layer.width, layer.height);
    }
  }
  return canvas.toBuffer('image/png');
}

module.exports = { renderBanner };
