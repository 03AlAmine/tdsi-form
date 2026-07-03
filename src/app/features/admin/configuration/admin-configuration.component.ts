// admin-configuration.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppSettingsService, DEFAULT_SETTINGS } from '../../../core/services/app-settings.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppSettings } from '../../../core/model/models';

@Component({
  selector: 'app-admin-configuration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-configuration.component.html',
  styleUrls: ['./admin-configuration.component.scss'],
})
export class AdminConfigurationComponent implements OnInit {
  private settingsService = inject(AppSettingsService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);

  loading = signal(true);
  saving = signal(false);
  lastUpdated = signal<Date | null>(null);

  form = this.fb.group({
    defaultThemeMaxParticipants: [
      DEFAULT_SETTINGS.defaultThemeMaxParticipants,
      [Validators.required, Validators.min(1), Validators.max(500)],
    ],
    defaultWorkshopDuration: [
      DEFAULT_SETTINGS.defaultWorkshopDuration,
      [Validators.required, Validators.min(15), Validators.max(480)],
    ],
    defaultWorkshopMaxParticipants: [
      DEFAULT_SETTINGS.defaultWorkshopMaxParticipants,
      [Validators.required, Validators.min(1), Validators.max(500)],
    ],
    defaultWorkshopLocation: [
      DEFAULT_SETTINGS.defaultWorkshopLocation,
      Validators.required,
    ],
    defaultWorkshopTime: [
      DEFAULT_SETTINGS.defaultWorkshopTime,
      [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)],
    ],
    interestNotificationThreshold: [
      DEFAULT_SETTINGS.interestNotificationThreshold,
      [Validators.required, Validators.min(1), Validators.max(1000)],
    ],
  });

  ngOnInit(): void {
    this.settingsService.getSettingsOnce().then((settings) => {
      this.form.patchValue(settings);
      this.lastUpdated.set(
        settings.updatedBy ? settings.updatedAt : null,
      );
      this.loading.set(false);
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error('Veuillez corriger les champs invalides');
      return;
    }

    const uid = this.authService.currentUser?.uid;
    if (!uid) return;

    this.saving.set(true);
    try {
      const values = this.form.value as Omit<AppSettings, 'updatedAt' | 'updatedBy'>;
      await this.settingsService.saveSettings(values, uid);
      this.lastUpdated.set(new Date());
      this.toastService.success('Configuration enregistrée');
    } catch {
      this.toastService.error("Erreur lors de l'enregistrement");
    } finally {
      this.saving.set(false);
    }
  }

  resetToDefaults(): void {
    this.form.patchValue(DEFAULT_SETTINGS);
  }
}
