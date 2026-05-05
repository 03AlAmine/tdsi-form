import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { TechBackgroundComponent } from '../../shared/components/tech-background/tech-background.component';

const PROMOS = ['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat', 'Professionnel'];

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirm = control.get('confirm')?.value;
  return password === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink, LogoComponent, TechBackgroundComponent],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  promos = PROMOS;
  loading = signal(false);
  error = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  form = this.fb.group({
    displayName: ['', [Validators.required, Validators.minLength(3)]],
    promo: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirm: ['', [Validators.required]]
  }, { validators: passwordMatchValidator });

  get passwordMismatch(): boolean {
    return this.form.hasError('mismatch') &&
           this.form.get('confirm')?.touched === true;
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return control ? (control.invalid && control.touched) : false;
  }

  togglePassword(): void {
    this.showPassword.update(value => !value);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update(value => !value);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const { email, password, displayName, promo } = this.form.value;
      await this.auth.register({
        email: email!,
        password: password!,
        displayName: displayName!,
        promo: promo!
      });
    } catch (e: any) {
      let errorMessage = '';

      switch (e.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Cet email est déjà utilisé.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Mot de passe trop faible. Utilise au moins 6 caractères.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email invalide.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Erreur réseau. Vérifiez votre connexion.';
          break;
        default:
          errorMessage = 'Erreur lors de la création du compte. Veuillez réessayer.';
      }

      this.error.set(errorMessage);
    } finally {
      this.loading.set(false);
    }
  }
}
