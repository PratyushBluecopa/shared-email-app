import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { EmailTemplatesTab } from "~/components/settings/email-templates-tab";
import { SharedEmailTab } from "~/components/settings/shared-email-tab";

export default function Settings() {
  return (
    <>
      <h1 className="copa:text-2xl copa:font-semibold">Settings</h1>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Email Templates</TabsTrigger>
          <TabsTrigger value="shared-email">Shared Email</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <EmailTemplatesTab />
        </TabsContent>
        <TabsContent value="shared-email">
          <SharedEmailTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
