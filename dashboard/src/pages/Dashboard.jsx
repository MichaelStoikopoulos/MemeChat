import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function Dashboard({ user }) {
  const [groups, setGroups] = useState(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const pendingCode = sessionStorage.getItem('pendingJoinCode');
    if (pendingCode) {
      sessionStorage.removeItem('pendingJoinCode');
      api
        .join(pendingCode)
        .then(({ groupId }) => navigate(`/groups/${groupId}`))
        .catch(() => loadGroups());
      return;
    }
    loadGroups();
  }, []);

  function loadGroups() {
    api.groups().then(setGroups).catch((err) => setError(err.message));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const group = await api.createGroup(newName.trim());
      setNewName('');
      navigate(`/groups/${group.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>MemeChat</h1>
        <div className="topbar-user">
          <span>{user.username}</span>
          <button className="btn btn-ghost" onClick={() => api.logout().then(() => window.location.reload())}>
            Log out
          </button>
        </div>
      </header>

      <main className="content">
        <h2>Your groups</h2>
        {error && <p className="error">{error}</p>}

        {groups === null ? (
          <div className="spinner" />
        ) : groups.length === 0 ? (
          <p>You're not in any groups yet. Create one below.</p>
        ) : (
          <ul className="group-list">
            {groups.map((g) => (
              <li key={g.id}>
                <a href={`/groups/${g.id}`} onClick={(e) => { e.preventDefault(); navigate(`/groups/${g.id}`); }}>
                  <span className="group-avatar">{g.name.trim()[0]?.toUpperCase()}</span>
                  {g.name} {g.isOwner && <span className="badge">owner</span>}
                  <span className="chevron">→</span>
                </a>
              </li>
            ))}
          </ul>
        )}

        <form className="create-group" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="New group name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn" type="submit">Create group</button>
        </form>
      </main>
    </div>
  );
}
