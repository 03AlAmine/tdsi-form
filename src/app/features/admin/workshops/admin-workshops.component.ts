// admin-workshops.component.ts - Version améliorée
import {
  Component,
  inject,
  signal,
  ViewChild,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkshopService } from '../../../core/services/workshop.service';
import { ThemeService } from '../../../core/services/theme.service';
import { Workshop, Theme } from '../../../core/model/models';
import { WorkshopDetailComponent } from './workshops-detail/workshops-detail.component';
import { ToastService } from '../../../core/services/toast.service';
import { QrService } from '../../../core/services/qr.service';
import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-admin-workshops',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    WorkshopDetailComponent,
  ],
  templateUrl: './admin-workshops.component.html',
  styleUrls: ['./admin-workshops.component.scss'],
})
export class AdminWorkshopsComponent implements OnInit, OnDestroy {
  private wsService = inject(WorkshopService);
  private themeService = inject(ThemeService);
  private fb = inject(FormBuilder);
  private toastService = inject(ToastService);
  private qrService = inject(QrService);
  private confirmService = inject(ConfirmService);

  @ViewChild(WorkshopDetailComponent) workshopDetail!: WorkshopDetailComponent;

  workshops = signal<Workshop[]>([]);
  themes = signal<Theme[]>([]);
  showForm = signal(false);
  saving = signal(false);
  loading = signal(true);
  qrWorkshop = signal<Workshop | null>(null);
  minDate = new Date().toISOString().split('T')[0];

  private subscription: Subscription | null = null;

  form = this.fb.group({
    themeId: ['', Validators.required],
    themeTitle: [''],
    presenter: ['', [Validators.required, Validators.minLength(2)]],
    duration: [
      90,
      [Validators.required, Validators.min(15), Validators.max(480)],
    ],
    date: ['', Validators.required],
    time: ['14:00', Validators.required],
    location: ['en ligne', Validators.required],
    meetLink: [''],
    maxParticipants: [
      30,
      [Validators.required, Validators.min(1), Validators.max(1000)],
    ],
  });

  editingWorkshop = signal<Workshop | null>(null);
  editSaving = signal(false);

  editForm = this.fb.group({
    themeId: ['', Validators.required],
    themeTitle: [''],
    presenter: ['', [Validators.required, Validators.minLength(2)]],
    duration: [
      90,
      [Validators.required, Validators.min(15), Validators.max(480)],
    ],
    date: ['', Validators.required],
    time: ['14:00', Validators.required],
    location: ['en ligne', Validators.required],
    meetLink: [''],
    maxParticipants: [
      30,
      [Validators.required, Validators.min(1), Validators.max(1000)],
    ],
  });

