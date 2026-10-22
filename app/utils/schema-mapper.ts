// Maps input-table rows between backend column names and camelCase frontend
// keys. Each top-level key is the `VITE_*` env var naming the table; inside it
// the mapping is `backend_column → frontendCamelCase`. The host-injected
// `schemaMap` (see AppProvider) wins per table over the bundled defaults below.
import type { SchemaMap } from "~/types";

const DEFAULT_SCHEMA_MAP: SchemaMap = {
  VITE_TABLE_EMAIL_DRAFT: {
    id: "id",
    user_id: "userId",
    draft_message: "draftMessage",
  },
  VITE_TABLE_EMAIL_TEMPLATE: {
    id: "id",
    created_at: "createdAt",
    updated_at: "updatedAt",
    email_body: "emailBody",
    email_subject: "emailSubject",
    template_name: "templateName",
    template_engine: "templateEngine",
    template_category: "templateCategory",
  },
  VITE_TABLE_SIGNATURE: {
    id: "id",
    account_id: "accountId",
    signature_template: "signatureTemplate",
  },
};

let activeSchemaMap: SchemaMap = DEFAULT_SCHEMA_MAP;

/** Called by AppProvider with the host map; host entries override the defaults per table. */
export function setActiveSchemaMap(hostMap: SchemaMap): void {
  activeSchemaMap = { ...DEFAULT_SCHEMA_MAP, ...hostMap };
}

function mapFor(env: string): Record<string, string> {
  return activeSchemaMap[env] ?? {};
}

/** Raw backend row → camelCase row. Unmapped columns are dropped. */
export function normalizeRow(row: Record<string, unknown>, env: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [backend, frontend] of Object.entries(mapFor(env))) {
    if (!(frontend in out) && Object.prototype.hasOwnProperty.call(row, backend)) {
      out[frontend] = row[backend];
    }
  }
  return out;
}

/** camelCase write payload → backend columns. Unmapped keys pass through. */
export function denormalizeRow(camelRow: Record<string, unknown>, env: string): Record<string, unknown> {
  const reverse: Record<string, string> = {};
  for (const [backend, frontend] of Object.entries(mapFor(env))) {
    if (!(frontend in reverse)) reverse[frontend] = backend;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(camelRow)) out[reverse[key] ?? key] = value;
  return out;
}

/** Backend column for a frontend key (falls back to the key itself). */
export function backendColFor(env: string, frontendKey: string): string {
  for (const [backend, frontend] of Object.entries(mapFor(env))) {
    if (frontend === frontendKey) return backend;
  }
  return frontendKey;
}
