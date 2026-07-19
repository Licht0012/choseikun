import { buildPublicEvent, findEventBySlug, hasEventAccess } from "@/lib/event-data";
import { jsonResponse, readJson } from "@/lib/http";
import {
  constantTimeEqual,
  createSignedToken,
  digestSecret,
  eventCookieName,
  serializeCookie,
} from "@/lib/security";

interface AccessInput {
  accessCode?: string;
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const event = await findEventBySlug(slug);
  if (!event) return jsonResponse({ error: "イベントが見つかりません。" }, 404);
  if (!(await hasEventAccess(request, event))) return jsonResponse({ locked: true }, 401);
  return jsonResponse({ event: await buildPublicEvent(event) });
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const event = await findEventBySlug(slug);
  if (!event) return jsonResponse({ error: "イベントが見つかりません。" }, 404);
  const body = await readJson<AccessInput>(request);
  const accessCode = body?.accessCode || "";
  const receivedHash = await digestSecret(accessCode);
  if (!accessCode || !constantTimeEqual(receivedHash, event.access_code_hash)) {
    return jsonResponse({ error: "合言葉が違います。" }, 401);
  }

  const maxAge = 60 * 60 * 24 * 30;
  const token = await createSignedToken(`event:${event.id}`, maxAge);
  return jsonResponse(
    { event: await buildPublicEvent(event) },
    200,
    {
      "set-cookie": serializeCookie(
        eventCookieName(event.slug),
        token,
        maxAge,
        new URL(request.url).protocol === "https:",
      ),
    },
  );
}
