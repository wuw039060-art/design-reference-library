import fs from "node:fs";
import path from "node:path";

const libraryRoot = path.join("output", "审美素材库");
const docsRoot = "docs";
const previewRoot = path.join(docsRoot, "assets", "previews");
const indexPath = path.join(libraryRoot, "library-index.json");
const repositoryUrl = "https://github.com/wuw039060-art/design-reference-library";

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
  purpose:
    "A structured design reference memory and aesthetic constraint layer for AI agents that generate websites, product pages, portfolios, and slide decks.",
  solves: [
    "Unstable AI-generated visual styles",
    "Unstructured screenshot collections that are hard for agents to reuse",
    "Random mixing of typography, layout, background, and motion patterns",
  ],
  intendedUse:
    "Help AI agents choose real design references by use case, style tags, and compatibility rules before generating UI or presentation code.",
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
    .categories,
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .stats span,
    .categories span,
    .links a {
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
    .columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 22px;
      margin-top: 14px;
    }
    .panel {
      border-left: 3px solid #155e75;
      padding-left: 16px;
    }
    .panel ul {
      margin: 10px 0 0;
      padding-left: 20px;
      line-height: 1.7;
    }
    .flow {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 14px;
    }
    .step {
      background: #fffdf8;
      border: 1px solid #ded6c9;
      border-radius: 8px;
      padding: 14px;
    }
    .step strong {
      display: block;
      margin-bottom: 8px;
      color: #155e75;
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
        <span>Readable code included</span>
      </div>
      <h1>Aesthetic Reference Library</h1>
      <p class="lede">一个给 AI 设计代理使用的网页/PPT 审美参考库。它不是截图收藏夹，而是把真实优秀网页和演示稿整理成分类、标签、预览、适用场景和兼容性规则，让 AI 生成网页、产品页、作品集或演示稿时有稳定参考。</p>
    </header>

    <section>
      <h2>为什么做这个项目</h2>
      <p>AI 已经很会写页面代码，但它经常不知道什么是真正成熟的网页审美，也不知道字体、布局、背景和动效为什么能搭在一起。只说“高级一点”“科技感一点”太模糊，模型很容易自由发挥，最后生成结果不可控。</p>
      <p>这个库想把审美从一句模糊提示变成可读取、可检索、可约束的数据层。AI 代理可以先看真实案例，再按任务类型选择参考，而不是凭空猜风格。</p>
    </section>

    <section>
      <h2>它解决什么问题</h2>
      <div class="columns">
        <div class="panel">
          <strong>问题</strong>
          <ul>
            <li>AI 生成设计风格不稳定</li>
            <li>截图收藏缺少结构，代理难以复用</li>
            <li>字体、布局、背景和动效容易混搭失控</li>
            <li>生成代码能跑，但视觉判断没有稳定依据</li>
          </ul>
        </div>
        <div class="panel">
          <strong>方案</strong>
          <ul>
            <li>把真实优秀案例整理成机器可读的数据</li>
            <li>用分类和风格标签帮助选择参考方向</li>
            <li>用兼容性规则约束设计元素组合</li>
            <li>把设计参考变成可持续扩展的资料层</li>
          </ul>
        </div>
      </div>
    </section>

    <section>
      <h2>它怎么工作</h2>
      <div class="flow">
        <div class="step"><strong>1. 收集真实案例</strong>保留来源、预览和设计场景。</div>
        <div class="step"><strong>2. 结构化审美信息</strong>整理分类、标签、适用场景和说明。</div>
        <div class="step"><strong>3. 加入兼容规则</strong>约束字体、布局、背景和动效组合。</div>
        <div class="step"><strong>4. 生成公开 Demo</strong>输出 GitHub Pages 页面和可读代码入口。</div>
      </div>
    </section>

    <section>
      <h2>代码入口</h2>
      <p>核心代码可以直接在 GitHub 仓库里查看。</p>
      <div class="links">
        <a href="${repositoryUrl}/blob/main/scripts/prepare_github_demo.mjs">prepare_github_demo.mjs</a>
        <a href="${repositoryUrl}/blob/main/scripts/build_public_library_platform_20260713.mjs">build_public_library_platform_20260713.mjs</a>
        <a href="${repositoryUrl}/blob/main/scripts/audit_library.mjs">audit_library.mjs</a>
      </div>
    </section>

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
      Public demo generated from structured metadata. Full local asset packs are intentionally excluded from the repository.
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
