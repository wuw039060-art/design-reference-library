import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chromium } from 'file:///C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.mjs';

const LIB_ROOT = path.resolve('output', '审美素材库');
const INDEX_PATH = path.join(LIB_ROOT, 'library-index.json');
const JSON_REPORT = path.join(LIB_ROOT, '复刻完整性最终审计.json');
const MD_REPORT = path.join(LIB_ROOT, '复刻完整性最终审计.md');
const skipZip = process.argv.includes('--skip-zip');

const requiredEvidence = [
  ['README.md', 300],
  ['replication-manifest.json', 400],
  ['screenshots/desktop-viewport.png', 5000],
  ['screenshots/desktop-full.png', 5000],
  ['screenshots/mobile-viewport.png', 5000],
  ['screenshots/mobile-full.png', 5000],
  ['dom/desktop-rendered.html', 500],
  ['dom/mobile-rendered.html', 500],
  ['network-log.json', 100],
  ['asset-manifest.json', 100],
  ['css-variables.json', 2],
  ['font-inventory.json', 40],
  ['component-geometry.json', 100],
  ['interaction-states.json', 100],
  ['viewport-results.json', 100],
  ['css/css-manifest.json', 20],
  ['research/source-reader.md', 100],
  ['recordings/desktop-session.webm', 10000],
];

const requiredPackDocs = [
  'manifest.json',
  'README.md',
  'design-analysis.md',
  'page-structure.md',
  'interaction-map.md',
  'design-tokens.json',
  'assets-inventory.json',
  'compatibility-rules.json',
  'AGENT_README.md',
  'reproduction-prompt.md',
];

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function fileSize(file) {
  try {
    return (await fs.stat(file)).size;
  } catch {
    return 0;
  }
}

