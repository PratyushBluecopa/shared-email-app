import { useState, useRef, useCallback, useEffect } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import DOMPurify from "dompurify";
import { Mail, Pencil, Save, PenLine } from "lucide-react";
import { ensureHtml, isEmptyHtml } from "~/hooks/email/use-emails";
import { useSignature } from "~/hooks/settings/use-signature";
import { useAppContext } from "~/contexts/app-context";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

/** Shared email settings: the configured account (read-only) + the signature. */
export function SharedEmailTab() {
  const { emailAccount } = useAppContext();
  const { signature: savedSignature, saveSignature, isSaving, isLoading } = useSignature();

  const [isEditingSignature, setIsEditingSignature] = useState(false);
  const [signatureBody, setSignatureBody] = useState("");
  const signatureQuillRef = useRef<Quill | null>(null);

  // Reset the draft and close the editor whenever the persisted signature changes.
  useEffect(() => {
    setSignatureBody(savedSignature || "");
    setIsEditingSignature(false);
  }, [savedSignature]);

  const onSignatureEditorMount = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || el.classList.contains("ql-container")) return;
      el.innerHTML = "";
      const quill = new Quill(el, {
        theme: "snow",
        modules: {
          toolbar: [
            [{ font: [] }, { size: ["small", false, "large", "huge"] }],
            ["bold", "italic", "underline"],
            [{ color: [] }],
            [{ align: [] }],
            ["link", "image"],
            ["clean"],
          ],
        },
      });
      signatureQuillRef.current = quill;
      quill.root.innerHTML = DOMPurify.sanitize(signatureBody || savedSignature || "");
      quill.on("text-change", () => setSignatureBody(quill.root.innerHTML));
    },
    // Mounts once per edit session; later signature changes close the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleSaveSignature = async () => {
    await saveSignature(isEmptyHtml(signatureBody) ? "" : signatureBody);
    setIsEditingSignature(false);
  };

  return (
    <div className="copa:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="copa:flex copa:items-center copa:gap-2">
            <Mail className="copa:h-5 copa:w-5" />
            Email Account
          </CardTitle>
          <p className="copa:text-sm copa:text-muted-foreground copa:mt-1">
            The shared email account the inbox reads and sends from (set via env).
          </p>
        </CardHeader>
        <CardContent className="copa:space-y-4">
          <div className="copa:grid copa:grid-cols-2 copa:gap-4">
            <div className="copa:space-y-2">
              <Label htmlFor="email-address">Email Address</Label>
              <Input id="email-address" value={emailAccount?.email ?? ""} readOnly className="copa:bg-muted/50" />
            </div>
            <div className="copa:space-y-2">
              <Label htmlFor="account-id">Account ID</Label>
              <Input id="account-id" value={emailAccount?.id ?? ""} readOnly className="copa:bg-muted/50" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="copa:flex copa:items-center copa:justify-between">
            <div>
              <CardTitle className="copa:flex copa:items-center copa:gap-2">
                <PenLine className="copa:h-5 copa:w-5" />
                Email Signature
              </CardTitle>
              <p className="copa:text-sm copa:text-muted-foreground copa:mt-1">
                This signature will be appended to all outgoing emails
              </p>
            </div>
            {!isEditingSignature && (
              <Button variant="outline" onClick={() => setIsEditingSignature(true)}>
                <Pencil className="copa:h-4 copa:w-4 copa:mr-2" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="copa:flex copa:items-center copa:justify-center copa:py-8">
              <div className="copa:animate-spin copa:rounded-full copa:h-6 copa:w-6 copa:border-b-2 copa:border-primary" />
            </div>
          ) : isEditingSignature ? (
            <div className="copa:space-y-3">
              <div className="copa:border copa:rounded-md copa:bg-white">
                <div ref={onSignatureEditorMount} style={{ height: "200px" }} />
              </div>
              <div className="copa:flex copa:justify-end copa:gap-2">
                <Button variant="outline" onClick={() => setIsEditingSignature(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveSignature} disabled={isSaving}>
                  <Save className="copa:h-4 copa:w-4 copa:mr-2" />
                  Save Signature
                </Button>
              </div>
            </div>
          ) : !isEmptyHtml(savedSignature) ? (
            <div
              className="copa:p-4 copa:border copa:rounded-md copa:bg-muted/30"
              style={{
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
                fontSize: "14px",
                lineHeight: "1.6",
              }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ensureHtml(savedSignature)) }}
            />
          ) : (
            <div className="copa:p-4 copa:border copa:rounded-md copa:bg-muted/30 copa:text-muted-foreground copa:text-sm copa:italic">
              No signature configured. Click Edit to add one.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
