"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {api,Field} from './ui';
import {languages,rtl} from '@reply/localization';
import type {Locale} from '@reply/shared';
export type CloudConversation={id:string;status:'open'|'unread'|'resolved';locale:Locale;preferred_locale:Locale|null;paused:boolean;customers:{display_name:string}};
type Message={id:string;role:string;body:string;provider:string;created_at:string};
type History={messages:Message[];nextCursor:string|null};
type Action=(action:string,data:unknown)=>Promise<boolean>;
type Attempt={signature:string;id:string}|null;
function requestId(ref:{current:Attempt},data:unknown){const signature=JSON.stringify(data);if(ref.current?.signature!==signature)ref.current={signature,id:crypto.randomUUID()};return ref.current.id;}
export function CloudInbox({conversations,act,busy}:{conversations:CloudConversation[];act:Action;busy:boolean}){
 const [selectedId,setSelectedId]=useState(''),[history,setHistory]=useState<History>({messages:[],nextCursor:null}),[error,setError]=useState(''),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
 const selected=conversations.find(c=>c.id===selectedId),revision=useRef(0),intakeAttempt=useRef<Attempt>(null),replyAttempt=useRef<Attempt>(null);
 const load=useCallback(async(cursor?:string)=>{
  if(!selectedId)return;const version=++revision.current;setLoading(true);setError('');
  try{const result=await api<History>('/api/cloud?conversation='+selectedId+(cursor?'&before='+encodeURIComponent(cursor):''));if(revision.current===version)setHistory(previous=>({messages:cursor?[...result.messages,...previous.messages]:result.messages,nextCursor:result.nextCursor}));}
  catch(e){if(revision.current===version)setError((e as Error).message);}
  finally{if(revision.current===version)setLoading(false);}
 },[selectedId]);
 const invalidate=useCallback(()=>{revision.current++;},[]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>{clearTimeout(timer);invalidate();};},[load,invalidate]);
 const control=(patch:Partial<{paused:boolean;status:CloudConversation['status'];locale:Locale|null}>)=>selected&&act('conversation.control',{conversationId:selected.id,paused:selected.paused,status:selected.status,locale:selected.preferred_locale,...patch});
 return <section className="panel stack" aria-label="Cloud inbox"><h2>Cloud customer inbox</h2><p className="muted small">Staff intake and human replies are stored in Supabase. Use fictional messages. Cloud Gemini generation and external delivery are not enabled yet. Latest 100 conversations; message history loads in pages of 50.</p>
 <details><summary>Add fictional customer message</summary><form className="stack" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form),data={name:String(f.get('name')),body:String(f.get('body'))};if(await act('conversation.intake',{...data,requestId:requestId(intakeAttempt,data)})){intakeAttempt.current=null;form.reset();}}}>
 <Field label="Inbox customer name" name="name" required minLength={2} maxLength={100}/><label>Incoming fictional message<textarea name="body" required maxLength={2000}/></label><button className="btn" disabled={busy}>Save cloud conversation</button></form></details>
 <label>Cloud conversation<select disabled={busy||saving||loading} value={selectedId} onChange={e=>{revision.current++;setHistory({messages:[],nextCursor:null});setSelectedId(e.target.value);}}><option value="">Choose a conversation</option>{conversations.map(c=><option value={c.id} key={c.id}>{c.customers.display_name} · {c.status}</option>)}</select></label>
 {error&&<p className="error" role="alert">{error}</p>}
 {selected&&<><div className="row wrap"><button className="btn" disabled={busy} onClick={()=>void control({paused:!selected.paused})}>{selected.paused?'Release cloud takeover':'Take over cloud conversation'}</button><button className="btn" disabled={loading} onClick={()=>void load()}>Refresh cloud messages</button></div>
 <div className="grid two"><label>Conversation status<select disabled={busy} value={selected.status} onChange={e=>void control({status:e.target.value as CloudConversation['status']})}><option value="open">Open</option><option value="unread">Unread</option><option value="resolved">Resolved</option></select></label><label>Cloud reply language<select disabled={busy} value={selected.preferred_locale||'auto'} onChange={e=>void control({locale:e.target.value==='auto'?null:e.target.value as Locale})}><option value="auto">Auto-detect</option>{Object.entries(languages).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
 <p className="small muted">{selected.paused?'Human takeover is active.':'Human service is available.'} Reply language: {languages[selected.locale]}.</p>
 {history.nextCursor&&<button className="btn" disabled={loading} onClick={()=>void load(history.nextCursor!)}>Load older cloud messages</button>}
 <div className="messages" aria-label="Cloud message history" aria-busy={loading} dir={rtl(selected.locale)?'rtl':'ltr'}>{history.messages.map(message=><article key={message.id} className={'message '+message.role}><strong>{message.role==='note'?'Private staff note':message.role==='customer'?'Customer':'Staff · human'}</strong><p dir="auto">{message.body}</p></article>)}</div>
 <form className="stack" onSubmit={async e=>{e.preventDefault();setSaving(true);const form=e.currentTarget,f=new FormData(form),data={conversationId:selected.id,body:String(f.get('body')),note:f.get('note')==='on'};try{if(await act('conversation.reply',{...data,requestId:requestId(replyAttempt,data)})){replyAttempt.current=null;form.reset();await load();}}finally{setSaving(false);}}}><label>Cloud staff message<textarea name="body" disabled={busy||saving} required maxLength={4000}/></label><label className="row"><input style={{width:18}} type="checkbox" disabled={busy||saving} name="note"/> Private staff note</label><button className="btn primary" disabled={busy||saving}>Save cloud staff message</button></form></>}
 </section>;
}
