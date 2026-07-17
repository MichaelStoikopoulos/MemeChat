const dropEl = document.getElementById('drop');
const imageEl = document.getElementById('image');
const textEl = document.getElementById('text');
const authorEl = document.getElementById('author');

let hideTimeout = null;

window.api.onShowDrop((payload) => {
  imageEl.src = payload.imageUrl;
  textEl.textContent = payload.text || '';
  textEl.style.display = payload.text ? 'block' : 'none';
  authorEl.textContent = payload.author ? `from ${payload.author}` : '';

  dropEl.classList.add('visible');

  if (hideTimeout) clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    dropEl.classList.remove('visible');
  }, 7500);
});
