import { createPwaIconResponse } from "@/lib/pwa-icon";

export async function GET() {
  return createPwaIconResponse({ size: 192 });
}
