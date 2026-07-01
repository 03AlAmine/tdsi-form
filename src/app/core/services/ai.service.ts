import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

// ═══════════════════════════════════════════════════════════════
// Interfaces de réponse — typées, plus de `any`
// ═══════════════════════════════════════════════════════════════

export interface ThemeCompletion {
  description: string;
  objectives: string;
  prerequisites: string;
  materialsNeeded: string;
  estimatedDuration: number;
}

export interface ThemeCategorization {
  category: string;
  difficulty: 'débutant' | 'intermédiaire' | 'avancé';
  tags: string[];
  description?: string;
}

export interface ThemeRecommendation {
  themeId: string;
  score: number;
  reason: string;
}

export interface SubmissionSummary {
  resume: string;
  verdict: 'fort' | 'moyen' | 'faible';
  points_forts: string[];
  points_faibles: string[];
  suggestion_commentaire: string;
}

export interface ThemeEnrichment {
  objectives: string[];
  prerequisites: string[];
  materials: string[];
  skills: string[];
}

export interface WorkshopEnrichment {
  objectives: string[];
  prerequisites: string[];
  skills: string[];
  outcomes: string[];
}

// Typage de la réponse brute de l'API (Groq / OpenAI-compatible)
interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// ═══════════════════════════════════════════════════════════════
// AiService
// ═══════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class AiService {

  // URL du backend proxy (jamais l'URL Groq directement)
  private readonly API_URL = `${environment.apiUrl}/api/ai`;

  // ── Cache ────────────────────────────────────────────────────
  // Évite de rappeler le backend pour la même requête
  private cache = new Map<string, { data: unknown; ts: number }>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  // ── File d'attente ────────────────────────────────────────────
  // Une seule requête à la fois pour ne pas saturer le backend
  private queue: Array<() => Promise<void>> = [];
  private running = false;

  // ── Rate limiting ─────────────────────────────────────────────
  // Groq free tier : max ~15 req/min → 1 req toutes les 4s
  private lastCallAt = 0;
  private readonly MIN_DELAY = 4000;

  // ════════════════════════════════════════════════════════════
  // Méthodes privées — infrastructure
  // ════════════════════════════════════════════════════════════

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, ts: Date.now() });
  }

  /** Vide tout le cache (utile si le contexte utilisateur change) */
  clearCache(): void {
    this.cache.clear();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  /**
   * Appelle le backend proxy en respectant le rate limit.
   * Les requêtes sont mises en file d'attente — une seule à la fois.
   */
  private async throttledFetch(body: object): Promise<LLMResponse> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const elapsed = Date.now() - this.lastCallAt;
          if (elapsed < this.MIN_DELAY) {
            await this.sleep(this.MIN_DELAY - elapsed);
          }

          const res = await fetch(this.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // La clé API Groq n'est PLUS ici — elle est dans le backend
            body: JSON.stringify(body)
          });

          this.lastCallAt = Date.now();

          if (res.status === 429) {
            console.warn('[AI] Rate limit atteint — attente 10s');
            await this.sleep(10_000);
            reject(new Error('Rate limit'));
            return;
          }

          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`Backend AI ${res.status}: ${errText}`);
          }

          resolve(await res.json() as LLMResponse);
        } catch (err) {
          reject(err);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await task();
    }
    this.running = false;
  }

  /**
   * Méthode centrale : appelle le LLM, parse le JSON de réponse
   * de façon robuste, gère le cache.
   */
  private async callLLM<T>(
    system: string,
    user: string,
    maxTokens = 800,
    cacheKey?: string,
    temperature = 0.7
  ): Promise<T> {
    // 1. Cache hit ?
    if (cacheKey) {
      const cached = this.getCached<T>(cacheKey);
      if (cached) {
        console.debug(`[AI] Cache hit: ${cacheKey}`);
        return cached;
      }
    }

    // 2. Appel backend
    const data = await this.throttledFetch({
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   }
      ],
      temperature,
      max_tokens: maxTokens
    });

    // 3. Extraction du contenu texte
    const raw: string = data?.choices?.[0]?.message?.content ?? '';

    // 4. Parse JSON robuste — gère les backticks, le texte avant/après
    const result = this.parseJSON<T>(raw);

    // 5. Mise en cache
    if (cacheKey) {
      this.setCache(cacheKey, result);
    }

    return result;
  }

  /**
   * Parse JSON de façon robuste :
   * - Retire les balises ```json ... ```
   * - Tente d'extraire un objet ou tableau JSON si du texte parasite est présent
   * - Lève une erreur descriptive si tout échoue
   */
  private parseJSON<T>(raw: string): T {
    // Nettoyage basique : enlever les blocs markdown
    const clean = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Tentative directe
    try {
      return JSON.parse(clean) as T;
    } catch {
      // Tentative d'extraction : chercher le premier { } ou [ ] complet
      const objectMatch = clean.match(/\{[\s\S]*\}/);
      const arrayMatch  = clean.match(/\[[\s\S]*\]/);

      // Préférer le tableau s'il commence avant l'objet
      const objIndex   = objectMatch ? clean.indexOf(objectMatch[0]) : Infinity;
      const arrayIndex = arrayMatch  ? clean.indexOf(arrayMatch[0])  : Infinity;

      const candidate = arrayIndex < objIndex
        ? arrayMatch![0]
        : objectMatch?.[0];

      if (candidate) {
        try {
          return JSON.parse(candidate) as T;
        } catch {
          // Dernière tentative — on continue vers l'erreur
        }
      }

      console.error('[AI] Réponse non parseable:', raw.slice(0, 200));
      throw new Error(`[AI] Impossible de parser la réponse JSON du modèle.`);
    }
  }

  // ════════════════════════════════════════════════════════════
  // AXE 1 — Auto-complétion du formulaire de proposition
  // ════════════════════════════════════════════════════════════

  async completeThemeForm(
    title: string,
    category: string,
    promo: string
  ): Promise<ThemeCompletion> {
    const key = `complete:${title.toLowerCase().trim()}:${category}`;

    return this.callLLM<ThemeCompletion>(
      `Tu es un assistant pédagogique pour le Club TDSI (cybersécurité, réseaux, IA) à l'UCAD Dakar.
Niveau des participants : ${promo}.
Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans markdown.`,
      `Génère le contenu complet pour un workshop intitulé "${title}" dans la catégorie "${category}".
Retourne exactement ce JSON :
{
  "description": "3-4 phrases descriptives (80 à 100 mots, 480 caractères MAXIMUM — c'est une limite stricte, ne pas dépasser)",
  "objectives": "3 objectifs séparés par des retours à la ligne, formulés avec 'À la fin, le participant saura...'",
  "prerequisites": "liste des prérequis nécessaires",
  "materialsNeeded": "outils et logiciels nécessaires",
  "estimatedDuration": 90
}`,
      600,
      key
    );
  }

  // ── Suggestions de titres ─────────────────────────────────────

  async suggestTitles(partial: string, category: string): Promise<string[]> {
    if (partial.trim().length < 4) return [];

    // Clé normalisée sur les 8 premiers caractères pour maximiser les hits cache
    const normalized = partial.toLowerCase().trim().slice(0, 8);
    const key = `suggest:${normalized}:${category}`;

    return this.callLLM<string[]>(
      `Tu proposes des titres de workshops pour le Club TDSI (cybersécurité, réseaux, IA).
Réponds UNIQUEMENT avec un tableau JSON de 4 chaînes courtes, sans texte avant ni après, sans markdown.`,
      `Complète ce début de titre : "${partial}"
Catégorie : "${category || 'non définie'}"
Retourne exactement : ["titre1", "titre2", "titre3", "titre4"]`,
      150,
      key,
      0.8 // légèrement plus créatif pour les suggestions
    );
  }

  // ════════════════════════════════════════════════════════════
  // AXE 2 — Recommandations personnalisées
  // ════════════════════════════════════════════════════════════

  async getPersonalizedRecommendations(
    userProfile: {
      promo: string;
      registeredCategories: string[];
      submittedCategories: string[];
      attendedThemes: string[];
    },
    availableThemes: Array<{
      id: string;
      title: string;
      category: string;
      difficulty: string;
      description: string;
    }>
  ): Promise<ThemeRecommendation[]> {
    if (!availableThemes.length) return [];

    // Clé stable basée sur le profil — pas sur les thèmes (qui changent peu)
    const key = `reco:${userProfile.promo}:${[...userProfile.registeredCategories].sort().join(',')}`;

    const themeList = availableThemes
      .map(t => `${t.id}|${t.title}|${t.category}|${t.difficulty}`)
      .join('\n');

    return this.callLLM<ThemeRecommendation[]>(
      `Tu es conseiller pédagogique au Club TDSI de l'UCAD Dakar.
Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ni après, sans markdown.`,
      `Profil de l'étudiant :
- Promotion : ${userProfile.promo}
- Catégories déjà suivies : ${userProfile.registeredCategories.join(', ') || 'aucune'}
- Thématiques proposées : ${userProfile.submittedCategories.join(', ') || 'aucune'}
- Thèmes déjà assistés : ${userProfile.attendedThemes.join(', ') || 'aucun'}

Thématiques disponibles (id|titre|catégorie|difficulté) :
${themeList}

Sélectionne les 3 thématiques les plus pertinentes pour ce profil.
Retourne exactement :
[
  { "themeId": "id", "score": 95, "reason": "1 phrase de justification" },
  { "themeId": "id", "score": 88, "reason": "1 phrase de justification" },
  { "themeId": "id", "score": 76, "reason": "1 phrase de justification" }
]`,
      400,
      key,
      0.4 // plus déterministe pour les recommandations
    );
  }

  // ════════════════════════════════════════════════════════════
  // AXE 3 — Catégorisation automatique (admin)
  // ════════════════════════════════════════════════════════════

  async categorizeTheme(
    title: string,
    description: string
  ): Promise<ThemeCategorization> {
    const key = `cat:${title.toLowerCase().trim().slice(0, 25)}`;

    const categories = [
      'Sécurité Réseau',
      'Cryptographie',
      'Transmission de Données',
      'Intelligence Artificielle',
      'Développement Web',
      'Cloud & DevOps',
      'Autre'
    ];

    return this.callLLM<ThemeCategorization>(
      `Tu analyses des propositions de workshops pour le Club TDSI.
Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans markdown.`,
      `Titre : "${title}"
Description : "${description || 'non fournie'}"

Catégories disponibles : ${categories.join(', ')}

Retourne exactement :
{
  "category": "une des catégories listées",
  "difficulty": "débutant" ou "intermédiaire" ou "avancé",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "description": "description enrichie si vide, sinon telle quelle"
}`,
      300,
      key,
      0.3 // très déterministe pour la catégorisation
    );
  }

  // ════════════════════════════════════════════════════════════
  // AXE 4 — Résumé et évaluation de soumission (admin)
  // ════════════════════════════════════════════════════════════

  async summarizeSubmission(s: {
    proposedTitle: string;
    category: string;
    description: string;
    objectives: string;
    prerequisites: string;
    materialsNeeded: string;
    estimatedDuration: number;
    studentName: string;
    promo: string;
  }): Promise<SubmissionSummary> {
    const key = `summary:${s.proposedTitle.toLowerCase().trim().slice(0, 25)}`;

    return this.callLLM<SubmissionSummary>(
      `Tu évalues des propositions de workshops soumises par des étudiants du Club TDSI.
Sois objectif et constructif. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown.`,
      `Titre : "${s.proposedTitle}" | Catégorie : ${s.category}
Étudiant : ${s.studentName} (${s.promo}) | Durée estimée : ${s.estimatedDuration} min
Description : ${s.description}
Objectifs : ${s.objectives}
Prérequis : ${s.prerequisites || 'non spécifiés'}
Matériels : ${s.materialsNeeded || 'non spécifiés'}

Retourne exactement :
{
  "resume": "1-2 phrases neutres résumant la proposition",
  "verdict": "fort" ou "moyen" ou "faible",
  "points_forts": ["point 1", "point 2"],
  "points_faibles": ["point 1"],
  "suggestion_commentaire": "commentaire constructif de 50 à 80 mots pour l'étudiant"
}`,
      500,
      key,
      0.4
    );
  }

  // ════════════════════════════════════════════════════════════
  // Enrichissement de thématique (page détail)
  // ════════════════════════════════════════════════════════════

  async enrichThemeContent(
    title: string,
    description: string,
    category: string
  ): Promise<ThemeEnrichment> {
    const key = `enrich:theme:${title.toLowerCase().trim().slice(0, 30)}`;

    return this.callLLM<ThemeEnrichment>(
      `Tu es un expert pédagogique au Club TDSI. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown.`,
      `Enrichis cette thématique :
Titre : "${title}"
Catégorie : ${category}
Description : ${description}

Retourne exactement :
{
  "objectives": ["obj1", "obj2", "obj3"],
  "prerequisites": ["preq1", "preq2"],
  "materials": ["outil1", "outil2"],
  "skills": ["compétence1", "compétence2", "compétence3"]
}`,
      400,
      key
    );
  }

  // ════════════════════════════════════════════════════════════
  // Enrichissement de workshop (drawer détail)
  // ════════════════════════════════════════════════════════════

  async enrichWorkshopContent(
    title: string,
    description: string,
    category: string
  ): Promise<WorkshopEnrichment> {
    const key = `enrich:workshop:${title.toLowerCase().trim().slice(0, 30)}`;

    return this.callLLM<WorkshopEnrichment>(
      `Tu es un expert pédagogique au Club TDSI. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown.`,
      `Enrichis ce workshop :
Titre : "${title}"
Catégorie : ${category}
Description : ${description}

Retourne exactement :
{
  "objectives": ["obj1", "obj2", "obj3"],
  "prerequisites": ["preq1", "preq2"],
  "skills": ["skill1", "skill2", "skill3"],
  "outcomes": ["bénéfice1", "bénéfice2", "bénéfice3"]
}`,
      400,
      key
    );
  }
}
