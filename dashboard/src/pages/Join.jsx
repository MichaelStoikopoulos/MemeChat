import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function Join() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .join(code)
      .then(({ groupId }) => navigate(`/groups/${groupId}`, { replace: true }))
      .catch((err) => setError(err.message));
  }, [code]);

  if (error) {
    return (
      <div className="page-center error">
        Couldn't join: {error}
      </div>
    );
  }

  return (
    <div className="page-center">
      <div>
        <div className="spinner" />
        <p style={{ marginTop: 16 }}>Joining group…</p>
      </div>
    </div>
  );
}
