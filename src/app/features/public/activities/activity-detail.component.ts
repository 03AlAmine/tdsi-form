import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { ActivityService } from '../../../core/services/activity.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { TechBackgroundComponent } from '../../shared/components/tech-background/tech-background.component';
import { PublicNavbarComponent } from '../../shared/components/public-navbar/public-navbar.component';
import { PublicFooterComponent } from '../../shared/components/public-footer/public-footer.component';
import {
  Activity, Session,
  ACTIVITY_TYPE_LABELS
} from '../../../core/model/activity.model';

@Component({
  selector: 'app-activity-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, TechBackgroundComponent, PublicNavbarComponent, PublicFooterComponent],
  templateUrl: './activity-detail.component.html',
  styleUrls: ['./activity-detail.component.scss'],
})
export class ActivityDetailComponent implements OnInit, OnDestroy {
  private route           = inject(ActivatedRoute);
  private activityService = inject(ActivityService);
  private authService     = inject(AuthService);
  private toast           = inject(ToastService);
  private sanitizer       = inject(DomSanitizer);

  activity      = signal<Activity | null>(null);
  loading       = signal(true);
  registering   = signal(false);
  showMeet      = signal(false);
  activeTab     = signal<'info' | 'programme' | 'intervenants'>('info');

  private sub = new Subscription();
  readonly typeLabels = ACTIVITY_TYPE_LABELS;

  // ── Getters utiles ────────────────────────────────────────
  get user() { return this.authService.currentUser; }
  get isLoggedIn() { return this.authService.isLoggedIn; }

  isRegistered(a: Activity): boolean {
    return !!this.user && (a.registrations?.includes(this.user.uid) ?? false);
  }

  isFull(a: Activity): boolean {
    if (!a.maxParticipants) return false;
    return (a.registrations?.length ?? 0) + (a.guestCount ?? 0) >= a.maxParticipants;
  }

  spotsLeft(a: Activity): number | null {
    if (!a.maxParticipants) return null;
    return Math.max(0, a.maxParticipants - (a.registrations?.length ?? 0) - (a.guestCount ?? 0));
  }

  // Meet actif 15 minutes avant le début jusqu'à la fin
  isMeetActive(a: Activity): boolean {
    const now   = Date.now();
    const start = a.date.getTime() - 15 * 60_000;
    const end   = a.endDate
      ? a.endDate.getTime()
      : a.date.getTime() + 4 * 3_600_000; // 4h par défaut
    return now >= start && now <= end;
  }

  // Jitsi embed URL — salle basée sur l'ID de l'activité
  getJitsiUrl(a: Activity): SafeResourceUrl {
    const url = a.meetLink ?? `https://meet.jit.si/tdsi-${a.id}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  // ── Lifecycle ─────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.params['id'];
    const activity = await this.activityService.getActivity(id);
    this.activity.set(activity);
    this.loading.set(false);

    // Choisir l'onglet par défaut selon le type
    if (activity?.sessions?.length) this.activeTab.set('programme');
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  // ── Actions ───────────────────────────────────────────────
  async register(): Promise<void> {
    const a = this.activity();
    if (!a || !this.user) return;
    this.registering.set(true);
    try {
      await this.activityService.registerMember(a.id!, this.user.uid);
      // Mettre à jour le signal local immédiatement
      this.activity.update(act =>
        act ? { ...act, registrations: [...(act.registrations ?? []), this.user!.uid] } : act
      );
      this.toast.success('Inscription confirmée !');
    } catch (e: any) {
      this.toast.error(e.message ?? 'Erreur lors de l\'inscription');
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
      this.activity.update(act =>
        act ? { ...act, registrations: act.registrations.filter(uid => uid !== this.user!.uid) } : act
      );
      this.toast.info('Désinscrit');
    } catch {
      this.toast.error('Erreur lors de la désinscription');
    } finally {
      this.registering.set(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  getSessionTypeClass(type: Session['type']): string {
    const map: Record<Session['type'], string> = {
      talk:     'session--talk',
      atelier:  'session--atelier',
      panel:    'session--panel',
      pause:    'session--pause',
      autre:    'session--autre',
    };
    return map[type] ?? '';
  }

  getSessionTypeLabel(type: Session['type']): string {
    const map: Record<Session['type'], string> = {
      talk:    'Talk',
      atelier: 'Atelier',
      panel:   'Panel',
      pause:   'Pause',
      autre:   'Session',
    };
    return map[type] ?? 'Session';
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
  }

  getSpeakerById(id: string) {
    return this.activity()?.speakers?.find(s => s.id === id);
  }

  hasMultipleTabs(): boolean {
    const a = this.activity();
    return !!(a?.sessions?.length || a?.speakers?.length);
  }
}
