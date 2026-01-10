declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export async function extractAudioFromVideo(
  videoFile: File
): Promise<Float32Array> {
  // Read file as ArrayBuffer
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(videoFile);
  });

  console.log("File size:", buffer.byteLength, "bytes");

  // Create audio context with specific sample rate
  const audioContext = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 16000,
  });

  try {
    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(buffer);

    console.log("Audio details:", {
      duration: audioBuffer.duration,
      numberOfChannels: audioBuffer.numberOfChannels,
      sampleRate: audioBuffer.sampleRate,
      length: audioBuffer.length,
    });

    // Handle stereo vs mono
    if (audioBuffer.numberOfChannels === 2) {
      // Merge channels for stereo
      const SCALING_FACTOR = Math.sqrt(2);
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      const audio = new Float32Array(left.length);

      for (let i = 0; i < audioBuffer.length; ++i) {
        audio[i] = (SCALING_FACTOR * (left[i] + right[i])) / 2;
      }

      console.log("Converted stereo to mono, length:", audio.length);
      return audio;
    } else {
      // Use the first channel for mono
      const audio = audioBuffer.getChannelData(0);
      console.log("Using mono audio, length:", audio.length);
      return audio;
    }
  } catch (e) {
    console.error("Audio extraction error:", e);
    if (e instanceof Error) {
      console.error("Error name:", e.name);
      console.error("Error message:", e.message);
      console.error("Error stack:", e.stack);
    }
    throw new Error(
      `Error processing audio: ${e instanceof Error ? e.message : String(e)}`
    );
  } finally {
    await audioContext.close();
  }
}
