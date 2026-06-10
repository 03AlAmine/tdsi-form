// activity-detail.component.ts - Version améliorée
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivityService } from '../../core/services/activity.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import {
  Activity,
  Session,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
} from '../../core/model/activity.model';

@Component({
  selector: 'app-activity-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './activity-detail.component.html',
  styleUrls: ['./activity-detail.component.scss'],
})
export class ActivityDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private activityService = inject(ActivityService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);

  activity = signal<Activity | null>(null);
  loading = signal(true);
  registering = signal(false);
  showMeet = signal(false);
  activeTab = signal<'info' | 'programme' | 'intervenants'>('info');

  readonly typeLabels = ACTIVITY_TYPE_LABELS;
  readonly typeIcons = ACTIVITY_TYPE_ICONS;

  get user() {
    return this.authService.currentUser;
  }
  get isLoggedIn() {
    return this.authService.isLoggedIn;
  }

  isRegistered(activity: Activity): boolean {
    return (
      !!this.user && (activity.registrations?.includes(this.user.uid) ?? false)
    );
  }

  isFull(activity: Activity): boolean {
    if (!activity.maxParticipants) return false;
    const total =
      (activity.registrations?.length ?? 0) + (activity.guestCount ?? 0);
    return total >= activity.maxParticipants;
  }

  spotsLeft(activity: Activity): number {
    if (!activity.maxParticipants) return 0;
    const total =
      (activity.registrations?.length ?? 0) + (activity.guestCount ?? 0);
    return Math.max(0, activity.maxParticipants - total);
  }

  isMeetActive(activity: Activity): boolean {
    const now = Date.now();
    const start = activity.date.getTime() - 15 * 60_000;
    const end = activity.endDate
      ? activity.endDate.getTime()
      : activity.date.getTime() + 4 * 3_600_000;
    return now >= start && now <= end;
  }

  getTypeIcon(type: string): string {
    return this.typeIcons[type as keyof typeof this.typeIcons] || 'fa-calendar';
  }

  getJitsiUrl(activity: Activity): SafeResourceUrl {
    const url = activity.meetLink ?? `https://meet.jit.si/campusclubtdsi-${activity.id}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.params['id'];
    try {
      const activity = await this.activityService.getActivity(id);
      this.activity.set(activity);

      if (activity?.sessions?.length) {
        this.activeTab.set('programme');
      }
    } catch {
      this.activity.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {}

  async register(): Promise<void> {
    const a = this.activity();
    if (!a || !this.user) return;

    this.registering.set(true);
    try {
      await this.activityService.registerMember(a.id!, this.user.uid);
      this.activity.update((act) =>
        act
          ? {
              ...act,
              registrations: [...(act.registrations ?? []), this.user!.uid],
            }
          : act,
      );
      this.toast.success('✅ Inscription confirmée !');
    } catch (e: any) {
      this.toast.error(e.message ?? "Erreur lors de l'inscription");
    } finally {
      this.registering.set(false);
    }
  }

  async unregister(): Promise<void> {
    const a = this.activity();
    if (!a || !this.user) return;

    this.registering.set(true);
    try {
      await this.activityService.unregisterMember(a.id!, this.user.uid);
      this.activity.update((act) =>
        act
          ? {
              ...act,
              registrations: act.registrations.filter(
                (uid) => uid !== this.user!.uid,
              ),
            }
          : act,
      );
      this.toast.info('ℹ️ Désinscription effectuée');
    } catch {
      this.toast.error('Erreur lors de la désinscription');
    } finally {
      this.registering.set(false);
    }
  }

  getSessionTypeClass(type: Session['type']): string {
    const map: Record<Session['type'], string> = {
      talk: 'session--talk',
      atelier: 'session--atelier',
      panel: 'session--panel',
      pause: 'session--pause',
      autre: 'session--autre',
    };
    return map[type] ?? '';
  }

  getSessionTypeLabel(type: Session['type']): string {
    const map: Record<Session['type'], string> = {
      talk: 'Talk',
      atelier: 'Atelier',
      panel: 'Panel',
      pause: 'Pause',
      autre: 'Session',
    };
    return map[type] ?? 'Session';
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
  }

  getSpeakerById(id: string) {
    return this.activity()?.speakers?.find((s) => s.id === id);
  }

  hasMultipleTabs(): boolean {
    const a = this.activity();
    return !!(a?.sessions?.length || a?.speakers?.length);
  }

  shareOnFacebook(): void {
    const url = window.location.href;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      '_blank',
    );
  }

  shareOnTwitter(): void {
    const url = window.location.href;
    const text = `Rejoignez l'événement ${this.activity()?.title} au Club TDSI !`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
    );
  }

  shareOnLinkedIn(): void {
    const url = window.location.href;
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      '_blank',
    );
  }

  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.toast.success('Lien copié dans le presse-papier !');
    } catch {
      this.toast.error('Impossible de copier le lien');
    }
  }
}
