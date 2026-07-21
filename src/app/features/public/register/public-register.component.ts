// public-register.component.ts - Version améliorée
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { WorkshopService } from '../../../core/services/workshop.service';
import { PublicRegistrationService } from '../../../core/services/public-registration.service';
import { ESTABLISHMENTS, STUDY_LEVELS } from '../../../core/model/guest-registration.model';
import { Workshop } from '../../../core/model/models';
import { ToastService } from '../../../core/services/toast.service';
import { db } from '../../../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';
import { TechBackgroundComponent } from '../../shared/components/tech-background/tech-background.component';

@Component({
  selector: 'app-public-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink, TechBackgroundComponent],
  templateUrl: './public-register.component.html',
  styleUrls: ['./public-register.component.scss']
})
export class PublicRegisterComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private workshopService = inject(WorkshopService);
  private registrationService = inject(PublicRegistrationService);
  private toastService = inject(ToastService);

  workshop = signal<Workshop | null>(null);
  loading = signal(true);
  submitting = signal(false);
  registered = signal(false);
  alreadyRegistered = signal(false);
  error = signal('');

  establishments = ESTABLISHMENTS;
  studyLevels = STUDY_LEVELS;

  form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    establishment: ['', Validators.required],
    level: ['', Validators.required],
    phone: ['']
  });

  private workshopId: string | null = null;

  async ngOnInit(): Promise<void> {
    this.workshopId = this.route.snapshot.params['id'];

    if (!this.workshopId) {
      this.error.set('Workshop non trouvé');
      this.loading.set(false);
      return;
    }

    try {
      const snap = await getDoc(doc(db, 'workshops', this.workshopId));

      if (!snap.exists()) {
        this.error.set('Ce workshop n\'est plus disponible');
        this.loading.set(false);
        return;
      }

      const d = snap.data() as any;
      const found: Workshop = {
        ...d,
        id: snap.id,
        date: d['date']?.toDate?.() ?? new Date(),
        createdAt: d['createdAt']?.toDate?.() ?? new Date(),
      };

      if (found.status !== 'planifié' && found.status !== 'en cours') {
        this.error.set('Ce workshop n\'est plus disponible');
        this.loading.set(false);
        return;
      }

      this.workshop.set(found);
    } catch (err) {
      this.error.set('Erreur lors du chargement du workshop');
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control?.invalid && !!control?.touched;
  }

  isValid(field: string): boolean {
    const control = this.form.get(field);
    return !!control?.valid && !!control?.touched;
  }

  private shake(): void {
    const el = document.querySelector('.register-form');
    if (el) { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 450); }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.shake();
      this.toastService.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const workshopId = this.workshop()!.id!;
    const email = this.form.value.email!;

    // Check if already registered
    const isRegistered = await this.registrationService.isAlreadyRegistered(workshopId, email);

    if (isRegistered) {
      this.alreadyRegistered.set(true);
      this.toastService.warning('Cet email est déjà inscrit à ce workshop');
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    try {
      await this.registrationService.registerGuest({
        workshopId: workshopId,
        workshopTitle: this.workshop()!.themeTitle,
        fullName: this.form.value.fullName!,
        email: email,
        establishment: this.form.value.establishment!,
        level: this.form.value.level!,
        phone: this.form.value.phone || '',
        status: 'pending'
      });

      this.registered.set(true);
      this.toastService.success('Inscription confirmée ! Vérifiez votre email');
    } catch (err) {
      this.error.set('Erreur lors de l\'inscription. Veuillez réessayer.');
      this.toastService.error('Erreur lors de l\'inscription');
      this.shake();
    } finally {
      this.submitting.set(false);
    }
  }

  resetForm(): void {
    this.registered.set(false);
    this.alreadyRegistered.set(false);
    this.error.set('');
    this.form.reset();
    this.toastService.info('Formulaire réinitialisé');
  }
}
