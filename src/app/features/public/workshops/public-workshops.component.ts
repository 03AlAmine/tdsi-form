import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WorkshopService } from '../../../core/services/workshop.service';
import { AuthService } from '../../../core/services/auth.service';
import { PublicRegistrationService } from '../../../core/services/public-registration.service';
import { Workshop } from '../../../core/model/models';
import { ToastService } from '../../../core/services/toast.service';
import { TechBackgroundComponent } from '../../shared/components/tech-background/tech-background.component';
import { PublicNavbarComponent } from '../../shared/components/public-navbar/public-navbar.component';
import { PublicFooterComponent } from '../../shared/components/public-footer/public-footer.component';

@Component({
  selector: 'app-public-workshops',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TechBackgroundComponent,
    PublicNavbarComponent,
    PublicFooterComponent,
  ],
  templateUrl: './public-workshops.component.html',
  styleUrls: ['./public-workshops.component.scss'],
})
export class PublicWorkshopsComponent {
  private workshopService = inject(WorkshopService);
  private authService = inject(AuthService);
  private publicRegistrationService = inject(PublicRegistrationService);
  private toastService = inject(ToastService);

  workshops = signal<Workshop[]>([]);
  loading = signal(true);
  selectedWorkshop = signal<Workshop | null>(null);
  drawerOpen = signal(false);

  isLoggedIn = () => this.authService.isLoggedIn;

  constructor() {
    this.workshopService
      .getWorkshops()
      .pipe(takeUntilDestroyed())
      .subscribe((workshops) => {
        this.workshops.set(
          workshops.filter(
            (w) => w.status === 'planifié' || w.status === 'en cours',
          ),
        );
        this.loading.set(false);
      });
  }

  openWorkshopDrawer(workshop: Workshop): void {
    this.selectedWorkshop.set(workshop);
    this.drawerOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    setTimeout(() => {
      this.selectedWorkshop.set(null);
      document.body.style.overflow = '';
    }, 300);
  }

  async quickRegister(workshop: Workshop): Promise<void> {
    const user = this.authService.currentUser;
    if (!user) return;
    try {
      await this.workshopService.registerToWorkshop(workshop.id!, user.uid);
      this.toastService.success(
        `Inscription confirmée pour "${workshop.themeTitle}"`,
      );
    } catch (error: any) {
      if (error.message === 'Plus de places disponibles') {
        this.toastService.error('Désolé, ce workshop est complet !');
      } else {
        this.toastService.error("Erreur lors de l'inscription");
      }
    }
  }

  getStatusClass(status: string): string {
    return (
      ({ planifié: 'info', 'en cours': 'success' } as any)[status] || 'neutral'
    );
  }
  getStatusIcon(status: string): string {
    return status === 'planifié' ? '📋' : '🔴';
  }
  getStatusText(status: string): string {
    return status === 'planifié' ? 'À venir' : 'En cours';
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  getLocationIcon(location: string): string {
    return (
      ({ 'en ligne': '💻', présentiel: '🏛️', hybride: '🔄' } as any)[
        location
      ] ?? '📍'
    );
  }
  getLocationText(location: string): string {
    return (
      (
        {
          'en ligne': 'En ligne',
          présentiel: 'Présentiel',
          hybride: 'Hybride',
        } as any
      )[location] ?? location
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
  hasMeetLink(workshop: Workshop): boolean {
    return !!workshop.meetLink && workshop.location === 'en ligne';
  }
  isWorkshopLive(workshop: Workshop): boolean {
    return workshop.status === 'en cours';
  }
}
