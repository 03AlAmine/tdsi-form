import { Component, inject, signal, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ActivityService } from '../../../core/services/activity.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { AuthService } from '../../../core/services/auth.service';
import { QrService } from '../../../core/services/qr.service';
import {
  Activity, ActivityType, ActivityStatus,
  ACTIVITY_TYPE_LABELS, ACTIVITY_STATUS_LABELS
} from '../../../core/model/activity.model';

@Component({
  selector: 'app-admin-activities',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './admin-activities.component.html',
  styleUrls: ['./admin-activities.component.scss'],
})
export class AdminActivitiesComponent implements OnDestroy {
  private activityService = inject(ActivityService);
  private authService     = inject(AuthService);
  private toast           = inject(ToastService);
  private confirm         = inject(ConfirmService);
  private fb              = inject(FormBuilder);
  readonly qrService      = inject(QrService);

  // ── État ──────────────────────────────────────────────────
  activities   = signal<Activity[]>([]);
  loading      = signal(true);
  showForm     = signal(false);
  saving       = signal(false);
  filterStatus = signal<ActivityStatus | 'all'>('all');
  qrActivity   = signal<Activity | null>(null);

  private sub = new Subscription();

  // ── Données de référence ──────────────────────────────────
  readonly typeLabels   = ACTIVITY_TYPE_LABELS;
  readonly statusLabels = ACTIVITY_STATUS_LABELS;
  readonly types: ActivityType[] = ['conference', 'journee', 'hackathon', 'atelier', 'autre'];
  readonly minDate = new Date().toISOString().split('T')[0];

  // ── Formulaire ────────────────────────────────────────────
  form = this.fb.group({
    type:            ['conference' as ActivityType, Validators.required],
    title:           ['', [Validators.required, Validators.minLength(5)]],
    description:     ['', [Validators.required, Validators.minLength(20)]],
    date:            ['', Validators.required],
    time:            ['09:00', Validators.required],
    endDate:         [''],
    location:        ['', Validators.required],
    isOnline:        [false],
    meetLink:        [''],
    maxParticipants: [null as number | null],
    tags:            [''],
  });

  // ── Computed ──────────────────────────────────────────────
  filteredActivities = computed(() => {
    const f = this.filterStatus();
    if (f === 'all') return this.activities();
    return this.activities().filter(a => a.status === f);
  });

  constructor() {
    this.sub.add(
      this.activityService.getAllActivities().subscribe(list => {
        this.activities.set(list);
        this.loading.set(false);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── Actions ───────────────────────────────────────────────

  toggleForm(): void {
    this.showForm.update(v => !v);
    if (!this.showForm()) this.form.reset({ type: 'conference', isOnline: false, time: '09:00' });
  }

  async create(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.form.value;

    try {
      const dateTime = new Date(`${v.date}T${v.time}`);
      const endDateTime = v.endDate ? new Date(`${v.endDate}T23:59`) : undefined;
      const user = this.authService.currentUser;

      await this.activityService.createActivity({
        type:            v.type as ActivityType,
        title:           v.title!,
        description:     v.description!,
        date:            dateTime,
        endDate:         endDateTime,
        location:        v.location!,
        isOnline:        v.isOnline ?? false,
        meetLink:        v.meetLink || undefined,
        maxParticipants: v.maxParticipants ?? undefined,
        tags:            v.tags ? v.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        status:          'draft',
        presenceEnabled: false,
        registrations:   [],
        guestCount:      0,
        speakers:        [],
        sessions:        [],
        createdAt:       new Date(),
        createdBy:       user?.uid ?? '',
      });

      this.form.reset({ type: 'conference', isOnline: false, time: '09:00' });
      this.showForm.set(false);
      this.toast.success('Activité créée — elle est en brouillon');
    } catch (e: any) {
      console.error('[Activity] Erreur création:', e);
      const msg = e?.code === 'permission-denied'
        ? 'Permission refusée — vérifiez les règles Firestore'
        : e?.code === 'failed-precondition'
        ? 'Index Firestore manquant — voir la console Firebase'
        : (e?.message ?? 'Erreur inconnue');
      this.toast.error(msg);
    } finally {
      this.saving.set(false);
    }
  }

  async publish(activity: Activity): Promise<void> {
    try {
      await this.activityService.publishActivity(activity.id!);
      this.toast.success(`"${activity.title}" est maintenant publiée`);
    } catch {
      this.toast.error('Erreur lors de la publication');
    }
  }

  async updateStatus(activity: Activity, status: ActivityStatus): Promise<void> {
    try {
      await this.activityService.updateActivity(activity.id!, { status });
      this.toast.success(`Statut mis à jour : ${this.statusLabels[status]}`);
    } catch {
      this.toast.error('Erreur lors de la mise à jour');
    }
  }

  async togglePresence(activity: Activity): Promise<void> {
    try {
      await this.activityService.enablePresence(activity.id!, !activity.presenceEnabled);
      this.toast.info(activity.presenceEnabled ? 'Check-in désactivé' : 'Check-in activé');
    } catch {
      this.toast.error('Erreur');
    }
  }

  delete(activity: Activity): void {
    this.confirm.confirm({
      title: 'Supprimer l\'activité',
      message: `Supprimer définitivement "${activity.title}" ?`,
      type: 'danger',
      confirmText: 'Supprimer',
      onConfirm: async () => {
        try {
          await this.activityService.deleteActivity(activity.id!);
          this.toast.success('Activité supprimée');
        } catch {
          this.toast.error('Erreur lors de la suppression');
        }
      }
    });
  }

  // ── QR ────────────────────────────────────────────────────
  openQr(activity: Activity): void {
    this.qrActivity.set(activity);
    document.body.style.overflow = 'hidden';
  }

  closeQr(): void {
    this.qrActivity.set(null);
    document.body.style.overflow = '';
  }

  getInscriptionQr(id: string): string {
    return this.qrService.getQrUrl(`/activites/${id}/inscription`, 180);
  }

  async downloadQr(activity: Activity): Promise<void> {
    const url  = this.qrService.getQrUrl(`/activites/${activity.id}/inscription`, 400);
    const name = `qr-inscription-${activity.title.toLowerCase().replace(/\s+/g, '-')}`;
    await this.qrService.downloadQr(url, name);
  }

  // ── Helpers template ──────────────────────────────────────
  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!c && c.invalid && c.touched;
  }

  getStatusClass(status: ActivityStatus): string {
    const map: Record<ActivityStatus, string> = {
      draft:     'badge--neutral',
      published: 'badge--info',
      ongoing:   'badge--primary',
      done:      'badge--success',
      cancelled: 'badge--danger',
    };
    return map[status] ?? 'badge--neutral';
  }

  getTypeClass(type: ActivityType): string {
    const map: Record<ActivityType, string> = {
      conference: 'badge--info',
      journee:    'badge--primary',
      hackathon:  'badge--warning',
      atelier:    'badge--success',
      autre:      'badge--neutral',
    };
    return map[type] ?? 'badge--neutral';
  }

  spotsLeft(a: Activity): string {
    if (!a.maxParticipants) return 'Illimité';
    const taken = (a.registrations?.length ?? 0) + (a.guestCount ?? 0);
    const left  = a.maxParticipants - taken;
    return left <= 0 ? 'Complet' : `${left} places`;
  }
}
