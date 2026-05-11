import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivityService } from '../../../core/services/activity.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { TechBackgroundComponent } from '../../shared/components/tech-background/tech-background.component';
import { Activity } from '../../../core/model/activity.model';

@Component({
  selector: 'app-activity-register',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, TechBackgroundComponent],
  templateUrl: './activity-register.component.html',
  styleUrls: ['./activity-register.component.scss'],
})
export class ActivityRegisterComponent implements OnInit {
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);
  private fb              = inject(FormBuilder);
  private activityService = inject(ActivityService);
  private authService     = inject(AuthService);
  private toast           = inject(ToastService);

  activity         = signal<Activity | null>(null);
  loading          = signal(true);
  submitting       = signal(false);
  success          = signal(false);
  alreadyRegistered = signal(false);
  error            = signal('');

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

    // Pré-remplir si membre connecté
    const user = this.authService.currentUser;
    if (user) {
      this.form.patchValue({
        name:  user.displayName ?? '',
        email: user.email ?? '',
      });

      // Vérifier si déjà inscrit
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

    const v          = this.form.value;
    const activity   = this.activity()!;
    const user       = this.authService.currentUser;

    try {
      if (user && activity.registrations?.includes(user.uid)) {
        this.alreadyRegistered.set(true);
        return;
      }

      if (user) {
        // Membre connecté — inscription directe
        await this.activityService.registerMember(activity.id!, user.uid);
      } else {
        // Invité sans compte
        await this.activityService.registerGuest(activity.id!, {
          name:         v.name!,
          email:        v.email!,
          phone:        v.phone || undefined,
          organization: v.organization || undefined,
        });
      }

      this.success.set(true);
      this.toast.success('Inscription confirmée !');
    } catch (e: any) {
      this.error.set(e.message ?? 'Une erreur est survenue. Réessayez.');
    } finally {
      this.submitting.set(false);
    }
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!c && c.invalid && c.touched;
  }
}
