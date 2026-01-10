"use client";

import type { JSX } from "react";
import { useCallback, useState } from "react";

import { LandingPage } from "@/components/landing-page/landing-page";
import { MainApp } from "@/components/main-app";

export function AppRoot(): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleVideoSelect = useCallback((file: File) => {
    setSelectedFile(file);
  }, []);

  const handleReturnToLanding = useCallback(() => {
    setSelectedFile(null);
  }, []);

  if (selectedFile) {
    return (
      <MainApp
        initialFile={selectedFile}
        onReturnToLanding={handleReturnToLanding}
      />
    );
  }

  return <LandingPage onVideoSelect={handleVideoSelect} />;
}

export default AppRoot;
