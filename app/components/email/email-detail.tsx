import {
  MoreVertical,
  Paperclip,
  ChevronDown,
  ChevronRight,
  FileText,
  Reply,
  ReplyAll,
  Forward,
  Mail,
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  File,
  FileCode,
  FileJson,
  RefreshCw,
  FileVideo,
  FileAudio,
  FileArchive,
  Presentation,
  Globe,
  ArrowLeft,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import PostalMime from "postal-mime";
import DOMPurify from "dompurify";
import { useGetFileUrlByFileId } from "@bluecopa/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { cn } from "~/utils/utils";

export type ReplyMode = "reply" | "reply-all" | "forward";

const STATUS_BADGES: Record<string, { variant: "default" | "outline" | "destructive"; label: string }> = {
  draft: { variant: "outline", label: "Draft" },
  sent: { variant: "default", label: "Sent" },
  delivered: { variant: "default", label: "Delivered" },
  failed: { variant: "destructive", label: "Failed" },
};

interface EmailDetailProps {
  selectedEmail: any;
  /** Thread messages from the conversation detail API. */
  messages: any[];
  isLoadingMessages: boolean;
  onReply: (mode: ReplyMode) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onBack: () => void;
  formatDateTime: (date: string) => string;
}

export default function EmailDetail({
  selectedEmail,
  messages,
  isLoadingMessages,
  onReply,
  onRefresh,
  isRefreshing,
  onBack,
  formatDateTime,
}: EmailDetailProps) {
  const threadContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to the newest message when a multi-message thread loads.
  useEffect(() => {
    if (!isLoadingMessages && messages.length > 1 && threadContainerRef.current) {
      setTimeout(() => {
        threadContainerRef.current?.scrollTo({
          top: threadContainerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    }
  }, [messages, isLoadingMessages, selectedEmail?.id]);

  if (!selectedEmail) {
    return (
      <div className="copa:flex-1 copa:flex copa:flex-col copa:items-center copa:justify-center copa:text-muted-foreground copa:bg-background">
        <Mail className="copa:h-16 copa:w-16 copa:mb-4 copa:opacity-10" />
        <p className="copa:text-sm copa:font-medium">Select an email to view its contents</p>
      </div>
    );
  }

  const status = selectedEmail.status ? String(selectedEmail.status) : "";
  const statusBadge = STATUS_BADGES[status] ?? { variant: "default" as const, label: status };

  return (
    <div className="copa:flex-1 copa:flex copa:flex-col copa:overflow-hidden copa:bg-background">
      <div className="copa:px-3 copa:py-3 copa:sm:px-6 copa:sm:py-4 copa:border-b">
        <div className="copa:flex copa:items-start copa:justify-between">
          <div className="copa:flex-1 copa:min-w-0">
            <div className="copa:flex copa:items-center copa:gap-2 copa:mb-1">
              <Button
                variant="ghost"
                size="icon"
                className="copa:h-8 copa:w-8 copa:shrink-0 copa:lg:hidden"
                onClick={onBack}
                title="Back to inbox"
                aria-label="Back to inbox"
              >
                <ArrowLeft className="copa:h-4 copa:w-4" />
              </Button>
              <h2 className="copa:text-base copa:sm:text-xl copa:font-bold copa:tracking-tight copa:truncate">
                {selectedEmail.subject || "(No subject)"}
              </h2>
            </div>
          </div>

          <div className="copa:flex copa:items-center copa:gap-2">
            {statusBadge.label && <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>}
            <Button
              variant="ghost"
              size="icon"
              className="copa:h-8 copa:w-8"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh"
              aria-label="Refresh message"
            >
              <RefreshCw className={cn("copa:h-4 copa:w-4", isRefreshing && "copa:animate-spin")} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="copa:h-8 copa:w-8" aria-label="More actions">
                  <MoreVertical className="copa:h-4 copa:w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="copa:cursor-pointer" onClick={() => onReply("reply")}>
                  <Reply className="copa:mr-2 copa:h-4 copa:w-4" /> Reply
                </DropdownMenuItem>
                <DropdownMenuItem className="copa:cursor-pointer" onClick={() => onReply("reply-all")}>
                  <ReplyAll className="copa:mr-2 copa:h-4 copa:w-4" /> Reply All
                </DropdownMenuItem>
                <DropdownMenuItem className="copa:cursor-pointer" onClick={() => onReply("forward")}>
                  <Forward className="copa:mr-2 copa:h-4 copa:w-4" /> Forward
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div ref={threadContainerRef} className="copa:flex-1 copa:overflow-y-auto">
        {isLoadingMessages ? (
          <div className="copa:flex copa:items-center copa:justify-center copa:py-12">
            <div className="copa:animate-spin copa:rounded-full copa:h-6 copa:w-6 copa:border-b-2 copa:border-primary" />
          </div>
        ) : messages.length > 0 ? (
          <div className="copa:divide-y">
            {messages.map((msg: any, idx: number) => (
              <ThreadMessage
                key={msg.id}
                msg={msg}
                isLast={idx === messages.length - 1}
                formatDateTime={formatDateTime}
              />
            ))}
          </div>
        ) : selectedEmail.emlStorageKey ? (
          <div className="copa:px-6 copa:py-8">
            <MessageBody
              emlStorageKey={selectedEmail.emlStorageKey}
              fallbackHtml={selectedEmail.bodyHtml}
              fallbackText={selectedEmail.bodyText || selectedEmail.body}
            />
          </div>
        ) : selectedEmail.bodyHtml ? (
          <div
            className="copa:px-6 copa:py-8 copa:max-w-none copa:font-sans copa:text-foreground/90 copa:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedEmail.bodyHtml) }}
          />
        ) : (
          <div className="copa:px-6 copa:py-8 copa:max-w-none copa:whitespace-pre-wrap copa:font-sans copa:text-foreground/90 copa:leading-relaxed">
            {selectedEmail.bodyText || selectedEmail.body || "No content available"}
          </div>
        )}

        {/* Attachments for a single message without a thread (e.g. Sent items) */}
        {messages.length === 0 && selectedEmail.attachments?.length > 0 && (
          <div className="copa:px-6 copa:pb-4 copa:flex copa:flex-wrap copa:gap-2">
            {selectedEmail.attachments.map((file: any, idx: number) => (
              <AttachmentItem key={file.id || idx} file={file} />
            ))}
          </div>
        )}
      </div>

      <div className="copa:px-6 copa:py-4 copa:border-t copa:bg-muted/20 copa:flex copa:items-center copa:gap-2 copa:flex-wrap">
        <Button variant="outline" size="sm" onClick={() => onReply("reply")} className="copa:h-9 copa:shadow-sm">
          <Reply className="copa:h-4 copa:w-4 copa:mr-2" /> Reply
        </Button>
        <Button variant="outline" size="sm" onClick={() => onReply("reply-all")} className="copa:h-9 copa:shadow-sm">
          <ReplyAll className="copa:h-4 copa:w-4 copa:mr-2" /> Reply All
        </Button>
        <Button variant="outline" size="sm" onClick={() => onReply("forward")} className="copa:h-9 copa:shadow-sm">
          <Forward className="copa:h-4 copa:w-4 copa:mr-2" /> Forward
        </Button>
      </div>
    </div>
  );
}

/**
 * Helper Component: Collapsible thread message — only last message expanded by default
 */
function ThreadMessage({
  msg,
  isLast,
  formatDateTime,
}: {
  msg: any;
  isLast: boolean;
  formatDateTime: (date: string) => string;
}) {
  const [expanded, setExpanded] = useState(isLast);
  const isInbound = (msg.direction || "").toLowerCase() === "inbound";

  return (
    <div className="copa:px-6 copa:py-3">
      <div
        className={`copa:flex copa:items-center copa:gap-3 ${!expanded ? "copa:cursor-pointer copa:hover:bg-muted/30 copa:-mx-2 copa:px-2 copa:py-1 copa:rounded-md" : "copa:mb-3"}`}
        onClick={() => !expanded && setExpanded(true)}
      >
        <button
          className="copa:shrink-0 copa:p-0.5 copa:text-muted-foreground copa:hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? (
            <ChevronDown className="copa:h-4 copa:w-4" />
          ) : (
            <ChevronRight className="copa:h-4 copa:w-4" />
          )}
        </button>
        <span
          className={`copa:flex copa:h-7 copa:w-7 copa:shrink-0 copa:items-center copa:justify-center copa:rounded-full copa:border copa:text-[10px] copa:font-bold ${isInbound ? "copa:bg-blue-100 copa:text-blue-700" : "copa:bg-muted"}`}
        >
          {(msg.fromAddress || "?").charAt(0).toUpperCase()}
        </span>
        <div className="copa:flex-1 copa:min-w-0">
          <div className="copa:flex copa:items-center copa:gap-2 copa:min-w-0">
            <span
              className={`copa:text-sm copa:truncate copa:min-w-0 ${expanded ? "copa:font-semibold" : "copa:font-medium copa:text-muted-foreground"}`}
            >
              {msg.fromAddress}
            </span>
            <Badge
              variant="secondary"
              className={`copa:text-[10px] copa:h-4 copa:shrink-0 ${isInbound ? "copa:bg-blue-50 copa:text-blue-600 copa:border-blue-100" : "copa:bg-green-50 copa:text-green-600 copa:border-green-100"}`}
            >
              {isInbound ? "Inbound" : "Outbound"}
            </Badge>
            {!expanded && (
              <span className="copa:text-xs copa:text-muted-foreground copa:truncate">
                — {msg.subject}
              </span>
            )}
            <span className="copa:ml-auto copa:shrink-0 copa:text-xs copa:text-muted-foreground">
              {formatDateTime(msg.createdDate)}
            </span>
          </div>
          {expanded && (
            <div className="copa:text-xs copa:text-muted-foreground">
              <div>
                To:{" "}
                {Array.isArray(msg.toAddresses)
                  ? msg.toAddresses.join(", ")
                  : msg.toAddresses}
              </div>
              {(() => {
                const cc = msg.ccAddresses || msg.cc || msg.ccRecipients;
                return cc?.length > 0 ? (
                  <div>CC: {Array.isArray(cc) ? cc.join(", ") : cc}</div>
                ) : null;
              })()}
              {(() => {
                const bcc = msg.bccAddresses || msg.bcc || msg.bccRecipients;
                return bcc?.length > 0 ? (
                  <div>BCC: {Array.isArray(bcc) ? bcc.join(", ") : bcc}</div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <>
          <MessageBody
            emlStorageKey={msg.emlStorageKey}
            fallbackHtml={msg.bodyHtml}
            fallbackText={msg.bodyText || msg.body}
          />
          {msg.attachments?.length > 0 && (
            <div className="copa:pl-11 copa:mt-3 copa:flex copa:flex-wrap copa:gap-2">
              {msg.attachments.map((file: any, idx: number) => (
                <AttachmentItem key={file.id || idx} file={file} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Helper Component: Attachment with View & Download actions using filePath signed URL
 */
function getContentTypeFromExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    ico: "image/x-icon",
    pdf: "application/pdf",
    txt: "text/plain",
    html: "text/html",
    csv: "text/csv",
    json: "application/json",
    xml: "application/xml",
    js: "text/javascript",
    ts: "text/typescript",
    css: "text/css",
    md: "text/markdown",
    log: "text/plain",
    yaml: "text/yaml",
    yml: "text/yaml",
    ini: "text/plain",
    cfg: "text/plain",
    eml: "message/rfc822",
    ics: "text/calendar",
    vcf: "text/vcard",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  return map[ext] || "";
}

function AttachmentItem({ file }: { file: any }) {
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [textContent, setTextContent] = useState<string>("");
  const fileName = file.name || file.filename || "attachment";
  // Resolve content type: prefer explicit type, fall back to extension-based detection
  const rawType = file.contentType || file.content_type || "";
  const contentType =
    rawType && rawType !== "application/octet-stream"
      ? rawType
      : getContentTypeFromExtension(fileName) || "application/octet-stream";
  const isImage = contentType.startsWith("image/");
  const isPdf = contentType === "application/pdf";
  const isHtml = contentType === "text/html";
  const isCodeOrData = [
    "application/json",
    "application/xml",
    "text/xml",
    "text/javascript",
    "text/typescript",
    "text/css",
    "text/yaml",
    "text/markdown",
  ].includes(contentType);
  const isText = contentType.startsWith("text/") && !isHtml && !isCodeOrData;
  const isAudio = contentType.startsWith("audio/");
  const isVideo = contentType.startsWith("video/");

  const filePath = file.filePath || file.filepath || file.key;
  const signedUrlQuery = useGetFileUrlByFileId(
    filePath || null,
    contentType,
    "GET",
    { enabled: false },
  );

  const getSignedUrl = useCallback(async (): Promise<string> => {
    if (!filePath) throw new Error("No file path available");
    const result = await signedUrlQuery.refetch();
    const data = result.data;
    const url =
      typeof data === "string" ? data : (data?.data ?? data?.url ?? "");
    if (!url) throw new Error("Failed to get download URL");
    return url;
  }, [filePath, signedUrlQuery]);

  const handleView = async () => {
    setLoading(true);
    try {
      const url = await getSignedUrl();
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Preview fetch failed (${response.status})`);
      }
      const blob = await response.blob();
      if (isCodeOrData || isText) {
        const text = await blob.text();
        setTextContent(text);
      }
      const viewBlob = new Blob([blob], { type: contentType });
      const blobUrl = URL.createObjectURL(viewBlob);
      setPreviewUrl(blobUrl);
      setPreviewOpen(true);
    } catch (err) {
      // Surface the underlying message so a 403 / CORS / wrong-key
      // failure is debuggable from the deployed app instead of a
      // generic "please try again" toast.
      const msg = err instanceof Error ? err.message : "Unknown error";
      // eslint-disable-next-line no-console
      console.error("[attachment] preview failed", {
        fileName,
        filePath,
        contentType,
        error: err,
      });
      toast.error(`Preview failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
    setTextContent("");
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const url = await getSignedUrl();
      // Fetch the file as a blob and trigger the download from a blob
      // URL. A direct `<a href={presignedUrl}>` redirects the browser
      // to the bucket (which on prod has `Content-Disposition:
      // inline`, so PDFs / images open in a tab instead of saving).
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Download fetch failed (${response.status})`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(
        new Blob([blob], { type: contentType }),
      );
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after a tick so Safari has time to start the save.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      // eslint-disable-next-line no-console
      console.error("[attachment] download failed", {
        fileName,
        filePath,
        contentType,
        error: err,
      });
      toast.error(`Download failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const hasFilePath = file.filePath || file.filepath || file.key;
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const fileSize = file.size || file.fileSize;

  // File type icon & color
  const getFileStyle = () => {
    if (isImage)
      return {
        Icon: FileImage,
        bg: "copa:bg-purple-50",
        text: "copa:text-purple-600",
        border: "copa:border-purple-100",
        label: ext.toUpperCase(),
      };
    if (isPdf)
      return {
        Icon: FileText,
        bg: "copa:bg-red-50",
        text: "copa:text-red-600",
        border: "copa:border-red-100",
        label: "PDF",
      };
    if (["xls", "xlsx", "csv"].includes(ext))
      return {
        Icon: FileSpreadsheet,
        bg: "copa:bg-green-50",
        text: "copa:text-green-600",
        border: "copa:border-green-100",
        label: ext.toUpperCase(),
      };
    if (["doc", "docx"].includes(ext))
      return {
        Icon: FileText,
        bg: "copa:bg-blue-50",
        text: "copa:text-blue-600",
        border: "copa:border-blue-100",
        label: ext.toUpperCase(),
      };
    if (ext === "json")
      return {
        Icon: FileJson,
        bg: "copa:bg-yellow-50",
        text: "copa:text-yellow-700",
        border: "copa:border-yellow-100",
        label: "JSON",
      };
    if (["xml", "yaml", "yml"].includes(ext))
      return {
        Icon: FileCode,
        bg: "copa:bg-orange-50",
        text: "copa:text-orange-600",
        border: "copa:border-orange-100",
        label: ext.toUpperCase(),
      };
    if (["js", "ts", "css", "md"].includes(ext))
      return {
        Icon: FileCode,
        bg: "copa:bg-cyan-50",
        text: "copa:text-cyan-600",
        border: "copa:border-cyan-100",
        label: ext.toUpperCase(),
      };
    if (isHtml)
      return {
        Icon: Globe,
        bg: "copa:bg-indigo-50",
        text: "copa:text-indigo-600",
        border: "copa:border-indigo-100",
        label: "HTML",
      };
    if (["ppt", "pptx"].includes(ext))
      return {
        Icon: Presentation,
        bg: "copa:bg-orange-50",
        text: "copa:text-orange-600",
        border: "copa:border-orange-100",
        label: ext.toUpperCase(),
      };
    if (isAudio)
      return {
        Icon: FileAudio,
        bg: "copa:bg-pink-50",
        text: "copa:text-pink-600",
        border: "copa:border-pink-100",
        label: ext.toUpperCase() || "AUDIO",
      };
    if (isVideo)
      return {
        Icon: FileVideo,
        bg: "copa:bg-violet-50",
        text: "copa:text-violet-600",
        border: "copa:border-violet-100",
        label: ext.toUpperCase() || "VIDEO",
      };
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext))
      return {
        Icon: FileArchive,
        bg: "copa:bg-amber-50",
        text: "copa:text-amber-600",
        border: "copa:border-amber-100",
        label: ext.toUpperCase(),
      };
    if (["eml", "msg"].includes(ext))
      return {
        Icon: Mail,
        bg: "copa:bg-sky-50",
        text: "copa:text-sky-600",
        border: "copa:border-sky-100",
        label: ext.toUpperCase(),
      };
    if (isText || isCodeOrData)
      return {
        Icon: FileText,
        bg: "copa:bg-slate-50",
        text: "copa:text-slate-600",
        border: "copa:border-slate-100",
        label: ext.toUpperCase() || "TEXT",
      };
    return {
      Icon: File,
      bg: "copa:bg-gray-50",
      text: "copa:text-gray-600",
      border: "copa:border-gray-100",
      label: ext.toUpperCase() || "FILE",
    };
  };

  const { Icon: FileIcon, bg, text, border, label } = getFileStyle();

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div
        className={`copa:group copa:flex copa:items-center copa:gap-3 copa:px-3 copa:py-2.5 copa:rounded-lg copa:border ${border} ${bg} copa:hover:shadow-sm copa:transition-all copa:cursor-default`}
      >
        {/* File type icon */}
        <div
          className={`copa:flex copa:items-center copa:justify-center copa:h-9 copa:w-9 copa:rounded-lg ${bg} ${text} copa:border ${border}`}
        >
          <FileIcon className="copa:h-4.5 copa:w-4.5" />
        </div>

        {/* File info */}
        <div className="copa:flex-1 copa:min-w-0">
          <p className="copa:text-xs copa:font-semibold copa:text-foreground copa:truncate copa:max-w-[160px]">
            {fileName}
          </p>
          <p className="copa:text-[10px] copa:text-muted-foreground copa:font-medium">
            {label}
            {fileSize ? ` · ${formatFileSize(fileSize)}` : ""}
          </p>
        </div>

        {/* Actions */}
        {hasFilePath && (
          <div className="copa:flex copa:items-center copa:gap-0.5 copa:opacity-70 copa:group-hover:opacity-100 copa:transition-opacity">
            <button
              onClick={handleView}
              disabled={loading}
              className={`copa:p-1.5 copa:rounded-md ${text} copa:hover:shadow-sm copa:transition-all`}
              title="View"
            >
              <Eye className="copa:h-3.5 copa:w-3.5" />
            </button>
            <button
              onClick={handleDownload}
              disabled={loading}
              className={`copa:p-1.5 copa:rounded-md ${text} copa:hover:shadow-sm copa:transition-all`}
              title="Download"
            >
              <Download className="copa:h-3.5 copa:w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={handleClosePreview}>
        <DialogContent className="copa:max-w-4xl copa:max-h-[90vh] copa:flex copa:flex-col">
          <DialogHeader>
            <DialogTitle className="copa:flex copa:items-center copa:gap-2 copa:text-sm">
              <Paperclip className="copa:h-4 copa:w-4" />
              {fileName}
            </DialogTitle>
          </DialogHeader>
          <div className="copa:flex-1 copa:overflow-auto copa:min-h-0">
            {isImage && previewUrl && (
              <img
                src={previewUrl}
                alt={fileName}
                className="copa:max-w-full copa:h-auto copa:mx-auto copa:rounded"
              />
            )}
            {isPdf && previewUrl && (
              <iframe
                src={previewUrl}
                className="copa:w-full copa:h-[70vh] copa:rounded copa:border-0"
                title={fileName}
              />
            )}
            {isHtml && previewUrl && (
              <iframe
                src={previewUrl}
                className="copa:w-full copa:h-[70vh] copa:rounded copa:border"
                sandbox="allow-same-origin"
                title={fileName}
              />
            )}
            {isCodeOrData && textContent && (
              <pre className="copa:w-full copa:h-[70vh] copa:overflow-auto copa:rounded copa:border copa:bg-[#1e1e1e] copa:text-[#d4d4d4] copa:p-4 copa:text-sm copa:font-mono copa:whitespace-pre-wrap copa:break-words">
                {contentType === "application/json"
                  ? (() => {
                      try {
                        return JSON.stringify(JSON.parse(textContent), null, 2);
                      } catch {
                        return textContent;
                      }
                    })()
                  : textContent}
              </pre>
            )}
            {isText && previewUrl && (
              <iframe
                src={previewUrl}
                className="copa:w-full copa:h-[70vh] copa:rounded copa:border copa:bg-white"
                title={fileName}
              />
            )}
            {isAudio && previewUrl && (
              <div className="copa:flex copa:items-center copa:justify-center copa:py-16">
                <audio controls src={previewUrl} className="copa:w-full copa:max-w-lg" />
              </div>
            )}
            {isVideo && previewUrl && (
              <video
                controls
                src={previewUrl}
                className="copa:w-full copa:h-[70vh] copa:rounded"
              />
            )}
            {!isImage &&
              !isPdf &&
              !isHtml &&
              !isCodeOrData &&
              !isText &&
              !isAudio &&
              !isVideo &&
              previewUrl && (
                <div className="copa:flex copa:flex-col copa:items-center copa:justify-center copa:py-16 copa:text-muted-foreground copa:gap-4">
                  <Paperclip className="copa:h-12 copa:w-12 copa:opacity-20" />
                  <p className="copa:text-sm">
                    Preview not available for this file type
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="copa:gap-2"
                  >
                    <Download className="copa:h-4 copa:w-4" /> Download File
                  </Button>
                </div>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Helper Component: Fetch and render email body from .eml file using signed URL
 */
function MessageBody({
  emlStorageKey,
  fallbackHtml,
  fallbackText,
}: {
  emlStorageKey?: string;
  fallbackHtml?: string;
  fallbackText?: string;
}) {
  const [htmlBody, setHtmlBody] = useState<string>("");
  const [textBody, setTextBody] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [emlFailed, setEmlFailed] = useState(false);

  const emlUrlQuery = useGetFileUrlByFileId(
    emlStorageKey || null,
    "message/rfc822",
    "GET",
    { enabled: !!emlStorageKey },
  );

  useEffect(() => {
    if (emlUrlQuery.isLoading) return;
    if (emlUrlQuery.error) {
      setEmlFailed(true);
      return;
    }
    const data = emlUrlQuery.data;
    if (!data) return;
    const url =
      typeof data === "string" ? data : (data?.data ?? data?.url ?? "");
    if (!url) {
      setEmlFailed(true);
      return;
    }
    setLoading(true);
    setEmlFailed(false);
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then(async (buffer) => {
        const parser = new PostalMime();
        const email = await parser.parse(buffer);
        setHtmlBody(email.html || "");
        setTextBody(email.text || "");
      })
      .catch(() => {
        setHtmlBody("");
        setTextBody("");
        setEmlFailed(true);
      })
      .finally(() => setLoading(false));
  }, [emlUrlQuery.data, emlUrlQuery.isLoading, emlUrlQuery.error]);

  if (!emlStorageKey) {
    return (
      <div className="copa:text-muted-foreground copa:italic copa:text-xs">
        No message body available
      </div>
    );
  }

  if (loading) {
    return (
      <div className="copa:flex copa:items-center copa:gap-2 copa:text-xs copa:text-muted-foreground">
        <div className="copa:animate-spin copa:rounded-full copa:h-3 copa:w-3 copa:border-b-2 copa:border-primary" />
        Loading message...
      </div>
    );
  }

  if (htmlBody) {
    return (
      <div
        className="copa:max-w-none copa:text-foreground/90 copa:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlBody) }}
      />
    );
  }

  if (textBody) {
    return (
      <div className="copa:max-w-none copa:text-foreground/90 copa:leading-relaxed copa:whitespace-pre-wrap">
        {textBody}
      </div>
    );
  }

  // Fallback to bodyHtml/bodyText when .eml loading fails
  if (emlFailed && fallbackHtml) {
    return (
      <div
        className="copa:max-w-none copa:text-foreground/90 copa:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(fallbackHtml) }}
      />
    );
  }

  if (emlFailed && fallbackText) {
    return (
      <div className="copa:max-w-none copa:text-foreground/90 copa:leading-relaxed copa:whitespace-pre-wrap">
        {fallbackText}
      </div>
    );
  }

  return (
    <div className="copa:text-muted-foreground copa:italic copa:text-xs">
      No message body available
    </div>
  );
}
