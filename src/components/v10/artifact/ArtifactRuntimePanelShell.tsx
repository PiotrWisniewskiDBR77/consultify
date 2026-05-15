import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ArtifactRuntimePanelShellProps {
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
}

export function ArtifactRuntimePanelShell({
  title,
  description,
  badge,
  children,
}: ArtifactRuntimePanelShellProps) {
  return (
    <Card className="border-slate-200/80">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {badge ? <Badge variant="outline">{badge}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
