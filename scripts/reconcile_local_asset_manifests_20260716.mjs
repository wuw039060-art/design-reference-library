import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const LIB_ROOT = path.resolve('output', '审美素材库');
const INDEX_PATH = path.join(LIB_ROOT, 'library-index.json');
const REPORT_PATH = path.join(LIB_ROOT, '本地资产清单对账报告.json');

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function walk(root) {
  const files = [];
  const visit = async (directory) => {
    let entries = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) files.push(file);
    }
  };
  await visit(root);
  return files;
}

async function sha256(file) {
  const digest = crypto.createHash('sha256');
  const handle = await fs.open(file, 'r');
  try {
    for await (const chunk of handle.readableWebStream({ type: 'bytes' })) digest.update(Buffer.from(chunk));
  } finally {
    await handle.close();
  }
  return digest.digest('hex');
}

async function detectFormat(file) {
  const handle = await fs.open(file, 'r');
  let data;
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const read = await handle.read(buffer, 0, buffer.length, 0);
    data = buffer.subarray(0, read.bytesRead);
  } finally {
    await handle.close();
  }
  const ascii = data.toString('ascii');
  const hex = data.toString('hex');
  const box = ascii.slice(4, 8);
  const brand = ascii.slice(8, 12);
  const text = data.toString('utf8').replace(/^\uFEFF/, '').trimStart();
  if (hex.startsWith('89504e470d0a1a0a')) return 'png';
  if (hex.startsWith('ffd8ff')) return 'jpeg';
  if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) return 'gif';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'webp';
  if (box === 'ftyp' && ['avif', 'avis'].includes(brand)) return 'avif';
  if (box === 'ftyp') return /(?:^|[-_.])init(?:[-_.]|$)/i.test(path.basename(file)) ? 'mp4-init' : 'mp4';
  if (box === 'styp' || box === 'moof') return 'mp4-fragment';
  if (hex.startsWith('1a45dfa3')) return 'webm';
  if (ascii.startsWith('ID3') || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0)) return 'mp3';
  if (ascii.startsWith('wOFF')) return 'woff';
  if (ascii.startsWith('wOF2')) return 'woff2';
  if (ascii.startsWith('OTTO')) return 'otf';
  if (hex.startsWith('00010000') || ascii.startsWith('true') || ascii.startsWith('ttcf')) return 'ttf';
  if (hex.startsWith('00000100')) return 'ico';
  if (/^<\?xml[\s\S]*?<svg\b/i.test(text) || /^<svg\b/i.test(text)) return 'svg';
  if (text.startsWith('#EXTM3U')) return 'm3u8';
  if (/(?:<!doctype\s+html|<html\b)/i.test(text)) return 'html';
  if (path.extname(file).toLowerCase() === '.css' && text && !/<html[\s>]/i.test(text.slice(0, 1000))) return 'css';
  return 'unknown';
}

const contentTypes = {
  png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  svg: 'image/svg+xml', ico: 'image/x-icon', mp4: 'video/mp4', 'mp4-init': 'video/mp4',
  'mp4-fragment': 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', m3u8: 'application/vnd.apple.mpegurl',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', css: 'text/css',
};

function resourceTypeFor(file, format) {
  if (file.toLowerCase().includes(`${path.sep}fonts${path.sep}`)) return 'font';
  if (['woff', 'woff2', 'ttf', 'otf'].includes(format)) return 'font';
  if (format === 'css') return 'stylesheet';
  if (['mp4', 'mp4-init', 'mp4-fragment', 'webm', 'mp3', 'm3u8'].includes(format)) return 'media';
  return 'image';
}

function localPath(packDir, file) {
  return path.relative(packDir, file).replaceAll('\\', '/');
}

async function normalizeArchiveNames(packDir) {
  const replacements = [];
  for (const file of await walk(path.join(packDir, 'reproduction-evidence', 'interaction-states'))) {
    const normalizedName = path.basename(file).replaceAll('¹', '1');
    if (normalizedName === path.basename(file)) continue;
    const destination = path.join(path.dirname(file), normalizedName);
    await fs.rename(file, destination);
    replacements.push({ oldName: path.basename(file), newName: normalizedName });
  }
  if (!replacements.length) return replacements;
  const textExtensions = new Set(['.json', '.md', '.html', '.css', '.txt']);
  for (const file of await walk(packDir)) {
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    let text = await fs.readFile(file, 'utf8');
    let changed = false;
    for (const replacement of replacements) {
      if (!text.includes(replacement.oldName)) continue;
      text = text.replaceAll(replacement.oldName, replacement.newName);
      changed = true;
    }
    if (changed) await fs.writeFile(file, text, 'utf8');
  }
  return replacements;
}

