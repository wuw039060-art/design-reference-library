import fs from "node:fs";
import path from "node:path";

const libraryRoot = path.join("output", "审美素材库");
const docsRoot = "docs";
const previewRoot = path.join(docsRoot, "assets", "previews");
const indexPath = path.join(libraryRoot, "library-index.json");

const sampleIds = [
  "augen",
  "apple",
  "anatoly-design",
  "defiant-vc",
  "robot-com",
  "belen-jones",
  "digital-trust-alliance",
];

const items = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const byId = new Map(items.map((item) => [item.id, item]));
const samples = sampleIds.map((id) => byId.get(id)).filter(Boolean);

fs.mkdirSync(previewRoot, { recursive: true });

const publicSamples = samples.map((item) => {
  const previewSource = path.join(libraryRoot, item.previewPath);
  const previewFile = `${item.id}.png`;
  const previewTarget = path.join(previewRoot, previewFile);

  if (fs.existsSync(previewSource)) {
    fs.copyFileSync(previewSource, previewTarget);
  }

  return {
    id: item.id,
    name: item.name,
    type: item.type,
    category: item.displayCategory,
    subcategory: item.displaySubcategory,
    sourceUrl: item.sourceUrl,
    styleTags: item.styleTags,
    suitableFor: item.suitableFor,
    preview: `assets/previews/${previewFile}`,
  };
});

const categories = {};
for (const item of items) {
  const category = item.displayCategory || "未分类";
  categories[category] = (categories[category] || 0) + 1;
}

const summary = {
  project: "Aesthetic Reference Library",
  publicDemo: true,
  totalEntries: items.length,
  categories,
  samples: publicSamples,
  privacyNote:
    "This public demo intentionally excludes local filesystem paths, private automation settings, and full-size asset packs.",
};

fs.mkdirSync(docsRoot, { recursive: true });
fs.writeFileSync(
  path.join(docsRoot, "library-summary.json"),
  JSON.stringify(summary, null, 2),
  "utf8",
);

const cards = publicSamples
  .map(
    (item) => `<article class="card">
  <img src="${item.preview}" alt="${escapeHtml(item.name)} preview" loading="lazy">
  <div class="card-body">
    <p class="meta">${escapeHtml(item.category)} / ${escapeHtml(item.subcategory)}</p>
    <h3>${escapeHtml(item.name)}</h3>
    <p>${escapeHtml((item.styleTags || []).slice(0, 4).join(" · "))}</p>
    <a href="${item.sourceUrl}" target="_blank" rel="noreferrer">Source</a>
  </div>
</article>`,
  )
  .join("\n");

const categoryRows = Object.entries(categories)
  .sort((a, b) => b[1] - a[1])
  .map(([name, count]) => `<span>${escapeHtml(name)} <strong>${count}</strong></span>`)
  .join("\n");

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Aesthetic Reference Library</title>
  <style>
    :root {
      color: #171717;
      background: #f7f3ea;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      margin: 0;
    }
    main {
      max-width: 1120px;
      margin: 0 auto;
      padding: 48px 20px;
    }
    header {
      display: grid;
      gap: 18px;
      margin-bottom: 36px;
    }
    h1 {
      max-width: 820px;
      margin: 0;
      font-size: clamp(40px, 8vw, 88px);
      line-height: 0.94;
      letter-spacing: 0;
    }
    .lede {
      max-width: 720px;
      margin: 0;
      color: #444;
      font-size: 18px;
      line-height: 1.6;
    }
    .stats,
    .categories {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .stats span,
    .categories span {
      border: 1px solid #d8d0c2;
      background: #fffaf0;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 18px;
      margin-top: 28px;
    }
    .card {
      overflow: hidden;
      border: 1px solid #ded6c9;
      border-radius: 8px;
      background: #fffdf8;
    }
    .card img {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 10;
      object-fit: cover;
      border-bottom: 1px solid #ebe3d7;
    }
    .card-body {
      padding: 14px;
    }
    .meta {
      margin: 0 0 8px;
      color: #70685c;
      font-size: 13px;
    }
    h2 {
      margin: 36px 0 10px;
      font-size: 24px;
    }
    h3 {
      margin: 0 0 8px;
      font-size: 18px;
      line-height: 1.3;
    }
    p {
      line-height: 1.55;
    }
    a {
      color: #155e75;
      font-weight: 700;
      text-decoration: none;
    }
    footer {
      margin-top: 40px;
      color: #70685c;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="stats">
        <span>${items.length} entries</span>
        <span>${Object.keys(categories).length} categories</span>
        <span>GitHub-safe public demo</span>
      </div>
      <h1>Aesthetic Reference Library</h1>
      <p class="lede">一个面向 AI 代理和产品设计任务的网页/PPT 审美参考库。公开版展示数据结构、分类体系和少量预览；完整素材包保留在本地或私有分发渠道，避免把大文件和个人环境信息提交到 GitHub。</p>
    </header>

    <section>
      <h2>分类概览</h2>
      <div class="categories">
        ${categoryRows}
      </div>
    </section>

    <section>
      <h2>样例预览</h2>
      <div class="grid">
        ${cards}
      </div>
    </section>

    <footer>
      Public demo generated from sanitized metadata. Full local asset packs are intentionally excluded from the repository.
    </footer>
  </main>
</body>
</html>`;

fs.writeFileSync(path.join(docsRoot, "index.html"), html, "utf8");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
