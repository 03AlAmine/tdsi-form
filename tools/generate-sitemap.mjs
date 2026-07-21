#!/usr/bin/env node
// tools/generate-sitemap.mjs
// ─────────────────────────────────────────────────────────────────────
// Génère src/sitemap.xml à partir de Firestore (API REST publique).
//
//   • Zéro dépendance — Node 18+ (fetch natif).
//   • Compatible plan Spark : lecture via l'API REST Firestore, les
//     règles de sécurité publiques en lecture s'appliquent normalement.
//   • Reprend EXACTEMENT la même logique de slug que
//     src/app/core/utils/slug.util.ts → les URLs du sitemap sont
//     identiques aux URLs canoniques générées par l'app.
//
// Usage :
//   node tools/generate-sitemap.mjs
//
// Intégration recommandée (package.json) :
//   "scripts": {
//     "sitemap": "node tools/generate-sitemap.mjs",
//     "prebuild": "npm run sitemap",   ← régénéré à chaque build
//     ...
//   }
//
// ⚠️ Ne pas oublier de déclarer "src/sitemap.xml" (et "src/robots.txt")
//    dans angular.json → architect.build.options.assets.
// ─────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Config ───────────────────────────────────────────────────────────

const SITE_URL = 'https://campus.clubtdsi.sn';
const PROJECT_ID = 'club-tdsi-sign';
const API_KEY = 'AIzaSyD-bglX-I4R6XYKFegytaPvlO7nGdwCOzA'; // clé web publique

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(ROOT, '../src/sitemap.xml');
// Liste des routes à prérendre au build (angular.json → prerender.routesFile)
const OUTPUT_ROUTES = resolve(ROOT, '../prerender-routes.txt');

// Routes statiques publiques (les zones privées sont exclues,
// cohérent avec robots.txt).
const STATIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/workshops', priority: '0.9', changefreq: 'daily' },
  { path: '/thematiques', priority: '0.9', changefreq: 'daily' },
];

// ── Slug — copie conforme de src/app/core/utils/slug.util.ts ─────────

function slugify(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildSlug(title, id) {
  const s = slugify(title);
  return s ? `${s}--${id}` : id;
}

// ── Lecture Firestore REST (avec pagination) ─────────────────────────

async function fetchCollection(name) {
  const docs = [];
  let pageToken = '';

  do {
    const url = new URL(`${FIRESTORE_BASE}/${name}`);
    url.searchParams.set('pageSize', '300');
    url.searchParams.set('key', API_KEY);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Firestore ${name} → HTTP ${res.status}`);
    }
    const data = await res.json();
    docs.push(...(data.documents ?? []));
    pageToken = data.nextPageToken ?? '';
  } while (pageToken);

  return docs.map((d) => ({
    id: d.name.split('/').pop(),
    fields: d.fields ?? {},
    updateTime: d.updateTime,
  }));
}

const str = (fields, key) => fields[key]?.stringValue;
const ts = (fields, key) => fields[key]?.timestampValue;

// ── Construction du XML ──────────────────────────────────────────────

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    lastmod ? `    <lastmod>${lastmod.slice(0, 10)}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

async function main() {
  console.log('⏳ Lecture Firestore…');
  const [workshops, themes] = await Promise.all([
    fetchCollection('workshops'),
    fetchCollection('themes'),
  ]);
  console.log(`   ${workshops.length} workshops, ${themes.length} thématiques`);

  const now = new Date().toISOString();
  const entries = [];

  for (const r of STATIC_ROUTES) {
    entries.push(
      urlEntry({
        loc: `${SITE_URL}${r.path}`,
        lastmod: now,
        changefreq: r.changefreq,
        priority: r.priority,
      }),
    );
  }

  for (const w of workshops) {
    const title = str(w.fields, 'themeTitle');
    if (!title) continue;
    entries.push(
      urlEntry({
        loc: `${SITE_URL}/workshops/${buildSlug(title, w.id)}`,
        lastmod: w.updateTime ?? ts(w.fields, 'createdAt'),
        changefreq: 'weekly',
        priority: '0.8',
      }),
    );
  }

  for (const t of themes) {
    const title = str(t.fields, 'title');
    if (!title) continue;
    entries.push(
      urlEntry({
        loc: `${SITE_URL}/thematiques/${buildSlug(title, t.id)}`,
        lastmod: t.updateTime ?? ts(t.fields, 'createdAt'),
        changefreq: 'weekly',
        priority: '0.7',
      }),
    );
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');

  writeFileSync(OUTPUT, xml, 'utf8');
  console.log(`✅ ${entries.length} URLs → ${OUTPUT}`);

  // ── prerender-routes.txt : mêmes URLs, en chemins relatifs ──
  const routes = [
    ...STATIC_ROUTES.map((r) => r.path),
    ...workshops
      .filter((w) => str(w.fields, 'themeTitle'))
      .map((w) => `/workshops/${buildSlug(str(w.fields, 'themeTitle'), w.id)}`),
    ...themes
      .filter((t) => str(t.fields, 'title'))
      .map((t) => `/thematiques/${buildSlug(str(t.fields, 'title'), t.id)}`),
  ];
  writeFileSync(OUTPUT_ROUTES, routes.join('\n') + '\n', 'utf8');
  console.log(`✅ ${routes.length} routes → ${OUTPUT_ROUTES}`);
}

/** Filet de sécurité : si Firestore est injoignable, on garantit au
 *  moins les routes statiques pour que `ng build` ne casse jamais. */
function writeFallbackRoutes() {
  try {
    writeFileSync(
      OUTPUT_ROUTES,
      STATIC_ROUTES.map((r) => r.path).join('\n') + '\n',
      { flag: 'wx' }, // n'écrase pas un fichier existant (souvent plus complet)
    );
    console.log('ℹ️  prerender-routes.txt minimal écrit (routes statiques).');
  } catch {
    /* le fichier existe déjà : on garde la version précédente */
  }
}

main().catch((err) => {
  console.error('❌ Échec de génération du sitemap :', err.message);
  // Sortie non bloquante : un build sans sitemap frais vaut mieux
  // qu'un build cassé (le sitemap précédent reste en place).
  writeFallbackRoutes();
  process.exit(0);
});
