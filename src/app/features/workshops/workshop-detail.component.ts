// workshop-detail.component.ts
// ─────────────────────────────────────────────────────────────────────
// Page de détail d'un workshop — URL canonique, indexable et partageable :
//   /workshops/{slug-du-titre}--{idFirestore}
//
// Rôles :
//   • Deep-link partageable (WhatsApp, LinkedIn…) avec aperçu OG
//   • SEO : Title/Meta/canonical par workshop + JSON-LD schema.org/Event
//     → éligible aux « rich results » événements de Google
//   • Redirection canonique : si l'URL contient un slug obsolète
//     (titre modifié) ou l'id brut, l'URL est réécrite sans rechargement
//   • Reprend les actions du listing : inscription, désinscription, meet
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
import { WorkshopService } from '../../core/services/workshop.service';
import { EnrichmentService } from '../../core/services/enrichment.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SeoService } from '../../core/services/seo.service';
import { Workshop, AiEnrichmentData } from '../../core/model/models';
import { buildSlug, extractIdFromSlug, slugify } from '../../core/utils/slug.util';
import {
  buildWorkshopIcs,
  googleCalendarUrl,
  downloadIcs,
} from '../../core/utils/calendar.util';

@Component({
  selector: 'app-workshop-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './workshop-detail.component.html',
  styleUrls: ['./workshop-detail.component.scss'],
})
export class WorkshopDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private workshopService = inject(WorkshopService);
  private enrichmentService = inject(EnrichmentService);
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

  workshop = signal<Workshop | null>(null);
  enrichment = signal<AiEnrichmentData | null>(null);
  loading = signal(true);
  notFound = signal(false);
  registering = signal(false);

  isLoggedIn = () => this.authService.isLoggedIn;

  isRegistered = computed(() => {
    const w = this.workshop();
    const uid = this.authService.currentUser?.uid;
    return !!w && !!uid && (w.registrations ?? []).includes(uid);
  });

  isFull = computed(() => {
    const w = this.workshop();
    return !!w && (w.registrations?.length ?? 0) >= w.maxParticipants;
  });

  spotsLeft = computed(() => {
    const w = this.workshop();
    if (!w) return 0;
    return Math.max(0, w.maxParticipants - (w.registrations?.length ?? 0));
  });

  async ngOnInit(): Promise<void> {
    const slugParam = this.route.snapshot.paramMap.get('slug') ?? '';
    const id = extractIdFromSlug(slugParam);

    // ── SEO provisoire, SYNCHRONE ──
    // Le slug contient déjà le titre : on pose immédiatement un
    // title/canonical dérivé du slug. C'est ce qui se retrouve dans le
    // HTML prérendu (déterministe, aucun accès réseau au build). Les
    // meta sont ensuite affinées après le fetch, côté navigateur.
    const provisionalTitle = this.titleFromSlug(slugParam);
    this.seo.setPage({
      title: provisionalTitle
        ? `${provisionalTitle} — Workshop`
        : 'Workshop — Club TDSI Campus',
      description:
        `Workshop « ${provisionalTitle || '…'} » du Club TDSI — ` +
        'cybersécurité, IA & réseaux. TDSI – UCAD, Dakar. Inscription en ligne.',
      path: `/workshops/${slugParam}`,
      type: 'article',
    });

    // ✅ SSR-safe : le fetch Firestore n'a lieu qu'en navigateur.
    if (!this.isBrowser) return;

    const workshop = await this.workshopService.getWorkshopById(id);

    if (!workshop) {
      this.loading.set(false);
      this.notFound.set(true);
      this.seo.setPage({
        title: 'Workshop introuvable',
        description: 'Ce workshop n’existe pas ou a été supprimé.',
        path: '/workshops',
        noIndex: true,
      });
      return;
    }

    this.workshop.set(workshop);
    this.loading.set(false);

    // ── URL canonique ──
    // Si le visiteur arrive via l'id brut ou un slug périmé (titre
    // modifié depuis), on réécrit l'URL sans recharger le composant.
    const canonicalSlug = buildSlug(workshop.themeTitle, workshop.id!);
    if (slugParam !== canonicalSlug) {
      this.location.replaceState(`/workshops/${canonicalSlug}`);
    }

    this.applySeo(workshop, canonicalSlug);

    // ── Enrichissement pédagogique (contenu principal de la page) ──
    // Servi instantanément s'il est déjà persisté en Firestore ;
    // sinon généré une fois puis persisté pour tous (best-effort).
    this.enrichmentService
      .forWorkshop(workshop)
      .then((data) => this.enrichment.set(data))
      .catch(() => {
        /* bonus non bloquant : la page reste complète sans */
      });
  }

  ngOnDestroy(): void {
    this.seo.clearJsonLd('workshop');
    this.seo.clearJsonLd('breadcrumb');
  }

  // ============================================================
  // SEO + JSON-LD
  // ============================================================

  private applySeo(w: Workshop, slug: string): void {
    const path = `/workshops/${slug}`;
    const dateFr = new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(w.date);

    this.seo.setPage({
      title: `${w.themeTitle} — Workshop`,
      description:
        `Workshop « ${w.themeTitle} » animé par ${w.presenter}, ` +
        `le ${dateFr} (${w.location}). ` +
        `Club TDSI, TDSI – UCAD, Dakar. Inscription en ligne.`,
      path,
      type: 'article',
    });

    // ── schema.org/Event → rich results Google ──
    const start = w.date;
    const end =
      w.endDate ?? new Date(start.getTime() + (w.duration || 90) * 60000);

    const attendanceMode =
      w.location === 'en ligne'
        ? 'https://schema.org/OnlineEventAttendanceMode'
        : w.location === 'hybride'
          ? 'https://schema.org/MixedEventAttendanceMode'
          : 'https://schema.org/OfflineEventAttendanceMode';

    const physicalPlace = {
      '@type': 'Place',
      name: 'École Supérieure Polytechnique – UCAD',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Dakar',
        addressCountry: 'SN',
      },
    };
    const virtualPlace = {
      '@type': 'VirtualLocation',
      url: this.seo.absoluteUrl(path),
    };

    this.seo.setJsonLd('workshop', {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: w.themeTitle,
      description: `Workshop animé par ${w.presenter} — Club TDSI Campus.`,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      eventAttendanceMode: attendanceMode,
      eventStatus:
        w.status === 'annulé'
          ? 'https://schema.org/EventCancelled'
          : 'https://schema.org/EventScheduled',
      location:
        w.location === 'en ligne'
          ? virtualPlace
          : w.location === 'hybride'
            ? [physicalPlace, virtualPlace]
            : physicalPlace,
      performer: { '@type': 'Person', name: w.presenter },
      organizer: {
        '@type': 'Organization',
        name: 'Club TDSI',
        url: this.seo.absoluteUrl('/'),
      },
      isAccessibleForFree: true,
      maximumAttendeeCapacity: w.maxParticipants,
      url: this.seo.absoluteUrl(path),
    });

    this.seo.setJsonLd('breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Workshops',
          item: this.seo.absoluteUrl('/workshops'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: w.themeTitle,
          item: this.seo.absoluteUrl(path),
        },
      ],
    });
  }

  // ============================================================
  // STATUT DYNAMIQUE (même logique que le listing)
  // ============================================================

  displayStatus = computed(() => {
    const w = this.workshop();
    if (!w) return '';
    if (w.status === 'annulé') return 'annulé';
    const now = new Date();
    const start = new Date(w.date);
    const end = w.endDate
      ? new Date(w.endDate)
      : new Date(start.getTime() + (w.duration || 90) * 60000);
    if (now > end) return 'terminé';
    if (now >= start) return 'en cours';
    return 'planifié';
  });

  // ============================================================
  // ACTIONS
  // ============================================================

  async register(): Promise<void> {
    const w = this.workshop();
    const userId = this.authService.currentUser?.uid;
    if (!w?.id) return;
    if (!userId) {
      this.router.navigate(['/connexion'], {
        queryParams: { redirect: this.router.url },
      });
      return;
    }

    this.registering.set(true);
    try {
      await this.workshopService.registerToWorkshop(w.id, userId);
      // Mise à jour optimiste locale
      this.workshop.set({
        ...w,
        registrations: [...(w.registrations ?? []), userId],
      });
      this.toastService.success(
        `✅ Inscription confirmée pour "${w.themeTitle}" !`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'Plus de places disponibles') {
        this.toastService.error(
          '❌ Ce workshop est complet, plus de places disponibles.',
        );
      } else if (message === 'Déjà inscrit') {
        this.toastService.info('Tu es déjà inscrit à ce workshop.');
      } else {
        this.toastService.error("❌ Erreur lors de l'inscription. Réessaie.");
      }
    } finally {
      this.registering.set(false);
    }
  }

  async unregister(): Promise<void> {
    const w = this.workshop();
    const userId = this.authService.currentUser?.uid;
    if (!w?.id || !userId) return;

    this.registering.set(true);
    try {
      await this.workshopService.unregisterFromWorkshop(w.id, userId);
      this.workshop.set({
        ...w,
        registrations: (w.registrations ?? []).filter((u) => u !== userId),
      });
      this.toastService.info(
        `ℹ️ Désinscription de "${w.themeTitle}" effectuée.`,
      );
    } catch {
      this.toastService.error('❌ Erreur lors de la désinscription. Réessaie.');
    } finally {
      this.registering.set(false);
    }
  }

  // ── Export calendrier ──

  /** URL canonique de la page (partagée par .ics et Google Calendar). */
  private pageUrl(w: Workshop): string {
    return this.seo.absoluteUrl(
      `/workshops/${buildSlug(w.themeTitle, w.id!)}`,
    );
  }

  /** Télécharge le fichier .ics (Apple Calendar, Outlook, Thunderbird…). */
  addToCalendar(): void {
    const w = this.workshop();
    if (!w) return;
    downloadIcs(
      `workshop-${slugify(w.themeTitle) || 'club-tdsi'}`,
      buildWorkshopIcs(w, this.pageUrl(w)),
    );
    this.toastService.success('📅 Fichier calendrier téléchargé !');
  }

  /** Ouvre Google Calendar pré-rempli dans un nouvel onglet. */
  addToGoogleCalendar(): void {
    const w = this.workshop();
    if (!w) return;
    window.open(googleCalendarUrl(w, this.pageUrl(w)), '_blank', 'noopener');
  }

  joinMeet(): void {
    const w = this.workshop();
    if (!w?.id) return;
    if (!this.isLoggedIn()) {
      this.toastService.error('🔒 Connecte-toi pour accéder au meet.');
      return;
    }
    this.router.navigate(['/workshops', w.id, 'meet']);
  }

  async share(): Promise<void> {
    const w = this.workshop();
    if (!w) return;
    const url = this.seo.absoluteUrl(
      `/workshops/${buildSlug(w.themeTitle, w.id!)}`,
    );
    const shareData = {
      title: `${w.themeTitle} — Club TDSI Campus`,
      text: `Workshop « ${w.themeTitle} » animé par ${w.presenter}`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        this.toastService.success('🔗 Lien copié dans le presse-papiers !');
      }
    } catch {
      /* partage annulé par l'utilisateur — rien à faire */
    }
  }
}
