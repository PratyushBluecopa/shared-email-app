import { useCallback } from "react";
import {
  useGetAllConversations,
  useCreateConversation,
  useReplyToConversation,
  useFilterMessagesBySenderId,
  useUpdateConversationReadStatus,
} from "@bluecopa/react";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import { useAppContext } from "~/contexts/app-context";

export interface EmailAttachmentPayload {
  filename: string;
  content: string;
  content_type: string;
}

/**
 * Replace every `.ql-code-block-container` (and orphan `.ql-code-block`) with
 * its `textContent`. `textContent` decodes entities, so a pasted
 * `&lt;!DOCTYPE html&gt;…` block collapses back to raw HTML text, which the
 * `&lt;` → `<` decode chain in `ensureHtml` then unwraps.
 */
function unwrapQuillCodeBlocks(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.querySelectorAll(".ql-code-block-container").forEach((container) => {
    container.replaceWith(doc.createTextNode(container.textContent ?? ""));
  });
  doc.querySelectorAll(".ql-code-block").forEach((cb) => {
    cb.replaceWith(doc.createTextNode(cb.textContent ?? ""));
  });
  return doc.body.innerHTML;
}

/** Ensure body is always valid, sanitized HTML before sending to the API. */
export function ensureHtml(body: string): string {
  if (!body || !body.trim()) return "";

  // HTML-escaped tags (e.g. `&lt;h2&gt;` from pasting raw HTML into an editor).
  if (/&lt;[a-z/!][\s\S]*?&gt;/i.test(body)) {
    const unwrapped =
      typeof DOMParser !== "undefined" && body.includes("ql-code-block")
        ? unwrapQuillCodeBlocks(body)
        : body;
    const decoded = unwrapped
      .replace(/<p[^>]*>/gi, "")
      .replace(/<\/p>/gi, "")
      .replace(/<br\s*\/?>/gi, "")
      .replace(/<span[^>]*>/gi, "")
      .replace(/<\/span>/gi, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .trim();
    // Full-document emails need WHOLE_DOCUMENT or DOMPurify strips
    // `<!DOCTYPE>` / `<html>` / `<head>` / `<body>`.
    const isFullDoc =
      decoded.toLowerCase().startsWith("<!doctype") || decoded.toLowerCase().startsWith("<html");
    return DOMPurify.sanitize(decoded, isFullDoc ? { WHOLE_DOCUMENT: true } : {});
  }

  // Already HTML — sanitize (keeping full-document structure when present).
  if (/<[a-z][\s\S]*>/i.test(body)) {
    const trimmed = body.trim().toLowerCase();
    const isFullDoc = trimmed.startsWith("<!doctype") || trimmed.startsWith("<html");
    return DOMPurify.sanitize(body, isFullDoc ? { WHOLE_DOCUMENT: true } : {});
  }

  // Plain text — one `<p>` per line.
  return body
    .split(/\n/)
    .map((line) => (line.trim() ? `<p>${DOMPurify.sanitize(line)}</p>` : "<p><br></p>"))
    .join("");
}

export function isEmptyHtml(html: string | null | undefined): boolean {
  if (!html) return true;
  const text = html
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim();
  if (text) return false;
  return !/<(img|hr|table|iframe)\b/i.test(html);
}

export function useEmails(
  page: number = 1,
  pageSize: number = 20,
  sentPage: number = 1,
  sentPageSize: number = 20,
) {
  const { user, emailAccount } = useAppContext();
  const senderEmail = user?.email ?? "";
  const accountId = emailAccount?.id ?? "";

  // --- 1. Conversations (inbox list) ---
  const {
    data: conversationsResponse,
    isLoading,
    error: queryError,
    refetch,
  } = useGetAllConversations({ page, pageSize } as any);

  const conversations = Array.isArray(conversationsResponse)
    ? conversationsResponse
    : ((conversationsResponse as any)?.content ?? (conversationsResponse as any)?.conversations ?? []);

  const pagination = {
    pageNumber: (conversationsResponse as any)?.pageNumber ?? 1,
    pageSize: (conversationsResponse as any)?.pageSize ?? pageSize,
    totalPages: (conversationsResponse as any)?.totalPages ?? 1,
    totalElements: (conversationsResponse as any)?.totalElements ?? conversations.length,
    isLast: (conversationsResponse as any)?.isLast ?? true,
  };

  // --- 2. Create conversation (compose / forward) ---
  const createMutation = useCreateConversation({
    onSuccess: () => {
      toast.success("Email sent successfully");
    },
    onError: (error: any) => {
      console.error("[useEmails] createConversation error:", error);
      toast.error(`Failed to send email: ${error?.message || "Unknown error"}`);
    },
  });

  const createConversation = useCallback(
    async (params: {
      toEmail: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      bodyHtml: string;
      attachments?: EmailAttachmentPayload[];
    }) => {
      if (!senderEmail) {
        toast.error("User email is unavailable. Please sign in again.");
        throw new Error("senderEmail is required to create a conversation");
      }

      // First 100 characters of plain text for messagePreview.
      const messagePreview = params.bodyHtml
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 100);

      const request: Record<string, any> = {
        toEmail: params.toEmail,
        subject: params.subject,
        bodyHtml: params.bodyHtml,
        accountId,
        senderId: senderEmail,
        messagePreview,
      };
      if (params.cc?.length) request.cc = params.cc;
      if (params.bcc?.length) request.bcc = params.bcc;
      if (params.attachments?.length) request.attachments = params.attachments;

      return createMutation.mutateAsync(request as any);
    },
    [createMutation, senderEmail, accountId],
  );

  // --- 3. Reply to conversation ---
  const replyMutation = useReplyToConversation({
    onSuccess: () => {
      toast.success("Reply sent successfully");
    },
    onError: (error: any) => {
      console.error("[useEmails] replyToConversation error:", error);
      toast.error(`Failed to send reply: ${error?.message || "Unknown error"}`);
    },
  });

  const replyToConversation = useCallback(
    async (
      conversationId: string,
      bodyHtml: string,
      attachments?: EmailAttachmentPayload[],
      toEmail?: string[],
    ) => {
      if (!senderEmail) {
        toast.error("User email is unavailable. Please sign in again.");
        throw new Error("senderEmail is required to reply to a conversation");
      }
      const request: Record<string, any> = {
        conversationId,
        accountId,
        senderId: senderEmail,
        toEmail: toEmail ?? [],
        bodyHtml,
      };
      if (attachments?.length) request.attachments = attachments;
      return replyMutation.mutateAsync(request as any);
    },
    [replyMutation, senderEmail, accountId],
  );

  // --- 4. Sent folder: messages filtered by sender ---
  const {
    data: sentResponse,
    refetch: refetchSent,
  } = useFilterMessagesBySenderId({
    senderId: senderEmail,
    direction: "OUTBOUND",
    page: sentPage,
    pageSize: sentPageSize,
    orderByCreatedDate: true,
  } as any);

  const sentMessages = Array.isArray(sentResponse)
    ? sentResponse
    : ((sentResponse as any)?.content ?? (sentResponse as any)?.data ?? (sentResponse as any)?.messages ?? []);

  const sentPagination = {
    pageNumber: (sentResponse as any)?.pageNumber ?? 1,
    pageSize: (sentResponse as any)?.pageSize ?? sentPageSize,
    totalPages: (sentResponse as any)?.totalPages ?? 1,
    totalElements: (sentResponse as any)?.totalElements ?? sentMessages.length,
    isLast: (sentResponse as any)?.isLast ?? true,
  };

  // Read state lives on the conversation, so marking one read clears the
  // unread styling for everyone sharing the inbox.
  const readStatusMutation = useUpdateConversationReadStatus({
    onError: (error: any) => {
      // Non-blocking: the email still opens, it just stays bold until the next refetch.
      console.error("[useEmails] updateConversationReadStatus error:", error);
    },
  });

  const markConversationRead = useCallback(
    (conversationId: string) => {
      if (!conversationId) return;
      readStatusMutation.mutate({ conversationId, readStatus: "READ" });
    },
    [readStatusMutation],
  );

  return {
    conversations,
    pagination,
    markConversationRead,
    loading: isLoading,
    error: queryError,
    createConversation,
    replyToConversation,
    refetch,
    sentMessages,
    sentPagination,
    refetchSent,
  };
}
