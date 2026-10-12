import {it,expect} from 'vitest';
import {detectLanguage} from '../packages/localization';
import {interpretLatinBadini} from '../packages/localization/badini';
import {MockProvider,renderAnswer} from '../packages/ai';
import {demoProducts} from '../packages/database/business';
import type {Product} from '../packages/shared';
it('normalizes Arabic keyboard forms and invisible joiners',()=>{
 expect(detectLanguage('تكا‌یە RTX 4060')).toEqual({locale:'ckb',uncertain:false});
 expect(detectLanguage('بهایێ RTX 4060')).toEqual({locale:'bad',uncertain:false});
 expect(detectLanguage('أريد السعر')).toEqual({locale:'ar',uncertain:false});
});
it('recognizes the requested informal Badini phrases by intent',()=>{
 for(const [text,intent] of [['slav chawa yi','greeting'],['iphone 15 pro max haya','availability'],['ave chand daya','price'],['ez dixwazim laptop bikirim','purchase'],['ave zmanayzhi zeda ka','language_request']]){
  expect(detectLanguage(text,'en')).toEqual({locale:'bad',uncertain:false});expect(interpretLatinBadini(text).intent).toBe(intent);
 }
 expect(interpretLatinBadini('Have you seen my laptop?').recognized).toBe(false);
});
it('answers a Romanized purchase request from catalog facts in Kurdish script',async()=>{
 const catalog=demoProducts.map((p,i)=>({...p,id:String(i),org_id:'test',created_at:''})) as Product[];
 const question='ez dixwazim laptop RTX 4060 bikirim';const selected=await new MockProvider().select(question,catalog);
 const answer=renderAnswer(selected,detectLanguage(question).locale,undefined,question);
 expect(answer).toContain('Atlas Gaming 15');expect(answer).toContain('RTX 4060');expect(answer).toContain('کاتەلۆگێ');
 expect(renderAnswer({products:[],provider:'mock',tokens:0,handoff:true},'bad',undefined,'ave chand daya')).toContain('ناڤێ بەرهەمی');
});
it('requests clarification when dialect evidence conflicts',()=>{
 expect(detectLanguage('تکایە بهایێ RTX 4060','bad')).toEqual({locale:'bad',uncertain:true});
});
it('recognizes an English sentence but preserves dialect for product identifiers',()=>{
 expect(detectLanguage('How much is RTX 4060?','bad').locale).toBe('en');
 expect(detectLanguage('RTX 4060 16GB','bad').locale).toBe('bad');
});
