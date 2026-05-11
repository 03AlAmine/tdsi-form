import { Component, inject, signal, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { AiService } from '../../../core/services/ai.service';
import { ThemeCategory } from '../../../core/model/models';
import { LoadingService } from '../../../core/services/loading.service';

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
  { value: 'débutant', label: '🌱 Débutant', desc: 'Accessible à tous' },
  {
    value: 'intermédiaire',
    label: '📘 Intermédiaire',
    desc: 'Connaissances de base requises',
  },
  {
    value: 'avancé',
    label: '⚡ Avancé',
    desc: 'Bonnes connaissances techniques',
  },
];

@Component({
  selector: 'app-propose',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './propose.component.html',
  styleUrls: ['./propose.component.scss'],
})
export class ProposeComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);
  private aiService = inject(AiService);
  private destroy$ = new Subject<void>();
  private loadingService = inject(LoadingService);

  categories = CATEGORIES;
  difficulties = DIFFICULTIES;

  loading = signal(false);
  success = signal(false);
  error = signal('');

  aiLoading = signal(false);
  aiError = signal('');
  aiUsed = signal(false);
  suggestLoading = signal(false);
  suggestions = signal<string[]>([]);
  showSuggestions = signal(false);
  titleInput$ = new Subject<string>();

  form = this.fb.group({
    proposedTitle: ['', [Validators.required, Validators.maxLength(80)]],
    category: ['', Validators.required],
    difficulty: ['intermédiaire', Validators.required],
    estimatedDuration: [
      60,
      [Validators.required, Validators.min(30), Validators.max(480)],
    ],
    description: ['', [Validators.required, Validators.minLength(50)]],
    objectives: ['', Validators.required],
    prerequisites: [''],
    materialsNeeded: [''],
  });

  constructor() {
    this.titleInput$
      .pipe(
        debounceTime(1500), // ✅ 600 → 1500ms
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((val) => this.fetchSuggestions(val));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTitleInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.titleInput$.next(val);
    if (val.length < 5) {
      // ✅ 3 → 5
      this.suggestions.set([]);
      this.showSuggestions.set(false);
    }
  }

  private async fetchSuggestions(title: string) {
    if (title.length < 5) return; // ✅ 4 → 5
    this.suggestLoading.set(true);
    try {
      const category = this.form.value.category ?? '';
      const results = await this.aiService.suggestTitles(title, category);
      this.suggestions.set(
        results.filter((s) => s.toLowerCase() !== title.toLowerCase()),
      );
      this.showSuggestions.set(this.suggestions().length > 0);
    } catch {
      // silencieux
    } finally {
      this.suggestLoading.set(false);
    }
  }

  pickSuggestion(title: string) {
    this.form.patchValue({ proposedTitle: title });
    this.showSuggestions.set(false);
    this.suggestions.set([]);
  }

  hideSuggestions() {
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  async autoComplete() {
    const title = this.form.value.proposedTitle?.trim() ?? '';
    const category = this.form.value.category ?? '';

    if (!title) {
      this.aiError.set("Saisis d'abord un titre pour générer le contenu.");
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

      this.form.patchValue({
        description: result.description,
        objectives: result.objectives,
        prerequisites: result.prerequisites,
        materialsNeeded: result.materialsNeeded,
        estimatedDuration: result.estimatedDuration,
      });

      this.aiUsed.set(true);
    } catch {
      this.aiError.set('Erreur IA. Vérifie ta connexion et réessaie.');
    } finally {
      this.aiLoading.set(false);
    }
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!c?.invalid && !!c?.touched;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');
    const user = this.authService.currentUser!;
    this.loadingService.show('Envoi de ta proposition...');

    try {
      await this.themeService.submitTheme({
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
        status: 'en attente',
        submittedAt: new Date(),
      });
      this.loadingService.hide();
      this.success.set(true);
    } catch (error) {
      this.loadingService.hide();
      this.error.set('Erreur lors de la soumission');
    }
  }

  resetForm(): void {
    this.success.set(false);
    this.aiUsed.set(false);
    this.form.reset({ estimatedDuration: 60, difficulty: 'intermédiaire' });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
}
