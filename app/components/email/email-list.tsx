import { useState } from "react";
import { Search, Mail, ArrowDownCircle, Trash2, FileEdit, RefreshCw, ChevronDown, X } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/utils/utils";
import { EmailSearchPopover, countActiveFilters, type EmailSearchFilters } from "~/components/email/email-search-popover";
import { getFolders, type InboxFolder } from "~/components/email/inbox-sidebar";
import type { DraftMessage } from "~/hooks/email/use-drafts";

interface Pagination {
  pageNumber: number;
  totalPages: number;
  isLast: boolean;
}

interface EmailListProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  /** Fired on Enter in the search box — this is what actually runs the search. */
  onSearchSubmit: () => void;
  /** True while a submitted search is in flight. */
  isQuickSearching: boolean;
  emailThreads: any[][];
  selectedEmail: any;
  onSelectEmail: (email: any) => void;
  getRelativeTime: (date: string) => string;
  activeFolder: InboxFolder;
  onFolderChange: (folder: InboxFolder) => void;
  inboxCount: number;
  sentCount: number;
  draftsCount: number;
  drafts: DraftMessage[];
  onOpenDraft: (draft: DraftMessage) => void;
  onDeleteDraft: (draftId: string) => void;
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  advancedFilters: EmailSearchFilters;
  onAdvancedSearch: (filters: EmailSearchFilters) => void;
  onClearAdvancedSearch: () => void;
}

