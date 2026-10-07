const fs = require('node:fs');
const path = require('node:path');

function validUses(value) {
  return Number.isInteger(value) && value >= 0;
}

function validateData(data, filePath) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`Structură invalidă în baza de invitații ${filePath}.`);
  }

  for (const [guildId, guildData] of Object.entries(data)) {
    if (!/^\d+$/.test(guildId) ||
        !guildData || typeof guildData !== 'object' ||
        !guildData.invites || typeof guildData.invites !== 'object' ||
        !guildData.totals || typeof guildData.totals !== 'object' ||
        (guildData.vanityUses !== undefined &&
          guildData.vanityUses !== null && !validUses(guildData.vanityUses))) {
      throw new Error(`Date invalide pentru serverul ${guildId} în baza de invitații ${filePath}.`);
    }

    for (const [code, invite] of Object.entries(guildData.invites)) {
      if (!code || !invite || !validUses(invite.uses) ||
          (invite.inviterId !== null && typeof invite.inviterId !== 'string')) {
        throw new Error(`Invitație invalidă (${code}) în baza de invitații ${filePath}.`);
      }
    }

    for (const [inviterId, count] of Object.entries(guildData.totals)) {
      if (!/^\d+$/.test(inviterId) || !validUses(count)) {
        throw new Error(`Contor invalid pentru ${inviterId} în baza de invitații ${filePath}.`);
      }
    }
  }
}

class InviteTracker {
  constructor(filePath = path.resolve(process.env.INVITE_DATA_FILE || './data/invites.json')) {
    this.filePath = filePath;
    this.data = {};
    this.guildQueues = new Map();
  }

  initialize() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) return;

    const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    validateData(parsed, this.filePath);
    this.data = parsed;
  }

  persist() {
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(temporaryPath, this.filePath);
  }

  async withGuildQueue(guildId, operation) {
    const previous = this.guildQueues.get(guildId) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    this.guildQueues.set(guildId, current);
    await previous;

    try {
      return await operation();
    } finally {
      release();
      if (this.guildQueues.get(guildId) === current) {
        this.guildQueues.delete(guildId);
      }
    }
  }

  async syncGuild(guild) {
    return this.withGuildQueue(guild.id, async () => {
      const fetchedInvites = await guild.invites.fetch();
      const stored = this.data[guild.id];
      const previous = stored
        ? structuredClone(stored)
        : { invites: {}, totals: {} };
      const vanityUses = await this.readVanityUses(guild);
      const currentInvites = {};
      let changed = !stored || previous.vanityUses !== vanityUses;

      for (const invite of fetchedInvites.values()) {
        const uses = invite.uses || 0;
        if (!validUses(uses)) {
          throw new Error(`Număr de utilizări invalid pentru invitația ${invite.code}.`);
        }

        const inviterId = invite.inviter?.id || null;
        const oldInvite = previous.invites[invite.code];
        const increase = oldInvite ? Math.max(0, uses - oldInvite.uses) : uses;

        if (increase > 0 && inviterId) {
          previous.totals[inviterId] = (previous.totals[inviterId] || 0) + increase;
          changed = true;
        }

        currentInvites[invite.code] = { uses, inviterId };
      }

      if (JSON.stringify(previous.invites) !== JSON.stringify(currentInvites)) {
        changed = true;
      }

      previous.invites = currentInvites;
      previous.vanityUses = vanityUses;
      this.data[guild.id] = previous;
      if (changed) this.persist();
    });
  }

  async readVanityUses(guild) {
    if (typeof guild.fetchVanityData !== 'function') return null;
    try {
      const vanity = await guild.fetchVanityData();
      return validUses(vanity?.uses) ? vanity.uses : null;
    } catch (error) {
      console.warn(`Nu am putut citi utilizările vanity URL pentru serverul ${guild.id}: ${error.message}`);
      return null;
    }
  }

  async handleMemberJoin(member) {
    return this.withGuildQueue(member.guild.id, async () => {
      const fetchedInvites = await member.guild.invites.fetch();
      const stored = this.data[member.guild.id];
      const previous = stored
        ? structuredClone(stored)
        : { invites: {}, totals: {} };
      const currentInvites = {};
      const increasedInviterIds = new Set();
      const increasedInviteCodes = [];

      for (const invite of fetchedInvites.values()) {
        const uses = invite.uses || 0;
        if (!validUses(uses)) {
          throw new Error(`Număr de utilizări invalid pentru invitația ${invite.code}.`);
        }

        const inviterId = invite.inviter?.id || null;
        const oldInvite = previous.invites[invite.code];
        const increase = oldInvite ? Math.max(0, uses - oldInvite.uses) : uses;

        if (increase > 0 && inviterId) {
          previous.totals[inviterId] = (previous.totals[inviterId] || 0) + increase;
          increasedInviterIds.add(inviterId);
          increasedInviteCodes.push(invite.code);
        }

        currentInvites[invite.code] = { uses, inviterId };
      }

      const vanityUses = await this.readVanityUses(member.guild);
      const vanityUsed = vanityUses !== null &&
        previous.vanityUses !== undefined && vanityUses > previous.vanityUses;
      const inviteCode = increasedInviteCodes.length === 1 ? increasedInviteCodes[0] : null;
      previous.invites = currentInvites;
      previous.vanityUses = vanityUses;
      this.data[member.guild.id] = previous;
      this.persist();

      const detectedInviterId = increasedInviterIds.size === 1
        ? increasedInviterIds.values().next().value
        : null;

      return {
        inviterId: vanityUsed ? null : detectedInviterId,
        inviteCount: vanityUsed ? 0 : detectedInviterId
          ? previous.totals[detectedInviterId] || 0
          : null,
        inviteCode: vanityUsed ? null : inviteCode,
        kind: vanityUsed ? 'vanity' : detectedInviterId && inviteCode ? 'normal' : 'unknown'
      };
    });
  }
}

module.exports = { InviteTracker };
