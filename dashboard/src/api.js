async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (res.status === 401) {
    const err = new Error('not_authenticated');
    err.status = 401;
    throw err;
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed: ${res.status}`);
  }
  return data;
}

export const api = {
  me: () => request('/api/me'),
  groups: () => request('/api/groups'),
  createGroup: (name) => request('/api/groups', { method: 'POST', body: JSON.stringify({ name }) }),
  group: (id) => request(`/api/groups/${id}`),
  setChannel: (id, guildId, channelId) =>
    request(`/api/groups/${id}/channel`, {
      method: 'PUT',
      body: JSON.stringify({ guildId, channelId }),
    }),
  guilds: () => request('/api/guilds'),
  channels: (guildId) => request(`/api/guilds/${guildId}/channels`),
  botInviteUrl: () => request('/api/bot-invite-url'),
  join: (code) => request(`/api/join/${code}`, { method: 'POST' }),
  pairingCode: (groupId) => request(`/api/groups/${groupId}/pairing-code`, { method: 'POST' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
};
