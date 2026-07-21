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
import { AppSettingsService, DEFAULT_SETTINGS } from '../../../core/services/app-settings.service';
import { Workshop, Theme, AppSettings } from '../../../core/model/models';
import { WorkshopDetailComponent } from './workshops-detail/workshops-detail.component';
import { ToastService } from '../../../core/services/toast.service';
import { QrService } from '../../../core/services/qr.service';
import {
  getWorkshopStatusIcon as sharedWorkshopStatusIcon,
  getAdminLocationIcon as sharedAdminLocationIcon,
  formatDuration as sharedFormatDuration,
} from '../../../core/utils/workshop-display.util';
import { ConfirmService } from '../../../core/services/confirm.service';
import { TiltSpotlightDirective } from '../../../core/directives/tilt-spotlight.directive';

@Component({
  selector: 'app-admin-workshops',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    WorkshopDetailComponent,
    TiltSpotlightDirective,
  ],
  templateUrl: './admin-workshops.component.html',
  styleUrls: ['./admin-workshops.component.scss'],
})
export class AdminWorkshopsComponent implements OnInit, OnDestroy {
  private wsService = inject(WorkshopService);
  private themeService = inject(ThemeService);
  private settingsService = inject(AppSettingsService);
  private fb = inject(FormBuilder);
  private toastService = inject(ToastService);
  private qrService = inject(QrService);
  private confirmService = inject(ConfirmService);

  // ✅ Réglages globaux (configurables depuis /admin/configuration),
  // utilisés comme valeurs par défaut du formulaire de création.
  // DEFAULT_SETTINGS sert de repli tant que le chargement n'est pas
  // terminé, pour que le formulaire reste toujours utilisable.
  private appSettings = signal<AppSettings>(DEFAULT_SETTINGS);

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

    // ✅ Réglages globaux : on les applique au formulaire dès qu'ils
    // arrivent, pour que les valeurs par défaut affichées soient
    // toujours à jour avec /admin/configuration.
    this.settingsService.getSettings().subscribe((settings) => {
      this.appSettings.set(settings);
      if (!this.showForm()) {
        this.resetFormDefaults();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private resetFormDefaults(): void {
    const s = this.appSettings();
    this.form.reset({
      duration: s.defaultWorkshopDuration,
      location: s.defaultWorkshopLocation,
      time: s.defaultWorkshopTime,
      maxParticipants: s.defaultWorkshopMaxParticipants,
    });
  }

  toggleForm(): void {
    this.showForm.update((v) => !v);
    if (!this.showForm()) {
      this.resetFormDefaults();
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
      await this.wsService.createWorkshop({
        themeId: values.themeId!,
        themeTitle: values.themeTitle!,
        presenter: values.presenter!,
        duration: values.duration!,
        date: new Date(`${values.date}T${values.time}`),
        location: values.location as Workshop['location'],
        meetLink: values.meetLink || '', // Vide si non renseigné/généré
        status: 'planifié',
        presenceFormEnabled: false,
        registrations: [],
        maxParticipants: values.maxParticipants!,
        createdAt: new Date(),
      });

      this.resetFormDefaults();
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
      time: timeStr || this.appSettings().defaultWorkshopTime,
      location: workshop.location,
      meetLink: workshop.meetLink || '',
      maxParticipants: workshop.maxParticipants || this.appSettings().defaultWorkshopMaxParticipants,
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
    return sharedWorkshopStatusIcon(status);
  }

  getLocationIconClass(location: string): string {
    return sharedAdminLocationIcon(location);
  }

  formatDuration(minutes: number): string {
    return sharedFormatDuration(minutes);
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
  const isEditing = !!this.editingWorkshop();
  const activeForm = isEditing ? this.editForm : this.form;
  const themeTitle = activeForm.get('themeTitle')?.value;
  const workshopId = this.editingWorkshop()?.id;

  if (!themeTitle) {
    this.toastService.warning('Veuillez d\'abord sélectionner une thématique');
    return;
  }

  // Générer un ID temporaire ou utiliser un timestamp
  const tempId = workshopId || Date.now().toString();
  const jitsiLink = this.wsService.generateJitsiLink(tempId, themeTitle);

  activeForm.patchValue({ meetLink: jitsiLink });

  this.toastService.success('Lien Jitsi généré');
}
}
