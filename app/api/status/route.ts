import { LOCAL_MODEL_BASE_URL } from "@/lib/model";

export async function GET() {
  const healthUrl = new URL("/health", LOCAL_MODEL_BASE_URL).toString();

  try {
    const res = await fetch(healthUrl, { cache: "no-store" });
    return Response.json({ online: res.ok });
  } catch {
    return Response.json({ online: false });
  }
}
