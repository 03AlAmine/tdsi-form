import { Component, inject, signal, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WorkshopService } from '../../../core/services/workshop.service';
import { ThemeService } from '../../../core/services/theme.service';
import { Workshop, Theme } from '../../../core/model/models';
import { WorkshopDetailComponent } from './workshops-detail/workshops-detail.component';
import { combineLatest } from 'rxjs';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-admin-workshops',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, WorkshopDetailComponent],
  templateUrl: './admin-workshops.component.html',
  styleUrls: ['./admin-workshops.component.scss']
})
export class AdminWorkshopsComponent implements OnInit {
  private wsService = inject(WorkshopService);
  private themeService = inject(ThemeService);
  private fb = inject(FormBuilder);
  private toastService = inject(ToastService);
  private confirmService = inject(ConfirmService);

  @ViewChild(WorkshopDetailComponent) workshopDetail!: WorkshopDetailComponent;

  workshops = signal<Workshop[]>([]);
  themes = signal<Theme[]>([]);
  showForm = signal(false);
  saving = signal(false);
  selectedThemeId = signal<string>('');
  minDate = new Date().toISOString().split('T')[0];

  form = this.fb.group({
    themeId: ['', Validators.required],
    themeTitle: [''],
    presenter: ['', [Validators.required, Validators.minLength(2)]],
    duration: [90, [Validators.required, Validators.min(15), Validators.max(480)]],
    date: ['', Validators.required],
    time: ['14:00', Validators.required],
    location: ['en ligne', Validators.required],
    meetLink: ['']
  });

  ngOnInit(): void {
    combineLatest([
      this.wsService.getWorkshops(),
      this.themeService.getThemes()
    ]).subscribe(([workshops, themes]) => {
      this.workshops.set(workshops);
      this.themes.set(themes);
    });
  }

  toggleForm(): void {
    this.showForm.update(v => !v);
    if (!this.showForm()) {
      this.form.reset({ duration: 90, location: 'en ligne', time: '14:00' });
      this.selectedThemeId.set('');
    }
  }

  onThemeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const themeId = select.value;
    this.selectedThemeId.set(themeId);

    const theme = this.themes().find(t => t.id === themeId);
    if (theme) {
      this.form.patchValue({ themeTitle: theme.title });
    }
  }

  async create(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const v = this.form.value;

    try {
      const dateTime = new Date(`${v.date}T${v.time}`);

      await this.wsService.createWorkshop({
        themeId: v.themeId!,
        themeTitle: v.themeTitle!,
        presenter: v.presenter!,
        duration: v.duration!,
        date: dateTime,
        location: v.location as Workshop['location'],
        meetLink: v.meetLink || '',
        status: 'planifié',
        presenceFormEnabled: false,
        registrations: [],
        createdAt: new Date()
      });

      this.form.reset({ duration: 90, location: 'en ligne', time: '14:00' });
      this.showForm.set(false);
      this.selectedThemeId.set('');
      this.toastService.success('Workshop créé avec succès');
    } catch (error) {
      this.toastService.error('Erreur lors de la création');
    } finally {
      this.saving.set(false);
    }
  }

  async updateStatus(workshop: Workshop, event: Event): Promise<void> {
    const status = (event.target as HTMLSelectElement).value as Workshop['status'];
    try {
      await this.wsService.updateWorkshop(workshop.id!, { status });
      this.toastService.success(`Statut mis à jour : ${status}`);
    } catch (error) {
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
        } catch (error) {
          this.toastService.error('Erreur lors de la suppression');
        }
      }
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
      meetLink: workshop.meetLink
    });
    this.showForm.set(true);
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'planifié': return 'badge--info';
      case 'en cours': return 'badge--primary';
      case 'terminé': return 'badge--success';
      case 'annulé': return 'badge--danger';
      default: return 'badge--neutral';
    }
  }

  getLocationIcon(location: string): string {
    switch (location) {
      case 'en ligne': return '💻';
      case 'présentiel': return '🏛️';
      case 'hybride': return '🔄';
      default: return '📍';
    }
  }

  formatDuration(minutes: number): string {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }
    return `${minutes}min`;
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return control ? (control.invalid && control.touched) : false;
  }
}
