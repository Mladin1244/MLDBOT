const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const supportedExtensions = new Set(['.jpg', '.png', '.gif', '.webp']);

function createWelcomeConfig(
  configFilePath = path.resolve('./data/welcome-config.json'),
  imagesDirectory = path.resolve('./data/welcome-images')
) {
  function validate(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`Structură invalidă în configurația de bun venit ${configFilePath}.`);
    }

    for (const [guildId, config] of Object.entries(data)) {
      if (!/^\d{17,20}$/.test(guildId) ||
          !config || typeof config !== 'object' ||
          !/^\d{17,20}$/.test(config.channelId) ||
          (config.imageFile !== null && config.imageFile !== undefined &&
            (typeof config.imageFile !== 'string' ||
              path.basename(config.imageFile) !== config.imageFile ||
              !config.imageFile.startsWith(`${guildId}-`) ||
              !supportedExtensions.has(path.extname(config.imageFile))))) {
        throw new Error(`Configurație de bun venit invalidă pentru serverul ${guildId}.`);
      }
    }
  }

  function load() {
    if (!fs.existsSync(configFilePath)) return {};

    const data = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
    validate(data);
    return data;
  }

  function save(data) {
    validate(data);
    fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
    const temporaryPath = `${configFilePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temporaryPath, configFilePath);
  }

  function get(guildId) {
    return load()[guildId] || null;
  }

  function getAll() {
    return load();
  }

  async function set(guildId, { channelId, imageBuffer = null, imageExtension = null }) {
    if (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(channelId)) {
      throw new Error('ID-ul serverului sau al canalului Discord nu este valid.');
    }

    const data = load();
    const previousImageFile = data[guildId]?.imageFile || null;
    let imageFile = previousImageFile;

    if (imageBuffer) {
      if (!Buffer.isBuffer(imageBuffer) || !supportedExtensions.has(imageExtension)) {
        throw new Error('Imaginea de bun venit sau extensia ei nu este validă.');
      }
      imageFile = `${guildId}-${randomUUID()}${imageExtension}`;
      fs.mkdirSync(imagesDirectory, { recursive: true });
      const imagePath = path.join(imagesDirectory, imageFile);
      const temporaryImagePath = `${imagePath}.tmp`;
      fs.writeFileSync(temporaryImagePath, imageBuffer);
      fs.renameSync(temporaryImagePath, imagePath);
    }

    data[guildId] = { channelId, imageFile };
    try {
      save(data);
    } catch (error) {
      if (imageFile) fs.rmSync(path.join(imagesDirectory, imageFile), { force: true });
      throw error;
    }

    if (previousImageFile && previousImageFile !== imageFile) {
      fs.rmSync(path.join(imagesDirectory, previousImageFile), { force: true });
    }
  }

  function remove(guildId) {
    const data = load();
    const previousImageFile = data[guildId]?.imageFile || null;
    const existed = Object.hasOwn(data, guildId);
    delete data[guildId];
    if (existed) {
      save(data);
      if (previousImageFile) {
        fs.rmSync(path.join(imagesDirectory, previousImageFile), { force: true });
      }
    }
    return existed;
  }

  function getImagePath(imageFile) {
    if (typeof imageFile !== 'string' ||
        path.basename(imageFile) !== imageFile ||
        !supportedExtensions.has(path.extname(imageFile))) {
      throw new Error('Fișierul imaginii de bun venit nu este valid.');
    }
    return path.join(imagesDirectory, imageFile);
  }

  return { get, getAll, getImagePath, remove, set };
}

module.exports = createWelcomeConfig();
module.exports.createWelcomeConfig = createWelcomeConfig;
