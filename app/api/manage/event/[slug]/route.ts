import { buildPublicEvent, findEventBySlug } from "@/lib/event-data";
import { updateEventConfiguration } from "@/lib/event-editor";
import { absoluteBaseUrl, jsonResponse, readJson } from "@/lib/http";
import { isAdminRequest } from "@/lib/security";
import type { CreateEventInput } from "@/lib/types";
import { validateCreateEvent } from "@/lib/validation";

async function findAuthorizedEvent(request: Request, slug: string) {
  if (!(await isAdminRequest(request))) return null;
  return findEventBySlug(slug);
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const event = await findAuthorizedEvent(request, slug);
  if (!event) return jsonResponse({ error: "管理者としてログインしてください。" }, 401);
  return jsonResponse({
    event: await buildPublicEvent(event),
    management: {
      shareUrl: `${absoluteBaseUrl(request)}/e/${event.slug}`,
      lineGroupName: event.line_group_name,
      lineConnected: Boolean(event.line_group_id),
      reminderSentAt: event.reminder_sent_at,
    },
  });
}

export async function PUT(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const event = await findAuthorizedEvent(request, slug);
  if (!event) return jsonResponse({ error: "管理者としてログインしてください。" }, 401);
  const validation = validateCreateEvent(await readJson<CreateEventInput>(request), { allowPastDeadline: true });
  if (!validation.value) return jsonResponse({ error: validation.error }, 400);
  try {
    await updateEventConfiguration(event, validation.value);
  } catch (error) {
    console.error("Failed to update event", error);
    return jsonResponse({ error: "変更を保存できませんでした。もう一度お試しください。" }, 500);
  }
  const updated = await findEventBySlug(slug);
  return jsonResponse({ event: updated ? await buildPublicEvent(updated) : null, saved: true });
}
