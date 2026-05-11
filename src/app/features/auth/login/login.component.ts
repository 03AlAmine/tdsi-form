import { Component, inject, signal, OnInit } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { TechBackgroundComponent } from '../../shared/components/tech-background/tech-background.component';

const PROMOS = ['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat', 'Professionnel'];

function passwordMatchValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirm = control.get('confirm')?.value;
  return password === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    RouterLink,
    LogoComponent,
    TechBackgroundComponent,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private location = inject(Location);

  // ── Switch State ──────────────────────────────────────
  showRegister = false;

  // ── Login State ───────────────────────────────────────
  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // ── Register State ────────────────────────────────────
  promos = PROMOS;
  regLoading = signal(false);
  registerError = signal('');
  showRegPassword = signal(false);

  registerForm = this.fb.group(
    {
      displayName: ['', [Validators.required, Validators.minLength(3)]],
      promo: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator },
  );

  get passwordMismatch(): boolean {
    return (
      this.registerForm.hasError('mismatch') &&
      this.registerForm.get('confirm')?.touched === true
    );
  }

  // ── Login Methods ─────────────────────────────────────
  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return control ? control.invalid && control.touched : false;
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  ngOnInit(): void {
    // Détecte l'URL actuelle
    const currentUrl = this.router.url;

    if (currentUrl.includes('/inscription')) {
      this.showRegister = true;
    }
  }

  // ── Switch avec animation + changement d'URL ──────────
  switchToRegister(): void {
    this.showRegister = true;
    // Change l'URL SANS recharger le composant
    this.location.replaceState('/inscription');
  }

  switchToLogin(): void {
    this.showRegister = false;
    // Change l'URL SANS recharger le composant
    this.location.replaceState('/connexion');
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
      let msg = 'Erreur de connexion. Veuillez réessayer.';
      if (e.code === 'auth/invalid-credential')
        msg = 'Email ou mot de passe incorrect.';
      else if (e.code === 'auth/too-many-requests')
        msg = 'Trop de tentatives. Réessayez plus tard.';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Register Methods ──────────────────────────────────
  isRegInvalid(field: string): boolean {
    const control = this.registerForm.get(field);
    return control ? control.invalid && control.touched : false;
  }

  toggleRegPassword(): void {
    this.showRegPassword.update((v) => !v);
  }

  async registerSubmit(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.regLoading.set(true);
    this.registerError.set('');

    try {
      const { email, password, displayName, promo } = this.registerForm.value;
      await this.auth.register({
        email: email!,
        password: password!,
        displayName: displayName!,
        promo: promo!,
      });
    } catch (e: any) {
      let msg = 'Erreur lors de la création du compte.';
      if (e.code === 'auth/email-already-in-use')
        msg = 'Cet email est déjà utilisé.';
      else if (e.code === 'auth/weak-password')
        msg = 'Mot de passe trop faible (min. 6 caractères).';
      this.registerError.set(msg);
    } finally {
      this.regLoading.set(false);
    }
  }
}
