import { buildPublicEvent, findEventByAdminToken } from "@/lib/event-data";
import { updateEventConfiguration } from "@/lib/event-editor";
import { absoluteBaseUrl, jsonResponse, readJson } from "@/lib/http";
import type { CreateEventInput } from "@/lib/types";
import { validateCreateEvent } from "@/lib/validation";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const event = await findEventByAdminToken(token);
  if (!event) return jsonResponse({ error: "管理ページが見つかりません。" }, 404);
  return jsonResponse({
    event: await buildPublicEvent(event),
    management: {
      shareUrl: `${absoluteBaseUrl(request)}/e/${event.slug}`,
      manageUrl: `${absoluteBaseUrl(request)}/manage/${token}`,
      lineGroupName: event.line_group_name,
      lineConnected: Boolean(event.line_group_id),
      reminderSentAt: event.reminder_sent_at,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    },
  });
}

export async function PUT(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const event = await findEventByAdminToken(token);
  if (!event) return jsonResponse({ error: "管理ページが見つかりません。" }, 404);
  const validation = validateCreateEvent(await readJson<CreateEventInput>(request), { allowPastDeadline: true });
  if (!validation.value) return jsonResponse({ error: validation.error }, 400);
  try {
    await updateEventConfiguration(event, validation.value);
  } catch (error) {
    console.error("Failed to update event", error);
    return jsonResponse({ error: "変更を保存できませんでした。もう一度お試しください。" }, 500);
  }
  const updated = await findEventByAdminToken(token);
  return jsonResponse({ event: updated ? await buildPublicEvent(updated) : null, saved: true });
}
