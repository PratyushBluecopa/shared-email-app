import { useState, useRef, useCallback, useEffect } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import DOMPurify from "dompurify";
import { Plus, Pencil, Trash2, Eye, PenLine, Code2 } from "lucide-react";
import { ensureHtml } from "~/hooks/email/use-emails";
import { useEmailTemplates, type TemplateRow } from "~/hooks/settings/use-email-templates";
import { TEMPLATE_VARIABLES } from "~/data/template-variables";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const PURIFY_CONFIG = {
  ADD_ATTR: ["style", "align", "valign", "width", "height", "cellpadding", "cellspacing", "border", "bgcolor", "background", "colspan", "rowspan", "target"],
  FORBID_TAGS: ["style", "link", "meta"] as string[],
};

function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(ensureHtml(html), PURIFY_CONFIG);
}
const CATEGORIES = ["General", "Follow-up", "Reminder", "Notification"];

const selectClass = "copa:h-8 copa:w-full copa:rounded-md copa:border copa:border-input copa:bg-transparent copa:px-3 copa:text-sm";

export function EmailTemplatesTab() {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate, isSaving } = useEmailTemplates();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [engine, setEngine] = useState<"jinja" | "mustache">("jinja");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [activeTab, setActiveTab] = useState<"write" | "preview" | "code">("write");
  const [previewTemplate, setPreviewTemplate] = useState<TemplateRow | null>(null);

  const quillRef = useRef<Quill | null>(null);

  // Full-document HTML templates (those starting with `<!doctype` /
  // `<html>`) get loaded via `quill.setText` instead of `innerHTML`,
  // matching the compose-modal pattern. Assigning full HTML to a
  // `<div>` causes the browser to strip `<!DOCTYPE>` / `<html>` /
  // `<head>` / `<body>` (they're invalid inside a div), so Quill
  // would lose the outer wrapping and the saved value would be the
  // body-only content. `setText` keeps the document intact as plain
  // text; `ensureHtml` later decodes it on send.
  const loadIntoQuill = useCallback((quill: Quill, body: string) => {
    const trimmed = body.trim().toLowerCase();
    if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) {
      quill.setText(body);
    } else {
      // Sanitize before assigning to the editor — saved bodies are
      // untrusted (anyone with write access can stash a `<script>` /
      // event-handler attribute that would otherwise execute when
      // the editor parses the HTML).
      quill.root.innerHTML = sanitizeEmailHtml(body);
    }
  }, []);

  const onEditorMount = useCallback((el: HTMLDivElement | null) => {
    if (!el || el.classList.contains("ql-container")) return;
    el.innerHTML = "";
    const quill = new Quill(el, {
      theme: "snow",
      modules: {
        toolbar: [
          [{ font: [] }, { size: ["small", false, "large", "huge"] }],
          ["bold", "italic", "underline", "strike"],
          [{ color: [] }, { background: [] }],
          [{ align: [] }],
          [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
          ["link", "image", "blockquote", "code-block"],
          ["clean"],
        ],
      },
    });
    quillRef.current = quill;
    if (emailBody) loadIntoQuill(quill, emailBody);
    quill.on("text-change", () => {
      setEmailBody(quill.root.innerHTML);
    });
  }, []);

  useEffect(() => {
    if (isModalOpen && quillRef.current) {
      setTimeout(() => {
        if (quillRef.current) {
          loadIntoQuill(quillRef.current, emailBody || "");
        }
      }, 50);
    }
  }, [isModalOpen]);

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateName("");
    setCategory(CATEGORIES[0]);
    setEngine("jinja");
    setEmailSubject("");
    setEmailBody("");
    setActiveTab("write");
    setIsModalOpen(true);
  };

  const handleEdit = (template: TemplateRow) => {
    setEditingTemplate(template);
    setTemplateName(template.template_name);
    setCategory(template.template_category);
    setEngine(template.template_engine === "mustache" ? "mustache" : "jinja");
    setEmailSubject(template.email_subject);
    setEmailBody(template.email_body);
    // Existing template already has content — open on the rendered Preview
    // ("view") so the user sees the email as it looks, not raw markup.
    setActiveTab(template.email_body ? "preview" : "write");
    setIsModalOpen(true);
    setTimeout(() => {
      if (quillRef.current) {
        loadIntoQuill(quillRef.current, template.email_body || "");
      }
    }, 100);
  };

  const handleSave = async () => {
    if (!templateName.trim() || !emailSubject.trim()) return;
    // Normalize before persisting so the DB doesn't accumulate Quill
    // editor chrome. `ensureHtml` unwraps `.ql-code-block-container`
    // wrappers (single- and multi-line pastes), strips `<p>`/`<br>`
    // chrome, decodes HTML entities, and preserves `<!DOCTYPE>` /
    // `<html>` / `<body>` for full-document templates via DOMPurify's
    // `WHOLE_DOCUMENT` mode.
    const params = {
      templateName,
      templateCategory: category,
      templateEngine: engine,
      emailSubject,
      emailBody: ensureHtml(emailBody),
    };
    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, params);
      } else {
        await createTemplate(params);
      }
      setIsModalOpen(false);
      setEditingTemplate(null);
    } catch {
      // `useEmailTemplates` already surfaces the user-facing error
      // toast via its mutation messages; swallow here so a rejected
      // promise doesn't bubble out of the click handler as an
      // unhandled rejection (and so the modal stays open for retry).
    }
  };

  const handleDelete = (id: string) => {
    deleteTemplate(id).catch(() => {}); // toast already shown
  };

  const insertPlaceholder = (placeholder: string) => {
    if (quillRef.current) {
      const range = quillRef.current.getSelection(true);
      quillRef.current.insertText(range.index, placeholder);
      quillRef.current.setSelection(range.index + placeholder.length, 0);
    }
  };

  return (
    <div className="copa:space-y-4">
      <div className="copa:flex copa:justify-end">
        <Button onClick={handleNewTemplate}>
          <Plus className="copa:h-4 copa:w-4 copa:mr-2" />
          Add Template
        </Button>
      </div>

      {isLoading ? (
        <div className="copa:flex copa:items-center copa:justify-center copa:py-12">
          <div className="copa:animate-spin copa:rounded-full copa:h-6 copa:w-6 copa:border-b-2 copa:border-primary" />
        </div>
      ) : templates.length === 0 ? (
        <div className="copa:flex copa:flex-col copa:items-center copa:justify-center copa:py-16 copa:text-muted-foreground">
          <p className="copa:text-sm">No email templates yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="copa:grid copa:grid-cols-1 copa:md:grid-cols-2 copa:lg:grid-cols-3 copa:gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="copa:flex copa:flex-col">
              <CardHeader className="copa:pb-3">
                {/* Title + category on one row, action buttons on
                    the second row right-aligned. Card height stays
                    compact — full body content is one click away
                    via the Preview (eye) button. */}
                <div className="copa:flex copa:flex-col copa:gap-2">
                  <div className="copa:min-w-0">
                    <CardTitle className="copa:text-base copa:truncate">{template.template_name}</CardTitle>
                    <p className="copa:text-xs copa:text-muted-foreground copa:mt-0.5 copa:truncate">{template.template_category}</p>
                  </div>
                  <div className="copa:flex copa:items-center copa:justify-end copa:gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="copa:h-8 copa:w-8"
                      onClick={() => setPreviewTemplate(template)}
                      title="Preview"
                    >
                      <Eye className="copa:h-4 copa:w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="copa:h-8 copa:w-8"
                      onClick={() => handleEdit(template)}
                      title="Edit"
                    >
                      <Pencil className="copa:h-4 copa:w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="copa:h-8 copa:w-8"
                      onClick={() => handleDelete(template.id)}
                      title="Delete"
                    >
                      <Trash2 className="copa:h-4 copa:w-4 copa:text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="copa:pt-0 copa:pb-4">
                {/* Body content is hidden — clicking the Preview
                    (eye) icon opens the full email in a modal, so
                    inlining a multi-line body just bloats the
                    grid. Subject is enough at-a-glance context. */}
                <div>
                  <p className="copa:text-xs copa:text-muted-foreground">Subject</p>
                  <p className="copa:text-sm copa:font-medium copa:truncate">{template.email_subject}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="copa:max-w-3xl copa:max-h-[80vh] copa:overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.template_name}</DialogTitle>
            <DialogDescription>
              <span className="copa:font-medium">Subject:</span> {previewTemplate?.email_subject}
            </DialogDescription>
          </DialogHeader>
          <EmailPreviewFrame html={previewTemplate?.email_body || ""} />
        </DialogContent>
      </Dialog>

      {/* Create/Edit Template Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="copa:max-w-4xl copa:max-h-[90vh] copa:overflow-hidden copa:flex copa:flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Email Template" : "Add Email Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the email template."
                : "Create a new email template for automated communications."}
            </DialogDescription>
          </DialogHeader>
          <div className="copa:flex-1 copa:overflow-y-auto copa:space-y-4 copa:py-4">
            <div className="copa:grid copa:grid-cols-2 copa:gap-4">
              <div className="copa:space-y-2">
                <Label htmlFor="template-name">Template Name *</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e: any) => setTemplateName(e.target.value)}
                  placeholder="e.g., Payment Reminder"
                />
              </div>
              <div className="copa:space-y-2">
                <Label htmlFor="category">Category *</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={selectClass}
                >
                  {/* Keep a legacy category selectable when editing an older template. */}
                  {[...new Set([...CATEGORIES, category])].map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="copa:space-y-2">
              <Label htmlFor="template-engine">Template Engine</Label>
              <select
                id="template-engine"
                value={engine}
                onChange={(e) => setEngine(e.target.value as "jinja" | "mustache")}
                className={selectClass}
              >
                <option value="jinja">Jinja — supports {"{% if %}"}, {"{% for %}"}, filters</option>
                <option value="mustache">Mustache — {"{{var}}"} and {"{{#each}}"} only (legacy)</option>
              </select>
            </div>

            <div className="copa:space-y-2">
              <Label htmlFor="email-subject">Subject Line *</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e: any) => setEmailSubject(e.target.value)}
                placeholder="Email subject line"
              />
            </div>

            <div className="copa:space-y-2">
              <div className="copa:flex copa:items-center copa:justify-between">
                <Label>Body *</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Insert Placeholder
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="copa:max-h-96 copa:overflow-y-auto">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <DropdownMenuItem key={v.key} onClick={() => insertPlaceholder(`{{${v.key}}}`)}>
                        <span className="copa:flex-1">{v.label}</span>
                        <span className="copa:ml-3 copa:text-[11px] copa:font-mono copa:text-muted-foreground">{`{{${v.key}}}`}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="copa:border copa:rounded-md copa:bg-white copa:overflow-hidden">
                <div className="copa:flex copa:border-b copa:bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setActiveTab("preview")}
                    className={`copa:flex copa:items-center copa:gap-1.5 copa:px-4 copa:py-2 copa:text-xs copa:font-medium copa:transition-colors ${
                      activeTab === "preview"
                        ? "copa:text-primary copa:border-b-2 copa:border-primary copa:bg-white"
                        : "copa:text-muted-foreground copa:hover:text-foreground"
                    }`}
                  >
                    <Eye className="copa:h-3.5 copa:w-3.5" />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Only reload Quill from the body when coming FROM the
                      // Code tab — re-running it on a plain Preview→Write switch
                      // would re-parse and could drop editor content.
                      if (activeTab === "code" && quillRef.current) {
                        loadIntoQuill(quillRef.current, emailBody);
                      }
                      setActiveTab("write");
                    }}
                    className={`copa:flex copa:items-center copa:gap-1.5 copa:px-4 copa:py-2 copa:text-xs copa:font-medium copa:transition-colors ${
                      activeTab === "write"
                        ? "copa:text-primary copa:border-b-2 copa:border-primary copa:bg-white"
                        : "copa:text-muted-foreground copa:hover:text-foreground"
                    }`}
                  >
                    <PenLine className="copa:h-3.5 copa:w-3.5" />
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("code")}
                    className={`copa:flex copa:items-center copa:gap-1.5 copa:px-4 copa:py-2 copa:text-xs copa:font-medium copa:transition-colors ${
                      activeTab === "code"
                        ? "copa:text-primary copa:border-b-2 copa:border-primary copa:bg-white"
                        : "copa:text-muted-foreground copa:hover:text-foreground"
                    }`}
                  >
                    <Code2 className="copa:h-3.5 copa:w-3.5" />
                    Code
                  </button>
                </div>

                <div style={{ display: activeTab === "write" ? "block" : "none" }}>
                  <div ref={onEditorMount} style={{ height: "250px" }} />
                </div>

                {activeTab === "preview" && (
                  <div className="copa:bg-gray-100 copa:p-4" style={{ height: "292px", overflow: "auto" }}>
                    {emailBody && emailBody !== "<p><br></p>" ? (
                      <EmailPreviewFrame html={emailBody} />
                    ) : (
                      <div className="copa:flex copa:items-center copa:justify-center copa:h-full copa:text-muted-foreground copa:text-sm">
                        Nothing to preview. Write some content first.
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "code" && (
                  <div className="copa:bg-white" style={{ height: "292px", overflow: "auto" }}>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      spellCheck={false}
                      aria-label="Template HTML"
                      className="copa:h-full copa:w-full copa:resize-none copa:p-3 copa:font-mono copa:text-xs copa:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!templateName.trim() || !emailSubject.trim() || isSaving}
            >
              {editingTemplate ? "Update Template" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmailPreviewFrame({ html }: { html: string }) {
  const [srcDoc, setSrcDoc] = useState("");

  useEffect(() => {
    const rendered = ensureHtml(html);
    const sanitized = DOMPurify.sanitize(rendered, PURIFY_CONFIG);
    const isFullDoc = sanitized.trim().toLowerCase().startsWith("<!doctype") || sanitized.trim().toLowerCase().startsWith("<html");
    if (isFullDoc) {
      setSrcDoc(sanitized);
    } else {
      setSrcDoc(`<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;max-width:600px;margin:0 auto;}p{margin:0 0 10px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ddd;padding:8px;}a{color:#1a73e8;}</style>
</head><body>${sanitized}</body></html>`);
    }
  }, [html]);

  if (!srcDoc) return null;

  return (
    <iframe
      title="Email Preview"
      srcDoc={srcDoc}
      className="copa:w-full copa:border copa:rounded copa:bg-white"
      style={{ height: "500px" }}
      sandbox=""
    />
  );
}
