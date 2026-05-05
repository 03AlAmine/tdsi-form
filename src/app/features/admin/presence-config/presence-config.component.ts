import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  FormArray,
  FormGroup,
  Validators,
} from '@angular/forms';
import { AsyncPipe, DatePipe } from '@angular/common';
import { WorkshopService } from '../../../core/services/workshop.service';
import { Workshop, PresenceField } from '../../../core/model/models';

type FieldType =
  | 'text'
  | 'email'
  | 'select'
  | 'checkbox'
  | 'textarea'
  | 'number';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texte court' },
  { value: 'textarea', label: 'Texte long' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Nombre' },
  { value: 'select', label: 'Liste déroulante' },
  { value: 'checkbox', label: 'Case à cocher' },
];

@Component({
  selector: 'app-presence-config',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <div class="page">
      <div class="container">
        @if (loading) {
          <div class="loading-state"><div class="spinner"></div></div>
        } @else if (!workshop) {
          <div class="error-state">
            <span>❌</span>
            <p>Workshop introuvable.</p>
          </div>
        } @else {
          <div class="config-header animate-fadeUp">
            <button
              class="config-header__back btn btn--ghost btn--sm"
              (click)="router.navigate(['/admin/workshops'])"
            >
              ← Retour
            </button>
            <div class="config-header__info">
              <div
                class="font-mono text-xs text-muted"
                style="color:var(--cyan)"
              >
                CONFIGURATION FORMULAIRE DE PRÉSENCE
              </div>
              <h1 class="config-header__title">{{ workshop.themeTitle }}</h1>
              <p class="config-header__sub text-muted">
                {{ workshop.presenter }} ·
                {{ workshop.date | date: 'dd MMM yyyy HH:mm' }}
              </p>
            </div>

            <!-- Toggle activation -->
            <div class="toggle-row card">
              <div>
                <div class="toggle-row__label">Formulaire de présence</div>
                <div class="toggle-row__sub text-muted text-sm">
                  Activé = les étudiants voient le bouton "Présence" sur ce
                  workshop
                </div>
              </div>
              <button
                class="toggle"
                [class.toggle--on]="form.value.presenceFormEnabled"
                (click)="toggleEnabled()"
              >
                <span class="toggle__dot"></span>
              </button>
            </div>
          </div>

          @if (form.value.presenceFormEnabled) {
            <form
              [formGroup]="form"
              (ngSubmit)="save()"
              class="config-form animate-fadeUp"
            >
              <!-- Champs dynamiques -->
              <div class="section card">
                <div class="section__header">
                  <div>
                    <div class="section__title">Champs du formulaire</div>
                    <div class="section__sub text-muted text-sm">
                      Les champs Nom et Email sont toujours inclus
                      automatiquement.
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn btn--outline btn--sm"
                    (click)="addField()"
                  >
                    + Ajouter un champ
                  </button>
                </div>

                @if (fields.length === 0) {
                  <div class="fields-empty">
                    Aucun champ supplémentaire. Clique sur "Ajouter un champ".
                  </div>
                } @else {
                  <div class="fields-list">
                    @for (
                      field of fields.controls;
                      let i = $index;
                      track field.value.id
                    ) {
                      <div [formGroupName]="i" class="field-item">
                        <div class="field-item__drag">⠿</div>

                        <div class="field-item__body">
                          <div class="form-grid">
                            <div class="form-group">
                              <label class="form-label"
                                >Libellé<span class="form-required"
                                  >*</span
                                ></label
                              >
                              <input
                                formControlName="label"
                                type="text"
                                class="form-control"
                                placeholder="ex: Votre établissement"
                              />
                            </div>
                            <div class="form-group">
                              <label class="form-label">Type</label>
                              <select
                                formControlName="type"
                                class="form-control"
                              >
                                @for (t of fieldTypes; track t.value) {
                                  <option [value]="t.value">
                                    {{ t.label }}
                                  </option>
                                }
                              </select>
                            </div>
                          </div>

                          <div class="form-grid">
                            <div class="form-group">
                              <label class="form-label">Placeholder</label>
                              <input
                                formControlName="placeholder"
                                type="text"
                                class="form-control"
                                placeholder="Texte d'aide…"
                              />
                            </div>
                            <div
                              class="form-group"
                              style="justify-content:flex-end;flex-direction:row;align-items:center;gap:0.5rem;padding-top:1.5rem"
                            >
                              <label class="form-label" style="margin:0"
                                >Obligatoire</label
                              >
                              <input
                                formControlName="required"
                                type="checkbox"
                                style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer"
                              />
                            </div>
                          </div>

                          <!-- Options pour select -->
                          @if (getFieldValue(i, 'type') === 'select') {
                            <div class="form-group">
                              <label class="form-label"
                                >Options (une par ligne)</label
                              >
                              <textarea
                                formControlName="optionsText"
                                class="form-control"
                                rows="3"
                                placeholder="Option 1&#10;Option 2&#10;Option 3"
                              ></textarea>
                            </div>
                          }
                        </div>

                        <button
                          type="button"
                          class="field-item__remove btn btn--ghost btn--icon"
                          (click)="removeField(i)"
                        >
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            viewBox="0 0 24 24"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>

              @if (saved) {
                <div class="alert alert--success">
                  ✅ Configuration sauvegardée avec succès !
                </div>
              }
              @if (error) {
                <div class="alert alert--error">{{ error }}</div>
              }

              <div class="config-actions">
                <button
                  type="submit"
                  class="btn btn--primary"
                  [disabled]="saving"
                >
                  @if (saving) {
                    <span
                      class="spinner"
                      style="width:14px;height:14px;border-width:2px"
                    ></span>
                  }
                  Sauvegarder la configuration
                </button>
              </div>
            </form>
          } @else {
            <div class="disabled-notice card animate-fadeUp">
              <span>💤</span>
              <p>
                Active le formulaire de présence pour configurer ses champs.
              </p>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .loading-state,
      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 4rem 2rem;
        color: var(--text-2);
        text-align: center;
        span {
          font-size: 2rem;
        }
      }

      .config-header {
        max-width: 720px;
        margin: 0 auto;
        padding-top: 1.5rem;
        margin-bottom: 1.5rem;

        &__back {
          margin-bottom: 1rem;
        }
        &__title {
          font-size: 1.375rem;
          font-weight: 700;
          margin: 0.3rem 0 0.2rem;
        }
        &__sub {
          font-size: 0.875rem;
        }
      }

      .toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-top: 1rem;

        &__label {
          font-size: 0.9375rem;
          font-weight: 600;
        }
        &__sub {
          font-size: 0.8125rem;
          margin-top: 0.15rem;
        }
      }

      .toggle {
        width: 44px;
        height: 24px;
        border-radius: 12px;
        background: var(--bg-3);
        border: 1px solid var(--border);
        cursor: pointer;
        position: relative;
        transition:
          background var(--transition),
          border-color var(--transition);
        flex-shrink: 0;

        &--on {
          background: var(--accent);
          border-color: var(--accent);

          .toggle__dot {
            left: 22px;
          }
        }

        &__dot {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 18px;
          height: 18px;
          background: white;
          border-radius: 50%;
          transition: left var(--transition);
        }
      }

      .config-form {
        max-width: 720px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .section {
        &__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }
        &__title {
          font-size: 0.9375rem;
          font-weight: 600;
          margin-bottom: 0.2rem;
        }
        &__sub {
          font-size: 0.8125rem;
        }
      }

      .fields-empty {
        text-align: center;
        padding: 2rem;
        color: var(--text-3);
        font-size: 0.875rem;
        border: 1px dashed var(--border);
        border-radius: var(--radius-sm);
      }

      .fields-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .field-item {
        display: flex;
        gap: 0.75rem;
        background: var(--bg-2);
        border: 1px solid var(--border-light);
        border-radius: var(--radius-sm);
        padding: 1rem;

        &__drag {
          color: var(--text-3);
          cursor: grab;
          font-size: 1.125rem;
          padding-top: 0.25rem;
          flex-shrink: 0;
        }

        &__body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        &__remove {
          flex-shrink: 0;
          color: var(--text-3);
          &:hover {
            color: var(--red);
          }
        }
      }

      .config-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }

      .disabled-notice {
        max-width: 720px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        gap: 1rem;
        color: var(--text-2);
        font-size: 0.9375rem;

        span {
          font-size: 1.5rem;
        }
      }
    `,
  ],
})
export class PresenceConfigComponent implements OnInit {
  public router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private wsService = inject(WorkshopService);

  workshop: Workshop | null = null;
  loading = true;
  saving = false;
  saved = false;
  error = '';
  fieldTypes = FIELD_TYPES;

  form = this.fb.group({
    presenceFormEnabled: [false],
    fields: this.fb.array([]),
  });

  get fields() {
    return this.form.get('fields') as FormArray;
  }

  async ngOnInit() {
    const workshopId = this.route.snapshot.params['workshopId'];
    const workshops = await new Promise<Workshop[]>((res) => {
      this.wsService.getWorkshops().subscribe(res);
    });
    this.workshop = workshops.find((w) => w.id === workshopId) ?? null;

    if (this.workshop) {
      this.form.patchValue({
        presenceFormEnabled: this.workshop.presenceFormEnabled,
      });

      // Charger les champs existants
      if (this.workshop.presenceFormConfig?.fields) {
        for (const field of this.workshop.presenceFormConfig.fields) {
          this.fields.push(this.buildFieldGroup(field));
        }
      }
    }
    this.loading = false;
  }

  buildFieldGroup(field?: Partial<PresenceField>): FormGroup {
    return this.fb.group({
      id: [field?.id ?? this.genId()],
      label: [field?.label ?? '', Validators.required],
      type: [field?.type ?? 'text'],
      required: [field?.required ?? false],
      placeholder: [field?.placeholder ?? ''],
      optionsText: [field?.options?.join('\n') ?? ''],
    });
  }

  addField() {
    this.fields.push(this.buildFieldGroup());
  }

  removeField(i: number) {
    this.fields.removeAt(i);
  }

  getFieldValue(i: number, key: string) {
    return this.fields.at(i).get(key)?.value;
  }

  toggleEnabled() {
    const current = this.form.value.presenceFormEnabled;
    this.form.patchValue({ presenceFormEnabled: !current });
  }

  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.saved = false;
    this.error = '';

    const rawFields = this.form.value.fields as any[];
    const fields: PresenceField[] = rawFields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type as PresenceField['type'],
      required: f.required,
      placeholder: f.placeholder,
      options:
        f.type === 'select'
          ? f.optionsText
              .split('\n')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : undefined,
    }));

    try {
      await this.wsService.updateWorkshop(this.workshop!.id!, {
        presenceFormEnabled: this.form.value.presenceFormEnabled!,
        presenceFormConfig: {
          fields,
          requirePhoto: false,
          sendConfirmation: false,
        },
      });
      this.saved = true;
      setTimeout(() => (this.saved = false), 3000);
    } catch {
      this.error = 'Erreur lors de la sauvegarde. Réessaie.';
    } finally {
      this.saving = false;
    }
  }

  private genId(): string {
    return Math.random().toString(36).slice(2, 8);
  }
}
