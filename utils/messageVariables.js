const MESSAGE_VARIABLES = [
  '%member_mention%',
  '%member_name%',
  '%member_tag%',
  '%member_id%',
  '%member_avatar%',
  '%server_name%',
  '%member_count%',
  '%inviter%',
  '%inviter_mention%',
  '%inviter_id%',
  '%inviter_invites%',
  '%invite_code%',
  '%account_age%',
  '%joined_duration%'
];

function replaceMessageVariables(template, values) {
  return MESSAGE_VARIABLES.reduce(
    (message, variable) => message.replaceAll(variable, String(values[variable] ?? 'necunoscut')),
    template
  );
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return 'necunoscut';
  const seconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor(seconds % 86_400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  if (days) return `${days} zile`;
  if (hours) return `${hours} ore`;
  return `${minutes} minute`;
}

function memberMessageVariables(member, attribution = {}) {
  const inviterId = attribution.inviterId || null;
  const inviter = inviterId ? `<@${inviterId}>` : 'necunoscut';
  const accountAge = Date.now() - member.user.createdTimestamp;
  const joinedDuration = member.joinedTimestamp
    ? Date.now() - member.joinedTimestamp
    : NaN;
  return {
    '%member_mention%': `<@${member.id}>`,
    '%member_name%': member.user.globalName || member.user.username || 'necunoscut',
    '%member_tag%': member.user.tag || member.user.username || 'necunoscut',
    '%member_id%': member.id,
    '%member_avatar%': member.user.displayAvatarURL({ extension: 'png', size: 256 }),
    '%server_name%': member.guild.name || 'necunoscut',
    '%member_count%': String(member.guild.memberCount || 0),
    '%inviter%': inviter,
    '%inviter_mention%': inviter,
    '%inviter_id%': inviterId || 'necunoscut',
    '%inviter_invites%': String(attribution.inviteCount ?? 0),
    '%invite_code%': attribution.inviteCode || 'necunoscut',
    '%account_age%': formatDuration(accountAge),
    '%joined_duration%': formatDuration(joinedDuration)
  };
}

module.exports = { MESSAGE_VARIABLES, memberMessageVariables, replaceMessageVariables };
