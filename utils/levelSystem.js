const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const XP_COOLDOWN_MS = 60_000;
const CHAT_MISSION_TARGET = 10;
const COMMAND_MISSION_TARGET = 2;
const MISSION_REWARD_XP = 60;
const PUBLIC_MISSION_COMMANDS = [
  'blackjack',
  'craps',
  'credite',
  'daily',
  'glitchhelp',
  'leaderboard',
  'poker',
  'stats'
];
const IMAGE_EXTENSIONS = new Set(['.jpg', '.png', '.gif', '.webp']);

function hashNumber(value) {
  return createHash('sha256').update(value).digest().readUInt32BE(0);
}

function dayKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function xpForNextLevel(level) {
  return 100 + level * 50;
}

function createDailyMissions(guildId, date) {
  const index = hashNumber(`${guildId}:${date}`) % PUBLIC_MISSION_COMMANDS.length;
  return {
    date,
    chat: { progress: 0, target: CHAT_MISSION_TARGET, completed: false },
    command: {
      name: PUBLIC_MISSION_COMMANDS[index],
      progress: 0,
      target: COMMAND_MISSION_TARGET,
      completed: false
    }
  };
}

function validateDatabase(database, filePath) {
  if (!database || typeof database !== 'object' ||
      Array.isArray(database) || !database.guilds ||
      typeof database.guilds !== 'object' || Array.isArray(database.guilds)) {
    throw new Error(`Structură invalidă în baza de date de level ${filePath}.`);
  }

  for (const [guildId, guild] of Object.entries(database.guilds)) {
    if (!/^\d{17,20}$/.test(guildId) || !guild || typeof guild !== 'object' ||
        !guild.users || typeof guild.users !== 'object' || Array.isArray(guild.users)) {
      throw new Error(`Date de level invalide pentru serverul ${guildId}.`);
    }

    for (const [userId, user] of Object.entries(guild.users)) {
      if (!/^\d{17,20}$/.test(userId) || !user || typeof user !== 'object' ||
          !Number.isSafeInteger(user.level) || user.level < 0 ||
          !Number.isSafeInteger(user.xp) || user.xp < 0 ||
          user.xp >= xpForNextLevel(user.level) ||
          !Number.isFinite(user.lastMessageAt) || user.lastMessageAt < 0 ||
          !user.missions || typeof user.missions !== 'object') {
        throw new Error(`Profil de level invalid pentru utilizatorul ${userId}.`);
      }

      const missions = user.missions;
      if (typeof missions.date !== 'string' ||
          !missions.chat || !Number.isSafeInteger(missions.chat.progress) ||
          !Number.isSafeInteger(missions.chat.target) ||
          typeof missions.chat.completed !== 'boolean' ||
          !missions.command ||
          !PUBLIC_MISSION_COMMANDS.includes(missions.command.name) ||
          !Number.isSafeInteger(missions.command.progress) ||
          !Number.isSafeInteger(missions.command.target) ||
          typeof missions.command.completed !== 'boolean') {
        throw new Error(`Misiuni invalide pentru utilizatorul ${userId}.`);
      }
    }
  }
}

