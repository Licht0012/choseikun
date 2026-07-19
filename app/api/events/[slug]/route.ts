import { buildPublicEvent, findEventBySlug } from "@/lib/event-data";
import { jsonResponse } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const event = await findEventBySlug(slug);
  if (!event) return jsonResponse({ error: "イベントが見つかりません。" }, 404);
  return jsonResponse({ event: await buildPublicEvent(event) });
}
