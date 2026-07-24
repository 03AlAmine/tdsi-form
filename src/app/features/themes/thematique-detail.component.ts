// thematique-detail.component.ts
// ─────────────────────────────────────────────────────────────────────
// Page de détail d'une thématique — URL canonique, indexable :
//   /thematiques/{slug-du-titre}--{idFirestore}
//
// • Title/Meta/canonical/OG par thématique + BreadcrumbList JSON-LD
// • Redirection canonique si slug obsolète ou id brut
// • Bouton « intéressé » (même logique optimiste que le listing)
// • Lien vers le workshop programmé si la thématique en a un
// ─────────────────────────────────────────────────────────────────────

import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ThemeService } from '../../core/services/theme.service';
import { WorkshopService } from '../../core/services/workshop.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SeoService } from '../../core/services/seo.service';
import { Theme, Workshop } from '../../core/model/models';
import { buildSlug, extractIdFromSlug } from '../../core/utils/slug.util';

@Component({
  selector: 'app-thematique-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './thematique-detail.component.html',
  styleUrls: ['./thematique-detail.component.scss'],
})
export class ThematiqueDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private themeService = inject(ThemeService);
  private workshopService = inject(WorkshopService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private seo = inject(SeoService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Reconstruit un titre lisible depuis le segment d'URL (partie avant `--`). */
  private titleFromSlug(slug: string): string {
    const ix = slug.lastIndexOf('--');
    const words = (ix >= 0 ? slug.slice(0, ix) : '').replace(/-/g, ' ').trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
  }

  theme = signal<Theme | null>(null);
  linkedWorkshop = signal<Workshop | null>(null);
  loading = signal(true);
  notFound = signal(false);
  interestPending = signal(false);

  isLoggedIn = () => this.authService.isLoggedIn;

  isInterested = computed(() => {
    const t = this.theme();
    const uid = this.authService.currentUser?.uid;
    return !!t && !!uid && !!t.interested?.includes(uid);
  });

  /** Même seuil que le listing : pas de compteur décourageant sous 3. */
  private static readonly INTEREST_DISPLAY_THRESHOLD = 3;

  showsInterestCount = computed(() => {
    const t = this.theme();
    return (
      (t?.interested?.length ?? 0) >=
      ThematiqueDetailComponent.INTEREST_DISPLAY_THRESHOLD
    );
  });

  /** URL de la page workshop liée, avec slug canonique. */
  linkedWorkshopLink = computed(() => {
    const w = this.linkedWorkshop();
    return w?.id ? ['/workshops', buildSlug(w.themeTitle, w.id)] : null;
  });

  async ngOnInit(): Promise<void> {
    const slugParam = this.route.snapshot.paramMap.get('slug') ?? '';
    const id = extractIdFromSlug(slugParam);

    // ── SEO provisoire, SYNCHRONE (voir workshop-detail pour le détail) ──
    const provisionalTitle = this.titleFromSlug(slugParam);
    this.seo.setPage({
      title: provisionalTitle
        ? `${provisionalTitle} — Thématique`
        : 'Thématique — Club TDSI Campus',
      description:
        `Thématique « ${provisionalTitle || '…'} » du Club TDSI — ` +
        'cybersécurité, IA & réseaux. TDSI – UCAD, Dakar.',
      path: `/thematiques/${slugParam}`,
      type: 'article',
    });

    // ✅ SSR-safe : le fetch Firestore n'a lieu qu'en navigateur.
    if (!this.isBrowser) return;

    const theme = await this.themeService.getThemeById(id);

    if (!theme) {
      this.loading.set(false);
      this.notFound.set(true);
      this.seo.setPage({
        title: 'Thématique introuvable',
        description: 'Cette thématique n’existe pas ou a été supprimée.',
        path: '/thematiques',
        noIndex: true,
      });
      return;
    }

    this.theme.set(theme);
    this.loading.set(false);

    // ── URL canonique ──
    const canonicalSlug = buildSlug(theme.title, theme.id!);
    if (slugParam !== canonicalSlug) {
      this.location.replaceState(`/thematiques/${canonicalSlug}`);
    }

    this.applySeo(theme, canonicalSlug);

    // ── Workshop lié (chargé en arrière-plan, non bloquant) ──
    firstValueFrom(this.workshopService.getWorkshops())
      .then((workshops) => {
        const linked = workshops.find((w) => w.themeId === theme.id);
        if (linked) this.linkedWorkshop.set(linked);
      })
      .catch(() => {
        /* pas bloquant : la page reste utilisable sans le workshop lié */
      });
  }

  ngOnDestroy(): void {
    this.seo.clearJsonLd('breadcrumb');
  }

  // ============================================================
  // SEO
  // ============================================================

  private applySeo(t: Theme, slug: string): void {
    const path = `/thematiques/${slug}`;

    // Description meta : celle de la thématique, tronquée proprement.
    const desc =
      t.description.length > 150
        ? t.description.slice(0, 147).trimEnd() + '…'
        : t.description;

    this.seo.setPage({
      title: `${t.title} — Thématique ${t.category}`,
      description: `${desc} Niveau ${t.difficulty} · Club TDSI, TDSI – UCAD, Dakar.`,
      path,
      type: 'article',
      image: t.imageUrl,
    });

    this.seo.setJsonLd('breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Thématiques',
          item: this.seo.absoluteUrl('/thematiques'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: t.title,
          item: this.seo.absoluteUrl(path),
        },
      ],
    });
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  async toggleInterest(): Promise<void> {
    const t = this.theme();
    const uid = this.authService.currentUser?.uid;
    if (!t?.id) return;
    if (!uid) {
      this.router.navigate(['/connexion'], {
        queryParams: { redirect: this.router.url },
      });
      return;
    }

    const wasInterested = this.isInterested();
    const previous = t.interested ?? [];
    const optimistic = wasInterested
      ? previous.filter((u) => u !== uid)
      : [...previous, uid];

    // Mise à jour optimiste — cohérente avec le listing.
    this.theme.set({ ...t, interested: optimistic });
    this.interestPending.set(true);

    try {
      // Même API que le listing : toggleInterest(theme, uid, étatActuel)
      await this.themeService.toggleInterest(t, uid, wasInterested);
      if (!wasInterested) {
        this.toastService.success('👍 Intérêt enregistré !');
      }
    } catch {
      // Rollback en cas d'échec
      this.theme.set({ ...t, interested: previous });
      this.toastService.error('❌ Erreur, réessaie.');
    } finally {
      this.interestPending.set(false);
    }
  }

  async share(): Promise<void> {
    const t = this.theme();
    if (!t) return;
    const url = this.seo.absoluteUrl(
      `/thematiques/${buildSlug(t.title, t.id!)}`,
    );
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${t.title} — Club TDSI Campus`,
          text: t.description.slice(0, 120),
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        this.toastService.success('🔗 Lien copié dans le presse-papiers !');
      }
    } catch {
      /* partage annulé — rien à faire */
    }
  }
}
