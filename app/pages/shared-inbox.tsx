import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useGetConversation, reactQuery } from "@bluecopa/react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import InboxSidebar, { type InboxFolder } from "~/components/email/inbox-sidebar";
import EmailList from "~/components/email/email-list";
import { InboxSkeleton } from "~/components/email/inbox-skeleton";
import EmailDetail, { type ReplyMode } from "~/components/email/email-detail";
import { ComposeEmailModal, type ComposeSendPayload } from "~/components/email/compose-email-modal";
import { countActiveFilters, type EmailSearchFilters } from "~/components/email/email-search-popover";
import { PageError } from "~/components/page-error";
import { useEmails, type EmailAttachmentPayload } from "~/hooks/email/use-emails";
import { useEmailSearch } from "~/hooks/email/use-email-search";
import { useDrafts, type DraftMessage, type ComposeDraftPayload } from "~/hooks/email/use-drafts";
import { useEmailWebSocket } from "~/hooks/email/use-email-websocket";
import { cn } from "~/utils/utils";

const { useQueryClient } = reactQuery;

const PAGE_SIZE = 20;
const QUICK_SEARCH_RESULT_CAP = 100;
// The Sent folder is filtered client-side, so a committed search widens the fetch.
const SENT_SEARCH_FETCH_SIZE = 500;
// Give the backend time to process a send before refetching the list.
const REFETCH_DELAY_MS = 5000;

// Backend timestamps without a tz marker are UTC — append "Z" so `new Date()`
// doesn't read them as local time.
const ensureUtcDate = (date: string | Date) =>
  typeof date === "string" && !date.endsWith("Z") && !date.includes("+") ? date + "Z" : date;

const formatDateTime = (date: string | Date) =>
  date ? format(new Date(ensureUtcDate(date)), "dd MMM yyyy, HH:mm") : "";

const getRelativeTime = (date: string | Date) =>
  date ? formatDistanceToNow(new Date(ensureUtcDate(date)), { addSuffix: true }) : "";

// lastMessageAt first so a conversation with a new mail moves to the top, not just new conversations.
const emailTime = (e: any) =>
  new Date(e.lastMessageAt || e.createdDate || e.createdAt || e.sentAt || 0).getTime();

