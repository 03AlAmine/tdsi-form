import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkshopService } from '../../../core/services/workshop.service';
import { GlowTimelineComponent } from '../../shared/components/glow-timeline/glow-timeline.component';
import { TimelineItem } from '../../shared/components/glow-timeline/timeline-item.model';
import { MemberCardComponent } from '../../shared/components/member-card/member-card.component';
import { auth } from '../../../../firebase.config';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink, GlowTimelineComponent, MemberCardComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit, OnDestroy {
  private fb           = inject(FormBuilder);
  private authService  = inject(AuthService);
  private userSvc      = inject(UserService);
  private router       = inject(Router);
  private toastService = inject(ToastService);
  private logger       = inject(LoggerService);
  private themeService    = inject(ThemeService);
  private workshopService = inject(WorkshopService);

  user = this.authService.currentUser;
  private sub: Subscription | null = null;

  // ── Stats & badges ────────────────────────────────────────
  stats = signal({ mySubmissions: 0, myRegistrations: 0 });

  engagementPoints = computed(
    () => this.stats().myRegistrations * 10 + this.stats().mySubmissions * 25,
  );

  certificatesCount = computed(() => Math.floor(this.stats().myRegistrations / 2));

  memberSince = computed(() => {
    const createdAt = this.user?.createdAt;
    if (!createdAt) return 0;
    const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
  });

  memberSinceLabel = computed(() => {
    const days = this.memberSince();
    return days > 0 ? `Membre depuis ${days} jour${days > 1 ? 's' : ''}` : 'Nouveau membre';
  });

  badges = computed(() => [
    {
      icon: 'fa-lightbulb',
      label: 'Premier pas',
      description: 'Proposer une thématique',
      unlocked: this.stats().mySubmissions >= 1,
    },
    {
      icon: 'fa-calendar-check',
      label: 'Habitué',
      description: 'S’inscrire à 3 workshops',
      unlocked: this.stats().myRegistrations >= 3,
    },
    {
      icon: 'fa-pen-nib',
      label: 'Contributeur actif',
      description: 'Proposer 3 thématiques',
      unlocked: this.stats().mySubmissions >= 3,
    },
    {
      icon: 'fa-hourglass-half',
      label: 'Membre fidèle',
      description: 'Membre depuis plus de 90 jours',
      unlocked: this.memberSince() >= 90,
    },
  ]);

  // ── Roadmap membre — réutilise app-glow-timeline avec les mêmes
  // seuils que les badges ci-dessus, pour rester cohérent (pas de
  // nouveau chiffre inventé). Le premier palier "Découvre" est toujours
  // acquis (compte créé) ; les suivants s'allument avec l'engagement
  // réel du membre. ──
  memberRoadmap = computed<TimelineItem[]>(() => {
    const s = this.stats();
    const since = this.memberSince();

    const steps: Array<{
      icon: string;
      title: string;
      description: string;
      unlocked: boolean;
    }> = [
      {
        icon: 'fa-compass',
        title: 'Découvre',
        description: 'Compte créé — bienvenue au Club TDSI.',
        unlocked: true,
      },
      {
        icon: 'fa-calendar-check',
        title: 'Participe',
        description: "S'inscrire à un premier workshop.",
        unlocked: s.myRegistrations >= 1,
      },
      {
        icon: 'fa-graduation-cap',
        title: 'Apprends',
        description: 'Suivre 3 workshops.',
        unlocked: s.myRegistrations >= 3,
      },
      {
        icon: 'fa-lightbulb',
        title: 'Contribue',
        description: 'Proposer une première thématique.',
        unlocked: s.mySubmissions >= 1,
      },
      {
        icon: 'fa-pen-nib',
        title: 'Devient référence',
        description: 'Proposer 3 thématiques.',
        unlocked: s.mySubmissions >= 3,
      },
      {
        icon: 'fa-user-graduate',
        title: 'Mentor',
        description: 'Membre fidèle et contributeur régulier du club.',
        unlocked: since >= 90 && s.mySubmissions >= 3,
      },
    ];

    // Le "step" actif = le dernier débloqué en partant du début, tant
    // que la chaîne n'est pas rompue (évite un pulse sur une étape
    // ultérieure débloquée "par hasard" avant une étape intermédiaire).
    let currentIndex = 0;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].unlocked) currentIndex = i;
      else break;
    }

    return steps.map((step, i) => ({
      id: `roadmap-${i}`,
      icon: step.icon,
      title: step.title,
      description: step.description,
      status: step.unlocked ? 'success' : 'neutral',
      statusLabel: step.unlocked ? 'Débloqué' : 'À venir',
      pulse: step.unlocked && i === currentIndex,
      disabled: !step.unlocked,
    }));
  });

  savingProfile       = signal(false);
  changingPassword    = signal(false);
  showCurrentPassword = signal(false);
  showNewPassword     = signal(false);
  showConfirmPassword = signal(false);
  successMessage      = signal('');
  errorMessage        = signal('');

  profileForm = this.fb.group({
    displayName:   [this.user?.displayName   ?? '', [Validators.required, Validators.minLength(3)]],
    promo:         [this.user?.promo         ?? '', Validators.required],
    etablissement: [this.user?.etablissement ?? ''],
    etablissementAutre: [''],
    filiere:       [this.user?.filiere       ?? ''],
    phone:         [this.user?.phone         ?? '', Validators.pattern(/^\+?[0-9 ]{7,15}$/)],
    linkedin:      [this.user?.linkedin      ?? '', Validators.pattern(/^https?:\/\/.+/)],
    github:        [this.user?.github        ?? '', Validators.pattern(/^https?:\/\/.+/)],
    bio:           [this.user?.bio           ?? '', Validators.maxLength(220)],
  });

  passwordForm: FormGroup = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword:     ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  }, { validators: this.passwordMatchValidator });

  promos = ['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat', 'Professionnel'];

  // ✅ Liste prédéfinie — "Autre" fait apparaître un champ libre
  // (etablissementAutre) dont la valeur remplace "Autre" à l'enregistrement.
  etablissements = [
    'Transmission de Données et Sécurité de l’Information (TDSI)',
    'École Supérieure Polytechnique de Dakar (ESP)',
    'Université Cheikh Anta Diop (UCAD)',
    'Université Gaston Berger (UGB)',
    'Université Alioune Diop de Bambey (UADB)',
    'Université Assane Seck de Ziguinchor (UASZ)',
    'École Polytechnique de Thiès (EPT)',
    'Institut Supérieur de Management (ISM)',
    "Institut Supérieur d'Informatique (ISI)",
    'Autre',
  ];

  get newPassword(): AbstractControl     { return this.passwordForm.get('newPassword')!; }
  get confirmPassword(): AbstractControl { return this.passwordForm.get('confirmPassword')!; }

  private statsSubs: Subscription[] = [];

  // ── Lifecycle ─────────────────────────────────────────────
  ngOnInit(): void {
    this.sub = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.user = user;
        const knownEtablissement = user.etablissement && this.etablissements.includes(user.etablissement);
        this.profileForm.patchValue(
          {
            displayName: user.displayName,
            promo: user.promo,
            etablissement: knownEtablissement ? user.etablissement : (user.etablissement ? 'Autre' : ''),
            etablissementAutre: knownEtablissement ? '' : (user.etablissement ?? ''),
            filiere: user.filiere ?? '',
            phone: user.phone ?? '',
            linkedin: user.linkedin ?? '',
            github: user.github ?? '',
            bio: user.bio ?? '',
          },
          { emitEvent: false }
        );
      }
    });
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.statsSubs.forEach((s) => s.unsubscribe());
  }

  private loadStats(): void {
    const uid = this.user?.uid;
    if (!uid) return;
    this.statsSubs.push(
      this.themeService.getMySubmissions(uid).subscribe((subs) => {
        this.stats.update((s) => ({ ...s, mySubmissions: subs.length }));
      }),
    );
    this.statsSubs.push(
      this.workshopService.getWorkshops().subscribe((workshops) => {
        const registrations = workshops.filter((w) => w.registrations?.includes(uid));
        this.stats.update((s) => ({ ...s, myRegistrations: registrations.length }));
      }),
    );
  }

  // ── Validation ────────────────────────────────────────────
  passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const np = group.get('newPassword')?.value;
    const cp = group.get('confirmPassword')?.value;
    return np === cp ? null : { mismatch: true };
  }

  isProfileInvalid(field: string): boolean {
    const c = this.profileForm.get(field);
    return c ? c.invalid && c.touched : false;
  }

  isOtherEtablissement(): boolean {
    return this.profileForm.get('etablissement')?.value === 'Autre';
  }

  bioLength(): number {
    return (this.profileForm.get('bio')?.value ?? '').length;
  }

  isPasswordInvalid(field: string): boolean {
    const c = this.passwordForm.get(field);
    return c ? c.invalid && c.touched : false;
  }

  // ── Profil ────────────────────────────────────────────────
  async updateProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.toastService.error('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    this.savingProfile.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const uid = this.user!.uid;
      const displayName = this.profileForm.value.displayName!;
      const promo       = this.profileForm.value.promo!;
      const etablissement =
        this.profileForm.value.etablissement === 'Autre'
          ? (this.profileForm.value.etablissementAutre ?? '').trim()
          : (this.profileForm.value.etablissement ?? '');

      // ✅ Via UserService — plus de updateDoc direct
      await this.userSvc.updateProfile(uid, {
        displayName,
        promo,
        etablissement,
        filiere:  this.profileForm.value.filiere  ?? '',
        phone:    this.profileForm.value.phone    ?? '',
        linkedin: this.profileForm.value.linkedin ?? '',
        github:   this.profileForm.value.github   ?? '',
        bio:      this.profileForm.value.bio      ?? '',
      });
      await this.authService.refreshCurrentUser();

      this.successMessage.set('Profil mis à jour avec succès !');
      this.toastService.success('Profil mis à jour avec succès');

      // ✅ Timeout stocké pour être annulable si le composant est détruit
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (err) {
      this.logger.error('[Profile] updateProfile:', err);
      this.errorMessage.set('Erreur lors de la mise à jour du profil');
      this.toastService.error('Erreur lors de la mise à jour du profil');
    } finally {
      this.savingProfile.set(false);
    }
  }

  // ── Mot de passe ──────────────────────────────────────────
  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.toastService.error('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    this.changingPassword.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const firebaseUser = auth.currentUser;
    if (!firebaseUser?.email) {
      this.errorMessage.set('Utilisateur non connecté');
      this.toastService.error('Utilisateur non connecté');
      this.changingPassword.set(false);
      return;
    }

    try {
      await reauthenticateWithCredential(
        firebaseUser,
        EmailAuthProvider.credential(
          firebaseUser.email,
          this.passwordForm.value.currentPassword!
        )
      );
      await updatePassword(firebaseUser, this.passwordForm.value.newPassword!);

      this.successMessage.set('Mot de passe modifié avec succès !');
      this.toastService.success('Mot de passe modifié avec succès');
      this.passwordForm.reset();
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (err: any) {
      this.logger.error('[Profile] changePassword:', err);
      const messages: Record<string, string> = {
        'auth/wrong-password':    'Mot de passe actuel incorrect',
        'auth/weak-password':     'Le nouveau mot de passe est trop faible',
        'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard',
      };
      const msg = messages[err?.code] ?? 'Erreur lors du changement de mot de passe';
      this.errorMessage.set(msg);
      this.toastService.error(msg);
    } finally {
      this.changingPassword.set(false);
    }
  }

  // ── Password strength ────────────────────────────────────
  getStrengthClass(password: string): string {
    if (!password) return '';
    const s = this.checkPasswordStrength(password);
    return s < 2 ? 'weak' : s < 4 ? 'medium' : 'strong';
  }

  getStrengthText(password: string): string {
    if (!password) return '';
    const s = this.checkPasswordStrength(password);
    return s < 2 ? 'Faible' : s < 4 ? 'Moyen' : 'Fort';
  }

  private checkPasswordStrength(p: string): number {
    return [p.length >= 8, /[a-z]/.test(p), /[A-Z]/.test(p), /[0-9]/.test(p), /[^a-zA-Z0-9]/.test(p)]
      .filter(Boolean).length;
  }

  // ── UI ────────────────────────────────────────────────────
  toggleCurrentPassword(): void { this.showCurrentPassword.update(v => !v); }
  toggleNewPassword():     void { this.showNewPassword.update(v => !v);     }
  toggleConfirmPassword(): void { this.showConfirmPassword.update(v => !v); }
  goBack():                void { this.router.navigate(['/espace-membre/thematiques']); }
  logout():                void { this.authService.logout(); this.toastService.info('Vous avez été déconnecté'); }
}
