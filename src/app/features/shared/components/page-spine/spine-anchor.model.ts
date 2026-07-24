// features/shared/components/page-spine/spine-anchor.model.ts
export interface SpineAnchor {
  /** Doit correspondre à l'id de la section ciblée dans le DOM. */
  id: string;
  label: string;
  icon: string; // classe FontAwesome
}
