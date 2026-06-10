// member-dashboard.component.ts

import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
import { User } from '../../../core/model/models';

@Component({
  selector: 'app-member-dashboard',
  standalone: true,
  imports: [CommonModule, MemberCalendarComponent, FormsModule, MemberNotesComponent],
  templateUrl: './member-dashboard.component.html',
  styleUrls: ['./member-dashboard.component.scss'],
})
export class MemberDashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private workshopService = inject(WorkshopService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  // ============================================================
  // ÉTATS & SIGNALS
  // ============================================================

  // Signal réactif : se met à jour si l'auth change après l'init
  // (ex: refreshCurrentUser() appelé ailleurs, token expiré, etc.)
  user = signal<User | null>(this.authService.currentUser);

  stats = signal({
    totalThemes: 0,
    upcomingWorkshops: 0,
    mySubmissions: 0,
    myRegistrations: 0,
  });

  recentThemes = signal<any[]>([]);
  upcomingWorkshops = signal<any[]>([]);
  loading = signal(true);

  // Notes
  notesContent = signal('');
  userNotes = signal('');
  notesEditing = signal(false);
  lastNoteUpdate = signal(new Date());

  private subscriptions: Subscription[] = [];

  // ============================================================
  // LIFECYCLE
  // ============================================================

  ngOnInit(): void {
    // Synchronise le signal user avec le stream Observable de AuthService.
    // Si currentUser$ émet une nouvelle valeur (refresh profil, reconnexion),
    // user() se met à jour automatiquement dans tout le template.
    this.subscriptions.push(
      this.authService.currentUser$.subscribe((u) => {
        this.user.set(u);
      })
    );

    this.loadData();
    this.loadUserNotes();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  // ============================================================
  // MÉTHODES PUBLIQUES
  // ============================================================

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

  // ============================================================
  // STATISTIQUES & PROGRESSION
  // ============================================================

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

  // ============================================================
  // GESTION DES NOTES
  // ============================================================

  async loadUserNotes(): Promise<void> {
    const uid = this.user()?.uid;
    if (!uid) return;

    try {
      const docRef = doc(db, 'user_notes', uid);
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
      await setDoc(docRef, {
        content: this.notesContent(),
        updatedAt: new Date(),
        userId: uid,
      });

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
    if (!this.notesEditing()) {
      this.notesContent.set(this.userNotes());
    }
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

  // ============================================================
  // CHARGEMENT DES DONNÉES
  // ============================================================

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
        this.stats.update((s) => ({
          ...s,
          upcomingWorkshops: upcoming.length,
        }));
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

      // Réutilise le même Observable getWorkshops() déjà en cache (shareReplay) —
      // pas de second listener Firestore ouvert.
      this.subscriptions.push(
        this.workshopService.getWorkshops().subscribe((workshops) => {
          const registrations = workshops.filter((w) =>
            w.registrations?.includes(uid)
          );
          this.stats.update((s) => ({
            ...s,
            myRegistrations: registrations.length,
          }));
          this.loading.set(false);
        })
      );
    } else {
      this.loading.set(false);
    }
  }
}
