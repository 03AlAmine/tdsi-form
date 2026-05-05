import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { TechBackgroundComponent } from "../../shared/components/tech-background/tech-background.component";

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink, LogoComponent, TechBackgroundComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return control ? (control.invalid && control.touched) : false;
  }

  togglePassword(): void {
    this.showPassword.update(value => !value);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      await this.auth.login(this.form.value.email!, this.form.value.password!);
    } catch (e: any) {
      let errorMessage = '';

      switch (e.code) {
        case 'auth/invalid-credential':
          errorMessage = 'Email ou mot de passe incorrect.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'Aucun compte trouvé avec cet email.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Trop de tentatives. Réessayez plus tard.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Erreur réseau. Vérifiez votre connexion.';
          break;
        default:
          errorMessage = 'Erreur de connexion. Veuillez réessayer.';
      }

      this.error.set(errorMessage);
    } finally {
      this.loading.set(false);
    }
  }
}