async function reconcileSite(item) {
  const packDir = path.join(LIB_ROOT, ...item.packPath.split('/'));
  const evidence = path.join(packDir, 'reproduction-evidence');
  const assetPath = path.join(evidence, 'asset-manifest.json');
  const manifest = await readJson(assetPath);
  const normalizedNames = await normalizeArchiveNames(packDir);
  const listedByPath = new Map();
  const duplicatePaths = [];
  for (const asset of manifest.assets) {
    if (!asset.localPath) continue;
    const key = asset.localPath.toLowerCase();
    if (listedByPath.has(key)) duplicatePaths.push(asset.localPath);
    else listedByPath.set(key, asset);
  }

  const roots = [path.join(evidence, 'assets', 'fonts'), path.join(evidence, 'assets', 'media')];
  const localFiles = [];
  for (const root of roots) localFiles.push(...await walk(root));
  let added = 0;
  let annotated = 0;
  let removedEmpty = 0;
  let removedNonVisual = 0;
  const unknown = [];
  for (const file of localFiles) {
    const relative = localPath(packDir, file);
    const key = relative.toLowerCase();
    const stat = await fs.stat(file);
    if (stat.size === 0) {
      await fs.rm(file);
      manifest.assets = manifest.assets.filter((entry) => entry.localPath?.toLowerCase() !== key);
      listedByPath.delete(key);
      removedEmpty += 1;
      continue;
    }
    const [digest, format] = await Promise.all([sha256(file), detectFormat(file)]);
    if (format === 'html') {
      await fs.rm(file);
      manifest.assets = manifest.assets.filter((entry) => entry.localPath?.toLowerCase() !== key);
      listedByPath.delete(key);
      removedNonVisual += 1;
      continue;
    }
    if (format === 'unknown') unknown.push(relative);
    const detectedContentType = contentTypes[format] || 'application/octet-stream';
    const existing = listedByPath.get(key);
    if (existing) {
      existing.detectedFormat = format;
      existing.detectedContentType = detectedContentType;
      existing.bytes = stat.size;
      existing.sha256 = digest;
      annotated += 1;
      continue;
    }
    const localId = crypto.createHash('sha256').update(`${item.id}:${relative}`).digest('hex').slice(0, 24);
    const entry = {
      url: `local-evidence://${item.id}/${localId}`,
      originPage: item.sourceUrl,
      resourceType: resourceTypeFor(file, format),
      contentType: detectedContentType,
      detectedFormat: format,
      detectedContentType,
      status: null,
      saved: true,
      bytes: stat.size,
      sha256: digest,
      localPath: relative,
      retainedLocalAsset: true,
      provenance: 'Captured from the source site in an earlier evidence pass; the original request URL was not retained after DOM declaration reconciliation.',
    };
    manifest.assets.push(entry);
    listedByPath.set(key, entry);
    added += 1;
  }

  const saved = manifest.assets.filter((entry) => entry.saved);
  manifest.savedCount = saved.length;
  manifest.savedBytes = saved.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  manifest.unresolvedVisualCount = manifest.assets.filter((entry) => !entry.saved && !entry.ignored
    && ['image', 'media', 'font', 'stylesheet'].includes(entry.resourceType)).length;
  manifest.reconciledAt = new Date().toISOString();
  await writeJson(assetPath, manifest);

  const replicationPath = path.join(evidence, 'replication-manifest.json');
  const replication = await readJson(replicationPath);
  replication.counts.savedAssets = saved.length;
  replication.counts.localFonts = saved.filter((entry) => entry.resourceType === 'font').length;
  replication.counts.localMedia = saved.filter((entry) => ['image', 'media'].includes(entry.resourceType)).length;
  replication.counts.localStylesheets = saved.filter((entry) => entry.resourceType === 'stylesheet').length;
  replication.counts.unresolvedVisualAssets = manifest.unresolvedVisualCount;
  replication.requirements.allVisualAssetsLocalized = manifest.unresolvedVisualCount === 0;
  replication.complete = Object.values(replication.requirements).every(Boolean);
  await writeJson(replicationPath, replication);

  const fontPath = path.join(evidence, 'font-inventory.json');
  const fontInventory = await readJson(fontPath);
  fontInventory.localFiles = saved.filter((entry) => entry.resourceType === 'font');
  await writeJson(fontPath, fontInventory);

  return {
    id: item.id,
    localFiles: localFiles.length,
    listedAssets: saved.length,
    added,
    annotated,
    removedEmpty,
    removedNonVisual,
    duplicatePaths,
    unknown,
    normalizedNames,
    complete: duplicatePaths.length === 0 && unknown.length === 0 && manifest.unresolvedVisualCount === 0,
  };
}

async function main() {
  const index = await readJson(INDEX_PATH);
  const websites = index.filter((item) => item.type === 'website');
  const report = { startedAt: new Date().toISOString(), sites: [] };
  for (const [position, item] of websites.entries()) {
    console.log(`[${position + 1}/${websites.length}] ${item.id}`);
    report.sites.push(await reconcileSite(item));
  }
  report.completedAt = new Date().toISOString();
  report.summary = {
    sites: report.sites.length,
    completeSites: report.sites.filter((site) => site.complete).length,
    localFiles: report.sites.reduce((sum, site) => sum + site.localFiles, 0),
    addedAssets: report.sites.reduce((sum, site) => sum + site.added, 0),
    removedEmptyFiles: report.sites.reduce((sum, site) => sum + site.removedEmpty, 0),
    removedNonVisualFiles: report.sites.reduce((sum, site) => sum + site.removedNonVisual, 0),
    unknownFiles: report.sites.reduce((sum, site) => sum + site.unknown.length, 0),
    normalizedNames: report.sites.reduce((sum, site) => sum + site.normalizedNames.length, 0),
    complete: report.sites.every((site) => site.complete),
  };
  await writeJson(REPORT_PATH, report);
  console.log(JSON.stringify(report.summary, null, 2));
  if (!report.summary.complete) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
