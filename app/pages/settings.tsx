import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { EmailTemplatesTab } from "~/components/settings/email-templates-tab";
import { SharedEmailTab } from "~/components/settings/shared-email-tab";

// Same frame as the cash app's subsidiary settings page (space-y-6, tabs with mt-6 content).
export default function Settings() {
  return (
    <div className="copa:space-y-6">
      <div className="copa:text-sm copa:text-muted-foreground">Settings</div>

      <Tabs defaultValue="templates" className="copa:w-full">
        <TabsList>
          <TabsTrigger value="templates">Email Templates</TabsTrigger>
          <TabsTrigger value="shared-email">Shared Email</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="copa:mt-6">
          <EmailTemplatesTab />
        </TabsContent>
        <TabsContent value="shared-email" className="copa:mt-6">
          <SharedEmailTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
