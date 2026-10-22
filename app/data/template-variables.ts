// Placeholder keys `buildTemplateData()` in `compose-email-modal.tsx` ships to
// `/templates/render`. Add a key here whenever that function gains one, so
// authors can pick it from the template editor's "Insert Placeholder" menu.

export interface TemplateVariable {
  /** Key shipped in the render request `data` — used inside `{{ ... }}`. */
  key: string;
  /** Human label shown in the placeholder picker. */
  label: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: "poc_name", label: "Sender Name" },
  { key: "poc_email", label: "Sender Email" },
];
