import { useCallback } from "react";
import { useTableController, useInputTableV2DirectInsert } from "~/hooks/input-table-v2";
import { useAppContext } from "~/contexts/app-context";
import { normalizeRow } from "~/utils/schema-mapper";
import type { TemplateEngine } from "~/utils/render-template";

const TABLE_ENV = "VITE_TABLE_EMAIL_TEMPLATE";

export interface TemplateRow {
  id: string;
  template_name: string;
  template_category: string;
  template_engine: TemplateEngine;
  email_subject: string;
  email_body: string;
}

/** Canonical camelCase write payload (translated to backend columns by `env`). */
type TemplateWritePayload = {
  templateName?: string;
  templateCategory?: string;
  templateEngine?: TemplateEngine;
  emailSubject?: string;
  emailBody?: string;
};

export function useEmailTemplates() {
  const { envConfig } = useAppContext();
  const TABLE = envConfig.VITE_TABLE_EMAIL_TEMPLATE ?? "";

  const { items, isLoading, update, remove, isSaving, refetch } = useTableController<TemplateRow>({
    table: TABLE,
    env: TABLE_ENV,
    mapRow: (row) => {
      const r = normalizeRow(row, TABLE_ENV);
      // Engine defaults to `jinja` (the platform default; `{{var}}` parses
      // identically in both engines).
      const engine: TemplateEngine =
        String(r.templateEngine ?? "").toLowerCase() === "mustache" ? "mustache" : "jinja";
      return {
        id: String(r.id ?? ""),
        template_name: String(r.templateName ?? ""),
        template_category: String(r.templateCategory ?? ""),
        template_engine: engine,
        email_subject: String(r.emailSubject ?? ""),
        email_body: String(r.emailBody ?? ""),
      };
    },
    messages: {
      update: "Template updated",
      remove: "Template deleted",
      updateError: "Failed to update template",
      removeError: "Failed to delete template",
    },
  });

  // Direct insert so the server generates the primary key.
  const directInsert = useInputTableV2DirectInsert<TemplateWritePayload>(TABLE, {
    successMessage: "Template created",
    errorMessage: "Failed to create template",
    env: TABLE_ENV,
  });

  const createTemplate = useCallback(
    (data: TemplateWritePayload) => directInsert.insert(data),
    [directInsert],
  );

  const updateTemplate = useCallback(
    (id: string, patch: TemplateWritePayload) => update(id, patch),
    [update],
  );

  return {
    templates: items,
    isLoading,
    refetch,
    createTemplate,
    updateTemplate,
    deleteTemplate: remove,
    isSaving: isSaving || directInsert.isPending,
  };
}
