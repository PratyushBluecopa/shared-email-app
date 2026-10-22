import { useCallback } from "react";
import { useTableController, useInputTableV2DirectInsert } from "~/hooks/input-table-v2";
import { useAppContext } from "~/contexts/app-context";
import { normalizeRow } from "~/utils/schema-mapper";

const TABLE_ENV = "VITE_TABLE_SIGNATURE";

interface SignatureRow {
  id: string;
  signature: string;
}

function parseSignatureHtml(template: unknown): string {
  if (template == null || template === "") return "";
  if (typeof template === "string" && template.startsWith("{")) {
    try {
      template = JSON.parse(template);
    } catch {
      /* keep as string */
    }
  }
  if (typeof template === "object" && template !== null) {
    const t = template as Record<string, unknown>;
    return String(t.html || t.signature || "");
  }
  return String(template);
}

/** The shared signature: the first row of the signature table. */
export function useSignature() {
  const { envConfig } = useAppContext();
  const TABLE = envConfig.VITE_TABLE_SIGNATURE ?? "";

  const { items, isLoading, update, isSaving } = useTableController<SignatureRow>({
    table: TABLE,
    env: TABLE_ENV,
    mapRow: (row) => {
      const r = normalizeRow(row, TABLE_ENV);
      return { id: String(r.id ?? ""), signature: parseSignatureHtml(r.signatureTemplate) };
    },
    messages: {
      update: "Signature updated",
      updateError: "Failed to save signature",
    },
  });

  const directInsert = useInputTableV2DirectInsert<Record<string, unknown>>(TABLE, {
    successMessage: "Signature saved",
    errorMessage: "Failed to save signature",
    env: TABLE_ENV,
  });

  const signatureRow = items[0] ?? null;

  const saveSignature = useCallback(
    async (signatureHtml: string) => {
      if (signatureRow) {
        await update(signatureRow.id, { signatureTemplate: { html: signatureHtml } });
      } else {
        await directInsert.insert({ signatureTemplate: { html: signatureHtml } });
      }
    },
    [directInsert, update, signatureRow],
  );

  return {
    signature: signatureRow?.signature ?? "",
    isLoading,
    saveSignature,
    isSaving: isSaving || directInsert.isPending,
  };
}
