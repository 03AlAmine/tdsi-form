import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WorkshopService } from '../../../core/services/workshop.service';
import { AuthService } from '../../../core/services/auth.service';
import { AiService } from '../../../core/services/ai.service';
import { ToastService } from '../../../core/services/toast.service';
import { Workshop } from '../../../core/model/models';
import { SearchBarComponent } from '../../shared/search-bar/search-bar.component';

@Component({
  selector: 'app-workshops',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchBarComponent],
  templateUrl: './workshops.component.html',
  styleUrls: ['./workshops.component.scss'],
})
export class WorkshopsComponent {
  private workshopService = inject(WorkshopService);
  private authService = inject(AuthService);
  private aiService = inject(AiService);
  private toastService = inject(ToastService);

  workshops = signal<Workshop[]>([]);
  loading = signal(true);
  searchTerm = signal('');
  selectedWorkshop = signal<Workshop | null>(null);
  drawerOpen = signal(false);
  loadingEnriched = signal(false);
  registeringId = signal<string | null>(null);

  enrichedWorkshopData = signal<{
    objectives: string[];
    prerequisites: string[];
    skills: string[];
    outcomes: string[];
  } | null>(null);

  filteredWorkshops = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.workshops();
    return this.workshops().filter(
      (w) =>
        w.themeTitle.toLowerCase().includes(term) ||
        w.presenter.toLowerCase().includes(term) ||
        w.location.toLowerCase().includes(term),
    );
  });

  constructor() {
    this.workshopService
      .getWorkshops()
      .pipe(takeUntilDestroyed())
      .subscribe((workshops) => {
        this.workshops.set(workshops);
        this.loading.set(false);
      });
  }

  openWorkshopDetail(workshop: Workshop): void {
    this.selectedWorkshop.set(workshop);
    this.enrichedWorkshopData.set(null);
    this.drawerOpen.set(true);
    document.body.style.overflow = 'hidden';
    this.enrichWorkshopWithAI(workshop);
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
      // Silencieux — l'enrichissement IA est un bonus, pas bloquant
    } finally {
      this.loadingEnriched.set(false);
    }
  }

  isRegistered(workshop: Workshop): boolean {
    const userId = this.authService.currentUser?.uid;
    return workshop.registrations?.includes(userId!) || false;
  }

  async register(workshop: Workshop): Promise<void> {
    const userId = this.authService.currentUser?.uid;
    if (!userId) return;

    this.registeringId.set(workshop.id!);
    try {
      await this.workshopService.registerToWorkshop(workshop.id!, userId);
      this.toastService.success(
        `Inscription confirmée pour "${workshop.themeTitle}" !`,
      );
    } catch (error: any) {
      if (error.message === 'Plus de places disponibles') {
        this.toastService.error(
          'Ce workshop est complet, plus de places disponibles.',
        );
      } else {
        this.toastService.error("Erreur lors de l'inscription. Réessaie.");
      }
    } finally {
      this.registeringId.set(null);
    }
  }

  async unregister(workshop: Workshop): Promise<void> {
    const userId = this.authService.currentUser?.uid;
    if (!userId) return;

    this.registeringId.set(workshop.id!);
    try {
      await this.workshopService.unregisterFromWorkshop(workshop.id!, userId);
      this.toastService.info(
        `Désinscription de "${workshop.themeTitle}" effectuée.`,
      );
    } catch {
      this.toastService.error('Erreur lors de la désinscription. Réessaie.');
    } finally {
      this.registeringId.set(null);
    }
  }

  isProcessing(workshop: Workshop): boolean {
    return this.registeringId() === workshop.id;
  }

  getStatusClass(status: string): string {
    return (
      (
        {
          planifié: 'info',
          'en cours': 'success',
          terminé: 'neutral',
          annulé: 'danger',
        } as any
      )[status] || 'neutral'
    );
  }
  getStatusIcon(status: string): string {
    return (
      (
        { planifié: '📋', 'en cours': '🔴', terminé: '✅', annulé: '❌' } as any
      )[status] || '●'
    );
  }
  getLocationIcon(location: string): string {
    return (
      ({ 'en ligne': '💻', présentiel: '🏛️', hybride: '🔄' } as any)[
        location
      ] || '📍'
    );
  }
  formatDuration(minutes: number): string {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60),
        m = minutes % 60;
      return m > 0 ? `${h}h ${m}min` : `${h}h`;
    }
    return `${minutes}min`;
  }
  upcomingCount(): number {
    return this.workshops().filter((w) => w.status === 'planifié').length;
  }
  ongoingCount(): number {
    return this.workshops().filter((w) => w.status === 'en cours').length;
  }
  getTotalRegistrations(): number {
    return this.workshops().reduce(
      (total, ws) => total + (ws.registrations?.length || 0),
      0,
    );
  }
}
