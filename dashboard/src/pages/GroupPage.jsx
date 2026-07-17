import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function GroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);
  const [guilds, setGuilds] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [botInviteUrl, setBotInviteUrl] = useState('');
  const [pairing, setPairing] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  function load() {
    api
      .group(id)
      .then((g) => {
        setGroup(g);
        setSelectedGuild(g.guild_id || '');
        setRenameValue(g.name);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (group && group.isOwner) {
      api.guilds().then(setGuilds).catch(() => {});
      api.botInviteUrl().then((r) => setBotInviteUrl(r.url)).catch(() => {});
    }
  }, [group && group.isOwner]);

  useEffect(() => {
    if (selectedGuild) {
      api.channels(selectedGuild).then(setChannels).catch(() => setChannels([]));
    } else {
      setChannels([]);
    }
  }, [selectedGuild]);

  async function handleSaveChannel(e) {
    e.preventDefault();
    if (!selectedGuild || !selectedChannel) return;
    try {
      await api.setChannel(id, selectedGuild, selectedChannel);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateCode() {
    try {
      const result = await api.pairingCode(id);
      setPairing(result);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRename(e) {
    e.preventDefault();
    const name = renameValue.trim();
    if (!name || name === group.name) return;
    setRenaming(true);
    try {
      await api.renameGroup(id, name);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.deleteGroup(id);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  if (error) return <div className="page-center error">{error}</div>;
  if (!group) return <div className="page-center"><div className="spinner" /></div>;

  const inviteLink = `${window.location.origin}/join/${group.invite_code}`;

  return (
    <div className="page">
      <header className="topbar">
        <button className="btn btn-ghost" onClick={() => navigate('/')}>← Groups</button>
        <h1>{group.name}</h1>
      </header>

      <main className="content">
        <section className="card">
          <h2>Watched channel</h2>
          {group.channel_id ? (
            <p>
              Watching <strong>#{group.channel_name}</strong> in <strong>{group.guild_name}</strong>
            </p>
          ) : (
            <p>No channel set yet.</p>
          )}

          {group.isOwner && group.guild_id && !group.botInGuild && (
            <p className="warn">
              The bot isn't in <strong>{group.guild_name}</strong> anymore.{' '}
              <a href={botInviteUrl} target="_blank" rel="noreferrer">Invite the bot</a> then refresh.
            </p>
          )}

          {group.isOwner && (
            <form className="channel-form" onSubmit={handleSaveChannel}>
              {guilds.length === 0 && (
                <p>
                  The bot isn't in any servers yet.{' '}
                  {botInviteUrl && <a href={botInviteUrl} target="_blank" rel="noreferrer">Invite the bot</a>}
                  {' '}then refresh this page.
                </p>
              )}
              <select value={selectedGuild} onChange={(e) => setSelectedGuild(e.target.value)}>
                <option value="">Select a server…</option>
                {guilds.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                disabled={!selectedGuild}
              >
                <option value="">Select a channel…</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
              </select>
              <button className="btn" type="submit" disabled={!selectedGuild || !selectedChannel}>
                Save
              </button>
            </form>
          )}
        </section>

        <section className="card">
          <h2>Members ({group.members.length})</h2>
          <ul className="member-list">
            {group.members.map((m) => (
              <li key={m.id}>{m.username}</li>
            ))}
          </ul>
          <p>Invite link — share with people who should join this group:</p>
          <div className="copy-row">
            <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
            <button className="btn" onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy</button>
          </div>
        </section>

        <section className="card">
          <h2>Link your desktop app</h2>
          <p>Don't have the desktop app installed yet? Grab the installer, run it, then link with a code below.</p>
          <a className="btn btn-ghost" href="/download/desktop-app">⬇ Download desktop app</a>

          <p style={{ marginTop: 18 }}>
            Generate a one-time code (valid 10 minutes) and enter it in the desktop app's link window.
          </p>
          <button className="btn" onClick={handleGenerateCode}>Generate code</button>
          {pairing && (
            <p className="pairing-code">
              <strong>{pairing.code}</strong> — expires {new Date(pairing.expiresAt).toLocaleTimeString()}
            </p>
          )}
        </section>

        {group.isOwner && (
          <section className="card">
            <h2>Group settings</h2>

            <form className="channel-form" onSubmit={handleRename}>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Group name"
              />
              <button
                className="btn btn-ghost"
                type="submit"
                disabled={renaming || !renameValue.trim() || renameValue.trim() === group.name}
              >
                {renaming ? 'Renaming…' : 'Rename'}
              </button>
            </form>

            <div className="danger-zone">
              {!confirmingDelete ? (
                <button className="btn btn-danger" onClick={() => setConfirmingDelete(true)}>
                  Delete group
                </button>
              ) : (
                <div className="danger-confirm">
                  <p className="warn">
                    This permanently deletes <strong>{group.name}</strong> and unlinks every paired
                    device. This can't be undone.
                  </p>
                  <div className="danger-confirm-actions">
                    <button className="btn btn-ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                      Cancel
                    </button>
                    <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                      {deleting ? 'Deleting…' : 'Yes, delete it'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
