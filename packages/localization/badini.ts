export type BadiniIntent='greeting'|'availability'|'price'|'purchase'|'language_request'|'unknown';
// Interpretation hints, not character-by-character transliteration. Keep the original message and model names intact.
export function interpretLatinBadini(text:string){
 const normalized=text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
 let intent:BadiniIntent='unknown';
 if(/\b(?:slav|silav|slaw)\b.*\b(?:chawa|cawa|choni)\b|\bchawa yi\b/.test(normalized))intent='greeting';
 else if(/\b(?:ez|az)\s+(?:dixwazim|dixazim|dxwazim)\b|\bbikirim\b/.test(normalized))intent='purchase';
 else if(/\b(?:ave|eve|ava|eva)\s+(?:chand|cand)\b|\b(?:bihaye|bahaye)\b/.test(normalized))intent='price';
 else if(/\b(?:zmanayzhi|zman|zimane)\b.*\b(?:zeda|zede)\s+ka\b/.test(normalized))intent='language_request';
 else if(/\b(?:haya|heye|haye)\b/.test(normalized)&&/\b(?:iphone|laptop|telefon|mobile|rtx|samsung)\b/.test(normalized))intent='availability';
 const recognized=intent!=='unknown';
 const query=text.replace(/\b(?:leptop|laptob)\b/gi,'laptop').replace(/\b(?:telefon|mobayl)\b/gi,'phone');
 return {recognized,intent,normalized,query};
}
