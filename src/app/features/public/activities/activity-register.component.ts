import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivityService } from '../../../core/services/activity.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmationPdfService } from '../../../core/services/confirmation-pdf.service';
import { TechBackgroundComponent } from '../../shared/components/tech-background/tech-background.component';
import { Activity, ActivityRegistration } from '../../../core/model/activity.model';

@Component({
  selector: 'app-activity-register',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, TechBackgroundComponent],
  templateUrl: './activity-register.component.html',
  styleUrls: ['./activity-register.component.scss'],
})
export class ActivityRegisterComponent implements OnInit {
  private route           = inject(ActivatedRoute);
  private fb              = inject(FormBuilder);
  private activityService = inject(ActivityService);
  private authService     = inject(AuthService);
  private toast           = inject(ToastService);
  private pdfService      = inject(ConfirmationPdfService);

  activity          = signal<Activity | null>(null);
  loading           = signal(true);
  submitting        = signal(false);
  downloadingPdf    = signal(false);
  success           = signal(false);
  alreadyRegistered = signal(false);
  error             = signal('');

  // L'inscription créée — pour le téléchargement PDF
  private createdRegistration: ActivityRegistration | null = null;
  registrationId = signal('');

  isLoggedIn = this.authService.isLoggedIn;

  form = this.fb.group({
    name:         ['', [Validators.required, Validators.minLength(3)]],
    email:        ['', [Validators.required, Validators.email]],
    phone:        [''],
    organization: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.params['id'];
    const activity = await this.activityService.getActivity(id);

    if (!activity || (activity.status !== 'published' && activity.status !== 'ongoing')) {
      this.error.set('Cet événement n\'est plus disponible à l\'inscription.');
      this.loading.set(false);
      return;
    }

    const user = this.authService.currentUser;
    if (user) {
      this.form.patchValue({
        name:  user.displayName ?? '',
        email: user.email ?? '',
      });
      if (activity.registrations?.includes(user.uid)) {
        this.alreadyRegistered.set(true);
      }
    }

    this.activity.set(activity);
    this.loading.set(false);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.error.set('');

    const v        = this.form.value;
    const activity = this.activity()!;
    const user     = this.authService.currentUser;

    try {
      if (user && activity.registrations?.includes(user.uid)) {
        this.alreadyRegistered.set(true);
        return;
      }

      if (user) {
        // Membre connecté
        await this.activityService.registerMember(activity.id!, user.uid);
        // Construire un objet registration local pour le PDF
        this.createdRegistration = {
          activityId:        activity.id!,
          type:              'member',
          userId:            user.uid,
          name:              user.displayName ?? v.name!,
          email:             user.email ?? v.email!,
          organization:      v.organization || undefined,
          phone:             v.phone || undefined,
          registeredAt:      new Date(),
          confirmationToken: `${activity.id}-${user.uid}-${Date.now()}`,
          checkedIn:         false,
        };
      } else {
        // Invité sans compte
        const regId = await this.activityService.registerGuest(activity.id!, {
          name:         v.name!,
          email:        v.email!,
          phone:        v.phone || undefined,
          organization: v.organization || undefined,
        });
        this.registrationId.set(regId);
        this.createdRegistration = {
          id:                regId,
          activityId:        activity.id!,
          type:              'guest',
          name:              v.name!,
          email:             v.email!,
          organization:      v.organization || undefined,
          phone:             v.phone || undefined,
          registeredAt:      new Date(),
          confirmationToken: `${activity.id}-${regId}`,
          checkedIn:         false,
        };
      }

      this.success.set(true);
      this.toast.success('Inscription confirmée !');

      // Lancer le téléchargement PDF automatiquement
      await this.downloadPdf();

    } catch (e: any) {
      this.error.set(e.message ?? 'Une erreur est survenue. Réessayez.');
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
        // qrDataUrl optionnel — peut être ajouté plus tard avec le token signé
      );
      this.toast.success('Reçu PDF téléchargé');
    } catch (e) {
      console.error('[PDF]', e);
      this.toast.error('Impossible de générer le PDF');
    } finally {
      this.downloadingPdf.set(false);
    }
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!c && c.invalid && c.touched;
  }
}
