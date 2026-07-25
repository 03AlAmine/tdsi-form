// core/services/seo.service.ts
// ─────────────────────────────────────────────────────────────────────
// Service SEO centralisé.
//
// Gère pour chaque page :
//   • <title> + meta description
//   • balise canonical
//   • Open Graph (og:title, og:description, og:url, og:image, og:type)
//   • Twitter Cards
//   • Injection / nettoyage de blocs JSON-LD (schema.org)
//
// Usage type dans un composant :
//   this.seo.setPage({
//     title: 'Pentest Web avancé',
//     description: 'Workshop animé par ... le 12 mars à l'ESP Dakar.',
//     path: '/workshops/pentest-web-avance--aB3xY9kQ',
//   });
//   this.seo.setJsonLd('workshop', { '@context': ..., '@type': 'Event', ... });
//
// Et dans ngOnDestroy :
//   this.seo.clearJsonLd('workshop');
//
// ⚠️ Prérequis : ajouter `siteUrl` dans environment.ts / environment.prod.ts
//    (voir INTEGRATION.md). Fallback fourni pour ne rien casser d'ici là.
// ─────────────────────────────────────────────────────────────────────

import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { environment } from '../../../environments/environment';

export interface SeoPageConfig {
  /** Titre de la page — le suffixe « | Club TDSI Campus » est ajouté automatiquement. */
  title: string;
  /** Description meta + OG. Idéalement 120–160 caractères, unique par page. */
  description: string;
  /** Chemin absolu de la route, ex: '/workshops/pentest--abc123'. Sert à la canonical + og:url. */
  path: string;
  /** URL absolue d'une image de partage. Fallback : logo du site. */
  image?: string;
  /** Largeur en px de `image` (défaut : dimensions du logo). Requis par certains crawlers, ex. LinkedIn. */
  imageWidth?: number;
  /** Hauteur en px de `image` (défaut : dimensions du logo). */
  imageHeight?: number;
  /** Type Open Graph. 'website' par défaut, 'article' pour du contenu daté. */
  type?: 'website' | 'article';
  /** true pour les pages à exclure de l'index (espace membre, admin…). */
  noIndex?: boolean;
}

const SITE_NAME = 'Club TDSI Campus';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private doc = inject(DOCUMENT);

  private readonly siteUrl: string =
    (environment as { siteUrl?: string }).siteUrl ??
    'https://campus.clubtdsi.sn';

  private readonly defaultImage = `${this.siteUrl}/assets/images/logo.png`;
  /** Dimensions réelles de assets/images/logo.png — à ajuster si le fichier change. */
  private readonly defaultImageWidth = 1024;
  private readonly defaultImageHeight = 1024;

  // ── Page complète ────────────────────────────────────────────────

  setPage(cfg: SeoPageConfig): void {
    const fullTitle = cfg.title.includes(SITE_NAME)
      ? cfg.title
      : `${cfg.title} | ${SITE_NAME}`;
    const url = this.absoluteUrl(cfg.path);
    const image = cfg.image ?? this.defaultImage;
    // Si une image custom est fournie sans dimensions, on ne force pas de
    // largeur/hauteur erronées : on les omet plutôt que de mentir au crawler.
    const imageWidth =
      cfg.imageWidth ?? (cfg.image ? undefined : this.defaultImageWidth);
    const imageHeight =
      cfg.imageHeight ?? (cfg.image ? undefined : this.defaultImageHeight);

    this.title.setTitle(fullTitle);

    this.upsert('description', cfg.description);
    this.upsert('robots', cfg.noIndex ? 'noindex, nofollow' : 'index, follow');

    // Open Graph
    this.upsertProp('og:site_name', SITE_NAME);
    this.upsertProp('og:title', fullTitle);
    this.upsertProp('og:description', cfg.description);
    this.upsertProp('og:url', url);
    this.upsertProp('og:image', image);
    if (imageWidth) {
      this.upsertProp('og:image:width', String(imageWidth));
    } else {
      this.meta.removeTag('property="og:image:width"');
    }
    if (imageHeight) {
      this.upsertProp('og:image:height', String(imageHeight));
    } else {
      this.meta.removeTag('property="og:image:height"');
    }
    this.upsertProp('og:type', cfg.type ?? 'website');
    this.upsertProp('og:locale', 'fr_SN');

    // Twitter
    this.upsert('twitter:card', 'summary_large_image');
    this.upsert('twitter:title', fullTitle);
    this.upsert('twitter:description', cfg.description);
    this.upsert('twitter:image', image);

    this.setCanonical(url);
  }

  // ── JSON-LD (schema.org) ─────────────────────────────────────────
  // Chaque bloc est identifié par un `key` pour pouvoir être remplacé
  // ou nettoyé indépendamment (ex: 'workshop', 'breadcrumb').

  setJsonLd(key: string, data: object): void {
    this.clearJsonLd(key);
    const script = this.doc.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo-jsonld', key);
    script.textContent = JSON.stringify(data);
    this.doc.head.appendChild(script);
  }

  clearJsonLd(key: string): void {
    this.doc.head
      .querySelectorAll(`script[data-seo-jsonld="${key}"]`)
      .forEach((el) => el.remove());
  }

  // ── Helpers ──────────────────────────────────────────────────────

  absoluteUrl(path: string): string {
    return `${this.siteUrl}${path.startsWith('/') ? path : '/' + path}`;
  }

  private upsert(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private upsertProp(property: string, content: string): void {
    this.meta.updateTag({ property, content });
  }

  private setCanonical(url: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
