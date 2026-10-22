import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "~/components/layouts/app-layout";
import SharedInbox from "~/pages/shared-inbox";
import Settings from "~/pages/settings";
import { ROUTES } from "~/constants";

export default function RouteConfig() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path={ROUTES.INBOX} element={<SharedInbox />} />
        <Route path={ROUTES.SETTINGS} element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to={ROUTES.INBOX} replace />} />
    </Routes>
  );
}
