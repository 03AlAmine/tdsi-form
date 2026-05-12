// presence.component.ts - Version améliorée avec Font Awesome
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  FormGroup,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { WorkshopService } from '../../../core/services/workshop.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Workshop } from '../../../core/model/models';
import { db } from '../../../../firebase.config';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-presence',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './presence.component.html',
  styleUrls: ['./presence.component.scss'],
})
export class PresenceComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  public router = inject(Router);
  private fb = inject(FormBuilder);
  private wsService = inject(WorkshopService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  workshop: Workshop | null = null;
  form: FormGroup = this.fb.group({});
  loading = true;
  saving = false;
  submitted = false;
  alreadySubmitted = false;
  error = '';

  private workshopId: string | null = null;
  private presenceCheckSubscription: Subscription | null = null;

  get user() {
    return this.authService.currentUser;
  }

  async ngOnInit() {
    this.workshopId = this.route.snapshot.params['workshopId'];

    if (!this.workshopId) {
      this.loading = false;
      this.error = 'Workshop non trouvé';
      return;
    }

    await this.loadWorkshop();
    await this.checkExistingPresence();
    this.loading = false;
  }

  ngOnDestroy(): void {
    this.presenceCheckSubscription?.unsubscribe();
  }

  private async loadWorkshop(): Promise<void> {
    try {
      const workshopSnap = await getDoc(doc(db, 'workshops', this.workshopId!));

      if (!workshopSnap.exists()) {
        this.workshop = null;
        return;
      }

      const data = workshopSnap.data();
      this.workshop = {
        ...data,
        id: workshopSnap.id,
        date: data['date']?.toDate?.() ?? new Date(),
        createdAt: data['createdAt']?.toDate?.() ?? new Date(),
      } as Workshop;

      // Initialize form with dynamic fields
      if (this.workshop?.presenceFormEnabled && this.workshop.presenceFormConfig?.fields?.length) {
        const controls: Record<string, any> = {};
        for (const field of this.workshop.presenceFormConfig.fields) {
          const validators = field.required ? [Validators.required] : [];
          controls[field.id] = [
            field.type === 'checkbox' ? false : '',
            validators,
          ];
        }
        this.form = this.fb.group(controls);
      }
    } catch (err) {
      console.error('Erreur chargement workshop:', err);
      this.workshop = null;
    }
  }

  private async checkExistingPresence(): Promise<void> {
    if (!this.workshop || !this.user) return;

    try {
      const presenceSnap = await getDocs(
        query(
          collection(db, 'presences'),
          where('workshopId', '==', this.workshopId),
          where('userId', '==', this.user.uid),
        ),
      );
      this.alreadySubmitted = !presenceSnap.empty;
    } catch (err) {
      console.error('Erreur vérification présence:', err);
    }
  }

  isFieldInvalid(fieldId: string): boolean {
    const control = this.form.get(fieldId);
    return !!(control?.invalid && control?.touched);
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    this.saving = true;
    this.error = '';
    const user = this.user!;

    try {
      await this.wsService.submitPresence({
        workshopId: this.workshop!.id!,
        userId: user.uid,
        userName: user.displayName,
        userEmail: user.email,
        checkedInAt: new Date(),
        responses: this.form.value,
      });
      this.submitted = true;
      this.toastService.success('Présence confirmée avec succès !');
    } catch (err) {
      this.error = "Erreur lors de l'enregistrement. Veuillez réessayer.";
      this.toastService.error(this.error);
    } finally {
      this.saving = false;
    }
  }
}
