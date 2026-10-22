import { copaGetConfig } from "@bluecopa/react";

export type TemplateEngine = "mustache" | "jinja";

export interface RenderTemplateRequest {
  templateHtml?: string;
  templateText?: string;
  data: Record<string, unknown>;
  engine?: TemplateEngine;
}

export interface RenderTemplateResponse {
  renderedHtml?: string;
  renderedText?: string;
}

// Decode HTML entities inside `{% ... %}` / `{{ ... }}` blocks so the renderer
// sees operators as written: rich-text editors store `{% if x > 0 %}` as
// `{% if x &gt; 0 %}`, which the platform's Nunjucks parser rejects. Text
// outside the blocks keeps its entities.
const ENTITY_DECODE: Record<string, string> = {
  "&gt;": ">",
  "&lt;": "<",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};
function decodeJinjaEntities(html?: string): string | undefined {
  if (!html) return html;
  return html.replace(/\{[%{][\s\S]*?[%}]\}/g, (block) =>
    block.replace(/&(?:gt|lt|amp|quot|apos|nbsp|#39);/g, (m) => ENTITY_DECODE[m] ?? m),
  );
}

// Posts to `/templates/render` directly (not the SDK's `useRenderTemplate`) so
// the API's error body survives — the SDK re-throws as `{ message, status }`
// and drops the validation `details[]`. Errors carry `status` and `data`.
export async function renderTemplate(body: RenderTemplateRequest): Promise<RenderTemplateResponse> {
  if (!body.templateHtml && !body.templateText) {
    throw Object.assign(new Error("At least one of templateHtml or templateText is required"), { status: 400 });
  }

  const cfg = copaGetConfig() as {
    apiBaseUrl?: string;
    accessToken?: string;
    workspaceId?: string;
    solutionId?: string;
  };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.accessToken) headers["X-COPA-TOKEN"] = String(cfg.accessToken).trim();
  if (cfg.workspaceId) headers["X-COPA-WORKSPACE-ID"] = String(cfg.workspaceId).trim();
  if (cfg.solutionId) headers["x-bluecopa-solution-id"] = String(cfg.solutionId).trim();

  const baseURL = cfg.apiBaseUrl?.trim() || "/api/v1";
  const res = await fetch(`${baseURL.replace(/\/$/, "")}/templates/render`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...body,
      templateHtml: decodeJinjaEntities(body.templateHtml),
      templateText: decodeJinjaEntities(body.templateText),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON body (e.g. gateway HTML) — keep the raw text */
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Failed to render template (HTTP ${res.status})`), { status: res.status, data });
  }
  return (data ?? {}) as RenderTemplateResponse;
}
