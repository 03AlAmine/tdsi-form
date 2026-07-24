// member-dashboard.component.ts

import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkshopService } from '../../../core/services/workshop.service';
import { ToastService } from '../../../core/services/toast.service';
import { Subscription } from 'rxjs';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../../firebase.config';
import { MemberCalendarComponent } from '../../calendar/calendar.component';
import { MemberNotesComponent } from '../../notes/notes.component';
import { WelcomeModalComponent } from '../../shared/components/welcome-modal/welcome-modal.component';
import { GlowTimelineComponent } from '../../shared/components/glow-timeline/glow-timeline.component';
import { TimelineItem } from '../../shared/components/glow-timeline/timeline-item.model';
import { RevealDirective } from '../../../core/directives/reveal.directive';
import { CountUpDirective } from '../../../core/directives/count-up.directive';
import { ClubInsightsComponent } from '../../shared/components/club-insights/club-insights.component';
import { User } from '../../../core/model/models';

@Component({
  selector: 'app-member-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MemberCalendarComponent,
    FormsModule,
    MemberNotesComponent,
    WelcomeModalComponent,
    GlowTimelineComponent,
    RevealDirective,
    CountUpDirective,
    ClubInsightsComponent,
  ],
  templateUrl: './member-dashboard.component.html',
  styleUrls: ['./member-dashboard.component.scss'],
})
export class MemberDashboardComponent implements OnInit, OnDestroy {
  private authService    = inject(AuthService);
  private themeService   = inject(ThemeService);
  private workshopService = inject(WorkshopService);
  private router         = inject(Router);
  private toastService   = inject(ToastService);

  // ── Signals ──────────────────────────────────────────────────────────────
  user = signal<User | null>(this.authService.currentUser);

  // ✅ Modale de bienvenue post-inscription — voir
  // AuthService.consumeJustRegistered(). null tant qu'il n'y a rien à
  // afficher (utilisateur qui se connecte normalement, ou modale déjà vue).
  justRegistered = signal<{ displayName: string; email: string } | null>(null);

  // ✅ Suggestion affichée une fois la modale de bienvenue fermée (croix ou
  // simple clic en dehors), si le profil n'est pas encore complété — pour
  // ne pas la manquer complètement une fois la modale disparue.
  showProfileNudge = signal(false);

  stats = signal({
    totalThemes: 0,
    upcomingWorkshops: 0,
    mySubmissions: 0,
    myRegistrations: 0,
  });

  recentThemes      = signal<any[]>([]);
  upcomingWorkshops = signal<any[]>([]);
  loading           = signal(true);

