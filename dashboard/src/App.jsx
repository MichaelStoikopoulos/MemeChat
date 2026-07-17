import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import GroupPage from './pages/GroupPage.jsx';
import Join from './pages/Join.jsx';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return <div className="page-center"><div className="spinner" /></div>;
  }

  if (user === null) {
    return (
      <Routes>
        <Route path="/join/:code" element={<Login redirectAfter />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard user={user} />} />
      <Route path="/groups/:id" element={<GroupPage user={user} />} />
      <Route path="/join/:code" element={<Join />} />
      <Route path="*" element={<Dashboard user={user} />} />
    </Routes>
  );
}
