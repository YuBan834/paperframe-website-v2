const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'data', 'media-memory.json');
const outputDir = path.join(root, 'assets', 'images', 'media');
const userAgent = 'PersonalUniverse/2.4 (local portfolio cover importer)';

const curated = {
  m01: '你的名字。',
  m10: '某科学的超电磁炮',
  m11: '赛博朋克 边缘行者',
  m13: '蔚蓝档案',
  m18: '赛博朋克2077',
  m25: '艾尔登法环',
  m37: '命运石之门',
  m39: '女神异闻录3 Reload',
};

async function searchSubject(keyword, type) {
  const response = await fetch('https://api.bgm.tv/v0/search/subjects?limit=6&offset=0', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
    },
    body: JSON.stringify({
      keyword,
      filter: { type: [type === 'game' ? 4 : 2], nsfw: false },
    }),
  });
  if (!response.ok) throw new Error(`Bangumi search failed: ${response.status}`);
  const payload = await response.json();
  return payload.data?.[0] || null;
}

async function downloadCover(item, subject) {
  const imageUrl = subject.images?.large || subject.images?.common || subject.images?.medium;
  if (!imageUrl) return false;
  const response = await fetch(imageUrl, { headers: { 'User-Agent': userAgent } });
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  const extension = contentType.includes('png') ? 'png' : 'jpg';
  const filename = `${item.id}.${extension}`;
  await fs.writeFile(path.join(outputDir, filename), Buffer.from(await response.arrayBuffer()));
  item.cover = `assets/images/media/${filename}`;
  item.sourceUrl = `https://bgm.tv/subject/${subject.id}`;
  item.coverSource = 'Bangumi';
  return true;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const payload = JSON.parse(await fs.readFile(dataPath, 'utf8'));
  const items = Array.isArray(payload) ? payload : payload.items;
  const report = [];

  for (const item of items) {
    const keyword = curated[item.id];
    if (!keyword || !['anime', 'game'].includes(item.type)) continue;
    try {
      const subject = await searchSubject(keyword, item.type);
      if (!subject) {
        report.push({ id: item.id, title: item.title, status: 'not-found' });
        continue;
      }
      await downloadCover(item, subject);
      report.push({
        id: item.id,
        title: item.title,
        matched: subject.name_cn || subject.name,
        subjectId: subject.id,
        status: 'downloaded',
      });
    } catch (error) {
      report.push({ id: item.id, title: item.title, status: 'failed', error: error.message });
    }
  }

  await fs.writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.table(report);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