export default function EmailList({
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  isQuickSearching,
  emailThreads,
  selectedEmail,
  onSelectEmail,
  getRelativeTime,
  activeFolder,
  onFolderChange,
  inboxCount,
  sentCount,
  draftsCount,
  drafts,
  onOpenDraft,
  onDeleteDraft,
  pagination,
  onPageChange,
  onRefresh,
  isRefreshing,
  advancedFilters,
  onAdvancedSearch,
  onClearAdvancedSearch,
}: EmailListProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const activeFilterCount = countActiveFilters(advancedFilters);
  const mobileFolders = getFolders({ inboxCount, sentCount, draftsCount });

  return (
    <div className="copa:w-full copa:lg:w-[420px] copa:lg:min-w-[360px] copa:border-r copa:flex copa:flex-col copa:h-full copa:bg-background">
      {/* Folder tabs — only on xs screens, where the sidebar is hidden */}
      <div className="copa:sm:hidden copa:border-b copa:bg-background copa:overflow-x-auto copa:shrink-0">
        <div className="copa:flex copa:min-w-max">
          {mobileFolders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onFolderChange(folder.id)}
              className={cn(
                "copa:flex copa:items-center copa:gap-1.5 copa:px-3 copa:py-2.5 copa:text-xs copa:font-medium copa:border-b-2 copa:transition-colors copa:whitespace-nowrap",
                activeFolder === folder.id
                  ? "copa:border-primary copa:text-primary"
                  : "copa:border-transparent copa:text-muted-foreground copa:hover:text-foreground",
              )}
            >
              <folder.icon className="copa:h-3.5 copa:w-3.5" />
              {folder.label}
              {folder.count > 0 && (
                <Badge variant="secondary" className="copa:h-4 copa:px-1 copa:text-[9px] copa:rounded-full copa:ml-0.5">
                  {folder.count}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="copa:p-3 copa:border-b copa:shrink-0 copa:space-y-2">
        <div className="copa:flex copa:items-center copa:gap-2">
          <div className="copa:relative copa:flex-1">
            {isQuickSearching ? (
              <RefreshCw className="copa:absolute copa:left-3 copa:inset-y-0 copa:my-auto copa:h-4 copa:w-4 copa:text-muted-foreground copa:animate-spin" />
            ) : (
              <Search className="copa:absolute copa:left-3 copa:inset-y-0 copa:my-auto copa:h-4 copa:w-4 copa:text-muted-foreground" />
            )}
            <Input
              placeholder="Search emails... (press Enter)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSearchSubmit();
                }
              }}
              // Right padding leaves room for the clear button and the chevron.
              className={cn("copa:pl-9 copa:h-9", searchQuery ? "copa:pr-16" : "copa:pr-9")}
            />
            <div className="copa:absolute copa:right-1.5 copa:inset-y-0 copa:my-auto copa:h-7 copa:flex copa:items-center copa:gap-0.5">
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="copa:h-7 copa:w-7 copa:inline-flex copa:items-center copa:justify-center copa:rounded-md copa:text-muted-foreground copa:hover:bg-muted copa:hover:text-foreground copa:transition-colors copa:cursor-pointer"
                >
                  <X className="copa:h-4 copa:w-4" />
                </button>
              )}
              <EmailSearchPopover
                value={advancedFilters}
                onApply={onAdvancedSearch}
                onClear={onClearAdvancedSearch}
                open={advancedOpen}
                onOpenChange={setAdvancedOpen}
                trigger={
                  <button
                    type="button"
                    aria-label="Advanced search filters"
                    className={cn(
                      "copa:h-7 copa:w-7 copa:inline-flex copa:items-center copa:justify-center copa:rounded-md copa:transition-colors copa:cursor-pointer",
                      activeFilterCount > 0
                        ? "copa:text-primary copa:bg-primary/10 copa:hover:bg-primary/15"
                        : "copa:text-muted-foreground copa:hover:bg-muted copa:hover:text-foreground",
                    )}
                  >
                    <ChevronDown className="copa:h-4 copa:w-4" />
                  </button>
                }
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="copa:h-9 copa:w-9 copa:shrink-0"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh"
            aria-label="Refresh email list"
          >
            <RefreshCw className={cn("copa:h-4 copa:w-4", isRefreshing && "copa:animate-spin")} />
          </Button>
        </div>

        {activeFilterCount > 0 && (
          <div className="copa:flex copa:items-center copa:justify-between copa:gap-2 copa:text-xs">
            <span className="copa:text-muted-foreground">
              {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} active
            </span>
            <button type="button" onClick={onClearAdvancedSearch} className="copa:text-primary copa:hover:underline copa:cursor-pointer">
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="copa:flex-1 copa:overflow-y-auto">
        {activeFolder === "drafts" ? (
          drafts.length === 0 ? (
            <div className="copa:p-10 copa:text-center copa:flex copa:flex-col copa:items-center copa:justify-center copa:text-muted-foreground">
              <FileEdit className="copa:h-10 copa:w-10 copa:mb-2 copa:opacity-20" />
              <p className="copa:text-sm">No drafts saved</p>
            </div>
          ) : (
            <div className="copa:divide-y copa:divide-border/50">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  role="button"
                  tabIndex={0}
                  className="copa:px-4 copa:py-3 copa:hover:bg-muted/50 copa:cursor-pointer copa:transition-colors"
                  onClick={() => onOpenDraft(draft)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenDraft(draft);
                    }
                  }}
                >
                  <div className="copa:flex copa:items-center copa:justify-between copa:mb-1">
                    <span className="copa:text-sm copa:font-medium copa:truncate copa:flex-1">{draft.to || "(No recipient)"}</span>
                    <div className="copa:flex copa:items-center copa:gap-1">
                      <span className="copa:text-[10px] copa:text-muted-foreground">
                        {draft.savedAt ? getRelativeTime(draft.savedAt) : ""}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete draft"
                        className="copa:h-6 copa:w-6 copa:text-muted-foreground copa:hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDraft(draft.id);
                        }}
                      >
                        <Trash2 className="copa:h-3 copa:w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="copa:text-sm copa:truncate copa:text-muted-foreground">{draft.subject || "(No subject)"}</div>
                  <div className="copa:text-xs copa:truncate copa:text-muted-foreground/60 copa:mt-0.5">
                    {draft.body.replace(/<[^>]*>/g, "").substring(0, 60)}
                  </div>
                  <Badge variant="outline" className="copa:mt-1 copa:text-[9px] copa:h-4 copa:bg-amber-50 copa:text-amber-600 copa:border-amber-100">
                    Draft
                  </Badge>
                </div>
              ))}
            </div>
          )
        ) : emailThreads.length === 0 ? (
          <div className="copa:p-10 copa:text-center copa:flex copa:flex-col copa:items-center copa:justify-center copa:text-muted-foreground">
            <Mail className="copa:h-10 copa:w-10 copa:mb-2 copa:opacity-20" />
            <p className="copa:text-sm">No emails found</p>
          </div>
        ) : (
          <div className="copa:divide-y copa:divide-border/50">
            {emailThreads
              .filter((thread) => thread.length > 0)
              .map((thread) => (
                <EmailThreadItem
                  key={thread[0].id}
                  thread={thread}
                  isSelected={selectedEmail?.id === thread[0].id}
                  onSelect={() => onSelectEmail(thread[0])}
                  getRelativeTime={getRelativeTime}
                />
              ))}
          </div>
        )}
      </div>

      {pagination.totalPages > 1 && activeFolder !== "drafts" && (
        <div className="copa:px-2 copa:py-2 copa:border-t copa:bg-muted/20 copa:flex copa:items-center copa:justify-between copa:text-xs">
          <div className="copa:flex copa:items-center copa:gap-1">
            <button
              className="copa:px-2 copa:py-1 copa:text-xs copa:text-muted-foreground copa:hover:text-foreground copa:disabled:opacity-40"
              disabled={pagination.pageNumber <= 1}
              onClick={() => onPageChange(pagination.pageNumber - 1)}
            >
              &lt; Prev
            </button>
            {pageButtons(pagination).map((p, i) =>
              p === null ? (
                <span key={`gap-${i}`} className="copa:px-1 copa:text-muted-foreground">...</span>
              ) : (
                <button
                  key={p}
                  className={cn(
                    "copa:h-6 copa:w-6 copa:rounded copa:text-xs copa:font-medium",
                    p === pagination.pageNumber ? "copa:bg-primary copa:text-white" : "copa:hover:bg-muted",
                  )}
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </button>
              ),
            )}
            <button
              className="copa:px-2 copa:py-1 copa:text-xs copa:text-muted-foreground copa:hover:text-foreground copa:disabled:opacity-40"
              disabled={pagination.isLast}
              onClick={() => onPageChange(pagination.pageNumber + 1)}
            >
              Next &gt;
            </button>
          </div>
          <span className="copa:text-muted-foreground">
            Page {pagination.pageNumber} of {pagination.totalPages}
          </span>
        </div>
      )}
    </div>
  );
}

