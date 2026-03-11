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
  liveText?: string;
}

export function ProcessingOverlay({
  isVisible,
  statusMessage,
  progress,
  canCancel = false,
  onCancel,
  liveText,
}: ProcessingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-background/70 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-background p-6 lg:p-8 rounded-lg shadow-xl max-w-md w-full mx-4 space-y-6 border border-border">
        <div className="flex flex-col items-center justify-center space-y-5">
          <Loader2 className="h-14 w-14 animate-spin text-primary" />
          <h3 className="text-2xl font-medium text-center">{statusMessage}</h3>
          <div className="w-full space-y-3">
            <Progress value={progress} className="w-full h-3" />
            <p className="text-sm text-muted-foreground text-center font-medium">
              {`${Math.round(progress)}% complete`}
            </p>
          </div>
          {/* Live transcription preview — grows token by token while Whisper runs */}
          {liveText && (
            <div className="w-full max-h-40 overflow-y-auto rounded-md bg-muted border border-border p-3">
              <p className="text-xs text-foreground leading-relaxed font-mono whitespace-pre-wrap">
                {liveText}
              </p>
            </div>
          )}
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
