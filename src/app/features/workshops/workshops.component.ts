// workshops.component.ts - Version améliorée
import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
    'Développer des compétences opérationnelles'
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
    this.subscription = this.workshopService.getWorkshops().subscribe((workshops) => {
      this.workshops.set(workshops);
      this.loading.set(false);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    document.body.style.overflow = '';
  }

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
      this.toastService.success(`✅ Inscription confirmée pour "${workshop.themeTitle}" !`);
    } catch (error: any) {
      if (error.message === 'Plus de places disponibles') {
        this.toastService.error('❌ Ce workshop est complet, plus de places disponibles.');
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
      this.toastService.info(`ℹ️ Désinscription de "${workshop.themeTitle}" effectuée.`);
    } catch {
      this.toastService.error('❌ Erreur lors de la désinscription. Réessaie.');
    } finally {
      this.registeringId.set(null);
    }
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

  myRegistrationsCount(): number {
    const userId = this.authService.currentUser?.uid;
    if (!userId) return 0;
    return this.workshops().filter(w => w.registrations?.includes(userId)).length;
  }

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
      planifié: '📋',
      'en cours': '🔴',
      terminé: '✅',
      annulé: '❌',
    };
    return map[status] || '●';
  }

  getLocationIcon(location: string): string {
    const map: Record<string, string> = {
      'en ligne': '💻',
      présentiel: '🏛️',
      hybride: '🔄',
    };
    return map[location] || '📍';
  }

  formatDuration(minutes: number): string {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
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
