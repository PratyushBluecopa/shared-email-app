import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { copaApi } from "@bluecopa/react";
import { toast } from "sonner";
import PostalMime from "postal-mime";
import {
  Send, X, Paperclip, Loader2,
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Link as LinkIcon, RemoveFormatting, Undo2, Redo2,
  AlignLeft, AlignCenter, AlignRight, IndentIncrease, IndentDecrease, Baseline,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "~/components/ui/dialog";
import { useAppContext } from "~/contexts/app-context";
import { ensureHtml, isEmptyHtml, type EmailAttachmentPayload } from "~/hooks/email/use-emails";
import type { ComposeDraftPayload } from "~/hooks/email/use-drafts";
import { useEmailTemplates } from "~/hooks/settings/use-email-templates";
import { useSignature } from "~/hooks/settings/use-signature";
import { renderTemplate } from "~/utils/render-template";
import type { ReplyMode } from "~/components/email/email-detail";

// Pull a useful, user-facing error out of a `/templates/render` failure.
// `renderTemplate` rethrows `{ message, status, data }` where `data`
// is the raw API response body. Typical shapes:
//   { message: "..." }
//   { error: "VALIDATION_ERROR", details: [{ field, message, code }] }
//   "<html>...</html>"  (gateway 5xx etc.)
function formatTemplateRenderError(err: unknown): {
  title: string;
  description: string;
} {
  const e = err as {
    message?: string;
    status?: number | string;
    response?: { data?: unknown };
    data?: unknown;
  };
  const payload = (e?.data ?? e?.response?.data ?? null) as unknown;
  const status = e?.status ? ` (HTTP ${e.status})` : "";

  // Object payload — most common (Zod validation, business errors).
  if (payload && typeof payload === "object") {
    const p = payload as {
      message?: string;
      error?: string;
      details?: Array<{ field?: string; message?: string; code?: string }>;
    };
    if (p.error === "VALIDATION_ERROR" && Array.isArray(p.details) && p.details.length) {
      const lines = p.details
        .slice(0, 5)
        .map((d) => `${d.field ?? "?"}: ${d.message ?? "Invalid"}`)
        .join("; ");
      const more = p.details.length > 5 ? ` (+${p.details.length - 5} more)` : "";
      return {
        title: `Template variables invalid${status}`,
        description: `${lines}${more}`,
      };
    }
    if (p.message) {
      return { title: `Couldn't render template${status}`, description: p.message };
    }
    if (p.error) {
      return { title: `Couldn't render template${status}`, description: String(p.error) };
    }
    // Last-resort: dump the JSON payload so the user sees *something*
    // concrete from the API instead of axios' "Request failed" wrapper.
    try {
      return {
        title: `Couldn't render template${status}`,
        description: JSON.stringify(payload).slice(0, 500),
      };
    } catch {
      // fall through
    }
  }

  // String payload (HTML / plaintext error pages).
  if (typeof payload === "string" && payload.trim()) {
    return {
      title: `Couldn't render template${status}`,
      description: payload.slice(0, 500),
    };
  }

  if (e?.message) {
    return { title: `Couldn't render template${status}`, description: e.message };
  }

  return {
    title: "Couldn't render template variables",
    description: "Showing the raw template — fill in placeholders manually.",
  };
}

/**
 * Build forwarded message thread HTML from conversation messages
 */
async function fetchEmailBody(emlStorageKey: string): Promise<string> {
  try {
    const data = await copaApi.files.getFileUrlByFileId({
      key: emlStorageKey,
      contentType: "message/rfc822",
      method: "GET",
    });
    const url = typeof data === "string" ? data : (data as any)?.data ?? (data as any)?.url ?? "";
    if (!url) return "";
    const emlRes = await fetch(url);
    const buffer = await emlRes.arrayBuffer();
    const parser = new PostalMime();
    const email = await parser.parse(buffer);
    return email.html || email.text || "";
  } catch {
    return "";
  }
}

async function buildForwardedThread(messages: any[], subject: string): Promise<string> {
  if (!messages || messages.length === 0) return "";

  const enriched = await Promise.all(
    messages.map(async (msg: any) => {
      let msgBody = msg.bodyHtml || msg.bodyText || msg.body || "";
      if (!msgBody && msg.emlStorageKey) {
        msgBody = await fetchEmailBody(msg.emlStorageKey);
      }
      return { ...msg, resolvedBody: msgBody };
    })
  );

  const threadHtml = enriched.map((msg: any) => {
    const from = msg.fromAddress || msg.from || "Unknown";
    const to = Array.isArray(msg.toAddresses)
      ? msg.toAddresses.join(", ")
      : (msg.toAddresses || (Array.isArray(msg.to) ? msg.to.join(", ") : msg.to) || "");
    const cc = Array.isArray(msg.ccAddresses) ? msg.ccAddresses.join(", ") : (msg.cc || "");
    // Sent items carry `sentAt` (the actual send time); conversation messages
    // use `createdDate`; some payloads only carry `createdAt` or
    // `lastMessageAt`. Prefer `sentAt` first so forwarded headers from the
    // Sent folder show the send timestamp instead of the row's createdDate.
    const dateRaw = msg.sentAt || msg.createdDate || msg.createdAt || msg.lastMessageAt;
    const date = dateRaw ? new Date(dateRaw).toLocaleString() : "";

    return `<div style="margin-bottom:16px;">
<div style="font-size:13px;color:#555;margin-bottom:8px;">
<strong>From:</strong> ${from}<br>
<strong>Date:</strong> ${date}<br>
<strong>Subject:</strong> ${msg.subject || subject}<br>
<strong>To:</strong> ${to}${cc ? `<br><strong>Cc:</strong> ${cc}` : ""}
</div>
<div>${msg.resolvedBody}</div>
</div>`;
  }).join('<hr style="border:none;border-top:1px solid #eee;margin:16px 0;">');

  return `<p style="font-size:13px;color:#888;">---------- Forwarded message ----------</p>
${threadHtml}`;
}

/**
 * Gmail-style email chip input — converts typed emails into badges on
 * Enter/comma/Tab. Renders an autocomplete dropdown driven by the
 * `suggestions` prop (workspace users). The list
 * pops on focus (Gmail-style — top suggestions visible immediately,
 * no need to type) and filters as the user types. Up/Down navigates,
 * Enter / Tab / click selects.
 */
export interface EmailSuggestion {
  email: string;
  name?: string;
}

function EmailChipInput({
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  id,
  suggestions = [],
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  id?: string;
  suggestions?: EmailSuggestion[];
}) {
  const [inputValue, setInputValue] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Parse existing comma-separated value into chips
  const chips = value
    ? value.split(",").map((e) => e.trim()).filter(Boolean)
    : [];

  // Pick the suggestion list:
  //   - typed query → substring match on email or name
  //   - empty input → top of the roster (Gmail-style "show on focus")
  // Cap at 8, exclude entries already chipped.
  const matches = (() => {
    if (suggestions.length === 0) return [];
    const used = new Set(chips.map((c) => c.toLowerCase()));
    const q = inputValue.trim().toLowerCase();
    const out: EmailSuggestion[] = [];
    for (const s of suggestions) {
      if (used.has(s.email.toLowerCase())) continue;
      if (q) {
        const hit =
          s.email.toLowerCase().includes(q)
          || (s.name?.toLowerCase().includes(q) ?? false);
        if (!hit) continue;
      }
      out.push(s);
      if (out.length >= 8) break;
    }
    return out;
  })();

  const addChip = (email: string) => {
    const trimmed = email.trim().replace(/,+$/, "");
    if (!trimmed) return;
    if (chips.includes(trimmed)) {
      setInputValue("");
      return;
    }
    const updated = [...chips, trimmed].join(", ");
    onChange(updated);
    setInputValue("");
    setOpen(false);
    setHighlight(0);
  };

  const removeChip = (index: number) => {
    const updated = chips.filter((_, i) => i !== index).join(", ");
    onChange(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Suggestion-list navigation takes precedence when the dropdown
    // is open and has matches.
    if (open && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && matches[highlight]) {
        e.preventDefault();
        addChip(matches[highlight].email);
        return;
      }
    }

    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (inputValue.trim()) {
        e.preventDefault();
        addChip(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && chips.length > 0) {
      removeChip(chips.length - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted.includes(",") || pasted.includes(" ")) {
      e.preventDefault();
      const emails = pasted.split(/[,\s]+/).filter(Boolean);
      const deduplicated = [...new Set([...chips, ...emails])];
      const updated = deduplicated.join(", ");
      onChange(updated);
      setInputValue("");
    }
  };

  return (
    <div className="copa:relative">
      <div
        className={`copa:flex copa:flex-wrap copa:items-center copa:gap-1.5 copa:min-h-[40px] copa:px-2 copa:py-1.5 copa:border copa:rounded-lg copa:bg-background copa:text-sm copa:transition-colors copa:focus-within:ring-2 copa:focus-within:ring-primary/20 copa:focus-within:border-primary ${error ? "copa:border-destructive" : "copa:border-input"}`}
        onClick={() => inputRef.current?.focus()}
      >
        {chips.map((chip, idx) => {
          const isValid = EMAIL_REGEX.test(chip);
          return (
            <span
              key={`${chip}-${idx}`}
              className={`copa:inline-flex copa:items-center copa:gap-1 copa:h-7 copa:pl-1.5 copa:pr-1 copa:rounded-full copa:text-xs copa:font-medium copa:shrink-0 copa:transition-colors ${
                isValid
                  ? "copa:bg-primary/10 copa:text-primary copa:border copa:border-primary/20 copa:hover:bg-primary/15"
                  : "copa:bg-destructive/10 copa:text-destructive copa:border copa:border-destructive/20 copa:hover:bg-destructive/15"
              }`}
            >
              <span className={`copa:flex copa:items-center copa:justify-center copa:h-4 copa:w-4 copa:rounded-full copa:text-[9px] copa:font-bold ${
                isValid ? "copa:bg-primary/20 copa:text-primary" : "copa:bg-destructive/20 copa:text-destructive"
              }`}>
                {chip.charAt(0).toUpperCase()}
              </span>
              <span className="copa:max-w-[180px] copa:truncate">{chip}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeChip(idx); }}
                className={`copa:rounded-full copa:p-0.5 copa:transition-colors ${
                  isValid ? "copa:hover:bg-primary/20" : "copa:hover:bg-destructive/20"
                }`}
              >
                <X className="copa:h-3 copa:w-3" />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          id={id}
          type="email"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setOpen(true)}
          // Defer the close so a click on a suggestion lands before
          // the input loses focus and the dropdown unmounts.
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
            const pending = inputValue.trim();
            if (pending) {
              // Commit any typed-but-uncommitted text as a chip. The
              // resulting `onChange` runs the parent's validator with
              // the post-commit value, so the field is already in a
              // valid state. Calling `onBlur?.()` here would invoke the
              // parent's `handleBlur`, whose `validateForm()` reads the
              // STALE closure `value` (the pre-commit string) and
              // re-paints the just-cleared "recipient required" error —
              // because both calls happen inside the same blur event,
              // closure variables don't refresh between them. So when
              // we've just committed, skip the parent's onBlur entirely.
              addChip(pending);
              return;
            }
            onBlur?.();
          }}
          placeholder={chips.length === 0 ? placeholder : "Add email..."}
          className="copa:flex-1 copa:min-w-[120px] copa:outline-none copa:bg-transparent copa:text-sm copa:placeholder:text-muted-foreground/60"
        />
      </div>
      {open && matches.length > 0 && (
        <div className="copa:absolute copa:left-0 copa:right-0 copa:top-full copa:z-50 copa:mt-1 copa:max-h-64 copa:overflow-auto copa:rounded-lg copa:border copa:border-border copa:bg-popover copa:shadow-md">
          {matches.map((s, idx) => (
            <button
              key={`${s.email}-${idx}`}
              type="button"
              // `mousedown` instead of `click` because the input's
              // `onBlur` fires first on click and would dismiss the
              // dropdown before the click could land.
              onMouseDown={(e) => {
                e.preventDefault();
                addChip(s.email);
              }}
              onMouseEnter={() => setHighlight(idx)}
              className={`copa:flex copa:w-full copa:items-center copa:gap-2 copa:px-3 copa:py-2 copa:text-left copa:text-sm copa:transition-colors ${
                idx === highlight
                  ? "copa:bg-primary/10 copa:text-foreground"
                  : "copa:hover:bg-muted"
              }`}
            >
              <span className="copa:flex copa:h-6 copa:w-6 copa:shrink-0 copa:items-center copa:justify-center copa:rounded-full copa:bg-primary/15 copa:text-[10px] copa:font-bold copa:text-primary">
                {(s.name || s.email).charAt(0).toUpperCase()}
              </span>
              <span className="copa:min-w-0 copa:flex-1">
                {s.name && (
                  <span className="copa:block copa:truncate copa:font-medium copa:leading-tight">
                    {s.name}
                  </span>
                )}
                <span className="copa:block copa:truncate copa:text-xs copa:text-muted-foreground">
                  {s.email}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validate a single email address
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// True for a complete HTML document (`<!doctype …>` / `<html …>`). Such bodies
// need the signature spliced before `</body>` rather than appended, and the
// editor renders them as a full document in its sandboxed iframe.
function isFullHtmlDoc(html: string): boolean {
  const trimmed = html.trim().toLowerCase();
  return trimmed.startsWith("<!doctype") || trimmed.startsWith("<html");
}

// Validate multiple comma-separated email addresses
function validateEmailList(emails: string): { valid: boolean; errors: string[] } {
  if (!emails.trim()) {
    return { valid: false, errors: [] };
  }

  const emailList = emails.split(",").map((e) => e.trim()).filter(Boolean);
  const errors: string[] = [];

  if (emailList.length === 0) {
    return { valid: false, errors: [] };
  }

  emailList.forEach((email) => {
    if (!isValidEmail(email)) {
      errors.push(`Invalid email format: ${email}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Read a File into the `{ filename, content, content_type }` payload the
 * send / reply / draft APIs expect (base64 without the data-URL
 * prefix). Rejects if the file can't be read.
 */
function fileToAttachmentPayload(file: File): Promise<EmailAttachmentPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1] ?? "";
      resolve({
        filename: file.name,
        content: base64,
        content_type: file.type || "application/octet-stream",
      });
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export interface ComposeSendPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: EmailAttachmentPayload[];
}

interface ComposeEmailModalProps {
  open: boolean;
  onClose: () => void;
  onSend: (email: ComposeSendPayload) => Promise<void>;
  onSaveDraft: (data: ComposeDraftPayload) => Promise<void>;
  draftData?: ComposeDraftPayload;
  replyMode: ReplyMode | null;
  replyToEmail?: any;
  forwardMessages?: any[];
  onReply: (
    conversationId: string,
    bodyHtml: string,
    attachments?: EmailAttachmentPayload[],
    toEmail?: string[],
  ) => Promise<void>;
}

export function ComposeEmailModal({
  open,
  onClose,
  onSend,
  onSaveDraft,
  draftData,
  replyMode,
  replyToEmail,
  forwardMessages,
  onReply,
}: ComposeEmailModalProps) {
  const { emailAccount, users: workspaceUsers, user } = useAppContext();

  // Recipient autocomplete for To / CC / BCC: the workspace user roster,
  // deduped by lower-cased email.
  const recipientSuggestions = useMemo<EmailSuggestion[]>(() => {
    const out: EmailSuggestion[] = [];
    const seen = new Set<string>();
    for (const u of workspaceUsers as Array<{
      email?: string | null;
      name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
    }>) {
      const email = (u?.email ?? "").trim();
      if (!email || seen.has(email.toLowerCase())) continue;
      seen.add(email.toLowerCase());
      const name = (u?.name ?? "").trim() || [u?.first_name, u?.last_name].filter(Boolean).join(" ");
      out.push({ email, name: name || undefined });
    }
    return out;
  }, [workspaceUsers]);

  const { templates: savedTemplates, refetch: refetchTemplates } = useEmailTemplates();
  // Refetch on every open so template edits made in Settings show up immediately.
  useEffect(() => {
    if (open) refetchTemplates();
  }, [open, refetchTemplates]);
  const { signature } = useSignature();
  // Latest signature in a ref so `resetComposeState` keeps a stable identity
  // when `useSignature` resolves late — otherwise the open-reset effect would
  // re-run and wipe typed / draft content.
  const signatureRef = useRef(signature);

  // Variables handed to `/templates/render` — keep in sync with
  // `~/data/template-variables.ts`.
  const buildTemplateData = useCallback(
    (): Record<string, unknown> => ({
      poc_name: user?.name ?? "",
      poc_email: user?.email ?? "",
    }),
    [user],
  );

  const allTemplates = useMemo(
    () =>
      savedTemplates.map((t) => ({
        id: t.id,
        name: t.template_name,
        subject: t.email_subject,
        body: t.email_body,
        engine: t.template_engine,
      })),
    [savedTemplates],
  );

  // Gmail-style separator: an empty paragraph, then the signature wrapped in a
  // marker class only (no inline styling), so the sent email is unchanged —
  // the editor alone styles `.bc-email-signature`.
  const wrapSignature = (sig: string) => (sig ? `<p><br></p><div class="bc-email-signature">${sig}</div>` : "");

  // Append the signature to a body block so the user types above it.
  const appendSignature = (innerBody: string) => {
    const base = innerBody ?? "";
    return editableSignature ? `${base}${wrapSignature(editableSignature)}` : base;
  };

  // Full-document templates (`<!doctype>` / `<html>`) get the signature
  // spliced before `</body>` instead of appended after `</html>`.
  const appendSignatureToDoc = (html: string) => {
    if (!editableSignature) return html;
    const sig = wrapSignature(editableSignature);
    const idx = html.toLowerCase().lastIndexOf("</body>");
    return idx !== -1 ? `${html.slice(0, idx)}${sig}${html.slice(idx)}` : `${html}${sig}`;
  };

  // Per-open guard so the late-load signature effect stamps at most once.
  const signatureInsertedForOpenRef = useRef(false);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [isRenderingTemplate, setIsRenderingTemplate] = useState(false);
  // Monotonic id of the in-flight render; a response that lands after a newer
  // pick or a reset/close is discarded.
  const templateRenderSeqRef = useRef(0);
  const [to, setTo] = useState<string>("");
  const [cc, setCc] = useState<string>("");
  const [bcc, setBcc] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [editableSignature, setEditableSignature] = useState("");
  const templateTriggerRef = useRef<HTMLSelectElement>(null);
  // Latest `body`, readable from async callbacks (the forwarded-thread fetch).
  const bodyRef = useRef(body);
  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  // Push body edits up, and clear the "body required" error once there's real content.
  const handleBodyChange = useCallback((html: string) => {
    setBody(html);
    const stripped = html.replace(/\s+/g, "");
    const hasContent = stripped !== "" && stripped !== "<p><br></p>" && stripped !== "<p><br/></p>";
    if (hasContent) {
      setErrors((prev) => {
        if (!prev.body) return prev;
        const { body: _omit, ...rest } = prev;
        return rest;
      });
    }
  }, []);

  // Single reset point so close/open paths stay in sync.
  const resetComposeState = useCallback(() => {
    setSelectedTemplateId("none");
    setIsRenderingTemplate(false);
    templateRenderSeqRef.current++;
    signatureInsertedForOpenRef.current = false;
    setAttachments([]);
    setErrors({});
    setTouched({});
    setTo("");
    setCc("");
    setBcc("");
    setSubject("");
    setBody("");
    setEditableSignature(isEmptyHtml(signatureRef.current) ? "" : ensureHtml(signatureRef.current));
  }, []);

  // Convert the loaded signature to HTML once. A no-op (not a clear) when it's
  // empty, so a transient refetch can't drop a signature already staged.
  useEffect(() => {
    signatureRef.current = signature;
    if (isEmptyHtml(signature)) return;
    setEditableSignature(ensureHtml(signature));
  }, [signature]);

  // Reset on open, then pre-fill for draft / reply modes.
  useEffect(() => {
    if (!open) return;
    resetComposeState();

    if (draftData) {
      setTo(draftData.to || "");
      setCc(draftData.cc || "");
      setBcc(draftData.bcc || "");
      setSubject(draftData.subject || "");
      setBody(draftData.body || "");
      // Show which template the draft came from; the saved body is kept as-is.
      if (draftData.templateId) setSelectedTemplateId(draftData.templateId);
      if (draftData.attachments?.length) {
        setAttachments(
          draftData.attachments.map((att) => {
            const bytes = Uint8Array.from(atob(att.content), (c) => c.charCodeAt(0));
            return new File([bytes], att.filename, { type: att.content_type });
          }),
        );
      }
    } else if (replyMode && replyToEmail) {
      const toAddresses = Array.isArray(replyToEmail.toAddresses)
        ? replyToEmail.toAddresses.join(", ")
        : replyToEmail.toAddresses || replyToEmail.toEmail || "";
      const ccAddresses = Array.isArray(replyToEmail.ccAddresses)
        ? replyToEmail.ccAddresses.join(", ")
        : replyToEmail.ccAddresses || replyToEmail.cc || "";
      if (replyMode === "forward") {
        setSubject(`Fwd: ${replyToEmail.subject || ""}`);
      } else {
        setTo(toAddresses);
        setSubject(`Re: ${replyToEmail.subject || ""}`);
        setCc(replyMode === "reply-all" ? ccAddresses : "");
      }
    }
  }, [open, replyMode, replyToEmail, draftData, resetComposeState]);

  // Clear unsent compose state as soon as the modal closes.
  useEffect(() => {
    if (open || draftData || replyMode) return;
    resetComposeState();
  }, [open, draftData, replyMode, resetComposeState]);

  // Once-per-open guard so forwarded-thread seeding can't re-run mid-edit.
  const hydratedForOpenRef = useRef(false);

  // Forward: seed the body with an empty typing line, the signature, then the
  // forwarded thread (built async). Drafts carry their signature already.
  useEffect(() => {
    if (!open) {
      hydratedForOpenRef.current = false;
      return;
    }
    if (hydratedForOpenRef.current) return;
    hydratedForOpenRef.current = true;

    if (draftData?.body) {
      signatureInsertedForOpenRef.current = true;
      return;
    }
    if (replyMode !== "forward" || !forwardMessages?.length) return;

    let cancelled = false;
    setBody('<p style="color:#888;">Loading forwarded messages...</p>');
    buildForwardedThread(forwardMessages, replyToEmail?.subject || "")
      .then((threadHtml) => {
        if (cancelled) return;
        // Only seed if the user hasn't started typing meanwhile.
        const cur = bodyRef.current;
        const stillPristine = /Loading forwarded messages/.test(cur) || cur === "" || cur === "<p><br></p>";
        if (!stillPristine) return;
        setBody(`<p><br></p>${appendSignature("")}${threadHtml}`);
        signatureInsertedForOpenRef.current = !!editableSignature;
      })
      .catch(() => {
        /* leave the placeholder — the user can still type */
      });
    return () => {
      cancelled = true;
    };
    // Runs once per open; the guard above covers re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The signature loads async. Append it only while the body is still
  // pristine, at most once per open. Forward seeds its own signature.
  useEffect(() => {
    if (!open || !editableSignature || replyMode === "forward") return;
    if (signatureInsertedForOpenRef.current) return;
    const stripped = body.replace(/\s+/g, "");
    if (stripped !== "" && stripped !== "<p><br></p>" && stripped !== "<p><br/></p>") return;
    setBody(appendSignature("<p><br></p>"));
    signatureInsertedForOpenRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editableSignature, body, replyMode]);

  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    const requestSeq = ++templateRenderSeqRef.current;
    const subjectHiddenForReply = Boolean(replyMode && replyMode !== "forward");

    if (templateId === "none") {
      // Unselecting removes the template's subject/body, keeping the signature.
      setIsRenderingTemplate(false);
      if (!subjectHiddenForReply) setSubject("");
      setBody(appendSignature("<p><br></p>"));
      return;
    }
    const template = allTemplates.find((t) => t.id === templateId);
    if (!template) {
      setIsRenderingTemplate(false);
      return;
    }
    setIsRenderingTemplate(true);

    // Render server-side; on failure fall back to the raw template so the user
    // can fill placeholders by hand.
    const rawBodyHtml = ensureHtml(template.body);
    let bodyHtml = rawBodyHtml;
    let renderedSubject = template.subject;
    try {
      const result = await renderTemplate({
        templateHtml: rawBodyHtml,
        templateText: template.subject,
        data: buildTemplateData(),
        engine: template.engine,
      });
      if (result.renderedHtml) bodyHtml = result.renderedHtml;
      if (result.renderedText) renderedSubject = result.renderedText;
    } catch (err) {
      if (requestSeq !== templateRenderSeqRef.current) return;
      console.warn("[compose] template render failed", err);
      const { title, description } = formatTemplateRenderError(err);
      toast.error(title, { description, duration: 8000 });
    }

    // Only the latest request may write the body/subject.
    if (requestSeq !== templateRenderSeqRef.current) return;

    setIsRenderingTemplate(false);
    // The reply API sends its own "Re: ..." subject, so leave it alone there.
    if (!subjectHiddenForReply) setSubject(renderedSubject);
    setErrors((prev) => {
      const next = { ...prev };
      if (renderedSubject?.trim()) delete next.subject;
      if (bodyHtml?.trim()) delete next.body;
      return next;
    });
    setBody(isFullHtmlDoc(bodyHtml) ? appendSignatureToDoc(bodyHtml) : appendSignature(bodyHtml));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    // Clear so picking the same file again still fires `onChange`.
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // `overrides` carries freshly-typed values / touched flags whose setState
  // hasn't flushed yet, so validation doesn't read stale closure values.
  const validateForm = (
    isDraft: boolean = false,
    overrides?: {
      to?: string;
      cc?: string;
      bcc?: string;
      subject?: string;
      touched?: Partial<Record<string, boolean>>;
    },
  ): boolean => {
    const newErrors: Record<string, string> = {};
    const effectiveTo = overrides?.to ?? to;
    const effectiveCc = overrides?.cc ?? cc;
    const effectiveBcc = overrides?.bcc ?? bcc;
    const effectiveSubject = overrides?.subject ?? subject;
    const effectiveTouched = { ...touched, ...(overrides?.touched ?? {}) };

    if (effectiveTouched.to) {
      if (!effectiveTo.trim()) {
        newErrors.to = "At least one recipient is required";
      } else {
        const toValidation = validateEmailList(effectiveTo);
        if (!toValidation.valid) newErrors.to = toValidation.errors[0] || "Invalid email address";
      }
    }
    if (effectiveCc.trim()) {
      const ccValidation = validateEmailList(effectiveCc);
      if (!ccValidation.valid) newErrors.cc = ccValidation.errors[0] || "Invalid email address";
    }
    if (effectiveBcc.trim()) {
      const bccValidation = validateEmailList(effectiveBcc);
      if (!bccValidation.valid) newErrors.bcc = bccValidation.errors[0] || "Invalid email address";
    }
    // Subject is hidden in reply / reply-all (the API sends its own "Re: ...").
    const subjectHiddenForReply = Boolean(replyMode && replyMode !== "forward");
    if (!isDraft && !subjectHiddenForReply && effectiveTouched.subject && !effectiveSubject.trim()) {
      newErrors.subject = "Subject is required";
    }
    if (!isDraft && effectiveTouched.body && !body.trim()) {
      newErrors.body = "Email body is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateForm(false, { touched: { [field]: true } });
  };

  const handleFieldChange = (field: "to" | "cc" | "bcc" | "subject", value: string) => {
    ({ to: setTo, cc: setCc, bcc: setBcc, subject: setSubject })[field](value);
    if (touched[field]) validateForm(false, { [field]: value });
  };

  const splitList = (value: string) => value.split(",").map((e) => e.trim()).filter(Boolean);

  const handleSend = async () => {
    setTouched({ to: true, cc: true, bcc: true, subject: true, body: true });
    if (!validateForm(true, { touched: { to: true, subject: true, body: true } })) return;

    setSending(true);
    try {
      const attachmentPayloads = attachments.length
        ? await Promise.all(attachments.map(fileToAttachmentPayload))
        : undefined;
      // The body already contains the signature (inlined when the editor opened).
      const bodyHtml = ensureHtml(body);
      if (replyMode && replyMode !== "forward" && replyToEmail?.id) {
        await onReply(replyToEmail.id, bodyHtml, attachmentPayloads, splitList(to));
      } else {
        await onSend({
          to: splitList(to),
          cc: cc ? splitList(cc) : undefined,
          bcc: bcc ? splitList(bcc) : undefined,
          subject,
          body: bodyHtml,
          attachments: attachmentPayloads,
        });
      }
      onClose();
    } catch (error) {
      console.error("Failed to send email:", error);
      toast.error("Failed to send email. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      await onSaveDraft({
        to,
        cc,
        bcc,
        subject,
        body,
        templateId: selectedTemplateId,
        attachments: attachments.length ? await Promise.all(attachments.map(fileToAttachmentPayload)) : undefined,
      });
    } catch {
      toast.error("Failed to save draft. Please try again.");
    }
  };

  const recipientsValid =
    to.trim() &&
    validateEmailList(to).valid &&
    (!cc.trim() || validateEmailList(cc).valid) &&
    (!bcc.trim() || validateEmailList(bcc).valid);
  const isFormValid = recipientsValid && subject.trim() && body.trim();

  const chipField = (field: "to" | "cc" | "bcc", label: string, placeholder: string) => (
    <div className="copa:space-y-2">
      <Label htmlFor={field}>{label}</Label>
      <EmailChipInput
        id={field}
        value={{ to, cc, bcc }[field]}
        onChange={(value) => handleFieldChange(field, value)}
        onBlur={() => handleBlur(field)}
        placeholder={placeholder}
        error={errors[field]}
        suggestions={recipientSuggestions}
      />
      {errors[field] && <p className="copa:text-sm copa:text-destructive">{errors[field]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="copa:max-w-4xl copa:max-h-[90vh] copa:overflow-hidden copa:flex copa:flex-col"
        onOpenAutoFocus={(event) => {
          if (!replyMode) {
            event.preventDefault();
            templateTriggerRef.current?.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {replyMode === "forward" ? "Forward Email" : replyMode ? "Reply Email" : "Compose Email"}
            {emailAccount?.email && (
              <span className="copa:text-sm copa:font-normal copa:text-muted-foreground copa:ml-2">({emailAccount.email})</span>
            )}
          </DialogTitle>
          <DialogDescription className="copa:sr-only">Write and send an email</DialogDescription>
        </DialogHeader>

        <div className="copa:flex-1 copa:overflow-y-auto">
          <div className="copa:space-y-4 copa:py-2">
            {replyMode !== "forward" && (
              <div className="copa:space-y-2">
                <Label htmlFor="template">Template</Label>
                <select
                  id="template"
                  ref={templateTriggerRef}
                  value={selectedTemplateId}
                  onChange={(e) => void handleTemplateChange(e.target.value)}
                  className="copa:h-9 copa:w-full copa:rounded-md copa:border copa:border-input copa:bg-transparent copa:px-3 copa:text-sm"
                >
                  <option value="none">None</option>
                  {allTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {chipField("to", "To *", "recipient@example.com")}
            {/* CC — hidden in reply mode unless reply-all */}
            {(!replyMode || replyMode === "reply-all") && chipField("cc", "CC", "cc@example.com")}
            {/* BCC — hidden in reply mode */}
            {!replyMode && chipField("bcc", "BCC", "bcc@example.com")}

            {/* Subject — hidden in reply mode */}
            {!replyMode && (
              <div className="copa:space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => handleFieldChange("subject", e.target.value)}
                  onBlur={() => handleBlur("subject")}
                  placeholder="Email subject"
                  aria-invalid={errors.subject ? "true" : "false"}
                  className={errors.subject ? "copa:border-destructive" : ""}
                />
                {errors.subject && <p className="copa:text-sm copa:text-destructive">{errors.subject}</p>}
              </div>
            )}

            {/* Body — one WYSIWYG surface that renders the email exactly as it
                will send (tables, full-HTML templates, signature) and is
                editable in place. */}
            <div className="copa:space-y-2">
              {!replyMode && <Label>Body *</Label>}
              <div className="copa:relative">
                <EmailBodyEditor
                  value={body}
                  onChange={handleBodyChange}
                  onBlur={() => handleBlur("body")}
                  onAttach={() => fileInputRef.current?.click()}
                />
                {isRenderingTemplate && (
                  <div className="copa:absolute copa:inset-0 copa:z-10 copa:flex copa:items-center copa:justify-center copa:gap-2 copa:rounded-md copa:bg-background/80 copa:text-sm copa:text-muted-foreground copa:pointer-events-none">
                    <Loader2 className="copa:h-4 copa:w-4 copa:animate-spin" />
                    Rendering template…
                  </div>
                )}
              </div>
              {errors.body && <p className="copa:text-sm copa:text-destructive">{errors.body}</p>}
            </div>

            {/* File picker behind the editor's paperclip button */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="copa:hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            {attachments.length > 0 && (
              <div className="copa:space-y-2">
                <Label>Attachments</Label>
                <div className="copa:space-y-2">
                  {attachments.map((file, index) => (
                    <div key={index} className="copa:flex copa:items-center copa:justify-between copa:p-2 copa:bg-muted copa:rounded">
                      <span className="copa:text-sm">{file.name}</span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => removeAttachment(index)}
                      >
                        <X className="copa:h-4 copa:w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          {!replyMode && (
            <Button variant="outline" onClick={handleSaveDraft} disabled={sending || !recipientsValid}>
              Save Draft
            </Button>
          )}
          <Button onClick={handleSend} disabled={sending || isRenderingTemplate || !isFormValid} className="copa:gap-2">
            <Send className="copa:h-4 copa:w-4" />
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// Single WYSIWYG body surface. Renders the email HTML — tables, full-HTML
// templates, signature, everything — inside a sandboxed iframe, AND makes that
// rendered output directly editable (the iframe body is `contentEditable`).
// Edits flow back to `value` via `onChange`; the lastEmittedRef guard keeps the
// frame from reloading (and dropping the caret) on the state change our own
// keystroke produced. A small toolbar drives `document.execCommand` against the
// iframe document for basic rich-text formatting.
function EmailBodyEditor({
  value,
  onChange,
  onBlur,
  onAttach,
  height = 342,
}: {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  onAttach?: () => void;
  height?: number;
}) {
  const [srcDoc, setSrcDoc] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // The whole editor wrapper (toolbar + iframe). Used to tell a real
  // "focus left the editor" blur apart from focus moving to a toolbar
  // control (font/size dropdown, color picker), which also blurs the iframe.
  const containerRef = useRef<HTMLDivElement>(null);
  // The HTML we last emitted from an in-frame edit — guards the rebuild below.
  const lastEmittedRef = useRef<string | null>(null);
  // Whether the current document is a full HTML doc (decides what we serialize
  // back: the whole document vs. just the body fragment).
  const isFullDocRef = useRef(false);
  // The last selection range inside the iframe. Dropdowns / the color picker
  // steal focus and collapse the live selection, so we save it as it changes
  // and restore it before applying a command from one of those controls.
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    // Skip the rebuild when `value` is the HTML we just emitted from an in-frame
    // edit: the iframe DOM already holds it, and reloading would reset the caret.
    if (lastEmittedRef.current !== null && value === lastEmittedRef.current) return;
    // Check if value contains escaped HTML that needs unescaping
    let rendered = value;
    if (/&lt;[a-z/!][\s\S]*?&gt;/i.test(value)) {
      // Only unescape — don't sanitize (editor runs in a sandboxed iframe)
      rendered = value
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
        .replace(/&nbsp;/g, " ");
    }
    const isFullDoc = rendered.trim().toLowerCase().startsWith("<!doctype") || rendered.trim().toLowerCase().startsWith("<html");
    isFullDocRef.current = isFullDoc;
    if (isFullDoc) {
      // Keep the signature at the email-body level; inject only the separator
      // style. Its left position is matched to the template's content after
      // render in `alignSignature` (static CSS can't hit an arbitrary
      // template's left offset). The id lets the serializer drop this injected
      // node so it never leaks into the saved/sent body. UI-only.
      const sigStyle =
        `<style id="bc-sig-style">.bc-email-signature{margin-top:24px;padding-top:12px;` +
        `border-top:1px solid #e0e0e0;color:#555;text-align:left;}</style>`;
      const lower = rendered.toLowerCase();
      const headClose = lower.indexOf("</head>");
      setSrcDoc(
        headClose !== -1
          ? rendered.slice(0, headClose) + sigStyle + rendered.slice(headClose)
          : sigStyle + rendered,
      );
    } else {
      setSrcDoc(`<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;max-width:600px;margin:0 auto;}p{margin:0 0 10px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ddd;padding:8px;}a{color:#1a73e8;}img{max-width:100%;height:auto;}.bc-email-signature{margin-top:16px;padding-top:12px;border-top:1px solid #e0e0e0;color:#555;}body:focus{outline:none;}</style>
</head><body>${rendered}</body></html>`);
    }
  }, [value]);

  // Serialize the iframe DOM back into the shape `value` expects — the whole
  // document for a full-doc body, otherwise the body fragment. Strips the
  // editor-only artifacts first (the injected separator <style> and the inline
  // offsets `alignSignature` writes onto `.bc-email-signature`) so neither
  // leaks into the sent email.
  const serialize = useCallback((): string | null => {
    const cd = iframeRef.current?.contentDocument;
    if (!cd || !cd.body) return null;
    const isFull = isFullDocRef.current;
    const clone = (isFull ? cd.documentElement : cd.body).cloneNode(true) as HTMLElement;
    clone.querySelector("#bc-sig-style")?.remove();
    const sig = clone.querySelector<HTMLElement>(".bc-email-signature");
    if (sig) {
      for (const prop of ["margin-left", "max-width", "box-sizing", "padding-left", "padding-right"]) {
        sig.style.removeProperty(prop);
      }
    }
    return isFull ? `<!DOCTYPE html>${clone.outerHTML}` : clone.innerHTML;
  }, []);

  const emit = useCallback(() => {
    const html = serialize();
    if (html == null) return;
    lastEmittedRef.current = html;
    onChange(html);
  }, [serialize, onChange]);

  // After the document renders, measure where its content actually starts and
  // shift the (body-level) signature so its left edge lines up with the
  // template's content. Runs on every (re)load. No-op for the wrapped
  // non-full-doc body (signature already shares the body column).
  const alignSignature = useCallback(() => {
    try {
      const ifr = iframeRef.current;
      const cd = ifr?.contentDocument;
      const win = ifr?.contentWindow;
      if (!cd || !win || !cd.body) return;
      const sig = cd.querySelector<HTMLElement>(".bc-email-signature");
      if (!sig) return;

      // Reference = the block element holding the template's last line of text
      // (the spot the signature should sit beneath), excluding the signature.
      const walker = cd.createTreeWalker(cd.body, NodeFilter.SHOW_TEXT);
      let lastText: Node | null = null;
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (sig.contains(n)) continue;
        if ((n.textContent || "").trim()) lastText = n;
      }
      const BLOCK = new Set([
        "DIV", "TD", "TH", "CENTER", "SECTION", "ARTICLE", "P", "BODY", "MAIN", "TABLE",
      ]);
      let ref: HTMLElement | null = (lastText?.parentElement as HTMLElement) ?? null;
      while (ref && ref !== cd.body && !BLOCK.has(ref.tagName)) {
        ref = ref.parentElement;
      }
      if (!ref) return;

      const cs = win.getComputedStyle(ref);
      const refRect = ref.getBoundingClientRect();
      const refContentLeft =
        refRect.left + parseFloat(cs.borderLeftWidth || "0") + parseFloat(cs.paddingLeft || "0");
      const refContentWidth =
        ref.clientWidth - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0");

      // Neutralize the signature's own horizontal box, then offset it so its
      // content-left matches the template's content-left.
      sig.style.boxSizing = "border-box";
      sig.style.marginLeft = "0px";
      sig.style.paddingLeft = "0px";
      sig.style.paddingRight = "0px";
      const sigLeft = sig.getBoundingClientRect().left;
      const delta = refContentLeft - sigLeft;
      if (Math.abs(delta) > 1) sig.style.marginLeft = `${delta}px`;
      if (refContentWidth > 0) sig.style.maxWidth = `${refContentWidth}px`;
    } catch {
      /* measurement is best-effort — leave the signature as-is on failure */
    }
  }, []);

  // Make the rendered document editable and wire edits back to `value`. Runs on
  // every (re)load so a fresh contentDocument always gets the flag + listeners.
  const setupEditing = useCallback(() => {
    const cd = iframeRef.current?.contentDocument;
    const win = iframeRef.current?.contentWindow;
    if (!cd || !cd.body || !win) return;
    cd.body.contentEditable = "true";
    cd.body.spellcheck = true;
    cd.body.style.outline = "none";
    cd.body.style.cursor = "text";
    cd.body.addEventListener("input", emit);
    // Remember the selection as it moves, so a command issued from a control
    // that stole focus (font/size dropdown, color picker) can restore it.
    const saveSelection = () => {
      const sel = cd.getSelection?.();
      if (sel && sel.rangeCount && cd.body.contains(sel.anchorNode)) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    };
    cd.addEventListener("selectionchange", saveSelection);
    cd.body.addEventListener("keyup", saveSelection);
    cd.body.addEventListener("mouseup", saveSelection);
    // Surface "body required" validation when focus leaves the editor — but
    // the iframe also blurs when focus moves to a toolbar control (font/size
    // dropdown, color picker), which lives in the parent document. Defer and
    // only fire when focus has actually landed OUTSIDE the editor wrapper,
    // otherwise opening a dropdown before typing would paint "Email body is
    // required" against a body the user is about to fill in.
    if (onBlur) {
      win.addEventListener("blur", () => {
        window.setTimeout(() => {
          if (!containerRef.current?.contains(document.activeElement)) onBlur();
        }, 0);
      });
    }
  }, [emit, onBlur]);

  const handleLoad = useCallback(() => {
    alignSignature();
    setupEditing();
    // alignSignature is a stable useCallback([]); listed for completeness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupEditing]);

  // Run a formatting command against the iframe document. Restores the last
  // in-frame selection first (a dropdown / color picker may have stolen focus
  // and collapsed it) so the command applies to the intended range.
  const exec = useCallback((command: string, arg?: string) => {
    const cd = iframeRef.current?.contentDocument;
    const win = iframeRef.current?.contentWindow;
    if (!cd || !win) return;
    win.focus();
    cd.body?.focus();
    const sel = cd.getSelection?.();
    if (sel && savedRangeRef.current) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      } catch { /* range may be stale after a rebuild — fall through */ }
    }
    cd.execCommand(command, false, arg);
    const after = cd.getSelection?.();
    if (after && after.rangeCount && cd.body?.contains(after.anchorNode)) {
      savedRangeRef.current = after.getRangeAt(0).cloneRange();
    }
    emit();
  }, [emit]);

  const createLink = useCallback(() => {
    const url = typeof window !== "undefined" ? window.prompt("Link URL") : null;
    if (url) exec("createLink", url);
  }, [exec]);

  // execCommand("fontSize") only accepts the legacy 1–7 scale.
  const FONT_SIZES = [
    { label: "Small", value: "2" },
    { label: "Normal", value: "3" },
    { label: "Large", value: "5" },
    { label: "Huge", value: "6" },
  ];
  const FONT_FAMILIES = [
    { label: "Sans Serif", value: "Arial, Helvetica, sans-serif" },
    { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
    { label: "Fixed Width", value: "'Courier New', monospace" },
    { label: "Wide", value: "Verdana, sans-serif" },
    { label: "Narrow", value: "'Arial Narrow', sans-serif" },
  ];

  // Icon-button groups (separated by dividers). These keep the iframe selection
  // via onMouseDown preventDefault, so no focus is stolen.
  const groups: { icon: typeof Bold; title: string; onClick: () => void }[][] = [
    [
      { icon: Undo2, title: "Undo", onClick: () => exec("undo") },
      { icon: Redo2, title: "Redo", onClick: () => exec("redo") },
    ],
    [
      { icon: Bold, title: "Bold", onClick: () => exec("bold") },
      { icon: Italic, title: "Italic", onClick: () => exec("italic") },
      { icon: Underline, title: "Underline", onClick: () => exec("underline") },
      { icon: Strikethrough, title: "Strikethrough", onClick: () => exec("strikeThrough") },
    ],
    [
      { icon: AlignLeft, title: "Align left", onClick: () => exec("justifyLeft") },
      { icon: AlignCenter, title: "Align center", onClick: () => exec("justifyCenter") },
      { icon: AlignRight, title: "Align right", onClick: () => exec("justifyRight") },
    ],
    [
      { icon: List, title: "Bulleted list", onClick: () => exec("insertUnorderedList") },
      { icon: ListOrdered, title: "Numbered list", onClick: () => exec("insertOrderedList") },
      { icon: IndentDecrease, title: "Decrease indent", onClick: () => exec("outdent") },
      { icon: IndentIncrease, title: "Increase indent", onClick: () => exec("indent") },
    ],
    [
      { icon: LinkIcon, title: "Insert link", onClick: createLink },
      { icon: RemoveFormatting, title: "Clear formatting", onClick: () => exec("removeFormat") },
    ],
  ];

  const selectClass =
    "copa:h-7 copa:rounded copa:border copa:border-input copa:bg-background copa:px-1.5 copa:text-xs copa:text-foreground copa:hover:bg-muted copa:focus:outline-none copa:cursor-pointer";
  const btnClass =
    "copa:inline-flex copa:h-7 copa:w-7 copa:items-center copa:justify-center copa:rounded copa:text-muted-foreground copa:hover:bg-muted copa:hover:text-foreground copa:transition-colors copa:cursor-pointer";

  return (
    <div ref={containerRef} className="copa:border copa:rounded-md copa:bg-white copa:overflow-hidden">
      <div className="copa:flex copa:flex-wrap copa:items-center copa:gap-x-0.5 copa:gap-y-1 copa:px-2 copa:py-1 copa:border-b copa:bg-muted/30">
        {/* Font family + size. These steal focus; `exec` restores the saved
            range. preventDefault on mousedown keeps the dropdown openable
            while still preserving the in-frame selection. */}
        <select
          title="Font"
          defaultValue=""
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => { exec("fontName", e.target.value); e.target.value = ""; }}
          className={selectClass}
        >
          <option value="" disabled>Font</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>
        <select
          title="Font size"
          defaultValue=""
          onChange={(e) => { exec("fontSize", e.target.value); e.target.value = ""; }}
          className={selectClass}
        >
          <option value="" disabled>Size</option>
          {FONT_SIZES.map((s) => (
            <option key={s.label} value={s.value}>{s.label}</option>
          ))}
        </select>
        <span className="copa:mx-1 copa:h-5 copa:w-px copa:bg-border" aria-hidden="true" />

        {groups.map((group, gi) => (
          <span key={gi} className="copa:flex copa:items-center copa:gap-0.5">
            {group.map(({ icon: Icon, title, onClick }) => (
              <button
                key={title}
                type="button"
                title={title}
                aria-label={title}
                // Keep the iframe selection — don't let the button steal focus.
                onMouseDown={(e) => e.preventDefault()}
                onClick={onClick}
                className={btnClass}
              >
                <Icon className="copa:h-4 copa:w-4" />
              </button>
            ))}
            {gi === 1 && (
              // Text color sits inside the format group. A hidden native color
              // input keeps it accessible; the label triggers it.
              <label className={`${btnClass} copa:relative`} title="Text color">
                <Baseline className="copa:h-4 copa:w-4" />
                <input
                  type="color"
                  defaultValue="#000000"
                  onChange={(e) => exec("foreColor", e.target.value)}
                  className="copa:absolute copa:inset-0 copa:h-full copa:w-full copa:cursor-pointer copa:opacity-0"
                />
              </label>
            )}
            <span className="copa:mx-1 copa:h-5 copa:w-px copa:bg-border" aria-hidden="true" />
          </span>
        ))}

        {onAttach && (
          <div className="copa:ml-auto">
            <button
              type="button"
              title="Attach file"
              aria-label="Attach file"
              onClick={onAttach}
              className={btnClass}
            >
              <Paperclip className="copa:h-4 copa:w-4" />
            </button>
          </div>
        )}
      </div>
      {srcDoc ? (
        <iframe
          ref={iframeRef}
          title="Email Body"
          srcDoc={srcDoc}
          onLoad={handleLoad}
          className="copa:w-full copa:bg-white"
          style={{ height }}
          // allow-same-origin (NOT allow-scripts): we drive contentEditable and
          // execCommand from the parent frame, so scripts in the email body
          // still can't run — untrusted markup stays inert.
          sandbox="allow-same-origin"
        />
      ) : (
        <div className="copa:flex copa:items-center copa:justify-center copa:text-muted-foreground copa:text-sm" style={{ height }}>
          Loading editor…
        </div>
      )}
    </div>
  );
}
