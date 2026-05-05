import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { WorkshopService } from '../../../core/services/workshop.service';
import { PublicRegistrationService } from '../../../core/services/public-registration.service';
import { ESTABLISHMENTS, STUDY_LEVELS } from '../../../core/model/guest-registration.model';
import { Workshop } from '../../../core/model/models';
import { TechBackgroundComponent } from '../../shared/components/tech-background/tech-background.component';


@Component({
  selector: 'app-public-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink, TechBackgroundComponent],
  templateUrl: './public-register.component.html',
  styleUrls: ['./public-register.component.scss']
})
export class PublicRegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private workshopService = inject(WorkshopService);
  private registrationService = inject(PublicRegistrationService);

  workshop = signal<Workshop | null>(null);
  loading = signal(true);
  submitting = signal(false);
  registered = signal(false);
  alreadyRegistered = signal(false);
  error = signal(''); // ← utilisé dans le template

  establishments = ESTABLISHMENTS;
  studyLevels = STUDY_LEVELS;

  form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    establishment: ['', Validators.required],
    level: ['', Validators.required],
    phone: ['']
  });

  async ngOnInit(): Promise<void> {
    const workshopId = this.route.snapshot.params['id'];

    this.workshopService.getWorkshops().subscribe(workshops => {
      const found = workshops.find(w => w.id === workshopId);

      if (!found || (found.status !== 'planifié' && found.status !== 'en cours')) {
        this.error.set('Ce workshop n\'est plus disponible');
        this.loading.set(false);
        return;
      }

      this.workshop.set(found);
      this.loading.set(false);
    });
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control?.invalid && !!control?.touched;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Vérifier si déjà inscrit
    const isRegistered = await this.registrationService.isAlreadyRegistered(
      this.workshop()!.id!,
      this.form.value.email!
    );

    if (isRegistered) {
      this.alreadyRegistered.set(true);
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    try {
      await this.registrationService.registerGuest({
        workshopId: this.workshop()!.id!,
        workshopTitle: this.workshop()!.themeTitle,
        fullName: this.form.value.fullName!,
        email: this.form.value.email!,
        establishment: this.form.value.establishment!,
        level: this.form.value.level!,
        phone: this.form.value.phone || '',
        status: 'pending'
      });

      this.registered.set(true);
    } catch (err) {
      this.error.set('Erreur lors de l\'inscription. Veuillez réessayer.');
    } finally {
      this.submitting.set(false);
    }
  }

  resetForm(): void {
    this.registered.set(false);
    this.alreadyRegistered.set(false);
    this.form.reset();
  }
}
