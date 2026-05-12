// activity-register.component.ts - Version améliorée
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivityService } from '../../core/services/activity.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmationPdfService } from '../../core/services/confirmation-pdf.service';
import { Activity, ActivityRegistration, ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_ICONS } from '../../core/model/activity.model';

@Component({
  selector: 'app-activity-register',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './activity-register.component.html',
  styleUrls: ['./activity-register.component.scss'],
})
export class ActivityRegisterComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private activityService = inject(ActivityService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private pdfService = inject(ConfirmationPdfService);

  activity = signal<Activity | null>(null);
  loading = signal(true);
  submitting = signal(false);
  downloadingPdf = signal(false);
  success = signal(false);
  alreadyRegistered = signal(false);
  error = signal('');

  private createdRegistration: ActivityRegistration | null = null;
  registrationId = signal('');

  isLoggedIn = this.authService.isLoggedIn;
  readonly typeLabels = ACTIVITY_TYPE_LABELS;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    organization: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.params['id'];

    try {
      const activity = await this.activityService.getActivity(id);

      if (!activity || (activity.status !== 'published' && activity.status !== 'ongoing')) {
        this.error.set('Cet événement n\'est plus disponible à l\'inscription.');
        this.loading.set(false);
        return;
      }

      const user = this.authService.currentUser;
      if (user) {
        this.form.patchValue({
          name: user.displayName ?? '',
          email: user.email ?? '',
        });
        if (activity.registrations?.includes(user.uid)) {
          this.alreadyRegistered.set(true);
        }
      }

      this.activity.set(activity);
    } catch {
      this.error.set('Erreur lors du chargement de l\'événement');
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {}

  getTypeIcon(type: string): string {
    return ACTIVITY_TYPE_ICONS[type as keyof typeof ACTIVITY_TYPE_ICONS] || 'fa-calendar';
  }

  getTypeLabel(type: string): string {
    return this.typeLabels[type as keyof typeof this.typeLabels] || type;
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    const values = this.form.value;
    const activity = this.activity()!;
    const user = this.authService.currentUser;

    try {
      if (user && activity.registrations?.includes(user.uid)) {
        this.alreadyRegistered.set(true);
        this.toast.warning('Vous êtes déjà inscrit à cet événement');
        return;
      }

      if (user) {
        // Member registration
        await this.activityService.registerMember(activity.id!, user.uid);
        this.createdRegistration = {
          activityId: activity.id!,
          type: 'member',
          userId: user.uid,
          name: user.displayName ?? values.name!,
          email: user.email ?? values.email!,
          organization: values.organization || undefined,
          phone: values.phone || undefined,
          registeredAt: new Date(),
          confirmationToken: `${activity.id}-${user.uid}-${Date.now()}`,
          checkedIn: false,
        };
      } else {
        // Guest registration
        const regId = await this.activityService.registerGuest(activity.id!, {
          name: values.name!,
          email: values.email!,
          phone: values.phone || undefined,
          organization: values.organization || undefined,
        });
        this.registrationId.set(regId);
        this.createdRegistration = {
          id: regId,
          activityId: activity.id!,
          type: 'guest',
          name: values.name!,
          email: values.email!,
          organization: values.organization || undefined,
          phone: values.phone || undefined,
          registeredAt: new Date(),
          confirmationToken: `${activity.id}-${regId}`,
          checkedIn: false,
        };
      }

      this.success.set(true);
      this.toast.success('✅ Inscription confirmée !');

      // Auto-download PDF
      await this.downloadPdf();
    } catch (e: any) {
      this.error.set(e.message ?? 'Une erreur est survenue. Veuillez réessayer.');
      this.toast.error(this.error());
    } finally {
      this.submitting.set(false);
    }
  }

  async downloadPdf(): Promise<void> {
    if (!this.createdRegistration || !this.activity()) return;

    this.downloadingPdf.set(true);
    try {
      await this.pdfService.generateAndDownload(
        this.createdRegistration,
        this.activity()!
      );
      this.toast.success('📄 Reçu PDF téléchargé');
    } catch {
      this.toast.error('Impossible de générer le PDF');
    } finally {
      this.downloadingPdf.set(false);
    }
  }
}
