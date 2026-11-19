import { useState, useEffect } from "react";
import { Search, X as XIcon } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

/** Payload shape the backend search endpoint accepts. */
export interface EmailSearchFilters {
  /** Sender addresses; a message from any of them matches. */
  from?: string[];
  /** Recipients on the `To` line. */
  to?: string[];
  /** Recipients on the `Cc` line. */
  cc?: string[];
  /** Substring match on subject. */
  subjectContains?: string;
  /** ISO date-time, inclusive lower bound. */
  dateFrom?: string;
  /** ISO date-time, inclusive upper bound. */
  dateTo?: string;
  /** Only conversations with at least one attachment. */
  hasAttachment?: boolean;
}

/** Number of populated filter fields (0 = no advanced search active). */
export function countActiveFilters(f: EmailSearchFilters): number {
  return [
    f.from?.length,
    f.to?.length,
    f.cc?.length,
    f.subjectContains?.trim(),
    f.dateFrom,
    f.dateTo,
    f.hasAttachment,
  ].filter(Boolean).length;
}

interface EmailSearchPopoverProps {
  value: EmailSearchFilters;
  /** Fired when the user clicks "Search" with the form state. */
  onApply: (filters: EmailSearchFilters) => void;
  onClear: () => void;
  /** Anchor element (the chevron inside the search bar). */
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Gmail-style advanced search panel. Keeps a local draft so the parent only
 * sees the committed filters on Search / Clear.
 */
export function EmailSearchPopover({ value, onApply, onClear, trigger, open, onOpenChange }: EmailSearchPopoverProps) {
  const [from, setFrom] = useState((value.from ?? []).join(", "));
  const [to, setTo] = useState((value.to ?? []).join(", "));
  const [cc, setCc] = useState((value.cc ?? []).join(", "));
  const [subjectContains, setSubjectContains] = useState(value.subjectContains ?? "");
  const [dateFrom, setDateFrom] = useState(toDateInput(value.dateFrom));
  const [dateTo, setDateTo] = useState(toDateInput(value.dateTo));
  const [hasAttachment, setHasAttachment] = useState(Boolean(value.hasAttachment));

  // Re-sync the draft when the panel opens or the parent's filters change.
  useEffect(() => {
    if (!open) return;
    setFrom((value.from ?? []).join(", "));
    setTo((value.to ?? []).join(", "));
    setCc((value.cc ?? []).join(", "));
    setSubjectContains(value.subjectContains ?? "");
    setDateFrom(toDateInput(value.dateFrom));
    setDateTo(toDateInput(value.dateTo));
    setHasAttachment(Boolean(value.hasAttachment));
  }, [open, value]);

  const handleApply = () => {
    onApply({
      from: splitEmails(from),
      to: splitEmails(to),
      cc: splitEmails(cc),
      subjectContains: subjectContains.trim() || undefined,
      dateFrom: fromDateInput(dateFrom, "start"),
      dateTo: fromDateInput(dateTo, "end"),
      hasAttachment: hasAttachment || undefined,
    });
    onOpenChange(false);
  };

  const handleClear = () => {
    setFrom("");
    setTo("");
    setCc("");
    setSubjectContains("");
    setDateFrom("");
    setDateTo("");
    setHasAttachment(false);
    onClear();
  };

  const field = (id: string, label: string, val: string, set: (v: string) => void, placeholder: string) => (
    <div className="copa:space-y-1.5">
      <Label htmlFor={id} className="copa:text-xs copa:text-muted-foreground">{label}</Label>
      <Input id={id} value={val} onChange={(e) => set(e.target.value)} placeholder={placeholder} className="copa:h-9" />
    </div>
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={8} className="copa:w-[420px] copa:p-4 copa:space-y-3">
        <div className="copa:flex copa:items-center copa:gap-2 copa:pb-2 copa:border-b">
          <Search className="copa:h-4 copa:w-4 copa:text-muted-foreground" />
          <span className="copa:text-sm copa:font-medium">Advanced search</span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close advanced search"
            className="copa:ml-auto copa:text-muted-foreground copa:hover:text-foreground copa:cursor-pointer"
          >
            <XIcon className="copa:h-4 copa:w-4" />
          </button>
        </div>

        {field("email-search-from", "From", from, setFrom, "a@x.com, b@x.com")}
        {field("email-search-to", "To", to, setTo, "one or more emails, comma-separated")}
        {field("email-search-cc", "CC", cc, setCc, "one or more emails, comma-separated")}
        {field("email-search-subject", "Subject contains", subjectContains, setSubjectContains, "e.g. meeting")}

        <div className="copa:grid copa:grid-cols-2 copa:gap-2">
          <div className="copa:space-y-1.5">
            <Label htmlFor="email-search-date-from" className="copa:text-xs copa:text-muted-foreground">Date from</Label>
            <Input
              id="email-search-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo || undefined}
              className="copa:h-9"
            />
          </div>
          <div className="copa:space-y-1.5">
            <Label htmlFor="email-search-date-to" className="copa:text-xs copa:text-muted-foreground">Date to</Label>
            <Input
              id="email-search-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              className="copa:h-9"
            />
          </div>
        </div>

        <div className="copa:flex copa:items-center copa:gap-2 copa:pt-1">
          <input
            id="email-search-attachment"
            type="checkbox"
            checked={hasAttachment}
            onChange={(e) => setHasAttachment(e.target.checked)}
            className="copa:h-4 copa:w-4 copa:accent-primary copa:cursor-pointer"
          />
          <Label htmlFor="email-search-attachment" className="copa:text-sm copa:cursor-pointer">
            Has attachment
          </Label>
        </div>

        <div className="copa:flex copa:items-center copa:justify-between copa:pt-3 copa:border-t">
          <Button variant="ghost" size="sm" onClick={handleClear} type="button">
            Clear filters
          </Button>
          <Button size="sm" onClick={handleApply} type="button" className="copa:gap-1.5">
            <Search className="copa:h-3.5 copa:w-3.5" />
            Search
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** "a@x.com, b@x.com" → ["a@x.com", "b@x.com"]; empty → undefined (field omitted). */
function splitEmails(raw: string): string[] | undefined {
  const list = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

/** ISO timestamp → `YYYY-MM-DD` for the native date input. */
function toDateInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → ISO at the start / end of that day (UTC) for inclusive ranges. */
function fromDateInput(value: string, edge: "start" | "end"): string | undefined {
  if (!value) return undefined;
  return `${value}${edge === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z"}`;
}