/** First three pages, an ellipsis, then the last three (null = ellipsis). */
function pageButtons({ pageNumber, totalPages }: Pagination): (number | null)[] {
  const first = [1, 2, 3].filter((p) => p <= totalPages);
  const last = [totalPages - 2, totalPages - 1, totalPages].filter((p) => p > 3);
  const gap = totalPages > 6 && pageNumber < totalPages - 3 ? [null] : [];
  return [...first, ...gap, ...last];
}

function EmailThreadItem({
  thread,
  isSelected,
  onSelect,
  getRelativeTime,
}: {
  thread: any[];
  isSelected: boolean;
  onSelect: () => void;
  getRelativeTime: (date: string) => string;
}) {
  const latestEmail = thread[0];
  const isInbound = latestEmail.direction === "inbound" || !!latestEmail.fromAddress;
  const toLine = Array.isArray(latestEmail.toAddresses)
    ? latestEmail.toAddresses.join(", ")
    : (latestEmail.toAddresses || latestEmail.toEmail?.join?.(", ") || "");

  return (
    <div
      onClick={onSelect}
      className={cn(
        "copa:px-4 copa:py-3 copa:cursor-pointer copa:transition-colors copa:hover:bg-muted/50",
        isSelected && "copa:bg-primary/5 copa:border-l-2 copa:border-primary",
        !latestEmail.isRead && "copa:bg-blue-50/40",
      )}
    >
      <div className="copa:flex copa:items-start copa:justify-between copa:gap-2">
        <div className="copa:flex-1 copa:min-w-0">
          <div className="copa:flex copa:items-center copa:gap-2 copa:mb-0.5">
            {!latestEmail.isRead && <div className="copa:w-2 copa:h-2 copa:rounded-full copa:bg-blue-500 copa:shrink-0" />}
            {isInbound && <ArrowDownCircle className="copa:h-3 copa:w-3 copa:text-blue-500 copa:shrink-0" />}
            <span
              className={cn(
                "copa:text-sm copa:truncate copa:block",
                !latestEmail.isRead ? "copa:font-semibold copa:text-foreground" : "copa:text-muted-foreground",
              )}
            >
              {isInbound ? latestEmail.fromAddress || latestEmail.from : toLine}
            </span>
          </div>

          <div className={cn("copa:text-sm copa:truncate copa:mt-1", !latestEmail.isRead && "copa:font-medium")}>
            {latestEmail.subject || "(No subject)"}
          </div>

          <div className="copa:text-xs copa:text-muted-foreground copa:truncate copa:mt-1 copa:leading-relaxed">
            {(latestEmail.bodyText || latestEmail.body || "").substring(0, 60)}...
          </div>
        </div>

        <div className="copa:flex copa:flex-col copa:items-end copa:gap-1.5 copa:shrink-0">
          <div className="copa:text-[10px] copa:text-muted-foreground copa:font-medium">
            {getRelativeTime(latestEmail.lastMessageAt || latestEmail.sentAt || latestEmail.createdDate || latestEmail.createdAt)}
          </div>
          {thread.length > 1 && (
            <Badge variant="outline" className="copa:text-[10px] copa:h-4 copa:px-1.5 copa:rounded-full">
              {thread.length}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
