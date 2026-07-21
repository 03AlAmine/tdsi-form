// core/utils/slug.util.ts
// ─────────────────────────────────────────────────────────────────────
// Slugs SEO : /workshops/pentest-web-avance--aB3xY9kQ
//
// Format : {slug-du-titre}--{idFirestore}
//   • Le titre rend l'URL lisible et riche en mots-clés (SEO + partage).
//   • L'id Firestore en suffixe permet de retrouver le document sans
//     champ `slug` en base → zéro migration, zéro risque de collision.
//   • Séparateur `--` : les ids Firestore auto-générés sont
//     alphanumériques (jamais de tiret), donc l'extraction est fiable.
//
// Rétro-compatibilité : /workshops/aB3xY9kQ (id brut, ancien format ou
// lien copié depuis l'admin) fonctionne aussi — extractIdFromSlug
// retourne la chaîne telle quelle s'il n'y a pas de `--`.
// ─────────────────────────────────────────────────────────────────────

/** Transforme un titre en slug URL-safe (accents retirés, minuscules). */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les diacritiques (é → e)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Construit le segment d'URL complet : slug lisible + id Firestore. */
export function buildSlug(title: string, id: string): string {
  const s = slugify(title);
  return s ? `${s}--${id}` : id;
}

/** Extrait l'id Firestore d'un segment d'URL (avec ou sans partie slug). */
export function extractIdFromSlug(slugOrId: string): string {
  const ix = slugOrId.lastIndexOf('--');
  return ix >= 0 ? slugOrId.slice(ix + 2) : slugOrId;
}