async function sha256(file) {
  return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

function packDir(item) {
  return path.join(LIB_ROOT, ...String(item.packPath).split('/'));
}

async function auditSite(item) {
  const root = packDir(item);
  const evidence = path.join(root, 'reproduction-evidence');
  const errors = [];
  const warnings = [];
  const sourceLimitations = await readJson(path.join(evidence, 'source-limitations.json'), null);
  const allowedBlankScreenshots = new Set(sourceLimitations?.auditTreatment?.allowBlankScreenshots || []);
  for (const [relative, minimum] of requiredEvidence) {
    const size = await fileSize(path.join(evidence, ...relative.split('/')));
    const documentedBlank = allowedBlankScreenshots.has(relative) && size >= 1000;
    if (size < minimum && !documentedBlank) errors.push(`missing-or-small evidence/${relative} (${size} bytes)`);
  }
  if (sourceLimitations) {
    const preserved = sourceLimitations.auditTreatment?.requiredPreservedSourceBehavior;
    const fallback = sourceLimitations.auditTreatment?.requiredFunctionalFallback;
    if (!sourceLimitations.reason || !sourceLimitations.auditTreatment?.prohibitInventedMobileVisuals) {
      errors.push('source limitation metadata is incomplete');
    }
    if (!preserved || await fileSize(path.join(evidence, ...preserved.split('/'))) < 1000) {
      errors.push('source limitation preserved behavior screenshot is missing');
    }
    if (!fallback || await fileSize(path.join(evidence, ...fallback.split('/'))) < 5000) {
      errors.push('source limitation functional fallback screenshot is missing');
    }
  }
  for (const relative of requiredPackDocs) {
    if ((await fileSize(path.join(root, relative))) < 20) errors.push(`missing pack document ${relative}`);
  }
  const manifest = await readJson(path.join(evidence, 'replication-manifest.json'));
  if (!manifest) errors.push('invalid replication-manifest.json');
  else {
    if (!manifest.complete) errors.push('replication manifest is not complete');
    for (const [key, value] of Object.entries(manifest.requirements || {})) {
      if (!value) errors.push(`failed requirement: ${key}`);
    }
    if (manifest.sourceUrl !== item.sourceUrl) errors.push('source URL does not match library index');
  }
  const assetManifest = await readJson(path.join(evidence, 'asset-manifest.json'), { assets: [] });
  const savedAssets = (assetManifest.assets || []).filter((asset) => asset.saved);
  if (!savedAssets.length) errors.push('no localized assets');
  const resourceTypes = new Set(savedAssets.map((asset) => asset.resourceType));
  if (!resourceTypes.has('image') && !resourceTypes.has('media')) errors.push('no localized image/media');
  const fontInventory = await readJson(path.join(evidence, 'font-inventory.json'), {});
  if (!(fontInventory.localFiles || []).length && !(fontInventory.observed || []).length && !(fontInventory.computedFamilies || []).length) errors.push('no font evidence');
  const cssManifest = await readJson(path.join(evidence, 'css', 'css-manifest.json'), {});
  if (!(cssManifest.externalStylesheets || []).length && !(cssManifest.inlineStyles || []).length && !cssManifest.computedStyleInventory?.componentCount) errors.push('no CSS evidence');
  for (const asset of savedAssets) {
    const target = path.join(root, ...String(asset.localPath || '').split('/'));
    const size = await fileSize(target);
    if (!size) {
      errors.push(`localized asset missing: ${asset.localPath}`);
      continue;
    }
    if (asset.bytes && size !== asset.bytes) errors.push(`localized asset size mismatch: ${asset.localPath}`);
    if (asset.sha256) {
      const actual = await sha256(target);
      if (actual !== asset.sha256) errors.push(`localized asset hash mismatch: ${asset.localPath}`);
    }
  }
  const geometry = await readJson(path.join(evidence, 'component-geometry.json'), {});
  if (!Object.values(geometry || {}).some((entries) => Array.isArray(entries) && entries.length)) errors.push('component geometry is empty');
  const interactions = await readJson(path.join(evidence, 'interaction-states.json'), {});
  if (!Object.values(interactions || {}).some((entry) => entry?.controls?.length)) errors.push('interaction inventory is empty');
  if (!Object.values(interactions || {}).some((entry) => entry?.capturedStates?.length)) warnings.push('no interactive state screenshot was captured');
  const network = await readJson(path.join(evidence, 'network-log.json'), []);
  const failures = network.filter((entry) => entry.kind === 'requestfailed');
  const visualResourceTypes = new Set(['image', 'media', 'font', 'stylesheet']);
  const visualFailures = failures.filter((entry) => visualResourceTypes.has(entry.resourceType));
  const assetsByUrl = new Map((assetManifest.assets || []).map((asset) => [asset.url, asset]));
  const uncoveredVisualFailures = visualFailures.filter((entry) => {
    const disposition = assetsByUrl.get(entry.url);
    return !disposition?.saved && !disposition?.ignored;
  });
  if (uncoveredVisualFailures.length) {
    errors.push(`${uncoveredVisualFailures.length} failed visual requests lack a saved or reviewed disposition`);
  }
  return {
    id: item.id,
    sourceUrl: item.sourceUrl,
    complete: errors.length === 0,
    errors,
    warnings,
    counts: {
      ...(manifest?.counts || {}),
      networkFailuresTotal: failures.length,
      networkFailuresVisual: visualFailures.length,
      networkFailuresVisualCovered: visualFailures.length - uncoveredVisualFailures.length,
      networkFailuresVisualUncovered: uncoveredVisualFailures.length,
    },
    sourceLimitation: sourceLimitations ? {
      classification: sourceLimitations.classification,
      allowedBlankScreenshots: [...allowedBlankScreenshots],
      preservedSourceBehavior: sourceLimitations.auditTreatment?.requiredPreservedSourceBehavior,
      functionalFallback: sourceLimitations.auditTreatment?.requiredFunctionalFallback,
    } : null,
  };
}

function auditZip(item) {
  const errors = [];
  const zip = path.join(LIB_ROOT, ...String(item.zipPath || '').split('/'));
  const list = spawnSync('tar.exe', ['-tf', zip], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (list.status !== 0) return [`ZIP unreadable: ${item.zipPath}`];
  const names = list.stdout.split(/\r?\n/).filter(Boolean).map((name) => name.replaceAll('\\', '/'));
  const roots = new Set(names.map((name) => name.split('/')[0]).filter(Boolean));
  const expected = path.basename(item.packPath);
  if (roots.size !== 1 || !roots.has(expected)) errors.push(`ZIP must have one root folder ${expected}; found ${[...roots].join(', ')}`);
  if (!names.some((name) => name.endsWith('/reproduction-evidence/replication-manifest.json'))) errors.push('ZIP does not contain replication manifest');
  return errors;
}

async function auditPlatform(index) {
  const errors = [];
  const html = await fs.readFile(path.join(LIB_ROOT, 'index.html'), 'utf8').catch(() => '');
  const elements = await readJson(path.join(LIB_ROOT, 'element-library.json'), []);
  const rules = await readJson(path.join(LIB_ROOT, 'compatibility-rules.json'), {});
  for (const marker of ['元素库', '组装器', 'validateSelection', 'downloadCustom', 'disabled']) {
    if (!html.includes(marker)) errors.push(`platform missing marker: ${marker}`);
  }
  for (const id of ['mission-editorial', 'cinematic-hero']) {
    if (!elements.some((element) => element.id === id)) errors.push(`element library missing ${id}`);
  }
  const elementIds = new Set(elements.map((element) => element.id));
  const elementById = new Map(elements.map((element) => [element.id, element]));
  const requiredTypes = ['字体系统', '排版结构', '视觉背景', '动效系统'];
  for (const item of index.filter((entry) => entry.type === 'website')) {
    const profile = item.compatibilityProfile || {};
    const recommended = profile.recommendedElements || [];
    const recommendedTypes = new Set();
    for (const id of item.compatibilityProfile?.recommendedElements || []) {
      if (!elementIds.has(id)) errors.push(`${item.id} references missing recommended element ${id}`);
      else recommendedTypes.add(elementById.get(id).type);
    }
    for (const id of item.compatibilityProfile?.blockedElements || []) {
      if (!elementIds.has(id)) errors.push(`${item.id} references missing blocked element ${id}`);
      if (recommended.includes(id)) errors.push(`${item.id} both recommends and blocks ${id}`);
    }
    for (const type of requiredTypes) if (!recommendedTypes.has(type)) errors.push(`${item.id} recommendation is missing type ${type}`);
  }
  if (!Array.isArray(rules.hardConflicts) || !rules.hardConflicts.length) errors.push('compatibility rules missing hardConflicts');
  for (const conflict of rules.hardConflicts || []) {
    if (!elementIds.has(conflict.a) || !elementIds.has(conflict.b)) errors.push(`hard conflict references missing element ${conflict.a} / ${conflict.b}`);
  }
  return errors;
}

async function auditPlatformRuntime() {
  const errors = [];
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--disable-extensions', '--no-first-run', '--allow-file-access-from-files'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const url = new URL(`file:///${path.join(LIB_ROOT, 'index.html').replaceAll('\\', '/')}`).href;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('button[data-mode="组装器"]').click();
    await page.waitForSelector('#downloadCustom');
    const cases = await page.locator('#useCase option').allTextContents();
    for (const useCase of cases) {
      await page.selectOption('#useCase', { label: useCase });
      await page.waitForTimeout(80);
      const state = await page.evaluate(() => ({
        ok: window.assemblerState?.ok,
        elementCount: window.assemblerState?.els?.length,
        problems: window.assemblerState?.problems || [],
        disabled: document.querySelector('#downloadCustom')?.disabled,
      }));
      if (!state.ok || state.disabled || state.elementCount !== 4) errors.push(`runtime valid combination failed for ${useCase}: ${state.problems.join('; ')}`);
    }
    const rejection = await page.evaluate(() => {
      const primary = window.assemblerState.primary;
      const allowed = new Set(primary.compatibilityProfile?.recommendedElements || []);
      const select = document.querySelector('#typography');
      const invalid = ELEMENTS.find((element) => element.type === '字体系统' && !allowed.has(element.id));
      if (!invalid) return { setupError: 'no invalid typography element available' };
      select.add(new Option(invalid.name, invalid.id));
      select.value = invalid.id;
      updateAssembler();
      return {
        invalidId: invalid.id,
        ok: window.assemblerState.ok,
        disabled: document.querySelector('#downloadCustom').disabled,
        problems: window.assemblerState.problems,
      };
    });
    if (rejection.setupError) errors.push(rejection.setupError);
    else if (rejection.ok || !rejection.disabled || !rejection.problems?.length) errors.push(`runtime conflict was not rejected: ${JSON.stringify(rejection)}`);
    const recovery = await page.evaluate(() => {
      populateElementChoices();
      return { ok: window.assemblerState.ok, disabled: document.querySelector('#downloadCustom').disabled, count: window.assemblerState.els.length };
    });
    if (!recovery.ok || recovery.disabled || recovery.count !== 4) errors.push(`runtime assembler did not recover: ${JSON.stringify(recovery)}`);
    if (recovery.ok && !recovery.disabled) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        page.locator('#downloadCustom').click(),
      ]);
      const tempZip = path.join(LIB_ROOT, '.assembler-runtime-audit.zip');
      await download.saveAs(tempZip);
      const list = spawnSync('tar.exe', ['-tf', tempZip], { encoding: 'utf8' });
      await fs.rm(tempZip, { force: true });
      if (list.status !== 0) errors.push('runtime custom ZIP is unreadable');
      else {
        const names = list.stdout.split(/\r?\n/).filter(Boolean).map((name) => name.replaceAll('\\', '/'));
        const expected = [
          'custom-design-reference-pack/AGENT_README.md',
          'custom-design-reference-pack/selected-elements.json',
          'custom-design-reference-pack/combined-design-brief.md',
          'custom-design-reference-pack/compatibility-rules.json',
          'custom-design-reference-pack/reproduction-prompt.md',
        ];
        for (const name of expected) if (!names.includes(name)) errors.push(`runtime custom ZIP missing ${name}`);
        const roots = new Set(names.map((name) => name.split('/')[0]));
        if (roots.size !== 1 || !roots.has('custom-design-reference-pack')) errors.push(`runtime custom ZIP has invalid roots: ${[...roots].join(', ')}`);
      }
    }
  } catch (error) {
    errors.push(`platform runtime test failed: ${String(error.message || error)}`);
  } finally {
    await browser.close();
  }
  return errors;
}

