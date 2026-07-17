const dropEl = document.getElementById('drop');
const imageEl = document.getElementById('image');
const videoEl = document.getElementById('video');
const textEl = document.getElementById('text');
const authorEl = document.getElementById('author');
const avatarEl = document.getElementById('avatar');

const IMAGE_DISPLAY_MS = 6500;
const FADE_MS = 300;

let dismissTimeout = null;
let audioCtx = null;

function playChime() {
  try {
    audioCtx = audioCtx || new AudioContext();
    const now = audioCtx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.5, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch {
    // Audio isn't essential to the drop; ignore failures (e.g. no audio device).
  }
}

function dismiss() {
  dropEl.classList.remove('visible');
  setTimeout(() => {
    videoEl.pause();
  }, FADE_MS);
  window.api.hideOverlay();
}

window.api.onShowDrop((payload) => {
  if (dismissTimeout) clearTimeout(dismissTimeout);
  videoEl.onended = null;
  videoEl.onerror = null;
  videoEl.pause();
  videoEl.removeAttribute('src');
  imageEl.style.display = 'none';
  videoEl.style.display = 'none';

  if (payload.mediaType === 'video') {
    videoEl.src = payload.mediaUrl;
    videoEl.volume = 0.9;
    videoEl.muted = false;
    videoEl.style.display = 'block';
    videoEl.play().catch(() => {});
    // A video's own length decides how long it's shown, not a fixed timer —
    // otherwise short clips loop mid-display and long ones get cut off.
    videoEl.onended = dismiss;
    videoEl.onerror = dismiss;
  } else if (payload.mediaType === 'image') {
    imageEl.src = payload.mediaUrl;
    imageEl.style.display = 'block';
    dismissTimeout = setTimeout(dismiss, IMAGE_DISPLAY_MS);
  } else {
    dismissTimeout = setTimeout(dismiss, IMAGE_DISPLAY_MS);
  }

  textEl.textContent = payload.text || '';
  textEl.style.display = payload.text ? 'block' : 'none';
  authorEl.textContent = payload.author || '';
  avatarEl.src = payload.authorAvatar || '';

  dropEl.classList.add('visible');
  playChime();
});
