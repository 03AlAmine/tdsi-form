// admin-activities.component.ts - Version améliorée
import { Component, inject, signal, OnDestroy, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ActivityService } from '../../../core/services/activity.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { AuthService } from '../../../core/services/auth.service';
import { QrService } from '../../../core/services/qr.service';
import {
  Activity, ActivityType, ActivityStatus,
  ACTIVITY_TYPE_LABELS, ACTIVITY_STATUS_LABELS, ACTIVITY_TYPE_ICONS,
  Speaker
} from '../../../core/model/activity.model';

@Component({
  selector: 'app-admin-activities',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './admin-activities.component.html',
  styleUrls: ['./admin-activities.component.scss'],
})
export class AdminActivitiesComponent implements OnInit, OnDestroy {
  private activityService = inject(ActivityService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private fb = inject(FormBuilder);
  readonly qrService = inject(QrService);

  activities = signal<Activity[]>([]);
  loading = signal(true);
  showForm = signal(false);
  saving = signal(false);
  filterStatus = signal<ActivityStatus | 'all'>('all');
  qrActivity = signal<Activity | null>(null);

  editingActivity = signal<Activity | null>(null);
  editSaving = signal(false);

  editForm = this.fb.group({
    type: ['conference' as ActivityType, Validators.required],
    title: ['', [Validators.required, Validators.minLength(5)]],
    description: ['', [Validators.required, Validators.minLength(20)]],
    date: ['', Validators.required],
    time: ['09:00', Validators.required],
    endDate: [''],
    location: ['', Validators.required],
    isOnline: [false],
    meetLink: [''],
    maxParticipants: [null as number | null],
    tags: [''],
    speakers: this.fb.array([]),
  });

  private subscription: Subscription | null = null;

  readonly typeLabels = ACTIVITY_TYPE_LABELS;
  readonly statusLabels = ACTIVITY_STATUS_LABELS;
  readonly types: ActivityType[] = ['conference', 'journee', 'hackathon', 'atelier', 'autre'];
  readonly minDate = new Date().toISOString().split('T')[0];

  readonly filters: { value: ActivityStatus | 'all'; label: string; icon: string }[] = [
    { value: 'all', label: 'Toutes', icon: 'fa-calendar-alt' },
    { value: 'draft', label: 'Brouillons', icon: 'fa-pencil-alt' },
    { value: 'published', label: 'Publiées', icon: 'fa-rocket' },
    { value: 'ongoing', label: 'En cours', icon: 'fa-play-circle' },
    { value: 'done', label: 'Terminées', icon: 'fa-check-circle' },
  ];

  form = this.fb.group({
    type: ['conference' as ActivityType, Validators.required],
    title: ['', [Validators.required, Validators.minLength(5)]],
    description: ['', [Validators.required, Validators.minLength(20)]],
    date: ['', Validators.required],
    time: ['09:00', Validators.required],
    endDate: [''],
    location: ['', Validators.required],
    isOnline: [false],
    meetLink: [''],
    maxParticipants: [null as number | null],
    tags: [''],
  });

  filteredActivities = computed(() => {
    const filter = this.filterStatus();
    if (filter === 'all') return this.activities();
    return this.activities().filter(a => a.status === filter);
  });

  ngOnInit(): void {
    this.subscription = this.activityService.getAllActivities().subscribe(list => {
      this.activities.set(list);
      this.loading.set(false);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  getTypeIcon(type: ActivityType): string {
    return ACTIVITY_TYPE_ICONS[type] || 'fa-calendar';
  }

  get speakers(): FormArray {
    return this.editForm.get('speakers') as FormArray;
  }



  getStatusIcon(status: ActivityStatus): string {
    const icons: Record<ActivityStatus, string> = {
      draft: 'fa-pencil-alt',
      published: 'fa-rocket',
      ongoing: 'fa-play-circle',
      done: 'fa-check-circle',
      cancelled: 'fa-ban',
    };
    return icons[status] || 'fa-circle';
  }

  toggleForm(): void {
    this.showForm.update(v => !v);
    if (!this.showForm()) {
      this.form.reset({ type: 'conference', isOnline: false, time: '09:00' });
    }
  }

  async create(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    this.saving.set(true);
    const values = this.form.value;

    try {
      const dateTime = new Date(`${values.date}T${values.time}`);
      const endDateTime = values.endDate ? new Date(`${values.endDate}T23:59`) : undefined;
      const user = this.authService.currentUser;

      await this.activityService.createActivity({
        type: values.type as ActivityType,
        title: values.title!,
        description: values.description!,
        date: dateTime,
        endDate: endDateTime,
        location: values.location!,
        isOnline: values.isOnline ?? false,
        meetLink: values.meetLink || undefined,
        maxParticipants: values.maxParticipants ?? undefined,
        tags: values.tags ? values.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        status: 'draft',
        presenceEnabled: false,
        registrations: [],
        guestCount: 0,
        speakers: [],
        sessions: [],
        createdAt: new Date(),
        createdBy: user?.uid ?? '',
      });

      this.form.reset({ type: 'conference', isOnline: false, time: '09:00' });
      this.showForm.set(false);
      this.toast.success('Activité créée — elle est en brouillon');
    } catch {
      this.toast.error('Erreur lors de la création');
    } finally {
      this.saving.set(false);
    }
  }

  async publishActivity(activity: Activity): Promise<void> {
    try {
      await this.activityService.publishActivity(activity.id!);
      this.toast.success(`"${activity.title}" est maintenant publiée`);
    } catch {
      this.toast.error('Erreur lors de la publication');
    }
  }

  openEditModal(activity: Activity): void {
    this.editingActivity.set(activity);

    // Formater la date pour l'input
    const dateStr = activity.date.toISOString().split('T')[0];
    const timeStr = activity.date.toISOString().split('T')[1]?.slice(0, 5);
    const endDateStr = activity.endDate ? activity.endDate.toISOString().split('T')[0] : '';

    this.editForm.patchValue({
      type: activity.type,
      title: activity.title,
      description: activity.description,
      date: dateStr,
      time: timeStr || '09:00',
      endDate: endDateStr,
      location: activity.location,
      isOnline: activity.isOnline,
      meetLink: activity.meetLink || '',
      maxParticipants: activity.maxParticipants || null,
      tags: activity.tags?.join(', ') || '',
    });

    // Charger les intervenants
    this.speakers.clear();
    if (activity.speakers?.length) {
      activity.speakers.forEach(speaker => {
        this.speakers.push(this.createSpeakerGroup(speaker));
      });
    }

    document.body.style.overflow = 'hidden';
  }

  closeEditModal(): void {
    this.editingActivity.set(null);
    this.editSaving.set(false);
    document.body.style.overflow = '';
  }

  createSpeakerGroup(speaker?: Speaker): FormGroup {
    return this.fb.group({
      id: [speaker?.id ?? this.generateId()],
      name: [speaker?.name ?? '', Validators.required],
      title: [speaker?.title ?? ''],
      organization: [speaker?.organization ?? ''],
      bio: [speaker?.bio ?? ''],
      photoUrl: [speaker?.photoUrl ?? ''],
      linkedinUrl: [speaker?.linkedinUrl ?? ''],
    });
  }

  addSpeaker(): void {
    this.speakers.push(this.createSpeakerGroup());
  }

  removeSpeaker(index: number): void {
    this.speakers.removeAt(index);
  }

  generateId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  isEditInvalid(field: string): boolean {
    const control = this.editForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  async updateActivity(): Promise<void> {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.toast.error('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    const activity = this.editingActivity();
    if (!activity) return;

    this.editSaving.set(true);
    const values = this.editForm.value;

    try {
      const dateTime = new Date(`${values.date}T${values.time}`);
      const endDateTime = values.endDate ? new Date(`${values.endDate}T23:59`) : undefined;

      // Récupérer les intervenants du formulaire
      const speakers: Speaker[] = this.speakers.controls.map(control => ({
        id: control.get('id')?.value,
        name: control.get('name')?.value,
        title: control.get('title')?.value,
        organization: control.get('organization')?.value,
        bio: control.get('bio')?.value,
        photoUrl: control.get('photoUrl')?.value,
        linkedinUrl: control.get('linkedinUrl')?.value,
      })).filter(s => s.name);

      await this.activityService.updateActivity(activity.id!, {
        type: values.type as ActivityType,
        title: values.title!,
        description: values.description!,
        date: dateTime,
        endDate: endDateTime,
        location: values.location!,
        isOnline: values.isOnline ?? false,
        meetLink: values.meetLink || undefined,
        maxParticipants: values.maxParticipants ?? undefined,
        tags: values.tags ? values.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        speakers: speakers.length ? speakers : [],
      });

      this.toast.success('Activité mise à jour avec succès');
      this.closeEditModal();
    } catch {
      this.toast.error('Erreur lors de la mise à jour');
    } finally {
      this.editSaving.set(false);
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

  async deleteActivity(activity: Activity): Promise<void> {
    this.confirm.confirm({
      title: 'Supprimer l\'activité',
      message: `Supprimer définitivement "${activity.title}" ?`,
      type: 'danger',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
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

  getSpotsLeftText(activity: Activity): string {
    if (!activity.maxParticipants) return '';
    const taken = (activity.registrations.length ?? 0) + (activity.guestCount ?? 0);
    const left = activity.maxParticipants - taken;
    return left <= 0 ? 'Complet' : `${left} places restantes`;
  }

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
    const url = this.qrService.getQrUrl(`/activites/${activity.id}/inscription`, 400);
    const name = `qr-inscription-${activity.title.toLowerCase().replace(/\s+/g, '-')}`;
    await this.qrService.downloadQr(url, name);
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  getStatusClass(status: ActivityStatus): string {
    const map: Record<ActivityStatus, string> = {
      draft: 'neutral',
      published: 'info',
      ongoing: 'primary',
      done: 'success',
      cancelled: 'danger',
    };
    return map[status] ?? 'neutral';
  }

  getTypeClass(type: ActivityType): string {
    const map: Record<ActivityType, string> = {
      conference: 'info',
      journee: 'primary',
      hackathon: 'warning',
      atelier: 'success',
      autre: 'neutral',
    };
    return map[type] ?? 'neutral';
  }
}
