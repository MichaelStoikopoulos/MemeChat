const form = document.getElementById('link-form');
const submitBtn = document.getElementById('submit');
const errorEl = document.getElementById('error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Linking…';

  const serverUrl = document.getElementById('serverUrl').value.trim();
  const code = document.getElementById('code').value.trim();

  try {
    await window.api.pair(serverUrl, code);
    // On success the main process closes this window.
  } catch (err) {
    errorEl.textContent = err.message || 'Failed to link device';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Link device';
  }
});
