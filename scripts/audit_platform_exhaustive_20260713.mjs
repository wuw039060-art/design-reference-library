import { chromium } from 'file:///C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const LIB_ROOT = path.resolve('output', '审美素材库');
const INDEX_PATH = path.join(LIB_ROOT, 'library-index.json');
const REPORT_PATH = path.join(LIB_ROOT, '平台穷举交互审计.json');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function exists(file) {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}

function fileUrl(file) {
  return new URL(`file:///${file.replaceAll('\\', '/')}`).href;
}

async function auditDesktop(browser, index, errors, checks) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`);
  });
  await page.goto(fileUrl(path.join(LIB_ROOT, 'index.html')), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.card');
  const cards = await page.locator('.card').count();
  checks.initialCards = cards;
  if (cards !== index.length) errors.push(`initial card count ${cards} != ${index.length}`);
  const cardActions = await page.locator('.card .actions').evaluateAll((groups) => groups.map((group) => ({
    count: group.children.length,
    labels: [...group.children].map((control) => control.textContent.trim()),
  })));
  checks.cardActions = cardActions;
  for (const [position, actions] of cardActions.entries()) {
    if (actions.count !== 2 || actions.labels[0] !== '预览' || actions.labels[1] !== '下载 AI 素材包') {
      errors.push(`card ${position + 1} actions regressed: ${JSON.stringify(actions)}`);
    }
  }
  await page.locator('#search').fill('Life Time 官网');
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(LIB_ROOT, '平台-Life-Time-两键验收.png'), fullPage: true });
  await page.locator('#search').fill('');

  const categories = await page.locator('.filter').evaluateAll((buttons) => buttons.map((button) => button.dataset.mode));
  checks.categories = {};
  for (const category of categories.filter((name) => !['元素库', '组装器'].includes(name))) {
    await page.locator(`button[data-mode="${category}"]`).click();
    await page.waitForTimeout(40);
    const actual = await page.locator('.card').count();
    const expected = category === '全部' ? index.length : index.filter((item) => item.displayCategory === category).length;
    checks.categories[category] = { actual, expected };
    if (actual !== expected) errors.push(`filter ${category}: ${actual} cards != ${expected}`);
  }

  await page.locator('button[data-mode="全部"]').click();
  const previewChecks = [];
  for (const item of index) {
    await page.locator('#search').fill(item.name);
    await page.waitForTimeout(25);
    const matching = page.locator('.card');
    if (await matching.count() !== 1) {
      errors.push(`search ${item.id} did not yield exactly one card`);
      continue;
    }
    await matching.locator('[data-preview]').first().click();
    await page.waitForSelector('#previewDialog[open]');
    const preview = await page.locator('#previewDialog img').evaluate((image) => ({
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      src: image.src,
    }));
    if (!preview.complete || !preview.naturalWidth || !preview.naturalHeight) errors.push(`preview image failed for ${item.id}`);
    const modalLinks = await page.locator('#previewDialog a').evaluateAll((links) => links.map((link) => ({ text: link.textContent.trim(), href: link.href })));
    if (!modalLinks.some((link) => link.text === '预览来源')) errors.push(`preview missing source link for ${item.id}`);
    if (!modalLinks.some((link) => link.text === '下载 AI 素材包')) errors.push(`preview missing download link for ${item.id}`);
    previewChecks.push({ id: item.id, preview, modalLinks });
    await page.locator('#previewDialog .close').click();
  }
  checks.previews = previewChecks;

  await page.locator('#search').fill('');

  await page.locator('button[data-mode="元素库"]').click();
  const elementCards = await page.locator('.element').count();
  checks.elementCards = elementCards;
  if (!elementCards) errors.push('element library rendered no cards');

  await page.locator('button[data-mode="组装器"]').click();
  await page.waitForSelector('#downloadCustom');
  const useCases = await page.locator('#useCase option').allTextContents();
  const combinations = [];
  for (const useCase of useCases) {
    await page.selectOption('#useCase', { label: useCase });
    const primaries = await page.locator('#primary option').evaluateAll((options) => options.map((option) => ({ value: option.value, label: option.textContent })));
    for (const primary of primaries) {
      await page.selectOption('#primary', primary.value);
      await page.waitForTimeout(20);
      const state = await page.evaluate(() => ({
        ok: window.assemblerState?.ok,
        disabled: document.querySelector('#downloadCustom')?.disabled,
        count: window.assemblerState?.els?.length,
        ids: window.assemblerState?.els?.map((element) => element.id),
        allowed: window.assemblerState?.primary?.compatibilityProfile?.recommendedElements,
        problems: window.assemblerState?.problems,
      }));
      if (!state.ok || state.disabled || state.count !== 4) errors.push(`valid assembler combination failed for ${primary.value}: ${JSON.stringify(state)}`);
      if (state.ids?.some((id) => !state.allowed?.includes(id))) errors.push(`assembler selected non-whitelisted element for ${primary.value}`);
      const rejection = await page.evaluate(() => {
        const allowed = new Set(window.assemblerState.primary.compatibilityProfile.recommendedElements || []);
        const select = document.querySelector('#typography');
        const invalid = ELEMENTS.find((element) => element.type === '字体系统' && !allowed.has(element.id));
        if (!invalid) return { setupError: true };
        select.add(new Option(invalid.name, invalid.id));
        select.value = invalid.id;
        updateAssembler();
        return { ok: window.assemblerState.ok, disabled: document.querySelector('#downloadCustom').disabled, problems: window.assemblerState.problems };
      });
      if (rejection.setupError || rejection.ok || !rejection.disabled || !rejection.problems?.length) errors.push(`invalid assembler combination passed for ${primary.value}`);
      await page.evaluate(() => populateElementChoices());
      combinations.push({ useCase, primary: primary.value, valid: state, invalid: rejection });
    }
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('#downloadCustom').click(),
    ]);
    const temp = path.join(LIB_ROOT, `.platform-${useCase}-audit.zip`);
    await download.saveAs(temp);
    const list = spawnSync('tar.exe', ['-tf', temp], { encoding: 'utf8' });
    await fs.rm(temp, { force: true });
    const names = list.stdout?.split(/\r?\n/).filter(Boolean).map((name) => name.replaceAll('\\', '/')) || [];
    if (list.status !== 0 || names.length !== 5 || names.some((name) => !name.startsWith('custom-design-reference-pack/'))) {
      errors.push(`generated custom ZIP invalid for ${useCase}`);
    }
  }
  checks.assemblerCombinations = combinations;
  if (pageErrors.length) errors.push(...pageErrors.map((error) => `desktop page error: ${error}`));
  await page.screenshot({ path: path.join(LIB_ROOT, '平台-深度审计-桌面.png'), fullPage: true });
  await page.close();
}

async function auditMobile(browser, errors, checks) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(fileUrl(path.join(LIB_ROOT, 'index.html')), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.card');
  const home = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
  if (home.bodyWidth > home.viewportWidth) errors.push(`mobile home overflows: ${JSON.stringify(home)}`);
  await page.locator('#search').fill('Life Time 官网');
  await page.waitForTimeout(80);
  const mobileCardActions = await page.locator('.card .actions').evaluate((group) => ({
    labels: [...group.children].map((control) => control.textContent.trim()),
    left: group.getBoundingClientRect().left,
    right: group.getBoundingClientRect().right,
    viewportWidth: innerWidth,
  }));
  checks.mobileCardActions = mobileCardActions;
  if (mobileCardActions.labels.join('|') !== '预览|下载 AI 素材包' || mobileCardActions.left < 0 || mobileCardActions.right > mobileCardActions.viewportWidth) {
    errors.push(`mobile card actions regressed: ${JSON.stringify(mobileCardActions)}`);
  }
  await page.screenshot({ path: path.join(LIB_ROOT, '平台-Life-Time-两键验收-移动.png'), fullPage: true });
  await page.locator('#search').fill('');
  await page.locator('button[data-mode="组装器"]').click();
  await page.waitForSelector('#downloadCustom');
  const assembler = await page.evaluate(() => {
    const button = document.querySelector('#downloadCustom').getBoundingClientRect();
    const selects = [...document.querySelectorAll('select')].map((select) => {
      const rect = select.getBoundingClientRect();
      return { id: select.id, x: rect.x, right: rect.right, width: rect.width };
    });
    return {
      bodyWidth: document.body.scrollWidth,
      viewportWidth: innerWidth,
      ok: window.assemblerState?.ok,
      disabled: document.querySelector('#downloadCustom').disabled,
      button: { x: button.x, right: button.right, width: button.width },
      selects,
    };
  });
  if (assembler.bodyWidth > assembler.viewportWidth || assembler.button.x < 0 || assembler.button.right > assembler.viewportWidth) errors.push(`mobile assembler overflow: ${JSON.stringify(assembler)}`);
  for (const select of assembler.selects) if (select.x < 0 || select.right > assembler.viewportWidth) errors.push(`mobile select overflow: ${JSON.stringify(select)}`);
  if (!assembler.ok || assembler.disabled) errors.push('mobile assembler default combination is not usable');
  if (pageErrors.length) errors.push(...pageErrors.map((error) => `mobile page error: ${error}`));
  checks.mobile = { home, assembler };
  await page.screenshot({ path: path.join(LIB_ROOT, '平台-深度审计-移动.png'), fullPage: true });
  await page.close();
}

async function main() {
  const index = await readJson(INDEX_PATH);
  const errors = [];
  const checks = { localReferences: [] };
  for (const item of index) {
    const references = {
      id: item.id,
      preview: path.join(LIB_ROOT, ...item.previewPath.split('/')),
      readme: path.join(LIB_ROOT, ...item.packPath.split('/'), 'README.md'),
      agentGuide: path.join(LIB_ROOT, ...item.agentGuidePath.split('/')),
      zip: path.join(LIB_ROOT, ...item.zipPath.split('/')),
    };
    for (const [kind, file] of Object.entries(references).filter(([key]) => key !== 'id')) {
      if (!await exists(file)) errors.push(`${item.id} missing ${kind}: ${file}`);
    }
    checks.localReferences.push(references);
  }
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--allow-file-access-from-files', '--disable-extensions', '--no-first-run'],
  });
  try {
    await auditDesktop(browser, index, errors, checks);
    await auditMobile(browser, errors, checks);
  } finally {
    await browser.close();
  }
  const report = {
    auditedAt: new Date().toISOString(),
    summary: {
      items: index.length,
      errors: errors.length,
      complete: errors.length === 0,
    },
    errors,
    checks,
  };
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report.summary, null, 2));
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