export default function SharedInbox() {
  const queryClient = useQueryClient();
  const [activeFolder, setActiveFolder] = useState<InboxFolder>("inbox");
  const [currentPage, setCurrentPage] = useState(1);
  const [sentCurrentPage, setSentCurrentPage] = useState(1);

  // Advanced (server-side) search: empty filters → the list shows the regular
  // conversation feed. The page calls `runSearch` explicitly on Search / page change.
  const [advancedFilters, setAdvancedFilters] = useState<EmailSearchFilters>({});
  const [searchPage, setSearchPage] = useState(1);
  const advancedActive = countActiveFilters(advancedFilters) > 0;

  // Quick search runs on Enter (Gmail-style): `searchQuery` is the box,
  // `committedSearchQuery` is what was last submitted.
  const [searchQuery, setSearchQuery] = useState("");
  const [committedSearchQuery, setCommittedSearchQuery] = useState("");
  const handleSetSearchQuery = useCallback((value: string) => {
    setSearchQuery(value);
    if (!value.trim()) setCommittedSearchQuery("");
  }, []);

  // Inbox quick search = subject match ∪ sender match, merged by id.
  const quickSearchActive = Boolean(committedSearchQuery.trim()) && !advancedActive && activeFolder === "inbox";
  const { runSearch: runSubjectQuickSearch } = useEmailSearch();
  const { runSearch: runSenderQuickSearch } = useEmailSearch();
  const [quickSearchResults, setQuickSearchResults] = useState<any[]>([]);
  const [isQuickSearchFetching, setIsQuickSearchFetching] = useState(false);
  const quickSearchSeqRef = useRef(0);
  const commitSearchNow = useCallback(() => {
    const q = searchQuery.trim();
    setCommittedSearchQuery(searchQuery);
    if (!q || advancedActive || activeFolder !== "inbox") return;
    const seq = ++quickSearchSeqRef.current;
    setIsQuickSearchFetching(true);
    void Promise.allSettled([
      runSubjectQuickSearch({ subjectContains: q }, { page: 1, pageSize: QUICK_SEARCH_RESULT_CAP }),
      runSenderQuickSearch({ from: q }, { page: 1, pageSize: QUICK_SEARCH_RESULT_CAP }),
    ]).then((results) => {
      // A newer commit owns publishing now; drop this older response.
      if (seq !== quickSearchSeqRef.current) return;
      setIsQuickSearchFetching(false);
      if (results.some((r) => r.status === "rejected")) {
        toast.error("Search failed", { description: "Some results may be missing — try searching again." });
      }
      const byId = new Map<string, any>();
      results.forEach((r) => {
        if (r.status !== "fulfilled") return;
        const data = r.value as any;
        ((data?.content ?? data?.conversations ?? []) as any[]).forEach((c) => {
          if (c?.id) byId.set(c.id, c);
        });
      });
      setQuickSearchResults(Array.from(byId.values()));
    });
  }, [searchQuery, advancedActive, activeFolder, runSubjectQuickSearch, runSenderQuickSearch]);

  const sentSearchActive = Boolean(committedSearchQuery.trim()) && !advancedActive && activeFolder === "sent";
  // Quick / sent search results are paged client-side.
  const searchPaginationActive = quickSearchActive || sentSearchActive;
  const [searchDisplayPage, setSearchDisplayPage] = useState(1);
  useEffect(() => {
    setSearchDisplayPage(1);
  }, [committedSearchQuery]);

  const {
    conversations: listEmails,
    pagination: listPagination,
    loading,
    error: emailsError,
    createConversation,
    replyToConversation,
    refetch: refetchConversations,
    markConversationRead,
    sentMessages,
    sentPagination,
    refetchSent,
  } = useEmails(
    currentPage,
    PAGE_SIZE,
    sentSearchActive ? 1 : sentCurrentPage,
    sentSearchActive ? SENT_SEARCH_FETCH_SIZE : PAGE_SIZE,
  );
  const {
    runSearch,
    reset: resetSearch,
    conversations: searchEmails,
    pagination: searchPagination,
  } = useEmailSearch();
  const { drafts, saveDraft, deleteDraft } = useDrafts();

  const rawEmails = quickSearchActive ? quickSearchResults : advancedActive ? searchEmails : listEmails;
  const pagination = advancedActive ? searchPagination : listPagination;

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedSentMessage, setSelectedSentMessage] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyMode, setReplyMode] = useState<ReplyMode | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  // Collapse the email list to give a long thread the full width.
  const [emailListCollapsed, setEmailListCollapsed] = useState(false);

  const invalidateSelectedConversation = useCallback(() => {
    if (selectedConversationId) {
      queryClient.invalidateQueries({ queryKey: ["emailConversation", selectedConversationId] });
    }
  }, [queryClient, selectedConversationId]);

  // Real-time updates.
  const onWsEvent = useCallback(() => {
    refetchConversations();
    refetchSent();
    invalidateSelectedConversation();
  }, [refetchConversations, refetchSent, invalidateSelectedConversation]);
  useEmailWebSocket({ onMessageNew: onWsEvent, onConversationUpdate: onWsEvent });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (activeFolder === "sent") await refetchSent();
      // Drafts are a live subscription — nothing to refetch.
      else if (activeFolder === "inbox" && advancedActive) await runSearch(advancedFilters, { page: searchPage });
      else if (activeFolder === "inbox") await refetchConversations();
      invalidateSelectedConversation();
    } finally {
      setIsRefreshing(false);
    }
  }, [activeFolder, advancedActive, advancedFilters, searchPage, runSearch, refetchSent, refetchConversations, invalidateSelectedConversation]);

  // Conversation detail is only fetched for inbox items; Sent items are self-contained.
  const { data: conversationDetail, isLoading: isDetailLoading } = useGetConversation(
    activeFolder !== "sent" ? selectedConversationId : null,
  );
  const listItem = selectedConversationId ? (rawEmails.find((e: any) => e.id === selectedConversationId) ?? null) : null;
  const selectedEmail = activeFolder === "sent" ? selectedSentMessage : (conversationDetail ?? listItem);
  const messages: any[] = selectedEmail?.messages ?? [];

  const editingDraftData = editingDraftId ? drafts.find((d) => d.id === editingDraftId) : undefined;

  const refetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
    },
    [],
  );
  const scheduleRefetch = () => {
    if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
    refetchTimeoutRef.current = setTimeout(() => refetchConversations(), REFETCH_DELAY_MS);
  };

  const closeCompose = () => {
    setComposeOpen(false);
    setReplyMode(null);
    setEditingDraftId(null);
  };

  const handleSendEmail = async (email: ComposeSendPayload) => {
    await createConversation({
      toEmail: email.to,
      cc: email.cc,
      bcc: email.bcc,
      subject: email.subject,
      bodyHtml: email.body,
      attachments: email.attachments,
    });
    // Sent from a draft → the draft is done.
    if (editingDraftId) deleteDraft(editingDraftId).catch(() => {}); // toast already shown
    closeCompose();
    scheduleRefetch();
  };

  const handleReplyEmail = async (
    conversationId: string,
    bodyHtml: string,
    attachments?: EmailAttachmentPayload[],
    toEmail?: string[],
  ) => {
    await replyToConversation(conversationId, bodyHtml, attachments, toEmail);
    invalidateSelectedConversation();
    closeCompose();
    scheduleRefetch();
  };

  const handleSaveDraft = async (draftData: ComposeDraftPayload) => {
    await saveDraft(draftData, editingDraftId ?? undefined);
    closeCompose();
  };

  const handleOpenDraft = (draft: DraftMessage) => {
    setEditingDraftId(draft.id);
    setSelectedConversationId(null);
    setReplyMode(null);
    setComposeOpen(true);
  };

  // --- Data processing ---
  const emails = useMemo(
    () =>
      rawEmails.map((email: any) => ({
        ...email,
        threadId: email.threadId || `thread-${email.id}`,
        // The list bolds unread rows; conversations predating `readStatus` count as read.
        isRead: email.readStatus ? email.readStatus === "READ" : true,
      })),
    [rawEmails],
  );

  const emailThreads = useMemo(() => {
    // Sent: one row per message. The sent query keys off the sender's address,
    // so a committed search filters the widened fetch client-side.
    if (activeFolder === "sent") {
      let sent = sentMessages as any[];
      if (committedSearchQuery) {
        const q = committedSearchQuery.toLowerCase();
        sent = sent.filter((e: any) => {
          const toStr = Array.isArray(e.toEmail) ? e.toEmail.join(", ") : e.toEmail || "";
          return e.subject?.toLowerCase().includes(q) || toStr.toLowerCase().includes(q);
        });
      }
      return sent.map((e: any) => [e]).sort((a: any[], b: any[]) => emailTime(b[0]) - emailTime(a[0]));
    }
    const threads: Record<string, any[]> = {};
    emails.forEach((e: any) => {
      (threads[e.threadId] ??= []).push(e);
    });
    return Object.values(threads).sort((a, b) => emailTime(b[0]) - emailTime(a[0]));
  }, [emails, sentMessages, activeFolder, committedSearchQuery]);

  const displayThreads = searchPaginationActive
    ? emailThreads.slice((searchDisplayPage - 1) * PAGE_SIZE, searchDisplayPage * PAGE_SIZE)
    : emailThreads;
  const searchDisplayTotalPages = Math.max(1, Math.ceil(emailThreads.length / PAGE_SIZE));

  if (loading) return <InboxSkeleton />;

  if (emailsError)
    return (
      <PageError title="Failed to load inbox" description={(emailsError as Error)?.message} onRetry={refetchConversations} />
    );

  const handleFolderChange = (f: InboxFolder) => {
    if (f !== activeFolder) handleSetSearchQuery("");
    setActiveFolder(f);
    setSelectedConversationId(null);
    if (f === "sent") refetchSent();
    else if (f === "inbox") refetchConversations();
  };

  const hasSelection = Boolean(selectedEmail || (isDetailLoading && selectedConversationId));

  return (
    <>
      <div className="copa:flex copa:h-full copa:overflow-hidden copa:text-body copa:bg-background">
        <InboxSidebar
          activeFolder={activeFolder}
          onFolderChange={handleFolderChange}
          inboxCount={pagination.totalElements}
          draftsCount={drafts.length}
          sentCount={sentPagination.totalElements}
          onCompose={() => {
            setReplyMode(null);
            setComposeOpen(true);
          }}
        />

        {/* Restore strip — replaces the email list while it's collapsed */}
        {emailListCollapsed && (
          <button
            type="button"
            onClick={() => setEmailListCollapsed(false)}
            className="copa:cursor-pointer copa:hidden copa:lg:flex copa:flex-col copa:items-center copa:gap-2 copa:border-r copa:bg-muted/30 copa:hover:bg-muted copa:px-2 copa:py-3 copa:shrink-0"
            title="Expand email list"
            aria-label="Expand email list"
          >
            <PanelLeftOpen className="copa:h-4 copa:w-4 copa:text-primary" />
            <span className="copa:text-[11px] copa:font-medium copa:text-foreground copa:tracking-wide" style={{ writingMode: "vertical-rl" }}>
              Email list
            </span>
          </button>
        )}

        {/* Email list — full width below lg; hidden there while a thread is open */}
        <div
          className={cn(
            "copa:flex-1 copa:min-w-0 copa:lg:flex-initial",
            hasSelection ? "copa:hidden copa:lg:flex" : "copa:flex",
            emailListCollapsed && "copa:lg:hidden",
          )}
        >
          <EmailList
            searchQuery={searchQuery}
            setSearchQuery={handleSetSearchQuery}
            onSearchSubmit={commitSearchNow}
            isQuickSearching={quickSearchActive && isQuickSearchFetching}
            emailThreads={displayThreads}
            selectedEmail={selectedEmail}
            onSelectEmail={(email: any) => {
              if (activeFolder === "sent") {
                setSelectedSentMessage(email);
                setSelectedConversationId(null);
              } else {
                setSelectedConversationId(email?.id ?? null);
                setSelectedSentMessage(null);
                if (email?.id && email?.readStatus === "UNREAD") markConversationRead(email.id);
              }
            }}
            getRelativeTime={getRelativeTime}
            activeFolder={activeFolder}
            onFolderChange={handleFolderChange}
            inboxCount={emails.length}
            sentCount={sentPagination.totalElements}
            draftsCount={drafts.length}
            drafts={drafts}
            onOpenDraft={handleOpenDraft}
            onDeleteDraft={(draftId) => deleteDraft(draftId).catch(() => {})}
            pagination={
              searchPaginationActive
                ? {
                    pageNumber: searchDisplayPage,
                    totalPages: searchDisplayTotalPages,
                    isLast: searchDisplayPage >= searchDisplayTotalPages,
                  }
                : activeFolder === "sent"
                  ? sentPagination
                  : pagination
            }
            onPageChange={
              searchPaginationActive
                ? setSearchDisplayPage
                : activeFolder === "sent"
                  ? setSentCurrentPage
                  : advancedActive
                    ? (page: number) => {
                        setSearchPage(page);
                        runSearch(advancedFilters, { page });
                      }
                    : setCurrentPage
            }
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            advancedFilters={advancedFilters}
            onAdvancedSearch={(filters) => {
              // Back to page 1, and drop a selection the new filters may exclude.
              setSearchPage(1);
              setAdvancedFilters(filters);
              setSelectedConversationId(null);
              runSearch(filters, { page: 1 });
            }}
            onClearAdvancedSearch={() => {
              setAdvancedFilters({});
              setSearchPage(1);
              resetSearch();
            }}
          />
        </div>

        {!emailListCollapsed && (
          <button
            type="button"
            onClick={() => setEmailListCollapsed(true)}
            className="copa:cursor-pointer copa:hidden copa:lg:flex copa:flex-col copa:items-center copa:gap-2 copa:border-l copa:bg-muted/30 copa:hover:bg-muted copa:px-2 copa:py-3 copa:shrink-0"
            title="Collapse email list"
            aria-label="Collapse email list"
          >
            <PanelLeftClose className="copa:h-4 copa:w-4 copa:text-muted-foreground" />
          </button>
        )}

        {/* Email detail — full width below lg while a thread is open */}
        <div className={cn("copa:flex-1 copa:min-w-0 copa:overflow-hidden", hasSelection ? "copa:flex" : "copa:hidden copa:lg:flex")}>
          {isDetailLoading && selectedConversationId && !selectedEmail ? (
            <div className="copa:flex-1 copa:flex copa:items-center copa:justify-center">
              <div className="copa:animate-spin copa:rounded-full copa:h-8 copa:w-8 copa:border-b-2 copa:border-primary" />
            </div>
          ) : (
            <EmailDetail
              selectedEmail={selectedEmail}
              messages={messages}
              isLoadingMessages={isDetailLoading}
              onReply={(mode) => {
                setReplyMode(mode);
                setComposeOpen(true);
              }}
              formatDateTime={formatDateTime}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              onBack={() => {
                setSelectedConversationId(null);
                setSelectedSentMessage(null);
              }}
            />
          )}
        </div>
      </div>

      <ComposeEmailModal
        open={composeOpen}
        onClose={closeCompose}
        onSend={handleSendEmail}
        onSaveDraft={handleSaveDraft}
        replyMode={replyMode}
        replyToEmail={replyMode ? selectedEmail : undefined}
        forwardMessages={
          replyMode === "forward"
            ? // Inbox threads forward every message; a Sent item forwards itself.
              messages.length
              ? messages
              : selectedEmail
                ? [selectedEmail]
                : undefined
            : undefined
        }
        onReply={handleReplyEmail}
        draftData={editingDraftData}
      />
    </>
  );
}
