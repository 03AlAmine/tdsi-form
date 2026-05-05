import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WorkshopService } from '../../../core/services/workshop.service';
import { AuthService } from '../../../core/services/auth.service';
import { Workshop } from '../../../core/model/models';

@Component({
  selector: 'app-workshops',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workshops.component.html',
  styleUrls: ['./workshops.component.scss']
})
export class WorkshopsComponent implements OnInit {
  private workshopService = inject(WorkshopService);
  private authService = inject(AuthService);

  workshops = signal<Workshop[]>([]);
  loading = signal(true);
  selectedWorkshop = signal<Workshop | null>(null);
  drawerOpen = signal(false);

  ngOnInit(): void {
    this.workshopService.getWorkshops().subscribe(workshops => {
      this.workshops.set(workshops);
      this.loading.set(false);
    });
  }

  openWorkshopDetail(workshop: Workshop): void {
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

  isRegistered(workshop: Workshop): boolean {
    const userId = this.authService.currentUser?.uid;
    return workshop.registrations?.includes(userId!) || false;
  }

  async register(workshop: Workshop): Promise<void> {
    const userId = this.authService.currentUser?.uid;
    if (userId) {
      await this.workshopService.registerToWorkshop(workshop.id!, userId);
    }
  }

  async unregister(workshop: Workshop): Promise<void> {
    const userId = this.authService.currentUser?.uid;
    if (userId) {
      await this.workshopService.unregisterFromWorkshop(workshop.id!, userId);
    }
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'planifié': 'info',
      'en cours': 'success',
      'terminé': 'neutral',
      'annulé': 'danger'
    };
    return map[status] || 'neutral';
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      'planifié': '📋',
      'en cours': '🔴',
      'terminé': '✅',
      'annulé': '❌'
    };
    return map[status] || '●';
  }

  getLocationIcon(location: string): string {
    const map: Record<string, string> = {
      'en ligne': '💻',
      'présentiel': '🏛️',
      'hybride': '🔄'
    };
    return map[location] || '📍';
  }

  formatDuration(minutes: number): string {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }
    return `${minutes}min`;
  }
}
