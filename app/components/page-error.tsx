import { AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";

interface PageErrorProps {
  title: string;
  description?: string;
  onRetry?: () => void;
}

/** Full-page error state: icon + heading + optional detail + Retry. */
export function PageError({ title, description, onRetry }: PageErrorProps) {
  return (
    <div className="copa:flex copa:h-full copa:flex-col copa:items-center copa:justify-center copa:p-8 copa:text-center">
      <AlertTriangle className="copa:mb-4 copa:h-12 copa:w-12 copa:text-destructive" />
      <h3 className="copa:mb-2 copa:text-lg copa:font-semibold">{title}</h3>
      {description && <p className="copa:mb-4 copa:max-w-sm copa:text-sm copa:text-muted-foreground">{description}</p>}
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
    </div>
  );
}
