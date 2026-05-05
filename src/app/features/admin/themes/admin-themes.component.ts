import { Component, inject, signal, ViewChild, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, map, Observable } from 'rxjs';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkshopService } from '../../../core/services/workshop.service';
import { AuthService } from '../../../core/services/auth.service';
import { Theme, ThemeCategory, Workshop } from '../../../core/model/models';
import { ThemeDetailComponent } from './theme-detail/theme-detail.component';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { SearchBarComponent } from '../../shared/search-bar/search-bar.component';

const CATEGORIES: ThemeCategory[] = [
  'Sécurité Réseau',
  'Cryptographie',
  'Transmission de Données',
  'Intelligence Artificielle',
  'Développement Web',
  'Cloud & DevOps',
  'Autre',
];

interface ThemeWithWorkshop extends Theme {
  linkedWorkshop?: Workshop;
}

@Component({
  selector: 'app-admin-themes',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ThemeDetailComponent,
    SearchBarComponent,
  ],
  templateUrl: './admin-themes.component.html',
  styleUrls: ['./admin-themes.component.scss'],
})
export class AdminThemesComponent implements OnInit {
  private themeService = inject(ThemeService);
  private workshopService = inject(WorkshopService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private toastService = inject(ToastService);
  private confirmService = inject(ConfirmService);

  @ViewChild(ThemeDetailComponent) themeDetail!: ThemeDetailComponent;

  // Observable pour les thèmes avec workshops liés
  themes$!: Observable<ThemeWithWorkshop[]>;

  // Signal pour stocker les thèmes (pour le filtrage)
  allThemes = signal<ThemeWithWorkshop[]>([]);

  categories = CATEGORIES;
  showForm = signal(false);
  saving = signal(false);
  selectedTheme = signal<Theme | null>(null);
  searchQuery = signal('');

  form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    category: ['', Validators.required],
    difficulty: ['intermédiaire', Validators.required],
    description: ['', [Validators.required, Validators.minLength(20)]],
    maxParticipants: [20, [Validators.required, Validators.min(1), Validators.max(100)]],
    tags: [''],
  });

  // Computed pour les thèmes filtrés
  filteredThemes = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const themes = this.allThemes();

    if (!query) return themes;

    return themes.filter(
      (theme) =>
        theme.title.toLowerCase().includes(query) ||
        theme.description.toLowerCase().includes(query) ||
        theme.category.toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    // Initialiser l'observable et s'abonner pour mettre à jour le signal
    this.themes$ = combineLatest([
      this.themeService.getThemes(),
      this.workshopService.getWorkshops(),
    ]).pipe(
      map(([themes, workshops]) =>
        themes.map(
          (theme) =>
            ({
              ...theme,
              linkedWorkshop: workshops.find((ws) => ws.themeId === theme.id),
            }) as ThemeWithWorkshop,
        ),
      ),
    );

    // S'abonner pour mettre à jour le signal
    this.themes$.subscribe(themes => {
      this.allThemes.set(themes);
    });
  }

  toggleForm(): void {
    this.showForm.update((v) => !v);
    if (!this.showForm()) {
      this.form.reset({ difficulty: 'intermédiaire', maxParticipants: 20 });
    }
  }

  async create(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const v = this.form.value;

    try {
      await this.themeService.createTheme({
        title: v.title!,
        description: v.description!,
        category: v.category as ThemeCategory,
        tags: v.tags
          ? v.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        difficulty: v.difficulty as Theme['difficulty'],
        maxParticipants: v.maxParticipants ?? 20,
        currentParticipants: 0,
        status: 'ouvert',
        createdAt: new Date(),
        createdBy: this.authService.currentUser!.uid,
      });

      this.form.reset({ difficulty: 'intermédiaire', maxParticipants: 20 });
      this.showForm.set(false);
      this.toastService.success('Thématique créée avec succès !');
    } catch (error) {
      this.toastService.error('Erreur lors de la création');
    } finally {
      this.saving.set(false);
    }
  }

  async updateStatus(theme: Theme, event: Event): Promise<void> {
    const status = (event.target as HTMLSelectElement).value as Theme['status'];
    try {
      await this.themeService.updateTheme(theme.id!, { status });
      this.toastService.success(`Statut mis à jour : ${status}`);
    } catch (error) {
      this.toastService.error('Erreur lors de la mise à jour');
    }
  }

  async deleteTheme(theme: Theme): Promise<void> {
    this.confirmService.confirm({
      title: 'Supprimer la thématique',
      message: `Êtes-vous sûr de vouloir supprimer "${theme.title}" ? Cette action est irréversible.`,
      type: 'danger',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          await this.themeService.deleteTheme(theme.id!);
          this.toastService.success('Thématique supprimée');
        } catch (error) {
          this.toastService.error('Erreur lors de la suppression');
        }
      },
    });
  }

  openThemeDetail(theme: Theme): void {
    this.themeDetail.open(theme);
  }

  editTheme(theme: Theme): void {
    this.form.patchValue({
      title: theme.title,
      category: theme.category,
      difficulty: theme.difficulty,
      description: theme.description,
      maxParticipants: theme.maxParticipants,
      tags: theme.tags?.join(', '),
    });
    this.showForm.set(true);
  }
}
