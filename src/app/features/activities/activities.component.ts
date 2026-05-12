// activities.component.ts - Version améliorée
import { Component, inject, signal, computed, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ActivityService } from '../../core/services/activity.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import {
  Activity,
  ActivityType,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS
} from '../../core/model/activity.model';

@Component({
  selector: 'app-activities',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './activities.component.html',
  styleUrls: ['./activities.component.scss'],
})
export class ActivitiesComponent implements OnInit, OnDestroy {
  private activityService = inject(ActivityService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  activities = signal<Activity[]>([]);
  loading = signal(true);
  filterType = signal<ActivityType | 'all'>('all');
  searchTerm = signal('');
  unregistering = signal<string | null>(null);
  registering = signal<string | null>(null);

  private sub = new Subscription();

  readonly typeLabels = ACTIVITY_TYPE_LABELS;
  readonly types: Array<ActivityType | 'all'> = ['all', 'conference', 'journee', 'hackathon', 'atelier'];

  isLoggedIn = () => this.authService.isLoggedIn;
  private get uid(): string { return this.authService.currentUser?.uid ?? ''; }

  filteredActivities = computed(() => {
    const type = this.filterType();
    const term = this.searchTerm().toLowerCase().trim();
    return this.activities().filter(a => {
      const matchType = type === 'all' || a.type === type;
      const matchSearch = !term
        || a.title.toLowerCase().includes(term)
        || a.description.toLowerCase().includes(term)
        || a.tags?.some(t => t.toLowerCase().includes(term));
      return matchType && matchSearch;
    });
  });

  myActivities = computed(() =>
    this.activities().filter(a => a.registrations?.includes(this.uid))
  );

  ngOnInit(): void {
    this.sub.add(
      this.activityService.getPublishedActivities().subscribe(list => {
        this.activities.set(list);
        this.loading.set(false);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  getTypeIcon(type: ActivityType | 'all'): string {
    const icons: Record<string, string> = {
      all: 'fa-calendar-alt',
      conference: 'fa-chalkboard-user',
      journee: 'fa-sun',
      hackathon: 'fa-laptop-code',
      atelier: 'fa-tools'
    };
    return icons[type] || 'fa-calendar';
  }

  getActivityTypeIcon(type: ActivityType): string {
    return ACTIVITY_TYPE_ICONS[type] || 'fa-calendar';
  }

  getTypeLabel(type: ActivityType | 'all'): string {
    if (type === 'all') return 'Tous';
    return this.typeLabels[type];
  }

  spotsLeft(activity: Activity): number {
    if (!activity.maxParticipants) return 0;
    const total = (activity.registrations?.length ?? 0) + (activity.guestCount ?? 0);
    return Math.max(0, activity.maxParticipants - total);
  }

  isFull(activity: Activity): boolean {
    return this.spotsLeft(activity) === 0 && (activity.maxParticipants ?? 0) > 0;
  }

  isSoon(activity: Activity): boolean {
    const days = (activity.date.getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= 7;
  }

  isUpcoming(activity: Activity): boolean {
    return activity.date.getTime() > Date.now();
  }

  isRegistered(activity: Activity): boolean {
    return activity.registrations?.includes(this.uid) ?? false;
  }

  async register(activity: Activity): Promise<void> {
    if (!this.isLoggedIn()) return;
    this.registering.set(activity.id!);
    try {
      await this.activityService.registerMember(activity.id!, this.uid);
      this.toast.success(`✅ Inscrit à "${activity.title}"`);
    } catch (e: any) {
      this.toast.error(e.message ?? "Erreur lors de l'inscription");
    } finally {
      this.registering.set(null);
    }
  }

  async unregister(activity: Activity): Promise<void> {
    if (!this.isLoggedIn()) return;
    this.unregistering.set(activity.id!);
    try {
      await this.activityService.unregisterMember(activity.id!, this.uid);
      this.toast.info(`ℹ️ Désinscrit de "${activity.title}"`);
    } catch {
      this.toast.error('Erreur lors de la désinscription');
    } finally {
      this.unregistering.set(null);
    }
  }

  isProcessing(activity: Activity): boolean {
    return this.registering() === activity.id || this.unregistering() === activity.id;
  }
}
