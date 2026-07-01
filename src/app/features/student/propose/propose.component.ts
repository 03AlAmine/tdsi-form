// propose.component.ts - Version avec vérification doublon + catégorisation automatique

import { Component, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, firstValueFrom } from 'rxjs';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { AiService } from '../../../core/services/ai.service';
import { ThemeCategory } from '../../../core/model/models';
import { LoadingService } from '../../../core/services/loading.service';
import { ToastService } from '../../../core/services/toast.service';

const CATEGORIES: ThemeCategory[] = [
  'Sécurité Réseau',
  'Cryptographie',
  'Transmission de Données',
  'Intelligence Artificielle',
  'Développement Web',
  'Cloud & DevOps',
  'Autre',
];

const DIFFICULTIES = [
  {
    value: 'débutant',
    label: 'Débutant',
    desc: 'Accessible à tous',
    icon: 'fa-seedling',
  },
  {
    value: 'intermédiaire',
    label: 'Intermédiaire',
    desc: 'Connaissances de base requises',
    icon: 'fa-book',
  },
  {
    value: 'avancé',
    label: 'Avancé',
    desc: 'Bonnes connaissances techniques',
    icon: 'fa-bolt',
  },
];

@Component({
  selector: 'app-propose',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './propose.component.html',
  styleUrls: ['./propose.component.scss'],
})
export class ProposeComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);
  private aiService = inject(AiService);
  private loadingService = inject(LoadingService);
  private toastService = inject(ToastService);

  private destroy$ = new Subject<void>();

  categories = CATEGORIES;
  difficulties = DIFFICULTIES;

  loading = signal(false);
  success = signal(false);
  error = signal('');

  aiLoading = signal(false);
  aiError = signal('');
  aiUsed = signal(false);
  suggestLoading = signal(false);
  categorizeLoading = signal(false);
  suggestions = signal<string[]>([]);
  showSuggestions = signal(false);
  titleInput$ = new Subject<string>();
  private categorizeTimeout: any = null;

  form = this.fb.group({
    proposedTitle: ['', [Validators.required, Validators.maxLength(80)]],
    category: ['', Validators.required],
    difficulty: ['intermédiaire', Validators.required],
    estimatedDuration: [
      90,
      [Validators.required, Validators.min(30), Validators.max(480)],
    ],
    description: ['', [Validators.required, Validators.minLength(50), Validators.maxLength(500)]],
    objectives: ['', Validators.required],
    prerequisites: [''],
    materialsNeeded: [''],
  });

  ngOnInit(): void {
    this.titleInput$
      .pipe(
        debounceTime(1200),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((val) => this.fetchSuggestions(val));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.categorizeTimeout) {
      clearTimeout(this.categorizeTimeout);
    }
  }

  getDifficultyIcon(value: string): string {
    return (
      this.difficulties.find((d) => d.value === value)?.icon ||
      'fa-circle-question'
    );
  }

  onTitleInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.titleInput$.next(val);

    if (val.length < 4) {
      this.suggestions.set([]);
      this.showSuggestions.set(false);
    }

    if (this.categorizeTimeout) {
      clearTimeout(this.categorizeTimeout);
    }

    this.categorizeTimeout = setTimeout(() => {
      if (val.length >= 5 && !this.form.value.category) {
        this.autoCategorizeTitle(val);
      }
    }, 2000);
  }

  async autoCategorizeTitle(title: string): Promise<void> {
    if (!title || title.length < 5) return;
    if (this.form.value.category) return;

    this.categorizeLoading.set(true);

    try {
      const result = await this.aiService.categorizeTheme(title, '');

      if (!this.form.value.category) {
        this.form.patchValue({
          category: result.category,
          difficulty: result.difficulty,
        });
        this.toastService.info(`✨ Catégorie suggérée : ${result.category}`);
      }
    } catch {
      // Silencieux - optionnel
    } finally {
      this.categorizeLoading.set(false);
    }
  }

  private async fetchSuggestions(title: string): Promise<void> {
    if (title.length < 4) return;
    this.suggestLoading.set(true);
    try {
      const category = this.form.value.category ?? '';
      const results = await this.aiService.suggestTitles(title, category);
      this.suggestions.set(
        results.filter((s) => s.toLowerCase() !== title.toLowerCase()),
      );
      this.showSuggestions.set(this.suggestions().length > 0);
    } catch {
      // Silencieux
    } finally {
      this.suggestLoading.set(false);
    }
  }

  pickSuggestion(title: string): void {
    this.form.get('proposedTitle')?.setValue(title);
    this.form.get('proposedTitle')?.markAsDirty();
    this.form.get('proposedTitle')?.updateValueAndValidity();

    this.showSuggestions.set(false);
    this.suggestions.set([]);

    this.autoCategorizeTitle(title);
  }

  hideSuggestions(): void {
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  async manualCategorize(): Promise<void> {
    const title = this.form.value.proposedTitle?.trim() ?? '';

    if (!title) {
      this.aiError.set("Saisissez d'abord un titre pour la catégorisation.");
      setTimeout(() => this.aiError.set(''), 3000);
      return;
    }

    this.categorizeLoading.set(true);
    try {
      const result = await this.aiService.categorizeTheme(title, '');
      this.form.patchValue({
        category: result.category,
        difficulty: result.difficulty,
      });
      this.toastService.success(`✨ Catégorie définie : ${result.category}`);
    } catch {
      this.aiError.set('Erreur de catégorisation. Réessayez.');
    } finally {
      this.categorizeLoading.set(false);
    }
  }

  async autoComplete(): Promise<void> {
    const title = this.form.value.proposedTitle?.trim() ?? '';
    const category = this.form.value.category ?? '';

    if (!title) {
      this.aiError.set("Saisissez d'abord un titre pour générer le contenu.");
      setTimeout(() => this.aiError.set(''), 3000);
      return;
    }

    this.aiLoading.set(true);
    this.aiError.set('');

    try {
      const user = this.authService.currentUser!;
      const result = await this.aiService.completeThemeForm(
        title,
        category,
        user.promo ?? 'étudiant',
      );

      // ✅ Filet de sécurité : même si le prompt demande ≤480 caractères,
      // rien ne garantit que le modèle respecte strictement la consigne.
      // La règle Firestore plafonne 'description' à 500 caractères — on
      // tronque donc ici pour ne jamais bloquer la soumission derrière.
      const safeDescription =
        result.description.length > 500
          ? result.description.slice(0, 497) + '...'
          : result.description;

      this.form.patchValue({
        description: safeDescription,
        objectives: result.objectives,
        prerequisites: result.prerequisites,
        materialsNeeded: result.materialsNeeded,
        estimatedDuration: result.estimatedDuration,
      });

      this.aiUsed.set(true);
      this.toastService.success('✨ Contenu généré par IA avec succès !');
    } catch {
      this.aiError.set('Erreur IA. Vérifiez votre connexion et réessayez.');
    } finally {
      this.aiLoading.set(false);
    }
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return control ? control.invalid && control.touched : false;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error(
        'Veuillez corriger les erreurs dans le formulaire',
      );
      return;
    }

    const user = this.authService.currentUser!;

    // ✅ FIX #2 — Vérifier si l'étudiant a déjà une soumission en attente
    // Évite le spam de propositions sans avoir attendu la réponse admin
    try {
      const submissions = await firstValueFrom(
        this.themeService.getMySubmissions(user.uid)
      );
      const hasPending = submissions.some((s) => s.status === 'en attente');

      if (hasPending) {
        this.toastService.error(
          '⏳ Tu as déjà une proposition en attente de validation. Attends la réponse avant d\'en soumettre une nouvelle.'
        );
        return;
      }
    } catch {
      // Si la vérification échoue, on laisse passer (dégradé gracieux)
    }

    this.loading.set(true);
    this.error.set('');
    this.loadingService.show('Envoi de votre proposition...');

    try {
      const payload = {
        studentId: user.uid,
        studentName: user.displayName,
        studentEmail: user.email,
        promo: user.promo ?? '',
        proposedTitle: this.form.value.proposedTitle!,
        description: this.form.value.description!,
        category: this.form.value.category as ThemeCategory,
        difficulty: this.form.value.difficulty as
          | 'débutant'
          | 'intermédiaire'
          | 'avancé',
        objectives: this.form.value.objectives!,
        prerequisites: this.form.value.prerequisites ?? '',
        estimatedDuration: this.form.value.estimatedDuration!,
        materialsNeeded: this.form.value.materialsNeeded ?? '',
        status: 'en attente' as const,
        submittedAt: new Date(),
        aiAssisted: this.aiUsed(),
      };

      await this.themeService.submitTheme(payload);
      this.loadingService.hide();
      this.success.set(true);
      this.toastService.success('Proposition soumise avec succès !');
    } catch (e) {
      console.error('Erreur soumission thématique:', e);
      this.loadingService.hide();
      this.error.set('Erreur lors de la soumission. Veuillez réessayer.');
      this.toastService.error('Erreur lors de la soumission');
    } finally {
      this.loading.set(false);
    }
  }

  resetForm(): void {
    this.success.set(false);
    this.aiUsed.set(false);
    this.form.reset({ estimatedDuration: 90, difficulty: 'intermédiaire' });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.toastService.info('Formulaire réinitialisé');
  }
}
