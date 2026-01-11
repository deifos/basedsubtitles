"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LanguageSelector, type LanguageCode } from "@/components/language-selector";
import { Video, Loader2 } from "lucide-react";

interface LanguageSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (language: LanguageCode) => void;
  defaultLanguage?: LanguageCode;
}

export function LanguageSelectionModal({
  open,
  onClose,
  onConfirm,
  defaultLanguage = "en",
}: LanguageSelectionModalProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(defaultLanguage);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync with defaultLanguage when modal opens
  useEffect(() => {
    if (open) {
      setSelectedLanguage(defaultLanguage);
      setIsProcessing(false);
    }
  }, [open, defaultLanguage]);

  const handleConfirm = () => {
    setIsProcessing(true);
    onConfirm(selectedLanguage);
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
          <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">💡 Translation Feature</p>
            <p>
              Select a different language to translate your video&apos;s speech. For example, if your video is in Spanish but you select English, the transcription will be translated to English.
            </p>
            <p className="mt-2 text-xs">
              <strong>Note:</strong> Translation will take longer to process than matching the video&apos;s original language.
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
