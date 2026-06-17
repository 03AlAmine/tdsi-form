// forgot-password.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { TechBackgroundComponent } from '../../shared/components/tech-background/tech-background.component';
import { auth } from '../../../../firebase.config';
import { sendPasswordResetEmail } from 'firebase/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, TechBackgroundComponent],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
})
export class ForgotPasswordComponent {
  private fb    = inject(FormBuilder);
  private toast = inject(ToastService);

  loading = signal(false);
  success = signal(false);
  error   = signal('');
  email   = signal('');

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!c && c.invalid && c.touched;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Veuillez entrer un email valide');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    const emailValue = this.form.value.email!;
    this.email.set(emailValue);

    try {
      await sendPasswordResetEmail(auth, emailValue);
      this.success.set(true);
      this.toast.success('Email de réinitialisation envoyé');
    } catch (err: any) {
      let msg = "Erreur lors de l'envoi de l'email";
      if (err.code === 'auth/user-not-found')  msg = 'Aucun compte associé à cet email';
      if (err.code === 'auth/invalid-email')   msg = 'Email invalide';
      this.error.set(msg);
      this.toast.error(msg);
    } finally {
      this.loading.set(false);
    }
  }

  /** Remet le formulaire pour renvoyer un email */
  resetForm(): void {
    this.success.set(false);
    this.error.set('');
    this.form.reset();
  }
}