  // Fusion chronologique des soumissions et workshops pour la timeline d'activité
  activityTimeline = computed(() => {
    const submissions = this.recentThemes().map((theme) => ({
      type: 'submission' as const,
      icon: 'fa-file-circle-plus',
      title: `Thématique proposée : ${theme.title}`,
      date: theme.createdAt instanceof Date ? theme.createdAt : new Date(theme.createdAt),
      link: '/espace-membre/mes-soumissions',
    }));
    const workshops = this.upcomingWorkshops().map((w) => ({
      type: 'workshop' as const,
      icon: 'fa-chalkboard-user',
      title: `Workshop à venir : ${w.themeTitle}`,
      date: w.date instanceof Date ? w.date : new Date(w.date),
      link: '/workshops',
    }));
    return [...submissions, ...workshops]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 6);
  });

  // ── Widget de bienvenue : message contextuel selon l'activité du membre ────
  welcomeTip = computed(() => {
    if (this.stats().mySubmissions === 0) {
      return {
        icon: 'fa-lightbulb',
        title: 'Une idée de workshop en tête ?',
        message: "Bienvenue chez vous ! Vous pouvez proposer une thématique qui vous passionne, parler de cybersécurité, d'IA, de cloud... le club est fait pour ça.",
        ctaLabel: 'Proposer une thématique',
        ctaLink: '/espace-membre/proposer',
      };
    }
    if (this.stats().myRegistrations === 0) {
      return {
        icon: 'fa-calendar-check',
        title: 'Pas encore inscrit à un workshop ?',
        message: 'Des sessions sont déjà planifiées par la communauté. Réservez votre place dès maintenant.',
        ctaLabel: 'Voir les workshops',
        ctaLink: '/workshops',
      };
    }
    return {
      icon: 'fa-rocket',
      title: 'Continuez sur cette lancée !',
      message: 'Explorez de nouvelles thématiques ou partagez une nouvelle idée avec la communauté.',
      ctaLabel: 'Explorer les thématiques',
      ctaLink: '/thematiques',
    };
  });

  // Notes
  notesContent    = signal('');
  userNotes       = signal('');
  notesEditing    = signal(false);
  lastNoteUpdate  = signal(new Date());

  private subscriptions: Subscription[] = [];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.subscriptions.push(
      this.authService.currentUser$.subscribe((u) => this.user.set(u))
    );
    this.justRegistered.set(this.authService.consumeJustRegistered());
    this.loadData();
    this.loadUserNotes();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  // ── Méthodes publiques ────────────────────────────────────────────────────
  getUserFirstName(): string {
    if (!this.user()?.displayName) return 'Membre';
    return this.user()!.displayName.split(' ')[0];
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }

  // ✅ Appelé à la fermeture de la modale de bienvenue (croix, Échap, ou
  // clic en dehors) — si le profil n'est pas encore complété, on affiche
  // une suggestion discrète et non bloquante à la place.
  onWelcomeModalClosed(): void {
    this.justRegistered.set(null);
    if (!this.isProfileComplete()) {
      this.showProfileNudge.set(true);
    }
  }

  dismissProfileNudge(): void {
    this.showProfileNudge.set(false);
  }

  goToWorkshop(_workshopId: string): void {
    this.router.navigate(['/workshops']);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  participationRate(): number {
    const totalRegistrations = this.stats().myRegistrations;
    const totalWorkshops = this.stats().upcomingWorkshops + this.stats().myRegistrations;
    if (totalWorkshops === 0) return 0;
    return Math.round((totalRegistrations / totalWorkshops) * 100);
  }

  engagementPoints(): number {
    return this.stats().myRegistrations * 10 + this.stats().mySubmissions * 25;
  }

  certificatesCount(): number {
    return Math.floor(this.stats().myRegistrations / 2);
  }

  lastActivityDate(): Date {
    return new Date();
  }

  // ── Rail d'onboarding — 3 étapes clés d'un nouveau membre ─────────────────
  // Recalculé dès que le profil (etablissement/filiere) ou les stats
  // (soumissions/inscriptions) changent, aucun état dupliqué.
  isProfileComplete(): boolean {
    const u = this.user();
    return !!(u?.etablissement && u?.filiere);
  }

  onboardingSteps = computed(() => {
    const u = this.user();
    const s = this.stats();
    const profileDone = !!(u?.etablissement && u?.filiere);
    const themeDone = s.mySubmissions > 0;
    const workshopDone = s.myRegistrations > 0;
    return [
      {
        id: 'profile',
        icon: 'fa-id-card',
        label: 'Compléter votre profil',
        description: profileDone
          ? 'Profil complet — établissement et filière renseignés.'
          : 'Ajoutez votre établissement et votre filière.',
        done: profileDone,
        link: '/espace-membre/profil',
      },
      {
        id: 'theme',
        icon: 'fa-lightbulb',
        label: 'Proposer une thématique',
        description: themeDone
          ? 'Vous avez déjà proposé une thématique.'
          : 'Partagez un sujet qui vous passionne avec le club.',
        done: themeDone,
        link: '/espace-membre/proposer',
      },
      {
        id: 'workshop',
        icon: 'fa-chalkboard-user',
        label: 'Participer à un workshop',
        description: workshopDone
          ? 'Vous participez déjà à un workshop.'
          : 'Réservez votre place à la prochaine session.',
        done: workshopDone,
        link: '/workshops',
      },
    ];
  });

  onboardingProgress = computed(() => {
    const steps = this.onboardingSteps();
    const doneCount = steps.filter((s) => s.done).length;
    return steps.length > 0 ? (doneCount / steps.length) * 100 : 0;
  });

  // ✅ Étape "à faire" la plus proche — reçoit un halo pulsant pour indiquer
  // clairement la prochaine action, même quand rien n'est encore complété.
  nextOnboardingStepIndex = computed(() => {
    return this.onboardingSteps().findIndex((s) => !s.done);
  });

  // ── Ton parcours — même roadmap que ProfileComponent.memberRoadmap
  // (mêmes seuils, mêmes libellés) affichée ici aussi pour qu'un membre
  // la retrouve dès l'accueil, sans avoir à aller sur son profil. ──
  memberSince = computed(() => {
    const createdAt = this.user()?.createdAt;
    if (!createdAt) return 0;
    const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
  });

  memberRoadmap = computed<TimelineItem[]>(() => {
    const s = this.stats();
    const since = this.memberSince();

    const steps: Array<{
      icon: string;
      title: string;
      description: string;
      unlocked: boolean;
    }> = [
      {
        icon: 'fa-compass',
        title: 'Découvre',
        description: 'Compte créé — bienvenue au Club TDSI.',
        unlocked: true,
      },
      {
        icon: 'fa-calendar-check',
        title: 'Participe',
        description: "S'inscrire à un premier workshop.",
        unlocked: s.myRegistrations >= 1,
      },
      {
        icon: 'fa-graduation-cap',
        title: 'Apprends',
        description: 'Suivre 3 workshops.',
        unlocked: s.myRegistrations >= 3,
      },
      {
        icon: 'fa-lightbulb',
        title: 'Contribue',
        description: 'Proposer une première thématique.',
        unlocked: s.mySubmissions >= 1,
      },
      {
        icon: 'fa-pen-nib',
        title: 'Devient référence',
        description: 'Proposer 3 thématiques.',
        unlocked: s.mySubmissions >= 3,
      },
      {
        icon: 'fa-user-graduate',
        title: 'Mentor',
        description: 'Membre fidèle et contributeur régulier du club.',
        unlocked: since >= 90 && s.mySubmissions >= 3,
      },
    ];

    let currentIndex = 0;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].unlocked) currentIndex = i;
      else break;
    }

    return steps.map((step, i) => ({
      id: `roadmap-${i}`,
      icon: step.icon,
      title: step.title,
      description: step.description,
      status: step.unlocked ? 'success' : 'neutral',
      statusLabel: step.unlocked ? 'Débloqué' : 'À venir',
      pulse: step.unlocked && i === currentIndex,
      disabled: !step.unlocked,
    }));
  });

  // ── Notes ─────────────────────────────────────────────────────────────────
  async loadUserNotes(): Promise<void> {
    const uid = this.user()?.uid;
    if (!uid) return;
    try {
      const docRef  = doc(db, 'user_notes', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        this.userNotes.set(data['content'] || '');
        this.lastNoteUpdate.set(data['updatedAt']?.toDate() || new Date());
      }
    } catch (error) {
      console.error('Erreur chargement notes:', error);
    }
  }

  async saveNotes(): Promise<void> {
    const uid = this.user()?.uid;
    if (!uid) return;
    try {
      const docRef = doc(db, 'user_notes', uid);
      await setDoc(docRef, { content: this.notesContent(), updatedAt: new Date(), userId: uid });
      this.userNotes.set(this.notesContent());
      this.lastNoteUpdate.set(new Date());
      this.notesEditing.set(false);
      this.toastService.success('Notes enregistrées 📝');
    } catch (error) {
      console.error('Erreur sauvegarde notes:', error);
      this.toastService.error('Erreur lors de la sauvegarde');
    }
  }

  toggleNotesEditor(): void {
    if (!this.notesEditing()) this.notesContent.set(this.userNotes());
    this.notesEditing.update((v) => !v);
  }

  cancelNotes(): void {
    this.notesEditing.set(false);
    this.notesContent.set(this.userNotes());
  }

  notesWordCount(): number {
    const text = this.userNotes();
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  }

  // ── Chargement des données ────────────────────────────────────────────────
  private loadData(): void {
    this.loading.set(true);

    this.subscriptions.push(
      this.themeService.getThemes().subscribe((themes) => {
        this.stats.update((s) => ({ ...s, totalThemes: themes.length }));
        this.recentThemes.set(themes.slice(0, 4));
      })
    );

    this.subscriptions.push(
      this.workshopService.getWorkshops().subscribe((workshops) => {
        const upcoming = workshops.filter((w) => w.status === 'planifié');
        this.stats.update((s) => ({ ...s, upcomingWorkshops: upcoming.length }));
        this.upcomingWorkshops.set(upcoming.slice(0, 3));
      })
    );

    const uid = this.user()?.uid;
    if (uid) {
      this.subscriptions.push(
        this.themeService.getMySubmissions(uid).subscribe((subs) => {
          this.stats.update((s) => ({ ...s, mySubmissions: subs.length }));
        })
      );
      this.subscriptions.push(
        this.workshopService.getWorkshops().subscribe((workshops) => {
          const registrations = workshops.filter((w) => w.registrations?.includes(uid));
          this.stats.update((s) => ({ ...s, myRegistrations: registrations.length }));
          this.loading.set(false);
        })
      );
    } else {
      this.loading.set(false);
    }
  }
}
