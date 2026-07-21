// core/services/enrichment.service.ts
// ─────────────────────────────────────────────────────────────────────
// Enrichissement IA persisté en Firestore.
//
// Avant : chaque utilisateur qui ouvrait un drawer déclenchait un appel
// au backend IA (latence 2-6s, quota Groq consommé, cache client 10 min
// seulement). Après : l'enrichissement est généré UNE fois, écrit dans
// le document Firestore (`aiEnrichment`), et servi instantanément à
// tous les visiteurs suivants — il arrive même déjà chargé avec le
// listing via onSnapshot, donc zéro requête supplémentaire.
//
// Invalidation : un hash du contenu source (titre/description) est
// stocké à côté (`aiEnrichmentHash`). Si l'admin modifie le titre ou la
// description, le hash ne correspond plus → régénération au prochain
// affichage.
//
// Droits d'écriture : la persistance est en best-effort. Si les rules
// Firestore refusent l'écriture (visiteur, membre sans droit), on
// retourne quand même l'enrichissement pour la session en cours — le
// premier utilisateur autorisé le persistera. Voir le snippet de rules
// recommandé dans la documentation de déploiement.
// ─────────────────────────────────────────────────────────────────────

import { Injectable, inject } from '@angular/core';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase.config';
import { AiService } from './ai.service';
import { AiEnrichmentData, Theme, Workshop } from '../model/models';

@Injectable({ providedIn: 'root' })
export class EnrichmentService {
  private ai = inject(AiService);

  // ── API publique ─────────────────────────────────────────────────

  /**
   * Enrichissement d'un workshop.
   * Retourne la version persistée si elle est à jour, sinon génère,
   * persiste (best-effort) et retourne.
   */
  async forWorkshop(w: Workshop): Promise<AiEnrichmentData> {
    const hash = this.hash(w.themeTitle);

    if (w.aiEnrichment && w.aiEnrichmentHash === hash) {
      return w.aiEnrichment; // ⚡ déjà en base — zéro appel IA
    }

    const r = await this.ai.enrichWorkshopContent(
      w.themeTitle,
      w.themeTitle,
      '',
    );
    const data: AiEnrichmentData = {
      objectives: r.objectives ?? [],
      prerequisites: r.prerequisites ?? [],
      skills: r.skills ?? [],
      outcomes: r.outcomes ?? [],
    };

    if (w.id) this.persist('workshops', w.id, data, hash);
    return data;
  }

  /**
   * Enrichissement d'une thématique.
   * Même mécanique que forWorkshop.
   */
  async forTheme(t: Theme): Promise<AiEnrichmentData> {
    const hash = this.hash(t.title, t.description, t.category);

    if (t.aiEnrichment && t.aiEnrichmentHash === hash) {
      return t.aiEnrichment;
    }

    const r = await this.ai.enrichThemeContent(
      t.title,
      t.description,
      t.category,
    );
    const data: AiEnrichmentData = {
      objectives: r.objectives ?? [],
      prerequisites: r.prerequisites ?? [],
      skills: r.skills ?? [],
      materials: r.materials ?? [],
    };

    if (t.id) this.persist('themes', t.id, data, hash);
    return data;
  }

  // ── Interne ──────────────────────────────────────────────────────

  /**
   * Écriture Firestore en best-effort : jamais bloquante, jamais
   * d'erreur remontée à l'UI. Si les rules refusent (permissions),
   * l'enrichissement reste valable pour la session — le premier
   * utilisateur autorisé le persistera pour tout le monde.
   */
  private persist(
    collection: 'workshops' | 'themes',
    id: string,
    data: AiEnrichmentData,
    hash: string,
  ): void {
    updateDoc(doc(db, collection, id), {
      aiEnrichment: data,
      aiEnrichmentHash: hash,
      aiEnrichmentAt: Timestamp.now(),
    }).catch(() => {
      console.debug(
        `[Enrichment] Persistance refusée pour ${collection}/${id} ` +
          '(rules) — enrichissement servi en session uniquement.',
      );
    });
  }

  /**
   * Empreinte djb2 (hex) du contenu source. Suffisant pour détecter
   * un changement de titre/description — pas un usage cryptographique.
   */
  private hash(...parts: string[]): string {
    const input = parts.join('|');
    let h = 5381;
    for (let i = 0; i < input.length; i++) {
      h = ((h << 5) + h + input.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16);
  }
}
