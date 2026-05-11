import { Component, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
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
export class AdminWorkshopsComponent {
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
  selectedThemeId = signal<string>('');
  qrWorkshop = signal<Workshop | null>(null);
  minDate = new Date().toISOString().split('T')[0];

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
  });

  constructor() {
    combineLatest([
      this.wsService.getWorkshops(),
      this.themeService.getThemes(),
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([workshops, themes]) => {
        this.workshops.set(workshops);
        this.themes.set(themes);
      });
  }

  toggleForm(): void {
    this.showForm.update((v) => !v);
    if (!this.showForm()) {
      this.form.reset({ duration: 90, location: 'en ligne', time: '14:00' });
      this.selectedThemeId.set('');
    }
  }

  onThemeChange(event: Event): void {
    const themeId = (event.target as HTMLSelectElement).value;
    this.selectedThemeId.set(themeId);
    const theme = this.themes().find((t) => t.id === themeId);
    if (theme) this.form.patchValue({ themeTitle: theme.title });
  }

  async create(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.value;
    try {
      await this.wsService.createWorkshop({
        themeId: v.themeId!,
        themeTitle: v.themeTitle!,
        presenter: v.presenter!,
        duration: v.duration!,
        date: new Date(`${v.date}T${v.time}`),
        location: v.location as Workshop['location'],
        meetLink: v.meetLink || '',
        status: 'planifié',
        presenceFormEnabled: false,
        registrations: [],
        createdAt: new Date(),
      });
      this.form.reset({ duration: 90, location: 'en ligne', time: '14:00' });
      this.showForm.set(false);
      this.selectedThemeId.set('');
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
    });
    this.showForm.set(true);
  }

  getStatusBadgeClass(status: string): string {
    return (
      (
        {
          planifié: 'badge--info',
          'en cours': 'badge--primary',
          terminé: 'badge--success',
          annulé: 'badge--danger',
        } as any
      )[status] ?? 'badge--neutral'
    );
  }
  getLocationIcon(location: string): string {
    return (
      ({ 'en ligne': '💻', présentiel: '🏛️', hybride: '🔄' } as any)[
        location
      ] ?? '📍'
    );
  }
  formatDuration(minutes: number): string {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60),
        m = minutes % 60;
      return m > 0 ? `${h}h ${m}min` : `${h}h`;
    }
    return `${minutes}min`;
  }
  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return c ? c.invalid && c.touched : false;
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
}