async function main() {
  const index = await readJson(INDEX_PATH, []);
  const websites = index.filter((item) => item.type === 'website');
  const errors = [];
  const ids = new Set();
  const packPaths = new Set();
  const zipPaths = new Set();
  for (const item of websites) {
    if (ids.has(item.id)) errors.push(`duplicate id: ${item.id}`);
    if (packPaths.has(item.packPath)) errors.push(`duplicate packPath: ${item.packPath}`);
    if (zipPaths.has(item.zipPath)) errors.push(`duplicate zipPath: ${item.zipPath}`);
    ids.add(item.id);
    packPaths.add(item.packPath);
    zipPaths.add(item.zipPath);
  }
  const sites = [];
  for (let index = 0; index < websites.length; index += 1) {
    const item = websites[index];
    console.log(`[audit ${index + 1}/${websites.length}] ${item.id}`);
    const result = await auditSite(item);
    if (!skipZip) result.errors.push(...auditZip(item));
    result.complete = result.errors.length === 0;
    sites.push(result);
  }
  errors.push(...await auditPlatform(index));
  errors.push(...await auditPlatformRuntime());
  const report = {
    auditedAt: new Date().toISOString(),
    websiteCount: websites.length,
    completeCount: sites.filter((site) => site.complete).length,
    needsAttentionCount: sites.filter((site) => !site.complete).length,
    platformErrors: errors,
    complete: errors.length === 0 && sites.every((site) => site.complete),
    sites,
  };
  await fs.writeFile(JSON_REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const failed = sites.filter((site) => !site.complete);
  const warnings = sites.filter((site) => site.warnings.length);
  const markdown = `# 复刻完整性最终审计

- 审计时间：${report.auditedAt}
- 网站总数：${report.websiteCount}
- 完整通过：${report.completeCount}
- 待修复：${report.needsAttentionCount}
- 平台与组装器问题：${errors.length}
- 最终结论：${report.complete ? '通过' : '未通过'}

## 未通过站点

${failed.length ? failed.map((site) => `- ${site.id}: ${site.errors.join('；')}`).join('\n') : '- 无'}

## 警告

${warnings.length ? warnings.map((site) => `- ${site.id}: ${site.warnings.join('；')}`).join('\n') : '- 无'}

## 平台与组装器

${errors.length ? errors.map((error) => `- ${error}`).join('\n') : '- 通过：索引唯一性、元素引用、冲突规则和下载禁用标记均存在。'}
`;
  await fs.writeFile(MD_REPORT, markdown, 'utf8');
  console.log(JSON.stringify({ websiteCount: report.websiteCount, completeCount: report.completeCount, needsAttentionCount: report.needsAttentionCount, platformErrors: errors.length, complete: report.complete }, null, 2));
  if (!report.complete) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
