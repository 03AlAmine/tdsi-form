import {
  Component,
  HostListener,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
  OnInit,
  Renderer2,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ArticleService } from '../../core/services/article.service';
import { Article } from '../../core/model/article.model';
import { TechBackgroundComponent } from '../shared/components/tech-background/tech-background.component';
import { MemberCalendarComponent } from '../calendar/calendar.component';
import { MemberNotesComponent } from '../notes/notes.component';
import { Subscription } from 'rxjs';

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
  ],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private articleService = inject(ArticleService);
  private renderer = inject(Renderer2);

  userMenuOpen = signal(false);

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

  // ── Articles preview ─────────────────────────────────────────────────────
  latestArticles = signal<Article[]>([]);
  private articleSub: Subscription | null = null;

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
    // Charger les 3 derniers articles publiés
    this.articleSub = this.articleService.getPublishedArticles().subscribe(articles => {
      this.latestArticles.set(articles.slice(0, 3));
    });
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
    this.initCounters();
    this.initTypingAnimation();
    this.initMouseGlow();
    this.initScrollReveal();
    this.initParticlesAnimation();
    this.initCodeTyping();
  }

  ngOnDestroy(): void {
    if (this.observer) this.observer.disconnect();
    if (this.typingInterval) clearInterval(this.typingInterval);
    if (this.codeTypingTimeout) clearTimeout(this.codeTypingTimeout);
    [this.t1, this.t2, this.t3].forEach((t) => t && clearTimeout(t));
    this.scrollObservers.forEach((obs) => obs.disconnect());
    if (this.mouseMoveHandler) this.mouseMoveHandler();
    this.articleSub?.unsubscribe();
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
                } else counter.textContent = target.toString();
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
