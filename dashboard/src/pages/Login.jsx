import { useParams } from 'react-router-dom';

export default function Login({ redirectAfter }) {
  const { code } = useParams();

  function handleLogin() {
    if (redirectAfter && code) {
      sessionStorage.setItem('pendingJoinCode', code);
    }
    window.location.href = '/auth/login';
  }

  return (
    <div className="page-center">
      <div className="card">
        <h1>Meme Relay</h1>
        <p>Memes from your Discord channel, popped up on everyone's screen.</p>
        <button className="btn btn-discord" onClick={handleLogin}>
          Login with Discord
        </button>
      </div>
    </div>
  );
}
