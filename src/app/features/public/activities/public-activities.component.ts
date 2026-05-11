import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ActivityService } from '../../../core/services/activity.service';
import { TechBackgroundComponent } from '../../shared/components/tech-background/tech-background.component';
import { PublicNavbarComponent } from '../../shared/components/public-navbar/public-navbar.component';
import { PublicFooterComponent } from '../../shared/components/public-footer/public-footer.component';
import {
  Activity, ActivityType,
  ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_ICONS
} from '../../../core/model/activity.model';

@Component({
  selector: 'app-public-activities',
  standalone: true,
  imports: [CommonModule, RouterLink, TechBackgroundComponent, PublicNavbarComponent, PublicFooterComponent],
  templateUrl: './public-activities.component.html',
  styleUrls: ['./public-activities.component.scss'],
})
export class PublicActivitiesComponent implements OnDestroy {
  private activityService = inject(ActivityService);

  activities   = signal<Activity[]>([]);
  loading      = signal(true);
  filterType   = signal<ActivityType | 'all'>('all');
  searchTerm   = signal('');

  private sub = new Subscription();

  readonly typeLabels = ACTIVITY_TYPE_LABELS;
  readonly typeIcons  = ACTIVITY_TYPE_ICONS;
  readonly types: Array<ActivityType | 'all'> = ['all', 'conference', 'journee', 'hackathon', 'atelier'];

  filteredActivities = computed(() => {
    const type = this.filterType();
    const term = this.searchTerm().toLowerCase().trim();
    return this.activities().filter(a => {
      const matchType   = type === 'all' || a.type === type;
      const matchSearch = !term
        || a.title.toLowerCase().includes(term)
        || a.description.toLowerCase().includes(term)
        || a.tags.some(t => t.toLowerCase().includes(term));
      return matchType && matchSearch;
    });
  });

  constructor() {
    this.sub.add(
      this.activityService.getPublishedActivities().subscribe(list => {
        this.activities.set(list);
        this.loading.set(false);
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  spotsLeft(a: Activity): number | null {
    if (!a.maxParticipants) return null;
    return Math.max(0, a.maxParticipants - (a.registrations?.length ?? 0) - (a.guestCount ?? 0));
  }

  isFull(a: Activity): boolean {
    const left = this.spotsLeft(a);
    return left !== null && left === 0;
  }

  isSoon(a: Activity): boolean {
    const days = (a.date.getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= 7;
  }

  getTypeLabel(type: ActivityType | 'all'): string {
    return type === 'all' ? 'Tous les événements' : this.typeLabels[type];
  }
}
