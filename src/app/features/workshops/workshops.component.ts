// workshops.component.ts - Version complète et corrigée

import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { WorkshopService } from '../../core/services/workshop.service';
import { AuthService } from '../../core/services/auth.service';
import { AiService } from '../../core/services/ai.service';
import { ToastService } from '../../core/services/toast.service';
import { Workshop } from '../../core/model/models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-workshops',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './workshops.component.html',
  styleUrls: ['./workshops.component.scss'],
})
export class WorkshopsComponent implements OnInit, OnDestroy {
  private workshopService = inject(WorkshopService);
  private authService = inject(AuthService);
  private aiService = inject(AiService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  workshops = signal<Workshop[]>([]);
  loading = signal(true);
  searchTerm = signal('');
  selectedWorkshop = signal<Workshop | null>(null);
  drawerOpen = signal(false);
  loadingEnriched = signal(false);
  registeringId = signal<string | null>(null);

  private subscription: Subscription | null = null;

  defaultObjectives = [
    'Maîtriser les concepts fondamentaux du sujet',
    'Savoir mettre en pratique les techniques apprises',
    'Développer des compétences opérationnelles',
  ];

  isLoggedIn = () => this.authService.isLoggedIn;

  filteredWorkshops = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const all = this.workshops();

    const visible = this.isLoggedIn()
      ? all
      : all.filter((w) => w.status === 'planifié' || w.status === 'en cours');

    if (!term) return visible;
    return visible.filter(
      (w) =>
        w.themeTitle.toLowerCase().includes(term) ||
        w.presenter.toLowerCase().includes(term) ||
        w.location.toLowerCase().includes(term),
    );
  });

  enrichedWorkshopData = signal<{
    objectives: string[];
    prerequisites: string[];
    skills: string[];
    outcomes: string[];
  } | null>(null);

  ngOnInit(): void {
    this.subscription = this.workshopService
      .getWorkshops()
      .subscribe((workshops) => {
        this.workshops.set(workshops);
        this.loading.set(false);
      });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    document.body.style.overflow = '';
  }

  // ============================================================
  // WORKSHOP DETAIL DRAWER
  // ============================================================

  openWorkshopDetail(workshop: Workshop): void {
    this.selectedWorkshop.set(workshop);
    this.enrichedWorkshopData.set(null);
    this.drawerOpen.set(true);
    document.body.style.overflow = 'hidden';

    if (this.isLoggedIn()) {
      this.enrichWorkshopWithAI(workshop);
    }
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    setTimeout(() => {
      this.selectedWorkshop.set(null);
      document.body.style.overflow = '';
    }, 300);
  }

  async enrichWorkshopWithAI(workshop: Workshop): Promise<void> {
    this.loadingEnriched.set(true);
    try {
      const result = await this.aiService.enrichWorkshopContent(
        workshop.themeTitle,
        workshop.themeTitle,
        '',
      );
      this.enrichedWorkshopData.set({
        objectives: result.objectives || [],
        prerequisites: result.prerequisites || [],
        skills: result.skills || [],
        outcomes: result.outcomes || [],
      });
    } catch {
      // Silencieux — l'enrichissement IA est un bonus
    } finally {
      this.loadingEnriched.set(false);
    }
  }

  // ============================================================
  // INSCRIPTIONS / DÉSINSCRIPTIONS
  // ============================================================

  isRegistered(workshop: Workshop): boolean {
    const userId = this.authService.currentUser?.uid;
    return workshop.registrations?.includes(userId!) || false;
  }

  isProcessing(workshop: Workshop): boolean {
    return this.registeringId() === workshop.id;
  }

  async register(workshop: Workshop): Promise<void> {
    if (!this.isLoggedIn()) return;
    const userId = this.authService.currentUser?.uid;
    if (!userId) return;

    this.registeringId.set(workshop.id!);
    try {
      await this.workshopService.registerToWorkshop(workshop.id!, userId);
      this.toastService.success(
        `✅ Inscription confirmée pour "${workshop.themeTitle}" !`,
      );
    } catch (error: any) {
      if (error.message === 'Plus de places disponibles') {
        this.toastService.error(
          '❌ Ce workshop est complet, plus de places disponibles.',
        );
      } else {
        this.toastService.error("❌ Erreur lors de l'inscription. Réessaie.");
      }
    } finally {
      this.registeringId.set(null);
    }
  }

  async unregister(workshop: Workshop): Promise<void> {
    if (!this.isLoggedIn()) return;
    const userId = this.authService.currentUser?.uid;
    if (!userId) return;

    this.registeringId.set(workshop.id!);
    try {
      await this.workshopService.unregisterFromWorkshop(workshop.id!, userId);
      this.toastService.info(
        `ℹ️ Désinscription de "${workshop.themeTitle}" effectuée.`,
      );
    } catch {
      this.toastService.error('❌ Erreur lors de la désinscription. Réessaie.');
    } finally {
      this.registeringId.set(null);
    }
  }

  joinMeet(workshop: Workshop): void {
    if (!this.isLoggedIn()) {
      this.toastService.error('🔒 Connecte-toi pour accéder au meet.');
      return;
    }
    this.router.navigate(['/workshops', workshop.id, 'meet']);
  }

  // ============================================================
  // LOGIQUE DE STATUT DYNAMIQUE (BASÉE SUR L'HEURE)
  // ============================================================

  // ============================================================
  // LOGIQUE DE STATUT DYNAMIQUE (BASÉE SUR L'HEURE)
  // ============================================================

  /**
   * Vérifie si un workshop est en cours
   */
  isWorkshopOngoing(workshop: Workshop): boolean {
    const now = new Date();
    const startDate = new Date(workshop.date);
    const duration = workshop.duration || 90;
    const endDate = workshop.endDate
      ? new Date(workshop.endDate)
      : new Date(startDate.getTime() + duration * 60000);

    return now >= startDate && now <= endDate;
  }

  /**
   * Vérifie si un workshop est terminé
   */
  isWorkshopFinished(workshop: Workshop): boolean {
    const now = new Date();
    const startDate = new Date(workshop.date);
    const duration = workshop.duration || 90;
    const endDate = workshop.endDate
      ? new Date(workshop.endDate)
      : new Date(startDate.getTime() + duration * 60000);

    return now > endDate;
  }

  /**
   * Obtient le statut d'affichage du workshop
   */
  getWorkshopDisplayStatus(workshop: Workshop): string {
    // Annulé (priorité max)
    if (workshop.status === 'annulé') return 'annulé';

    // Terminé
    if (this.isWorkshopFinished(workshop)) return 'terminé';

    // En cours
    if (this.isWorkshopOngoing(workshop)) return 'en cours';

    // Planifié par défaut
    return 'planifié';
  }

  /**
   * Classe CSS pour le badge
   */
  getWorkshopStatusClass(workshop: Workshop): string {
    const status = this.getWorkshopDisplayStatus(workshop);
    const map: Record<string, string> = {
      planifié: 'info',
      'en cours': 'success',
      terminé: 'neutral',
      annulé: 'danger',
    };
    return map[status] || 'neutral';
  }

  /**
   * Icône pour le badge
   */
  getWorkshopStatusIcon(workshop: Workshop): string {
    const status = this.getWorkshopDisplayStatus(workshop);
    const map: Record<string, string> = {
      planifié: 'fa-clock',
      'en cours': 'fa-play-circle',
      terminé: 'fa-check-circle',
      annulé: 'fa-ban',
    };
    return map[status] || 'fa-circle';
  }


  // ============================================================
  // MÉTHODES DE COMPTAGE (CORRIGÉES AVEC STATUT DYNAMIQUE)
  // ============================================================

  /**
   * Nombre de workshops à venir (basé sur le statut dynamique)
   */
  upcomingCount(): number {
    return this.workshops().filter(
      (w) => this.getWorkshopDisplayStatus(w) === 'planifié',
    ).length;
  }

  /**
   * Nombre de workshops en cours (basé sur le statut dynamique)
   */
  ongoingCount(): number {
    return this.workshops().filter(
      (w) => this.getWorkshopDisplayStatus(w) === 'en cours',
    ).length;
  }

  /**
   * Nombre de workshops terminés (basé sur le statut dynamique) - optionnel
   */
  finishedCount(): number {
    return this.workshops().filter(
      (w) => this.getWorkshopDisplayStatus(w) === 'terminé',
    ).length;
  }

  /**
   * Total des inscriptions (inchangé)
   */
  getTotalRegistrations(): number {
    return this.workshops().reduce(
      (total, ws) => total + (ws.registrations?.length || 0),
      0,
    );
  }

  /**
   * Mes inscriptions (inchangé)
   */
  myRegistrationsCount(): number {
    const userId = this.authService.currentUser?.uid;
    if (!userId) return 0;
    return this.workshops().filter((w) => w.registrations?.includes(userId))
      .length;
  }

  // ============================================================
  // MÉTHODES UTILITAIRES (GARDÉES)
  // ============================================================

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      planifié: 'info',
      'en cours': 'success',
      terminé: 'neutral',
      annulé: 'danger',
    };
    return map[status] || 'neutral';
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      planifié: 'fa-clipboard-list',
      'en cours': 'fa-circle-play',
      terminé: 'fa-circle-check',
      annulé: 'fa-circle-xmark',
    };
    return map[status] || 'fa-circle';
  }
  getLocationIcon(location: string): string {
    const map: Record<string, string> = {
      'en ligne': 'fa-laptop',
      présentiel: 'fa-building-columns',
      hybride: 'fa-arrows-rotate',
    };

    return map[location] || 'fa-location-dot';
  }

  formatDuration(minutes: number): string {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m > 0 ? `${h}h ${m}min` : `${h}h`;
    }
    return `${minutes}min`;
  }

  getRegistrationPercent(workshop: Workshop): number {
    const registrations = workshop.registrations?.length || 0;
    const max = workshop.maxParticipants || 30;
    return Math.min((registrations / max) * 100, 100);
  }

  getAvailablePlaces(workshop: Workshop): number {
    const max = workshop.maxParticipants || 30;
    const registrations = workshop.registrations?.length || 0;
    return Math.max(max - registrations, 0);
  }
}
