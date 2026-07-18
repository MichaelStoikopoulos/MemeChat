const express = require('express');
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', '..', 'desktop-client', 'dist');
const INSTALLER_EXTENSIONS = ['.exe', '.dmg', '.AppImage'];

function findInstaller() {
  if (!fs.existsSync(DIST_DIR)) return null;
  const file = fs
    .readdirSync(DIST_DIR)
    .find((f) => INSTALLER_EXTENSIONS.some((ext) => f.endsWith(ext)));
  return file ? path.join(DIST_DIR, file) : null;
}

const router = express.Router();

router.get('/desktop-app', (req, res) => {
  // In production the installer is published as a GitHub release asset
  // instead of shipped with the deploy (avoids committing a ~75MB binary to
  // the repo). Locally, fall back to whatever was just built in dist/.
  if (process.env.DESKTOP_APP_DOWNLOAD_URL) {
    return res.redirect(process.env.DESKTOP_APP_DOWNLOAD_URL);
  }

  const filePath = findInstaller();
  if (!filePath) {
    return res.status(404).send('The desktop app installer has not been built yet.');
  }
  res.download(filePath);
});

module.exports = router;