function createLevelSystem(filePath = path.resolve('./data/levels.json')) {
  let database = { guilds: {} };

  function persist() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(database, null, 2), 'utf8');
    fs.renameSync(temporaryPath, filePath);
  }

  function initialize() {
    if (!fs.existsSync(filePath)) return;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    validateDatabase(parsed, filePath);
    database = parsed;
  }

  function ensureUser(guildId, userId) {
    if (!database.guilds[guildId]) database.guilds[guildId] = { users: {} };
    const guild = database.guilds[guildId];
    if (!guild.users[userId]) {
      guild.users[userId] = {
        level: 0,
        xp: 0,
        lastMessageAt: 0,
        missions: createDailyMissions(guildId, dayKey(Date.now()))
      };
    }
    return guild.users[userId];
  }

  function getUser(guildId, userId, now = Date.now()) {
    if (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(userId)) {
      throw new Error('ID-ul serverului sau al utilizatorului nu este valid.');
    }
    const existing = database.guilds[guildId]?.users[userId];
    const profile = existing
      ? structuredClone(existing)
      : {
          level: 0,
          xp: 0,
          lastMessageAt: 0,
          missions: createDailyMissions(guildId, dayKey(now))
        };
    if (profile.missions.date !== dayKey(now)) {
      profile.missions = createDailyMissions(guildId, dayKey(now));
    }
    return profile;
  }

  function applyXp(profile, amount) {
    profile.xp += amount;
    const levelUps = [];
    while (profile.xp >= xpForNextLevel(profile.level)) {
      profile.xp -= xpForNextLevel(profile.level);
      profile.level += 1;
      levelUps.push(profile.level);
    }
    return levelUps;
  }

  function recordActivity(guildId, userId, type, now, options = {}) {
    if (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(userId) ||
        !Number.isFinite(now) || now < 0) {
      throw new Error('Datele activității de level nu sunt valide.');
    }
    if (!['message', 'command'].includes(type)) {
      throw new Error('Tipul activității de level nu este recunoscut.');
    }

    const snapshot = structuredClone(database);
    try {
      const profile = ensureUser(guildId, userId);
      if (profile.missions.date !== dayKey(now)) {
        profile.missions = createDailyMissions(guildId, dayKey(now));
      }

      const previousLevel = profile.level;
      let xpAwarded = 0;
      const completedMissions = [];

      if (type === 'message' && now - profile.lastMessageAt >= XP_COOLDOWN_MS) {
        profile.lastMessageAt = now;
        if (!profile.missions.chat.completed) {
          profile.missions.chat.progress = Math.min(
            profile.missions.chat.target,
            profile.missions.chat.progress + 1
          );
          if (profile.missions.chat.progress >= profile.missions.chat.target) {
            profile.missions.chat.completed = true;
            completedMissions.push('chat');
            xpAwarded += MISSION_REWARD_XP;
          }
        }
        xpAwarded += 15 + (hashNumber(`${guildId}:${userId}:${now}`) % 11);
      }

      if (type === 'command' &&
          options.commandName === profile.missions.command.name &&
          !profile.missions.command.completed) {
        profile.missions.command.progress = Math.min(
          profile.missions.command.target,
          profile.missions.command.progress + 1
        );
        if (profile.missions.command.progress >= profile.missions.command.target) {
          profile.missions.command.completed = true;
          completedMissions.push('command');
          xpAwarded += MISSION_REWARD_XP;
        }
      }

      const levelUps = xpAwarded > 0 ? applyXp(profile, xpAwarded) : [];
      validateDatabase(database, filePath);
      persist();
      return {
        profile: structuredClone(profile),
        xpAwarded,
        levelUps,
        previousLevel,
        completedMissions
      };
    } catch (error) {
      database = snapshot;
      throw error;
    }
  }

  function getLeaderboard(guildId) {
    return Object.entries(database.guilds[guildId]?.users || {})
      .map(([userId, profile]) => ({ userId, ...profile }))
      .sort((left, right) => right.level - left.level || right.xp - left.xp);
  }

  function storeImage(guildId, buffer, extension, imagesDirectory = path.resolve('./data/level-images')) {
    if (!/^\d{17,20}$/.test(guildId) || !Buffer.isBuffer(buffer) ||
        !IMAGE_EXTENSIONS.has(extension)) {
      throw new Error('Imaginea pentru mesajele de level-up nu este validă.');
    }
    fs.mkdirSync(imagesDirectory, { recursive: true });
    const filename = `${guildId}-${randomUUID()}${extension}`;
    const imagePath = path.join(imagesDirectory, filename);
    const temporaryPath = `${imagePath}.tmp`;
    fs.writeFileSync(temporaryPath, buffer);
    fs.renameSync(temporaryPath, imagePath);
    return { filename, imagePath };
  }

  function getImagePath(filename, imagesDirectory = path.resolve('./data/level-images')) {
    if (typeof filename !== 'string' ||
        path.basename(filename) !== filename ||
        !/^\d{17,20}-[\w-]+\.(jpg|png|gif|webp)$/.test(filename)) {
      throw new Error('Fișierul imaginii de level-up nu este valid.');
    }
    return path.join(imagesDirectory, filename);
  }

  return {
    getLeaderboard,
    getUser,
    initialize,
    recordActivity,
    storeImage,
    getImagePath,
    xpForNextLevel,
    XP_COOLDOWN_MS,
    MISSION_REWARD_XP,
    PUBLIC_MISSION_COMMANDS
  };
}

module.exports = createLevelSystem();
module.exports.createLevelSystem = createLevelSystem;
