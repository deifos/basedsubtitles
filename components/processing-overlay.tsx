"use client";

import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface ProcessingOverlayProps {
  isVisible: boolean;
  statusMessage: string;
  progress: number;
  canCancel?: boolean;
  onCancel?: () => void;
}

export function ProcessingOverlay({
  isVisible,
  statusMessage,
  progress,
  canCancel = false,
  onCancel,
}: ProcessingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-xl max-w-md w-full space-y-6 border border-border">
        <div className="flex flex-col items-center justify-center space-y-5">
          <Loader2 className="h-14 w-14 animate-spin text-primary" />
          <h3 className="text-2xl font-medium text-center">{statusMessage}</h3>
          <div className="w-full space-y-3">
            <Progress value={progress} className="w-full h-3" />
            <p className="text-sm text-muted-foreground text-center font-medium">
              {`${Math.round(progress)}% complete`}
            </p>
          </div>
          {canCancel && onCancel && (
            <Button variant="default" onClick={onCancel} className="w-full">
              Stop processing
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
