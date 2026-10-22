import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { EmailTemplatesTab } from "~/components/settings/email-templates-tab";
import { SharedEmailTab } from "~/components/settings/shared-email-tab";

export default function Settings() {
  return (
    <div className="copa:h-full copa:overflow-y-auto">
      <div className="copa:mx-auto copa:flex copa:max-w-5xl copa:flex-col copa:gap-6 copa:px-6 copa:py-6">
        <div>
          <h1 className="copa:text-xl copa:font-semibold">Settings</h1>
          <p className="copa:text-sm copa:text-muted-foreground">
            Manage the email templates, mailbox and signature used by the shared inbox.
          </p>
        </div>

        <Tabs defaultValue="templates">
          <TabsList>
            <TabsTrigger value="templates">Email Templates</TabsTrigger>
            <TabsTrigger value="shared-email">Shared Email</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="copa:mt-4">
            <EmailTemplatesTab />
          </TabsContent>
          <TabsContent value="shared-email" className="copa:mt-4">
            <SharedEmailTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
