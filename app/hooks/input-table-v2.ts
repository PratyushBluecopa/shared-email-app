/**
 * Input Table V2 helpers over `copaInputTableDb` from `@bluecopa/react`.
 *
 *   - useTableController({ table, env, mapRow, where?, sort?, messages? })
 *       reactive, mapped rows + update / remove with toast feedback
 *   - useInputTableV2DirectInsert(table, { env, successMessage, errorMessage })
 *       POSTs straight to the API so the payload carries no client-minted `id`
 *
 * `env` routes write payloads through `denormalizeRow` (schema map).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copaApi, copaGetConfig, copaInputTableDb } from "@bluecopa/react";
import type { CollectionRef, QueryBuilder, Row, WhereOp } from "@bluecopa/react";
import { toast } from "sonner";
import { denormalizeRow } from "~/utils/schema-mapper";

type WhereClause = [string, WhereOp, unknown];

// Columns the client must never send on insert or update.
const SERVER_MANAGED_COLUMNS = new Set(["id", "_copa_id", "created_at", "updated_at", "createdAt", "updatedAt"]);

function stripServerManagedColumns(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([key]) => !SERVER_MANAGED_COLUMNS.has(key)));
}

function toWritePayload(data: Record<string, unknown>, env?: string) {
  return stripServerManagedColumns(env ? denormalizeRow(data, env) : data);
}

export interface TableControllerConfig<TUI> {
  /** Input table v2 table name. */
  table: string;
  /** Schema-map env that scopes this table (see `~/utils/schema-mapper`). */
  env?: string;
  mapRow: (row: Record<string, unknown>) => TUI;
  where?: WhereClause[];
  sort?: (a: TUI, b: TUI) => number;
  /** Toast text per operation; `false` silences it. */
  messages?: {
    update?: string | false;
    remove?: string | false;
    updateError?: string | false;
    removeError?: string | false;
  };
}

export function useTableController<TUI>(config: TableControllerConfig<TUI>) {
  const { table, env, messages = {} } = config;
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // The SDK rejects an empty table name, so stay in a loading state until the
  // env var is configured.
  const safeName = (table ?? "").trim();
  const collection = useMemo<CollectionRef<Row> | null>(
    () => (safeName ? copaInputTableDb.collection<Row>(safeName) : null),
    [safeName],
  );

  const whereSig = JSON.stringify(config.where ?? []);
  const whereRef = useRef(config.where);
  whereRef.current = config.where;

  const buildQuery = useCallback(
    (col: CollectionRef<Row>) => {
      let q: CollectionRef<Row> | QueryBuilder<Row> = col;
      for (const [field, op, value] of whereRef.current ?? []) q = q.where(field, op, value);
      return q;
    },
    [],
  );

  useEffect(() => {
    if (!collection) {
      setRows([]);
      setIsLoading(true);
      return;
    }
    setIsLoading(true);
    setError(null);
    let unsub: (() => void) | undefined;
    try {
      unsub = buildQuery(collection).subscribe((next) => {
        setRows(next as Row[]);
        setIsLoading(false);
      });
    } catch (e) {
      console.error(`[useTableController:${safeName}] subscribe failed:`, e);
      setError(e instanceof Error ? e : new Error(String(e)));
      setIsLoading(false);
    }
    return () => unsub?.();
  }, [collection, whereSig, safeName, buildQuery]);

  const refetch = useCallback(async () => {
    if (!collection) return;
    try {
      setRows((await buildQuery(collection).get()) as Row[]);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [collection, buildQuery]);

  const items = useMemo<TUI[]>(() => {
    const mapped = rows.map((r) => config.mapRow(r as Record<string, unknown>));
    return config.sort ? mapped.sort(config.sort) : mapped;
    // mapRow/sort are inline closures; rows is the only real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const runMutation = useCallback(
    async (run: () => Promise<unknown>, ok: string | false | undefined, fail: string | false | undefined) => {
      if (!collection) throw new Error(`Table "${safeName}" is not configured`);
      setIsSaving(true);
      try {
        await run();
        if (ok) toast.success(ok);
      } catch (err) {
        if (fail !== false) toast.error(fail ?? "Operation failed");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [collection, safeName],
  );

  const update = useCallback(
    (id: string, data: Record<string, unknown>) =>
      runMutation(
        () => collection!.doc(id).update(toWritePayload(data, env) as Partial<Row>),
        messages.update ?? "Updated successfully",
        messages.updateError,
      ),
    [collection, env, runMutation, messages.update, messages.updateError],
  );

  const remove = useCallback(
    (id: string) =>
      runMutation(
        () => collection!.doc(id).delete(),
        messages.remove ?? "Deleted successfully",
        messages.removeError,
      ),
    [collection, runMutation, messages.remove, messages.removeError],
  );

  return { items, isLoading, error, isSaving, refetch, update, remove };
}

export function useInputTableV2DirectInsert<TRow extends Record<string, unknown>>(
  tableName: string,
  options: { env?: string; successMessage?: string | false; errorMessage?: string | false } = {},
) {
  const [isPending, setIsPending] = useState(false);
  const { env, successMessage, errorMessage } = options;

  const insert = useCallback(
    async (data: Partial<TRow>): Promise<Record<string, unknown> | null> => {
      const solutionId = (copaGetConfig() as { solutionId?: string })?.solutionId;
      if (!tableName || !solutionId) {
        if (errorMessage !== false) toast.error(errorMessage ?? "Configuration error");
        return null;
      }
      setIsPending(true);
      try {
        const res = await (copaApi as any).apiClient.post(
          `/input-table-v2/${solutionId}/rows/${tableName}`,
          toWritePayload(data as Record<string, unknown>, env),
          { headers: { Prefer: "return=representation" } },
        );
        // Re-sync replication so reactive subscribers pick up the new row.
        try {
          const ref = await (copaInputTableDb.collection(tableName) as any)?.getRef?.();
          ref?.replicationState?.reSync?.();
        } catch {
          /* best-effort; the next replication tick catches it */
        }
        if (successMessage) toast.success(successMessage);
        return (Array.isArray(res?.data) ? res.data[0] : (res?.data?.data ?? res?.data)) ?? null;
      } catch (err) {
        if (errorMessage !== false) toast.error(errorMessage ?? "Failed to insert row");
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [tableName, env, successMessage, errorMessage],
  );

  return { insert, isPending };
}
