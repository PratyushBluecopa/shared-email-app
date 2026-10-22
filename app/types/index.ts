/** Column-name normalization map injected by the host (workbook `storedSchemaMap`).
 *  Keyed by env-var name → { backendColumn: frontendColumn }. */
export type SchemaMap = Record<string, Record<string, string>>;

/** Logged-in user's live permissions injected by the host (PRD-3294).
 *  Keyed by actionId → { permission: granted }. The host computes this with a
 *  backend check against the app's access-control matrix before mount. */
export type PermissionsMap = Record<string, Record<string, boolean>>;

/**
 * Runtime environment config. The host injects these via the `envVars` prop
 * (the app's Settings → Env Vars panel, persisted on the workbook). At
 * build-time / standalone dev they come from `import.meta.env`. The index
 * signature lets app-specific vars (table IDs, dataset IDs, …) flow through
 * without being listed here.
 */
export interface EnvConfig {
  VITE_BLUECOPA_API_URL?: string;
  VITE_BLUECOPA_WORKSPACE_ID?: string;
  VITE_BLUECOPA_API_TOKEN?: string;
  VITE_BLUECOPA_USER_ID?: string;
  /** Required by the Input Table V2 SDK (`copaInputTableDb`). Flows through to
   *  the `x-bluecopa-solution-*` request headers. */
  VITE_BLUECOPA_SOLUTION_ID?: string;
  VITE_BLUECOPA_SOLUTION_BRANCH?: string;
  VITE_BLUECOPA_SOLUTION_BRANCH_TYPE?: string;
  /** Email-engine account the inbox reads/sends from, and its address. */
  VITE_BLUECOPA_EMAIL_ACCOUNT_ID?: string;
  VITE_BLUECOPA_EMAIL_ADDRESS?: string;
  /** Input Table V2 tables for drafts, templates and the signature. */
  VITE_TABLE_EMAIL_DRAFT?: string;
  VITE_TABLE_EMAIL_TEMPLATE?: string;
  VITE_TABLE_SIGNATURE?: string;
  /** Real-time email updates (websocket provider + channel/event names). */
  VITE_WEBSOCKET?: string;
  VITE_PUSHER_KEY?: string;
  VITE_PUSHER_CLUSTER?: string;
  VITE_PUSHER_AUTH_ENDPOINT?: string;
  VITE_EMAIL_WS_CHANNEL?: string;
  VITE_EMAIL_WS_EVENT_MESSAGE_NEW?: string;
  VITE_EMAIL_WS_EVENT_CONVERSATION_UPDATE?: string;
  [key: string]: string | undefined;
}

/** Props passed to the MFE root component from the host app (single-spa customProps or manualMount). */
export interface MfeProps {
  apiBaseUrl?: string;
  workspaceId?: string;
  accessToken?: string;
  userId?: string;
  basename?: string;
  /** Runtime env vars injected by the host (workbook `storedEnvVariable`). */
  envVars?: EnvConfig;
  /** Column-name normalization map injected by the host (workbook `storedSchemaMap`). */
  schemaMap?: SchemaMap;
  /** Logged-in user's live permissions injected by the host (actionId → permission → granted). */
  permissions?: PermissionsMap;
}

/** Normalized user object provided by AppContext. */
export type AppUser = {
  userId?: string;
  name?: string;
  userExists?: boolean;
  settings?: Record<string, unknown>;
  workspaceIds?: string[];
  currentWorkspace?: unknown;
  teams?: unknown[];
  userTeamProperties?: unknown[];
  email?: string | null;
  role?: string;
  [key: string]: unknown;
};

/** Workspace data settings derived from user/workspace API (currency, timezone, date format, etc.) */
export type WorkspaceDataSettings = {
  currency: string;
  timezone: string;
  dateFormat: string;
  fiscalYear: { yearType: string; startMonth?: number; startDate?: number };
  numberSettings: {
    numberSystem: string;
    defaultPrecision: number;
    nullPlaceholder?: string;
  };
  weekStartDay: string;
};
