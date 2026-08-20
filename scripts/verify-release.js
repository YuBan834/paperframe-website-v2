'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

function walk(directory, extension, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, extension, output);
    else if (entry.name.endsWith(extension)) output.push(absolute);
  }
  return output;
}

const javascriptFiles = [...walk(path.join(root, 'js'), '.js'), path.join(root, 'server.js')];
for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) errors.push(`${path.relative(root, file)}: ${result.stderr.trim()}`);
}

const dataFiles = ['profile.json', 'media-memory.json', 'signal.json', 'works.json', 'changelog.json'];
for (const name of dataFiles) {
  const file = path.join(root, 'data', name);
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`data/${name}: ${error.message}`);
  }
}

try {
  const mediaArchive = JSON.parse(fs.readFileSync(path.join(root, 'data/media-memory.json'), 'utf8'));
  const items = mediaArchive.items || [];
  if (items.length !== 41) errors.push(`data/media-memory.json: expected 41 items, found ${items.length}`);

  const ids = new Set();
  const referencedMedia = new Set();
  for (const item of items) {
    if (!item.id || ids.has(item.id)) errors.push(`data/media-memory.json: duplicate or missing id ${item.id || '(empty)'}`);
    ids.add(item.id);
    if (!Number.isInteger(item.year) || item.year < 1900) errors.push(`data/media-memory.json: invalid year for ${item.id}`);
    if (!item.title || typeof item.review !== 'string') errors.push(`data/media-memory.json: invalid text fields for ${item.id}`);
    if (typeof item.rating !== 'number' || item.rating < 0 || item.rating > 5) errors.push(`data/media-memory.json: invalid rating for ${item.id}`);
    if (!['anime', 'game', 'film', 'series', 'book'].includes(item.type)) errors.push(`data/media-memory.json: invalid type for ${item.id}`);
    for (const field of ['cover', 'wallpaper']) {
      if (typeof item[field] === 'string' && item[field].startsWith('assets/images/media/')) {
        referencedMedia.add(path.normalize(item[field]));
      }
    }
    for (const field of ['cover', 'wallpaper']) {
      const relative = item[field];
      if (!relative || !fs.existsSync(path.join(root, relative))) {
        errors.push(`data/media-memory.json: missing ${field} for ${item.id}`);
      }
    }
    if (!item.sourceUrl || !item.coverSource) {
      errors.push(`data/media-memory.json: missing artwork source metadata for ${item.id}`);
    }
  }

  const mediaDirectory = path.join(root, 'assets/images/media');
  const orphanedMedia = fs.readdirSync(mediaDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== 'README.md')
    .map((entry) => path.normalize(path.join('assets/images/media', entry.name)))
    .filter((relative) => !referencedMedia.has(relative));
  if (orphanedMedia.length) {
    warnings.push(`assets/images/media contains ${orphanedMedia.length} unreferenced file(s)`);
  }
} catch (_) {
  // JSON parsing is already reported above.
}

const requiredAssets = [
  'shokuhou.vrm',
  'assets/images/wallpaper/login/elaina.mp4',
  'assets/images/wallpaper/login/elaina-poster.webp',
  'assets/images/wallpaper/login/miku-background.webp',
  'assets/images/wallpaper/login/miku-character.webp',
  'assets/images/wallpaper/login/miku-water.webp',
  'assets/animations/character/angry.vrma',
  'assets/animations/character/clapping.vrma',
  'assets/animations/character/greeting.vrma',
  'assets/animations/character/laughing.vrma',
  'assets/animations/character/talking.vrma',
  'assets/animations/character/thinking.vrma',
  'assets/animations/character/tsundere.vrma',
  'assets/animations/character/yawn.vrma',
  'assets/animations/THIRD_PARTY_NOTICES.md',
  'js/character-engine.js',
  'js/field-console.js',
  'js/achievement-reward.js',
  'js/modules/signal.js',
  'assets/images/tickets/ticket-classic.png',
  'assets/images/tickets/ticket-welcome.png',
  'assets/images/tickets/ticket-mentalout.png',
  'assets/images/tickets/ticket-encore.png',
];

for (const relative of requiredAssets) {
  if (!fs.existsSync(path.join(root, relative))) errors.push(`missing asset: ${relative}`);
}

const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
if (/express\.static\(\s*ROOT\s*[,)]/.test(serverSource)) {
  errors.push('server.js: repository root must never be exposed through express.static');
}
for (const mount of ['assets', 'css', 'js', 'data']) {
  if (!serverSource.includes(`'${mount}'`)) warnings.push(`server.js: public mount ${mount} was not found`);
}

const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
for (const sensitive of ['.env', '.private/', 'messages.txt']) {
  if (!gitignore.split(/\r?\n/).includes(sensitive)) errors.push(`.gitignore: missing ${sensitive}`);
}

const publicTextFiles = [
  path.join(root, 'index.html'), path.join(root, 'ticket.html'),
  ...walk(path.join(root, 'js'), '.js'), ...walk(path.join(root, 'data'), '.json'),
];
for (const file of publicTextFiles) {
  const source = fs.readFileSync(file, 'utf8');
  if (/\bsk-[A-Za-z0-9_-]{20,}\b/.test(source)) {
    errors.push(`${path.relative(root, file)}: possible API key in public source`);
  }
}

try {
  const profile = JSON.parse(fs.readFileSync(path.join(root, 'data/profile.json'), 'utf8'));
  const socialUrls = (profile.socials || []).map((item) => String(item.url || '').trim());
  if (socialUrls.some((url) => url.includes('example@example.com') || url === 'https://github.com/' || url === 'https://github.com')) {
    warnings.push('data/profile.json still contains placeholder social links; the UI hides them until replaced.');
  }
} catch (_) {
  // JSON parsing is already reported above.
}

if (warnings.length) {
  console.warn(`Release warnings (${warnings.length}):`);
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (errors.length) {
  console.error(`Release check failed (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Release check passed: ${javascriptFiles.length} scripts, ${dataFiles.length} data files, ${requiredAssets.length} critical assets, 41 complete media records.`);
