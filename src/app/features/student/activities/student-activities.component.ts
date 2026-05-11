import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ActivityService } from '../../../core/services/activity.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Activity, ACTIVITY_TYPE_LABELS } from '../../../core/model/activity.model';

@Component({
  selector: 'app-student-activities',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './student-activities.component.html',
  styleUrls: ['./student-activities.component.scss'],
})
export class StudentActivitiesComponent implements OnDestroy {
  private activityService = inject(ActivityService);
  private authService     = inject(AuthService);
  private toast           = inject(ToastService);

  allActivities  = signal<Activity[]>([]);
  loading        = signal(true);
  unregistering  = signal<string | null>(null);

  private sub = new Subscription();
  readonly typeLabels = ACTIVITY_TYPE_LABELS;

  private get uid(): string { return this.authService.currentUser?.uid ?? ''; }

  // Activités où le membre est inscrit
  myActivities = computed(() =>
    this.allActivities().filter(a => a.registrations?.includes(this.uid))
  );

  // Activités disponibles non encore rejoint
  upcoming = computed(() =>
    this.allActivities().filter(a =>
      !a.registrations?.includes(this.uid)
      && a.date.getTime() > Date.now()
    )
  );

  constructor() {
    this.sub.add(
      this.activityService.getPublishedActivities().subscribe(list => {
        this.allActivities.set(list);
        this.loading.set(false);
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  async register(activity: Activity): Promise<void> {
    try {
      await this.activityService.registerMember(activity.id!, this.uid);
      this.toast.success(`Inscrit à "${activity.title}"`);
    } catch (e: any) {
      this.toast.error(e.message ?? 'Erreur lors de l\'inscription');
    }
  }

  async unregister(activity: Activity): Promise<void> {
    this.unregistering.set(activity.id!);
    try {
      await this.activityService.unregisterMember(activity.id!, this.uid);
      this.toast.info(`Désinscrit de "${activity.title}"`);
    } catch {
      this.toast.error('Erreur lors de la désinscription');
    } finally {
      this.unregistering.set(null);
    }
  }

  isUpcoming(a: Activity): boolean {
    return a.date.getTime() > Date.now();
  }
}
