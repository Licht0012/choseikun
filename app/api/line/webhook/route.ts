import { getBindings, getDb } from "@/db";
import { jsonResponse } from "@/lib/http";
import { constantTimeEqual, digestSecret } from "@/lib/security";

interface LineWebhookBody {
  events?: Array<{
    type?: string;
    replyToken?: string;
    source?: { type?: string; groupId?: string };
    message?: { type?: string; text?: string };
  }>;
}

async function lineSignature(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  let binary = "";
  for (const byte of signature) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function replyMessage(replyToken: string, text: string, accessToken: string): Promise<void> {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

async function getGroupName(groupId: string, accessToken: string): Promise<string> {
  const response = await fetch(`https://api.line.me/v2/bot/group/${encodeURIComponent(groupId)}/summary`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return "LINEグループ";
  const data = (await response.json()) as { groupName?: string };
  return data.groupName?.slice(0, 100) || "LINEグループ";
}

export async function POST(request: Request) {
  const bindings = getBindings();
  const bodyText = await request.text();
  const receivedSignature = request.headers.get("x-line-signature") || "";
  if (!bindings.LINE_CHANNEL_SECRET || !receivedSignature) return jsonResponse({ error: "LINE未設定" }, 503);
  const expectedSignature = await lineSignature(bodyText, bindings.LINE_CHANNEL_SECRET);
  if (!constantTimeEqual(receivedSignature, expectedSignature)) return jsonResponse({ error: "署名が一致しません。" }, 401);

  let body: LineWebhookBody;
  try {
    body = JSON.parse(bodyText) as LineWebhookBody;
  } catch {
    return jsonResponse({ error: "不正なリクエストです。" }, 400);
  }

  const accessToken = bindings.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) return jsonResponse({ received: true, configured: false });
  const db = await getDb();
  for (const event of body.events || []) {
    const text = event.message?.type === "text" ? event.message.text?.normalize("NFKC").trim() || "" : "";
    const match = text.match(/^調整くん\s+連携\s+([A-Z2-9]{6})$/i);
    const groupId = event.source?.type === "group" ? event.source.groupId : undefined;
    if (!match || !groupId || !event.replyToken) continue;

    const linkCodeHash = await digestSecret(match[1].toUpperCase());
    const linkedEvent = await db
      .prepare(
        `SELECT id, name FROM events
         WHERE line_link_code_hash = ? AND line_link_expires_at > ?
         LIMIT 1`,
      )
      .bind(linkCodeHash, new Date().toISOString())
      .first<{ id: string; name: string }>();
    if (!linkedEvent) {
      await replyMessage(event.replyToken, "連携コードが見つからないか、有効期限が切れています。管理画面で新しいコードを発行してください。", accessToken);
      continue;
    }

    const groupName = await getGroupName(groupId, accessToken);
    await db
      .prepare(
        `UPDATE events
         SET line_group_id = ?, line_group_name = ?, line_link_code_hash = NULL,
             line_link_expires_at = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .bind(groupId, groupName, new Date().toISOString(), linkedEvent.id)
      .run();
    await replyMessage(
      event.replyToken,
      `「${linkedEvent.name}」とこのグループを連携しました。回答期限の前日19:00にお知らせします。`,
      accessToken,
    );
  }
  return jsonResponse({ received: true });
}
