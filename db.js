const fs = require('node:fs');
const path = require('node:path');

const filePath = path.resolve(process.env.DATA_FILE || './data/database.json');

function newUser(id, username) {
  return {
    id,
    username,
    language: null,
    credits: 1000,
    dailyAt: 0,
    stats: { wins: 0, losses: 0, pushes: 0, profit: 0 }
  };
}

function validateUser(user) {
  if (!user || typeof user !== 'object' ||
      !Number.isFinite(user.credits) || user.credits < 0 ||
      !Number.isFinite(user.dailyAt) ||
      (user.language !== null && user.language !== 'ro' && user.language !== 'en') ||
      !user.stats || !Number.isFinite(user.stats.wins) ||
      !Number.isFinite(user.stats.losses) || !Number.isFinite(user.stats.pushes) ||
      !Number.isFinite(user.stats.profit)) {
    throw new Error('Date de utilizator invalide în baza de date; datele nu au fost modificate.');
  }
}

class JsonDatabase {
  constructor() {
    this.data = { users: {} };
  }

  initialize() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      this.persist();
      return;
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || typeof parsed.users !== 'object' || Array.isArray(parsed.users)) {
      throw new Error(`Structură JSON invalidă în ${filePath}.`);
    }
    let migrated = false;
    for (const user of Object.values(parsed.users)) {
      if (!user || typeof user !== 'object') validateUser(user);
      if (!Object.hasOwn(user, 'language')) {
        user.language = null;
        migrated = true;
      } else if (user.language !== null && user.language !== 'ro' && user.language !== 'en') {
        user.language = 'en';
        migrated = true;
      }
      validateUser(user);
    }
    this.data = parsed;
    if (migrated) this.persist();
  }

  persist() {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  }

  ensureUser(id, username = 'Utilizator', save = true) {
    let user = this.data.users[id];
    if (!user) {
      user = newUser(id, username);
      this.data.users[id] = user;
      if (save) this.persist();
    } else {
      validateUser(user);
      if (username && user.username !== username) {
        user.username = username;
        if (save) this.persist();
      }
    }
    return user;
  }

  getUser(id, username) {
    return structuredClone(this.ensureUser(id, username));
  }

  getBalance(id, username) {
    return this.ensureUser(id, username).credits;
  }

  setLanguage(id, username, language) {
    if (language !== 'ro' && language !== 'en') {
      throw new Error('Limba trebuie să fie „ro” sau „en”.');
    }
    return this.update(() => {
      const user = this.ensureUser(id, username, false);
      user.language = language;
    });
  }

  update(operation) {
    const snapshot = structuredClone(this.data);
    try {
      const result = operation();
      for (const user of Object.values(this.data.users)) validateUser(user);
      this.persist();
      return result;
    } catch (error) {
      this.data = snapshot;
      throw error;
    }
  }

  transfer(fromId, fromName, toId, toName, amount) {
    return this.update(() => {
      const from = this.ensureUser(fromId, fromName, false);
      const to = this.ensureUser(toId, toName, false);
      if (from.credits < amount) throw new Error('Nu ai suficiente credite.');
      from.credits -= amount;
      to.credits += amount;
    });
  }

  reserve(players, amount) {
    return this.update(() => {
      const users = players.map(({ id, username }) => this.ensureUser(id, username, false));
      if (users.some((user) => user.credits < amount)) {
        throw new Error('Unul dintre jucători nu mai are suficiente credite pentru miză.');
      }
      for (const user of users) user.credits -= amount;
    });
  }

  pay(id, username, amount, result, profit) {
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(profit)) {
      throw new Error('Suma decontată nu este validă.');
    }
    return this.update(() => {
      const user = this.ensureUser(id, username, false);
      user.credits += amount;
      user.stats.profit += profit;
      if (result === 'win') user.stats.wins += 1;
      else if (result === 'loss') user.stats.losses += 1;
      else user.stats.pushes += 1;
    });
  }

  settle(entries) {
    return this.update(() => {
      for (const entry of entries) {
        if (!Number.isFinite(entry.amount) || entry.amount < 0 || !Number.isFinite(entry.profit)) {
          throw new Error('Suma decontată invalidă.');
        }
        const user = this.ensureUser(entry.id, entry.username, false);
        user.credits += entry.amount;
        user.stats.profit += entry.profit;
        if (entry.result === 'win') user.stats.wins += 1;
        else if (entry.result === 'loss') user.stats.losses += 1;
        else user.stats.pushes += 1;
      }
    });
  }

  daily(id, username, now, cooldown) {
    return this.update(() => {
      const user = this.ensureUser(id, username, false);
      const nextAt = user.dailyAt + cooldown;
      if (now < nextAt) return { claimed: false, nextAt };
      user.credits += 100;
      user.dailyAt = now;
      return { claimed: true, nextAt: now + cooldown };
    });
  }

  adminChange(id, username, amount) {
    return this.update(() => {
      const user = this.ensureUser(id, username, false);
      if (user.credits + amount < 0) throw new Error('Soldul nu poate deveni negativ.');
      user.credits += amount;
    });
  }

  reset(id, username) {
    return this.update(() => {
      this.data.users[id] = newUser(id, username);
    });
  }

  leaderboard() {
    return Object.values(this.data.users)
      .sort((a, b) => b.credits - a.credits)
      .map((user) => ({ ...user }));
  }
}

module.exports = new JsonDatabase();
