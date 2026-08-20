const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'data', 'media-memory.json');
const mediaDir = path.join(root, 'assets', 'images', 'media');

const kitsu = {
  m01: 11614, m09: 7158, m10: 4478, m11: 43248,
  m12: 45469, m22: 48618, m23: 5497, m24: 47356,
  m31: 7023, m32: 21, m37: 5646, m38: 7203,
};

const steam = {
  m02: 391540, m04: 553640, m06: 105600, m07: 8500,
  m18: 1091500, m19: 2167960, m20: 281990, m21: 730,
  m25: 1245620, m26: 1238810, m27: 347620, m28: 1237370,
  m29: 394360, m30: 1451940, m39: 2161700, m40: 1388880,
  m41: 1607200,
};

const appStore = {
  m03: 1517783697,
  m05: 1290687550,
  m13: 1571873795,
  m16: 1535759278,
};

const sourcePages = {
  m03: 'https://apps.apple.com/us/app/genshin-impact/id1517783697',
  m05: 'https://apps.apple.com/us/app/cytus-ii/id1290687550',
  m13: 'https://apps.apple.com/us/app/blue-archive/id1571873795',
  m16: 'https://apps.apple.com/us/app/glory-of-generals-3-ww2/id1535759278',
};

const findAsset = (baseName) => {
  const matches = fs.readdirSync(mediaDir)
    .filter((name) => path.parse(name).name === baseName)
    .filter((name) => fs.statSync(path.join(mediaDir, name)).size > 0)
    .sort((a, b) => fs.statSync(path.join(mediaDir, a)).size - fs.statSync(path.join(mediaDir, b)).size);
  if (!matches.length) throw new Error(`Missing asset: ${baseName}`);
  return `assets/images/media/${matches[0]}`;
};

const database = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
for (const item of database.items) {
  if (!['anime', 'game'].includes(item.type)) continue;

  item.cover = findAsset(item.id);
  item.wallpaper = steam[item.id]
    ? `assets/images/media/${item.id}-wallpaper.jpg`
    : findAsset(`${item.id}-wallpaper`);

  if (kitsu[item.id]) {
    item.sourceUrl = `https://kitsu.app/anime/${kitsu[item.id]}`;
    item.coverSource = 'Kitsu';
  } else if (steam[item.id]) {
    item.sourceUrl = `https://store.steampowered.com/app/${steam[item.id]}/`;
    item.coverSource = 'Steam';
  } else if (appStore[item.id]) {
    item.sourceUrl = sourcePages[item.id];
    item.coverSource = 'App Store';
  }
}

fs.writeFileSync(dataPath, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
console.log(`Updated ${database.items.filter((item) => ['anime', 'game'].includes(item.type)).length} archive entries.`);
