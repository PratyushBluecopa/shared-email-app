import { useCallback } from "react";
import { useSearchMessages, type EmailMessageSearchRequest } from "@bluecopa/react";
import { useAppContext } from "~/contexts/app-context";
import type { EmailSearchFilters } from "~/components/email/email-search-popover";

/**
 * Advanced email search via the SDK's `useSearchMessages` mutation. The page
 * calls `runSearch(filters, { page })` explicitly (Search click / page change);
 * `conversations` / `pagination` reflect the latest result.
 */
export function useEmailSearch() {
  const { emailAccount } = useAppContext();
  const accountId = emailAccount?.id ?? "";

  const searchMutation = useSearchMessages({
    onError: (error: unknown) => {
      console.error("[useEmailSearch] searchMessages error:", error);
    },
  });

  const runSearch = useCallback(
    async (filters: EmailSearchFilters, opts: { page?: number; pageSize?: number } = {}) => {
      // `to` and `cc` are required by the backend type even when empty, so always send them.
      const payload = {
        accountId,
        page: opts.page ?? 1,
        pageSize: opts.pageSize ?? 20,
        sortBy: "DATE",
        sortDirection: "DESC",
        to: filters.to ?? [],
        cc: filters.cc ?? [],
      } as EmailMessageSearchRequest;
      // Unchecked means "any": sending false would drop every mail that has attachments.
      if (filters.hasAttachment) payload.hasAttachment = true;
      if (filters.from?.length) payload.from = filters.from;
      if (filters.subjectContains) payload.subjectContains = filters.subjectContains;
      if (filters.dateFrom) payload.dateFrom = filters.dateFrom;
      if (filters.dateTo) payload.dateTo = filters.dateTo;

      return await searchMutation.mutateAsync(payload);
    },
    [searchMutation, accountId],
  );

  const data = (searchMutation.data ?? undefined) as
    | {
        content?: unknown[];
        conversations?: unknown[];
        pageNumber?: number;
        pageSize?: number;
        totalPages?: number;
        totalElements?: number;
        isLast?: boolean;
      }
    | undefined;
  const conversations = (data?.content ?? data?.conversations ?? []) as unknown[];

  return {
    runSearch,
    /** Drop the last result (e.g. when the user clears filters). */
    reset: searchMutation.reset,
    conversations,
    pagination: {
      pageNumber: data?.pageNumber ?? 1,
      pageSize: data?.pageSize ?? 20,
      totalPages: data?.totalPages ?? 1,
      totalElements: data?.totalElements ?? conversations.length,
      isLast: data?.isLast ?? true,
    },
  };
}
