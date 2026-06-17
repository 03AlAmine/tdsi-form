// login.component.ts
import {
  Component, inject, signal,
  OnInit, AfterViewInit, OnDestroy,
} from '@angular/core';
import {
  FormBuilder, ReactiveFormsModule, Validators,
  AbstractControl, ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { TechBackgroundComponent } from '../../shared/components/tech-background/tech-background.component';
import { getAuth, sendEmailVerification } from 'firebase/auth';

const PROMOS = ['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat', 'Professionnel'];

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const pwd = control.get('password')?.value;
  const cfm = control.get('confirm')?.value;
  return pwd === cfm ? null : { mismatch: true };
}

interface TerminalLine {
  text: string;
  type: 'cmd' | 'ok' | 'warn' | 'info' | 'blank';
  visible: boolean;
  cursor?: boolean;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink, LogoComponent, TechBackgroundComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
  private fb       = inject(FormBuilder);
  private auth     = inject(AuthService);
  private router   = inject(Router);
  private location = inject(Location);

  private termTimers: ReturnType<typeof setTimeout>[] = [];

  // ── Switch ──────────────────────────────────────────
  showRegister = false;

  // ── Login ────────────────────────────────────────────
  loading              = signal(false);
  error                = signal('');
  showPassword         = signal(false);
  emailVerificationSent = signal(false);

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // ── Register ─────────────────────────────────────────
  promos           = PROMOS;
  regLoading       = signal(false);
  registerError    = signal('');
  showRegPassword  = signal(false);

  registerForm = this.fb.group(
    {
      displayName: ['', [Validators.required, Validators.minLength(3)]],
      promo:       ['', Validators.required],
      email:       ['', [Validators.required, Validators.email]],
      password:    ['', [Validators.required, Validators.minLength(6)]],
      confirm:     ['', Validators.required],
    },
    { validators: passwordMatchValidator }
  );

  // ── Terminal ──────────────────────────────────────────
  terminalLines: TerminalLine[] = [];

  private readonly BOOT: Omit<TerminalLine, 'visible'>[] = [
    { text: 'ssh member@clubtdsi.sn -p 22',           type: 'cmd'  },
    { text: 'Connecting to clubtdsicampus.sn...',            type: 'info' },
    { text: 'Handshake OK  [TLS 1.3 / ECDHE]',    type: 'ok'   },
    { text: '',                                     type: 'blank'},
    { text: 'init community_modules...',            type: 'cmd'  },
    { text: '  ✓ cybersecurity     [LOADED]',      type: 'ok'   },
    { text: '  ✓ ai_ml             [LOADED]',      type: 'ok'   },
    { text: '  ✓ pentest_lab       [LOADED]',      type: 'ok'   },
    { text: '  ✓ ctf_arena         [LOADED]',      type: 'ok'   },
    { text: '  ✓ osint_toolkit     [LOADED]',      type: 'ok'   },
    { text: '',                                     type: 'blank'},
    { text: 'whoami',                               type: 'cmd'  },
    { text: 'guest — access: restricted',          type: 'warn' },
    { text: '',                                     type: 'blank'},
    { text: 'sudo auth --module ctc_member',       type: 'cmd'  },
    { text: '[AUTH] Enter credentials to proceed.', type: 'info', cursor: true },
  ];

  get passwordMismatch(): boolean {
    return (
      this.registerForm.hasError('mismatch') &&
      this.registerForm.get('confirm')?.touched === true
    );
  }

  ngOnInit(): void {
    if (this.router.url.includes('/inscription')) this.showRegister = true;
    document.addEventListener('keydown', this.onKey);
  }

  ngAfterViewInit(): void {
    this.playBoot();
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.onKey);
    this.termTimers.forEach(clearTimeout);
  }

  private playBoot(): void {
    let delay = 280;
    this.BOOT.forEach((line, i) => {
      const t = setTimeout(() => {
        this.terminalLines.push({ ...line, visible: true });
        if (i > 0) this.terminalLines[i - 1].cursor = false;
      }, delay);
      this.termTimers.push(t);
      delay += line.type === 'blank' ? 70 : 160 + Math.random() * 110;
    });
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { this.error.set(''); this.registerError.set(''); }
  };

  isInvalid(f: string): boolean {
    const c = this.form.get(f);
    return !!c && c.invalid && c.touched;
  }

  isRegInvalid(f: string): boolean {
    const c = this.registerForm.get(f);
    return !!c && c.invalid && c.touched;
  }

  togglePassword():    void { this.showPassword.update(v => !v); }
  toggleRegPassword(): void { this.showRegPassword.update(v => !v); }

  switchToRegister(): void {
    this.showRegister = true;
    this.location.replaceState('/inscription');
    this.addLine('sudo auth --action register',       'cmd');
    this.addLine('[REGISTER] New member enrollment.', 'info');
  }

  switchToLogin(): void {
    this.showRegister = false;
    this.location.replaceState('/connexion');
    this.addLine('sudo auth --action login',   'cmd');
    this.addLine('[LOGIN] Authentication mode.','info');
  }

  private addLine(text: string, type: TerminalLine['type']): void {
    if (this.terminalLines.length) this.terminalLines[this.terminalLines.length - 1].cursor = false;
    this.terminalLines.push({ text, type, visible: true });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.shake();
      this.addLine('[AUTH] Error: invalid credentials format.', 'warn');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.addLine('Authenticating...', 'info');
    try {
      await this.auth.login(this.form.value.email!, this.form.value.password!);
      this.addLine('Access granted. Welcome back.', 'ok');
    } catch (e: any) {
      let msg = 'Erreur de connexion. Veuillez réessayer.';
      if (e.code === 'auth/invalid-credential')  msg = 'Email ou mot de passe incorrect.';
      if (e.code === 'auth/too-many-requests')   msg = 'Trop de tentatives. Réessayez plus tard.';
      if (e.code === 'auth/user-disabled')       msg = 'Ce compte a été désactivé.';
      this.error.set(msg);
      this.addLine('[AUTH] Access denied.', 'warn');
    } finally {
      this.loading.set(false);
    }
  }

  async registerSubmit(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.shake();
      this.addLine('[REGISTER] Error: incomplete data.', 'warn');
      return;
    }
    this.regLoading.set(true);
    this.registerError.set('');
    this.addLine('Creating member account...', 'info');
    try {
      const { email, password, displayName, promo } = this.registerForm.value;
      await this.auth.register({ email: email!, password: password!, displayName: displayName!, promo: promo! });

      const fu = getAuth().currentUser;
      if (fu && !fu.emailVerified) {
        try { await sendEmailVerification(fu); this.emailVerificationSent.set(true); } catch {}
      }
      this.addLine('Account created. Verify email.', 'ok');
    } catch (e: any) {
      let msg = 'Erreur lors de la création du compte.';
      if (e.code === 'auth/email-already-in-use') msg = 'Cet email est déjà utilisé.';
      if (e.code === 'auth/weak-password')         msg = 'Mot de passe trop faible.';
      if (e.code === 'auth/invalid-email')         msg = 'Email invalide.';
      this.registerError.set(msg);
      this.addLine('[REGISTER] Error: ' + msg, 'warn');
    } finally {
      this.regLoading.set(false);
    }
  }

  async resendVerificationEmail(): Promise<void> {
    const fu = getAuth().currentUser;
    if (!fu) return;
    try { await sendEmailVerification(fu); this.emailVerificationSent.set(true); }
    catch { this.registerError.set("Impossible de renvoyer l'email. Réessayez dans quelques minutes."); }
  }

  private shake(): void {
    const el = document.querySelector('.auth-form');
    if (el) { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 450); }
  }
}
