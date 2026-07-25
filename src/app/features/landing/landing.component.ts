import {
  Component,
  HostListener,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
  OnInit,
  Renderer2,
  PLATFORM_ID,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ArticleService } from '../../core/services/article.service';
import { SeoService } from '../../core/services/seo.service';
import { WorkshopService } from '../../core/services/workshop.service';
import { ThemeService } from '../../core/services/theme.service';
import { Article } from '../../core/model/article.model';
import { Workshop } from '../../core/model/models';
import { buildSlug } from '../../core/utils/slug.util';
import { TechBackgroundComponent } from '../shared/components/tech-background/tech-background.component';
import { MemberCalendarComponent } from '../calendar/calendar.component';
import { MemberNotesComponent } from '../notes/notes.component';
import { Subscription } from 'rxjs';
import { TiltSpotlightDirective } from '../../core/directives/tilt-spotlight.directive';
import { MagneticDirective } from '../../core/directives/magnetic.directive';
import { PageSpineComponent } from '../shared/components/page-spine/page-spine.component';
import { SpineAnchor } from '../shared/components/page-spine/spine-anchor.model';
import { ClubInsightsComponent } from '../shared/components/club-insights/club-insights.component';

interface FeatureDetail {
  icon: string;
  title: string;
  summary: string;
  points: string[];
  ctaLabel: string;
  ctaLink: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    RouterLink,
    CommonModule,
    TechBackgroundComponent,
    MemberCalendarComponent,
    MemberNotesComponent,
    TiltSpotlightDirective,
    MagneticDirective,
    PageSpineComponent,
    ClubInsightsComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private articleService = inject(ArticleService);
  private workshopService = inject(WorkshopService);
  private themeService = inject(ThemeService);
  private renderer = inject(Renderer2);
  private seo = inject(SeoService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  userMenuOpen = signal(false);

  // ── Fil conducteur latéral (voir PageSpineComponent) — ordre = ordre
  // réel des sections dans le template ci-dessous. ──
  readonly spineAnchors: SpineAnchor[] = [
    { id: 'hero', label: 'Accueil', icon: 'fa-house' },
    { id: 'stats-section', label: 'Notre impact', icon: 'fa-chart-line' },
    { id: 'insights-section', label: 'En chiffres', icon: 'fa-chart-pie' },
    { id: 'upcoming-events', label: 'Ça arrive bientôt', icon: 'fa-calendar-alt' },
    { id: 'features', label: 'Pourquoi nous rejoindre', icon: 'fa-question-circle' },
    { id: 'parcours-section', label: 'Ton parcours', icon: 'fa-route' },
    { id: 'workspace-section', label: 'Agenda & Notes', icon: 'fa-calendar-check' },
    { id: 'showcase', label: 'Live Experience', icon: 'fa-video' },
    { id: 'cta-section', label: 'Rejoindre le club', icon: 'fa-user-plus' },
  ];

  // ── Modal "En savoir plus" (features) ───────────────────────────────────
  activeFeature = signal<FeatureDetail | null>(null);

  readonly featureDetails: Record<string, FeatureDetail> = {
    propose: {
      icon: 'fa-lightbulb',
      title: 'Proposer une thématique',
      summary:
        "Tu as une idée de workshop ? Tu peux la soumettre directement depuis ton espace membre. L'équipe d'administration l'examine, la valide si elle correspond aux objectifs du club, puis programme la session et configure le formulaire de présence associé.",
      points: [
        'Soumission simple via un formulaire dédié dans ton espace membre',
        "Suivi de l'état de ta proposition (en attente, validée, refusée)",
        "Une fois validée, l'admin programme la date et configure les présences",
        'Tu peux proposer autant de thématiques que tu le souhaites',
      ],
      ctaLabel: 'Proposer une thématique',
      ctaLink: '/espace-membre/proposer',
    },
    workshops: {
      icon: 'fa-microphone-alt',
      title: 'Workshops interactifs',
      summary:
        'Les workshops sont des sessions en direct, animées par des membres ou intervenants du club. Tu confirmes ta présence via un formulaire personnalisé et tu peux suivre la session en ligne directement via notre intégration Jitsi Meet.',
      points: [
        'Sessions live, en présentiel ou à distance selon le format',
        'Formulaire de présence rapide et personnalisé pour chaque session',
        'Accès direct à la visioconférence intégrée pour les sessions à distance',
        "Historique de tes participations consultable dans ton espace",
      ],
      ctaLabel: 'Voir les workshops',
      ctaLink: '/workshops',
    },
    security: {
      icon: 'fa-shield-alt',
      title: 'Sécurité & Réseaux',
      summary:
        'Le club met un accent particulier sur la cybersécurité et les réseaux : cryptographie, tests d’intrusion (pentest), protocoles de transmission, durcissement de systèmes. Ces thématiques sont régulièrement abordées lors de nos workshops et challenges CTF.',
      points: [
        'Ateliers pratiques de pentest et de sécurité réseau',
        'Notions de cryptographie appliquée',
        'Challenges type CTF pour mettre en pratique tes compétences',
        'Bonnes pratiques de sécurisation des infrastructures',
      ],
      ctaLabel: 'Explorer les thématiques',
      ctaLink: '/thematiques',
    },
    ai: {
      icon: 'fa-robot',
      title: 'Intelligence Artificielle',
      summary:
        "L'IA est un axe fort du club : nous explorons ses applications concrètes, notamment dans la cybersécurité (détection d'anomalies, analyse comportementale) et dans la transmission/traitement de données.",
      points: [
        "Introduction au machine learning et à ses cas d'usage",
        "IA appliquée à la détection de menaces et d'anomalies",
        'Veille technologique partagée avec la communauté',
        'Projets et démonstrations présentés lors des workshops',
      ],
      ctaLabel: 'Explorer les thématiques',
      ctaLink: '/thematiques',
    },
    cloud: {
      icon: 'fa-cloud-upload-alt',
      title: 'Cloud & DevOps',
      summary:
        "Apprends à déployer et sécuriser des applications dans des environnements cloud modernes. Nous couvrons les bonnes pratiques DevOps ainsi que la sécurisation des infrastructures cloud (gestion des accès, configuration, supervision).",
      points: [
        'Bonnes pratiques de sécurité dans le cloud',
        'Notions de CI/CD et automatisation des déploiements',
        'Gestion des accès et durcissement des configurations',
        'Retours d’expérience partagés par les membres',
      ],
      ctaLabel: 'Explorer les thématiques',
      ctaLink: '/thematiques',
    },
    webdev: {
      icon: 'fa-code',
      title: 'Développement Web',
      summary:
        'Le club accompagne ses membres dans la maîtrise des frameworks modernes (Angular, etc.) ainsi que des bonnes pratiques de sécurité web : protection contre les failles courantes, gestion sécurisée des authentifications et des données.',
      points: [
        'Frameworks et outils modernes du développement web',
        'Sécurité web : XSS, CSRF, gestion des sessions et des accès',
        'Bonnes pratiques de structuration et de qualité de code',
        'Projets concrets présentés et discutés en communauté',
      ],
      ctaLabel: 'Explorer les thématiques',
      ctaLink: '/thematiques',
    },
  };

  openFeatureModal(key: string): void {
    this.activeFeature.set(this.featureDetails[key] ?? null);
  }

  closeFeatureModal(): void {
    this.activeFeature.set(null);
  }

  // ── Ton parcours (section publique) ──────────────────────────────────────
  // Mêmes 6 étapes que la roadmap affichée dans l'espace membre (voir
  // ProfileComponent.memberRoadmap / MemberDashboardComponent.memberRoadmap)
  // — un visiteur reconnaît ainsi le même fil une fois inscrit. Ici pas de
  // progression réelle (personne n'est encore membre) : cliquer une étape
  // active simplement son explication dans le panneau ci-dessous.
  activeJourneyIndex = signal(0);

  readonly journeySteps: Array<{
    icon: string;
    title: string;
    tagline: string;
    description: string;
  }> = [
    {
      icon: 'fa-compass',
      title: 'Découvre',
      tagline: 'Crée ton compte',
      description:
        "Tu crées ton compte en quelques secondes et tu accèdes immédiatement à ton espace membre : catalogue de thématiques, agenda des workshops, et ton propre tableau de bord.",
    },
    {
      icon: 'fa-calendar-check',
      title: 'Participe',
      tagline: 'Ton premier workshop',
      description:
        "Tu t'inscris à une première session en direct, animée par un membre ou un intervenant du club — en présentiel, à distance ou en hybride selon le format.",
    },
    {
      icon: 'fa-graduation-cap',
      title: 'Apprends',
      tagline: '3 workshops suivis',
      description:
        "À force de suivre les sessions — cybersécurité, IA, cloud, développement — tu montes en compétence et tu commences à te repérer dans l'écosystème du club.",
    },
    {
      icon: 'fa-lightbulb',
      title: 'Contribue',
      tagline: 'Ta première thématique',
      description:
        "Tu proposes toi-même un sujet qui te passionne. L'équipe l'examine, et si elle correspond aux objectifs du club, elle est programmée comme un vrai workshop.",
    },
    {
      icon: 'fa-pen-nib',
      title: 'Devient référence',
      tagline: '3 thématiques proposées',
      description:
        'Tu deviens une voix reconnue sur tes sujets de prédilection, sollicitée par la communauté pour partager ton expertise et animer de nouvelles sessions.',
    },
    {
      icon: 'fa-user-graduate',
      title: 'Mentor',
      tagline: 'Membre fidèle & contributeur',
      description:
        "Membre depuis longtemps et contributeur régulier, tu accompagnes les nouveaux arrivants et fais vivre la communauté au quotidien.",
    },
  ];

  setActiveJourneyStep(index: number): void {
    this.activeJourneyIndex.set(index);
  }

  // ── Articles preview ─────────────────────────────────────────────────────
  latestArticles = signal<Article[]>([]);
  private articleSub: Subscription | null = null;

  // ── Événements à venir & statistiques dynamiques ────────────────────────
  upcomingEvents = signal<Workshop[]>([]);
  totalThemesCount = signal(22);
  totalWorkshopsCount = signal(16);
  private workshopsSub: Subscription | null = null;
  private themesSub: Subscription | null = null;

  // Category icons map
  readonly categoryIcons: Record<string, string> = {
    'Cybersécurité': 'fa-shield-alt',
    'Intelligence Artificielle': 'fa-robot',
    'Développement Web': 'fa-code',
    'Cloud & DevOps': 'fa-cloud',
    'Cryptographie': 'fa-lock',
    'Réseaux': 'fa-network-wired',
    'Autre': 'fa-tag',
  };

  getCategoryIcon(cat: string): string {
    return this.categoryIcons[cat] ?? 'fa-tag';
  }

  formatArticleDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
    }).format(date);
  }

  // ── Guest notebook state (même séquence que MemberNotesComponent) ──
  guestNotebookOpen = false;
  guestIsFlipping = false;
  guestIsOpening = false;

  private t1: ReturnType<typeof setTimeout> | null = null;
  private t2: ReturnType<typeof setTimeout> | null = null;
  private t3: ReturnType<typeof setTimeout> | null = null;

  private observer: IntersectionObserver | null = null;
  private typingInterval: any = null;
  private scrollObservers: IntersectionObserver[] = [];
  private mouseMoveHandler: (() => void) | null = null;
  private codeTypingTimeout: any = null;

  get user() {
    return this.authService.currentUser;
  }
  get userInitial(): string {
    return this.user?.displayName?.charAt(0).toUpperCase() ?? '?';
  }
  isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeFeatureModal();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) this.userMenuOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
  }

  ngOnInit(): void {
    // ── SEO de la page d'accueil ──
    this.seo.setPage({
      title: 'Club TDSI Campus — communauté cybersécurité & IA, Club TDSI Dakar',
      description:
        'La communauté sénégalaise dédiée à la cybersécurité, l’IA et les ' +
        'technologies de l’information. Workshops gratuits, thématiques, ' +
        'réseau. Club TDSI – UCAD, Dakar.',
      path: '/',
    });

    // ── JSON-LD Organization + WebSite ──
    // Sert uniquement sur la home : identifie l'entité "Club TDSI" pour
    // Google (knowledge panel potentiel) et déclare le site pour une
    // éventuelle sitelinks search box.
    this.seo.setJsonLd('organization', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Club TDSI',
      alternateName: 'Club TDSI Campus',
      url: this.seo.absoluteUrl('/'),
      logo: this.seo.absoluteUrl('/assets/images/logo.png'),
      description:
        'Club étudiant dédié à la cybersécurité, l’IA et les technologies ' +
        'de l’information — TDSI, École Supérieure Polytechnique (ESP), UCAD, Dakar.',
      // 🔧 À compléter avec les vrais liens du club (retire ceux qui n'existent pas).
      sameAs: [
        // 'https://www.facebook.com/clubtdsi',
        // 'https://www.instagram.com/clubtdsi',
        // 'https://www.linkedin.com/company/club-tdsi',
      ],
    });

    this.seo.setJsonLd('website', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Club TDSI Campus',
      url: this.seo.absoluteUrl('/'),
    });

    // ✅ SSR-safe : le listener Firestore temps réel ne doit s'ouvrir
    // que dans le navigateur (il empêcherait le prerender de se
    // stabiliser). Le HTML prérendu contient le shell + les meta.
    if (!this.isBrowser) return;

    // Charger les 3 derniers articles publiés
    this.articleSub = this.articleService.getPublishedArticles().subscribe(articles => {
      this.latestArticles.set(articles.slice(0, 3));
    });

    // Charger les workshops (événements à venir + compteur réel)
    this.workshopsSub = this.workshopService.getWorkshops().subscribe((workshops) => {
      this.totalWorkshopsCount.set(workshops.length);
      const now = new Date();
      const upcoming = workshops
        .filter((w) => w.status === 'planifié' && new Date(w.date).getTime() >= now.getTime())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 3);
      this.upcomingEvents.set(upcoming);
    });

    // Charger le nombre réel de thématiques
    this.themesSub = this.themeService.getThemes().subscribe((themes) => {
      this.totalThemesCount.set(themes.length);
    });
  }

  workshopSlug(workshop: Workshop): string {
    return buildSlug(workshop.themeTitle, workshop.id!);
  }

  availableSpots(workshop: Workshop): number {
    const max = workshop.maxParticipants || 30;
    const registrations = workshop.registrations?.length || 0;
    return Math.max(max - registrations, 0);
  }

  // ── Ouverture du carnet guest avec feuilletage ────────────────────────
  openGuestNotebook(): void {
    if (this.guestNotebookOpen) return;

    this.guestIsFlipping = true;
    this.guestIsOpening = true;

    this.t1 = setTimeout(() => {
      this.guestNotebookOpen = true;
    }, 380);

    this.t2 = setTimeout(() => {
      this.guestIsFlipping = false;
    }, 680);

    this.t3 = setTimeout(() => {
      this.guestIsOpening = false;
    }, 950);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    // ✅ SSR-safe : animations DOM (querySelector, IntersectionObserver,
    // mousemove) uniquement dans le navigateur.
    if (!this.isBrowser) return;
    this.initCounters();
    this.initTypingAnimation();
    this.initMouseGlow();
    this.initScrollReveal();
    this.initParticlesAnimation();
    this.initCodeTyping();
    this.initParallax();
  }

  ngOnDestroy(): void {
    this.seo.clearJsonLd('organization');
    this.seo.clearJsonLd('website');
    if (this.observer) this.observer.disconnect();
    if (this.typingInterval) clearInterval(this.typingInterval);
    if (this.codeTypingTimeout) clearTimeout(this.codeTypingTimeout);
    [this.t1, this.t2, this.t3].forEach((t) => t && clearTimeout(t));
    this.scrollObservers.forEach((obs) => obs.disconnect());
    if (this.mouseMoveHandler) this.mouseMoveHandler();
    this.articleSub?.unsubscribe();
    this.workshopsSub?.unsubscribe();
    this.themesSub?.unsubscribe();
    if (this.parallaxScrollHandler) {
      window.removeEventListener('scroll', this.parallaxScrollHandler);
    }
    if (this.parallaxRafId) cancelAnimationFrame(this.parallaxRafId);
  }

  // ── Parallax scroll léger (hero + showcase) ─────────────────────────────
  // Donne une sensation de profondeur sans lib externe : deux éléments
  // (logo du hero, mockup du showcase) se translatent à une vitesse
  // légèrement différente du scroll. Throttled via requestAnimationFrame
  // pour rester fluide, et désactivé si prefers-reduced-motion.
  private parallaxScrollHandler: (() => void) | null = null;
  private parallaxRafId: number | null = null;

  private initParallax(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const heroLogo = document.querySelector<HTMLElement>('.hero__logo-container');
    const showcaseCard = document.querySelector<HTMLElement>('.showcase__card');
    if (!heroLogo && !showcaseCard) return;

    let ticking = false;

    const apply = () => {
      const scrollY = window.scrollY;

      if (heroLogo) {
        // Ratio doux : le logo suit le scroll à 15% de sa vitesse et
        // s'arrête de bouger dès qu'on est sorti du hero, pour ne pas
        // dériver sur le reste de la page.
        const heroSection = heroLogo.closest('.hero') as HTMLElement | null;
        const heroHeight = heroSection?.offsetHeight ?? window.innerHeight;
        if (scrollY < heroHeight) {
          heroLogo.style.transform = `translateY(${scrollY * 0.15}px)`;
        }
      }

      if (showcaseCard) {
        const rect = showcaseCard.getBoundingClientRect();
        const viewportCenter = window.innerHeight / 2;
        const distanceFromCenter = rect.top + rect.height / 2 - viewportCenter;
        // Amplitude bornée pour rester subtil même sur les grands écrans.
        const offset = Math.max(-24, Math.min(24, distanceFromCenter * -0.06));
        showcaseCard.style.transform = `translateY(${offset}px)`;
      }

      ticking = false;
    };

    this.parallaxScrollHandler = () => {
      if (!ticking) {
        this.parallaxRafId = requestAnimationFrame(apply);
        ticking = true;
      }
    };

    window.addEventListener('scroll', this.parallaxScrollHandler, { passive: true });
    apply();
  }

  // ── Animations existantes ─────────────────────────────────────────────

  private initTypingAnimation(): void {
    const texts = [
      'Club TDSI Campus',
      'Tech Community',
      'Cyber Security Hub',
      'AI Innovation Lab',
    ];
    let textIndex = 0,
      charIndex = 0,
      isDeleting = false;
    const typingElement = document.getElementById('typingText');
    if (!typingElement) return;

    const type = () => {
      const currentText = texts[textIndex];
      typingElement.textContent = isDeleting
        ? currentText.substring(0, charIndex - 1)
        : currentText.substring(0, charIndex + 1);
      isDeleting ? charIndex-- : charIndex++;

      if (!isDeleting && charIndex === currentText.length) {
        isDeleting = true;
        setTimeout(type, 2000);
        return;
      }
      if (isDeleting && charIndex === 0) {
        isDeleting = false;
        textIndex = (textIndex + 1) % texts.length;
      }
      setTimeout(type, isDeleting ? 50 : 100);
    };
    setTimeout(type, 500);
  }

  private initCodeTyping(): void {
    const codeLines = document.querySelectorAll('.code-line');
    const cursor = document.querySelector('.code-cursor') as HTMLElement;
    const animateLines = () => {
      codeLines.forEach((line, index) => {
        const el = line as HTMLElement;
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        setTimeout(() => {
          el.style.transition = 'all 1.2s ease';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, index * 700);
      });
      if (cursor) {
        cursor.style.opacity = '0';
        setTimeout(() => {
          cursor.style.opacity = '1';
        }, codeLines.length * 700);
      }
      setTimeout(() => animateLines(), codeLines.length * 700 + 7000);
    };
    animateLines();
  }

  private initCounters(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            document.querySelectorAll('.counter').forEach((counter) => {
              const target = parseInt(
                counter.getAttribute('data-target') || '0',
                10,
              );
              let current = 0;
              const step = target / (2000 / 16);
              const update = () => {
                current += step;
                if (current < target) {
                  counter.textContent = Math.floor(current).toString();
                  requestAnimationFrame(update);
                } else {
                  counter.textContent = target.toString();
                  counter.closest('.stat-card')?.classList.add('stat-card--counted');
                }
              };
              update();
            });
            this.observer?.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );
    const statsSection = document.querySelector('.stats-grid');
    if (statsSection) this.observer.observe(statsSection);
  }

  private initMouseGlow(): void {
    const glow = document.getElementById('mouseGlow');
    if (!glow) return;

    const handler = (e: MouseEvent) => {
      glow.style.transform = `translate3d(${e.clientX - 125}px, ${e.clientY - 125}px, 0)`;
    };

    document.addEventListener('mousemove', handler);

    this.mouseMoveHandler = () =>
      document.removeEventListener('mousemove', handler);
  }

  private initScrollReveal(): void {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' },
    );
    document
      .querySelectorAll(
        '.feature-card, .stat-card, .showcase__content, .showcase__image, .resource-card, .article-preview-card',
      )
      .forEach((el) => {
        el.classList.add('reveal');
        revealObserver.observe(el);
      });
    this.scrollObservers.push(revealObserver);
  }

  private initParticlesAnimation(): void {
    document.querySelectorAll('.particle').forEach((particle) => {
      (particle as HTMLElement).style.left = `${Math.random() * 100}%`;
      (particle as HTMLElement).style.top = `${Math.random() * 100}%`;
      (particle as HTMLElement).style.animationDelay = `${Math.random() * 2}s`;
      (particle as HTMLElement).style.animationDuration =
        `${3 + Math.random() * 2}s`;
    });
  }

  openExternalLink(url: string): void {
    window.open(url, '_blank');
  }
}
