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
import { RevealDirective } from '../../../core/directives/reveal.directive';
import { CountUpDirective } from '../../../core/directives/count-up.directive';
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
    RevealDirective,
    CountUpDirective,
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
