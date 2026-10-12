import {it,expect} from 'vitest';
import {detectLanguage} from '../packages/localization';
it('normalizes Arabic keyboard forms and invisible joiners',()=>{
 expect(detectLanguage('تكا‌یە RTX 4060')).toEqual({locale:'ckb',uncertain:false});
 expect(detectLanguage('بهایێ RTX 4060')).toEqual({locale:'bad',uncertain:false});
 expect(detectLanguage('أريد السعر')).toEqual({locale:'ar',uncertain:false});
});
it('requests clarification when dialect evidence conflicts',()=>{
 expect(detectLanguage('تکایە بهایێ RTX 4060','bad')).toEqual({locale:'bad',uncertain:true});
});
it('recognizes an English sentence but preserves dialect for product identifiers',()=>{
 expect(detectLanguage('How much is RTX 4060?','bad').locale).toBe('en');
 expect(detectLanguage('RTX 4060 16GB','bad').locale).toBe('bad');
});
