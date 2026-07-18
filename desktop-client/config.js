// Baked into the app at build time so people linking their device only have
// to enter a pairing code, not the server URL. Update this before running
// `npm run build` if the server's address changes (e.g. a new tunnel URL or
// once it's on a real domain).
module.exports = {
  SERVER_URL: 'https://memechat-production-f040.up.railway.app/',
};
