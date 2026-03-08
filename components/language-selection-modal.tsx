"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  LanguageSelector,
  type LanguageCode,
} from "@/components/language-selector";
import { Video, Loader2 } from "lucide-react";
import type { ModelSize } from "@/hooks/useTranscription";

interface LanguageSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (language: LanguageCode, modelSize: ModelSize) => void;
  defaultLanguage?: LanguageCode;
  defaultModelSize?: ModelSize;
}

const MODEL_SIZE_OPTIONS: {
  value: ModelSize;
  label: string;
  description: string;
}[] = [
  {
    value: "tiny",
    label: "Tiny (~75MB)",
    description: "Fastest, lower accuracy",
  },
  {
    value: "base",
    label: "Base (~150MB)",
    description: "Balanced speed & accuracy",
  },
  {
    value: "small",
    label: "Small (~500MB)",
    description: "Most accurate, slower",
  },
];

export function LanguageSelectionModal({
  open,
  onClose,
  onConfirm,
  defaultLanguage = "en",
  defaultModelSize = "base",
}: LanguageSelectionModalProps) {
  const [selectedLanguage, setSelectedLanguage] =
    useState<LanguageCode>(defaultLanguage);
  const [selectedModelSize, setSelectedModelSize] =
    useState<ModelSize>(defaultModelSize);
  const [isProcessing, setIsProcessing] = useState(false);

  // Radix Dialog unmounts DialogContent when closed, so state resets naturally
  // on each open — no effect needed to sync with defaultLanguage/defaultModelSize.

  const handleConfirm = () => {
    setIsProcessing(true);
    onConfirm(selectedLanguage, selectedModelSize);
    // Modal will auto-close when transcription status changes
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Video Language</DialogTitle>
          <DialogDescription>
            Choose the language spoken in your video for accurate transcription.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <LanguageSelector
            language={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
          />

          <div className="space-y-2">
            <p className="text-sm font-medium">Model Size</p>
            <div className="grid grid-cols-3 gap-2">
              {MODEL_SIZE_OPTIONS.map((option) => {
                const isActive = selectedModelSize === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setSelectedModelSize(option.value)}
                    className={`rounded-md border px-3 py-2 text-left transition-all ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/50 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    <div className="text-xs font-medium">{option.label}</div>
                    <div className="text-[10px] opacity-70">
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">💡 Translation Feature</p>
            <p>
              Select a different language to translate your video&apos;s speech.
              For example, if your video is in Spanish but you select English,
              the transcription will be translated to English.
            </p>
            <p className="mt-2 text-xs">
              <strong>Note:</strong> Translation will take longer to process
              than matching the video&apos;s original language.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Video className="w-4 h-4 mr-2" />
                Transcribe
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
