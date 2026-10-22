import { useCallback } from "react";
import { useTableController, useInputTableV2DirectInsert } from "~/hooks/input-table-v2";
import { useAppContext } from "~/contexts/app-context";
import { backendColFor, normalizeRow } from "~/utils/schema-mapper";
import type { EmailAttachmentPayload } from "~/hooks/email/use-emails";

const TABLE_ENV = "VITE_TABLE_EMAIL_DRAFT";

export interface DraftMessage {
  id: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  templateId: string;
  savedAt: string;
  attachments?: EmailAttachmentPayload[];
}

/** The compose modal's draft payload — a `DraftMessage` minus the server-owned `id` / `savedAt`. */
export type ComposeDraftPayload = Omit<DraftMessage, "id" | "savedAt">;

function parseDraftMessage(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && raw !== null) return raw as Record<string, unknown>;
  return {};
}

export function useDrafts() {
  const { user, envConfig } = useAppContext();
  const userId = user?.userId ?? "";
  const TABLE = envConfig.VITE_TABLE_EMAIL_DRAFT ?? "";

  const { items, update, remove } = useTableController<DraftMessage>({
    table: TABLE,
    env: TABLE_ENV,
    mapRow: (row) => {
      const r = normalizeRow(row, TABLE_ENV);
      const parsed = parseDraftMessage(r.draftMessage);
      return {
        id: String(r.id ?? ""),
        to: String(parsed.to ?? ""),
        cc: String(parsed.cc ?? ""),
        bcc: String(parsed.bcc ?? ""),
        subject: String(parsed.subject ?? ""),
        body: String(parsed.body ?? ""),
        templateId: String(parsed.templateId ?? "none"),
        savedAt: String(parsed.savedAt ?? ""),
        attachments: Array.isArray(parsed.attachments)
          ? (parsed.attachments as DraftMessage["attachments"])
          : undefined,
      };
    },
    where: [[backendColFor(TABLE_ENV, "userId"), "==", userId || "__none__"]],
    sort: (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
    messages: {
      update: "Draft updated",
      updateError: "Failed to save draft",
      remove: false, // silent delete
      removeError: "Failed to delete draft",
    },
  });

  // Bypass RxDB on insert so the POST body has no client-minted `id`.
  const directInsert = useInputTableV2DirectInsert<Record<string, unknown>>(TABLE, {
    successMessage: "Draft saved",
    errorMessage: "Failed to save draft",
    env: TABLE_ENV,
  });

  const saveDraft = useCallback(
    async (draftData: ComposeDraftPayload, existingDraftId?: string) => {
      if (!userId) return;
      const payload = { ...draftData, savedAt: new Date().toISOString() };
      if (existingDraftId) {
        await update(existingDraftId, { draftMessage: payload });
      } else {
        await directInsert.insert({ userId, draftMessage: payload });
      }
    },
    [directInsert, update, userId],
  );

  return { drafts: items, saveDraft, deleteDraft: remove };
}
