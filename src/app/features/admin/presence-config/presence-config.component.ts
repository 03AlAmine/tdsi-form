import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormArray, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkshopService } from '../../../core/services/workshop.service';
import { Workshop, PresenceField } from '../../../core/model/models';
import { db } from '../../../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';

type FieldType = 'text' | 'email' | 'select' | 'checkbox' | 'textarea' | 'number';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text',     label: 'Texte court' },
  { value: 'textarea', label: 'Texte long' },
  { value: 'email',    label: 'Email' },
  { value: 'number',   label: 'Nombre' },
  { value: 'select',   label: 'Liste déroulante' },
  { value: 'checkbox', label: 'Case à cocher' },
];

@Component({
  selector: 'app-presence-config',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './presence-config.component.html',
  styleUrls: ['./presence-config.component.scss']
})
export class PresenceConfigComponent implements OnInit {
  router = inject(Router);
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

    // Lecture unique du document — pas de listener temps réel, pas de fuite mémoire
    const snap = await getDoc(doc(db, 'workshops', workshopId));

    if (snap.exists()) {
      const data: any = snap.data();
      this.workshop = {
        ...data,
        id: snap.id,
        date:      data['date']?.toDate?.()      ?? new Date(),
        createdAt: data['createdAt']?.toDate?.() ?? new Date(),
      } as Workshop;

      this.form.patchValue({
        presenceFormEnabled: this.workshop.presenceFormEnabled,
      });

      if (this.workshop.presenceFormConfig?.fields?.length) {
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
      options: f.type === 'select'
        ? f.optionsText.split('\n').map((s: string) => s.trim()).filter(Boolean)
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