  ngOnInit(): void {
    this.subscription = this.wsService.getWorkshops().subscribe((workshops) => {
      this.workshops.set(workshops);
      this.loading.set(false);
    });

    this.themeService.getThemes().subscribe((themes) => {
      this.themes.set(themes);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  toggleForm(): void {
    this.showForm.update((v) => !v);
    if (!this.showForm()) {
      this.form.reset({
        duration: 90,
        location: 'en ligne',
        time: '14:00',
        maxParticipants: 30,
      });
    }
  }

  onThemeChange(event: Event): void {
    const themeId = (event.target as HTMLSelectElement).value;
    const theme = this.themes().find((t) => t.id === themeId);
    if (theme) {
      this.form.patchValue({ themeTitle: theme.title });
    }
  }

  async create(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    this.saving.set(true);
    const values = this.form.value;

    try {
      // Créer d'abord le workshop pour obtenir un ID
      const workshopId = await this.wsService.createWorkshop({
        themeId: values.themeId!,
        themeTitle: values.themeTitle!,
        presenter: values.presenter!,
        duration: values.duration!,
        date: new Date(`${values.date}T${values.time}`),
        location: values.location as Workshop['location'],
        meetLink: '', // Temporairement vide
        status: 'planifié',
        presenceFormEnabled: false,
        registrations: [],
        maxParticipants: values.maxParticipants!,
        createdAt: new Date(),
      });

      // Générer le lien Jitsi avec l'ID du workshop
      const jitsiLink = this.wsService.generateJitsiLink(
        workshopId,
        values.themeTitle!,
      );

      // Mettre à jour le workshop avec le lien Jitsi
      await this.wsService.updateWorkshop(workshopId, { meetLink: jitsiLink });

      this.form.reset({
        duration: 90,
        location: 'en ligne',
        time: '14:00',
        maxParticipants: 30,
      });
      this.showForm.set(false);
      this.toastService.success('Workshop créé avec succès');
    } catch {
      this.toastService.error('Erreur lors de la création');
    } finally {
      this.saving.set(false);
    }
  }

  async updateStatus(workshop: Workshop, event: Event): Promise<void> {
    const status = (event.target as HTMLSelectElement)
      .value as Workshop['status'];
    try {
      await this.wsService.updateWorkshop(workshop.id!, { status });
      this.toastService.success(`Statut mis à jour : ${status}`);
    } catch {
      this.toastService.error('Erreur lors de la mise à jour');
    }
  }

  async deleteWorkshop(workshop: Workshop): Promise<void> {
    this.confirmService.confirm({
      title: 'Supprimer le workshop',
      message: `Êtes-vous sûr de vouloir supprimer "${workshop.themeTitle}" ?`,
      type: 'danger',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          await this.wsService.deleteWorkshop(workshop.id!);
          this.toastService.success('Workshop supprimé');
        } catch {
          this.toastService.error('Erreur lors de la suppression');
        }
      },
    });
  }

  openWorkshopDetail(workshop: Workshop): void {
    this.workshopDetail.open(workshop);
  }

  editWorkshop(workshop: Workshop): void {
    this.form.patchValue({
      themeId: workshop.themeId,
      themeTitle: workshop.themeTitle,
      presenter: workshop.presenter,
      duration: workshop.duration,
      date: workshop.date.toISOString().split('T')[0],
      time: workshop.date.toISOString().split('T')[1]?.slice(0, 5),
      location: workshop.location,
      meetLink: workshop.meetLink,
      maxParticipants: workshop.maxParticipants,
    });
    this.showForm.set(true);
  }

  // ✅ Ouvrir le modal d'édition
  openEditModal(workshop: Workshop): void {
    this.editingWorkshop.set(workshop);

    // Formater la date pour l'input
    const dateStr = workshop.date.toISOString().split('T')[0];
    const timeStr = workshop.date.toISOString().split('T')[1]?.slice(0, 5);

    this.editForm.patchValue({
      themeId: workshop.themeId,
      themeTitle: workshop.themeTitle,
      presenter: workshop.presenter,
      duration: workshop.duration,
      date: dateStr,
      time: timeStr || '14:00',
      location: workshop.location,
      meetLink: workshop.meetLink || '',
      maxParticipants: workshop.maxParticipants || 30,
    });

    document.body.style.overflow = 'hidden';
  }

  closeEditModal(): void {
    this.editingWorkshop.set(null);
    this.editSaving.set(false);
    document.body.style.overflow = '';
  }

  onEditThemeChange(event: Event): void {
    const themeId = (event.target as HTMLSelectElement).value;
    const theme = this.themes().find((t) => t.id === themeId);
    if (theme) {
      this.editForm.patchValue({ themeTitle: theme.title });
    }
  }

  isEditInvalid(field: string): boolean {
    const control = this.editForm.get(field);
    return control ? control.invalid && control.touched : false;
  }

  async updateWorkshop(): Promise<void> {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.toastService.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const workshop = this.editingWorkshop();
    if (!workshop) return;

    this.editSaving.set(true);
    const values = this.editForm.value;

    try {
      await this.wsService.updateWorkshop(workshop.id!, {
        themeId: values.themeId!,
        themeTitle: values.themeTitle!,
        presenter: values.presenter!,
        duration: values.duration!,
        date: new Date(`${values.date}T${values.time}`),
        location: values.location as Workshop['location'],
        meetLink: values.meetLink || '',
        maxParticipants: values.maxParticipants!,
      });

      this.toastService.success('Workshop modifié avec succès');
      this.closeEditModal();
    } catch {
      this.toastService.error('Erreur lors de la modification');
    } finally {
      this.editSaving.set(false);
    }
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      planifié: 'info',
      'en cours': 'primary',
      terminé: 'success',
      annulé: 'danger',
    };
    return map[status] || 'neutral';
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      planifié: 'fa-clock',
      'en cours': 'fa-play-circle',
      terminé: 'fa-check-circle',
      annulé: 'fa-ban',
    };
    return map[status] || 'fa-circle';
  }

  getLocationIconClass(location: string): string {
    const map: Record<string, string> = {
      'en ligne': 'fa-wifi',
      présentiel: 'fa-building',
      hybride: 'fa-sync-alt',
    };
    return map[location] || 'fa-map-marker-alt';
  }

  formatDuration(minutes: number): string {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m > 0 ? `${h}h ${m}min` : `${h}h`;
    }
    return `${minutes}min`;
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return control ? control.invalid && control.touched : false;
  }

  openQr(workshop: Workshop): void {
    this.qrWorkshop.set(workshop);
    document.body.style.overflow = 'hidden';
  }

  closeQr(): void {
    this.qrWorkshop.set(null);
    document.body.style.overflow = '';
  }

  getPresenceQr(id: string): string {
    return this.qrService.presenceQrUrl(id, 180);
  }

  getPublicQr(id: string): string {
    return this.qrService.workshopPublicQrUrl(id, 180);
  }

  async downloadQr(
    type: 'presence' | 'public',
    workshop: Workshop,
  ): Promise<void> {
    const url =
      type === 'presence'
        ? this.qrService.presenceQrUrl(workshop.id!, 400)
        : this.qrService.workshopPublicQrUrl(workshop.id!, 400);
    await this.qrService.downloadQr(
      url,
      `qr-${type}-${workshop.themeTitle.toLowerCase().replace(/\s+/g, '-')}`,
    );
  }

  // admin-workshops.component.ts - Ajouter la méthode

generateJitsiLink(): void {
  const themeTitle = this.form.get('themeTitle')?.value;
  const workshopId = this.editingWorkshop()?.id;

  if (!themeTitle) {
    this.toastService.warning('Veuillez d\'abord sélectionner une thématique');
    return;
  }

  // Générer un ID temporaire ou utiliser un timestamp
  const tempId = workshopId || Date.now().toString();
  const jitsiLink = this.wsService.generateJitsiLink(tempId, themeTitle);

  if (this.showForm()) {
    this.form.patchValue({ meetLink: jitsiLink });
  } else if (this.editingWorkshop()) {
    this.editForm.patchValue({ meetLink: jitsiLink });
  }

  this.toastService.success('Lien Jitsi généré');
}
}
