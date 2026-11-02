"use client";
import { useEffect, useState } from "react";
import type { PublicEventView, AvailabilityStatus, ResponseView } from "@/lib/types";
import { slotLabel } from "@/lib/20261101_monthly-rules";

export function MonthlyResponseTable({event:initial}: {event:PublicEventView}) {
  const [event,setEvent] = useState(initial);
  const [drafts,setDrafts] = useState<Record<string,ResponseView>>({});
  const [busy,setBusy] = useState<string | null>(null);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  useEffect(() => {
    if (!event.isOpen || !event.monthly?.deadlineAt) return;
    const close = () => setEvent(current => ({...current,isOpen:false}));
    const deadline = Date.parse(event.monthly.deadlineAt);
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) close();
      else timer = setTimeout(check, Math.min(remaining, 2147483647));
    };
    check();
    return () => clearTimeout(timer);
  }, [event.isOpen, event.monthly?.deadlineAt]);
  function update(response:ResponseView, patch:Partial<ResponseView>) {
    setDrafts(current => ({...current,[response.id]:{...(current[response.id] || response),...patch}}));
    setMessage("");
  }
  async function save(response:ResponseView) {
    setBusy(response.id); setError(""); setMessage("");
    try {
      const draft = drafts[response.id] || response;
      const result = await fetch(`/api/events/${encodeURIComponent(event.slug)}/responses`,{
        method:"POST", headers:{"content-type":"application/json"},
        body:JSON.stringify({name:draft.name,comment:draft.comment,updatedAt:draft.updatedAt,
          availability:Object.entries(draft.availability).map(([slotId,status])=>({slotId,status}))}),
      });
      const data = await result.json() as {event?:PublicEventView;error?:string};
      if (!result.ok || !data.event) throw new Error(data.error || "保存できませんでした。");
      setEvent(data.event);
      setDrafts(current => {const next={...current}; delete next[response.id]; return next;});
      setMessage(`${response.name}さんの回答を保存しました。`);
    } catch (err) {setError(err instanceof Error ? err.message : "保存できませんでした。再度お試しください。");}
    finally {setBusy(null);}
  }
  const finished = event.responses.filter(r => event.slots.every(s => r.availability[s.id])).length;
  return <section className="answer-section monthly-answer">
    <h2>みんなの回答（{finished}/6人完了）</h2>
    <p>各自の行に○△×を入力して保存してください。途中保存できます。本人以外の編集も可能です。</p>
    <p>表は横にスクロールできます。コメント欄は右端です。</p>
    <div className="monthly-table-scroll" tabIndex={0} role="region" aria-label="固定メンバーの日程回答表">
      <table className="monthly-table"><thead><tr><th scope="col">参加者</th>
        {event.slots.map(slot=><th scope="col" key={slot.id}>{slotLabel(slot)}</th>)}<th scope="col">コメント（任意・300文字まで）</th><th scope="col">保存</th>
      </tr></thead><tbody>{event.responses.map(response=>{
        const draft = drafts[response.id] || response;
        return <tr key={response.id}><th scope="row">{response.name}<small>{event.slots.every(s=>response.availability[s.id]) ? "回答完了" : "未完了"}</small></th>
          {event.slots.map(slot=><td key={slot.id}><select aria-label={`${response.name} ${slotLabel(slot)}`} value={draft.availability[slot.id] || ""} disabled={!event.isOpen || busy===response.id}
            onChange={e=>{const values={...draft.availability}; if(e.target.value) values[slot.id]=e.target.value as AvailabilityStatus;else delete values[slot.id];update(response,{availability:values});}}>
              <option value="">未入力</option><option value="yes">○</option><option value="maybe">△</option><option value="no">×</option>
            </select></td>)}
          <td><textarea aria-label={`${response.name}のコメント`} value={draft.comment} maxLength={300} disabled={!event.isOpen || busy===response.id} onChange={e=>update(response,{comment:e.target.value})}/></td>
          <td><button type="button" className="button button--primary" disabled={!event.isOpen || busy!==null} onClick={()=>save(response)}>{busy===response.id ? "保存中…" : "保存"}</button></td></tr>;
      })}</tbody></table>
    </div>
    {!event.isOpen && <p>回答期限を過ぎています。回答・コメントは編集できません。</p>}
    {error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status">{message}</p>}
    <h2>現在の候補日時</h2>
    {finished<6 && <p>未回答があるため暫定結果です。</p>}
    {event.candidates?.length ? <ul>{event.candidates.map(s=><li key={s.id}>{slotLabel(s)}</li>)}</ul> : <p>条件を満たす候補日時がありません。</p>}
  </section>;
}
