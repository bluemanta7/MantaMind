const fs = require('fs');
const path = require('path');
const dataPath = path.join(__dirname, '..', 'data.json');
const raw = fs.readFileSync(dataPath, 'utf8');
const data = JSON.parse(raw);
const wordData = data.words || [];

function runAugment(wordData) {
  const augmentLog = [];
  wordData.forEach(cw => {
    if (!cw || !cw.word) return;
    cw.forms = Array.isArray(cw.forms) ? cw.forms.slice() : [];
    const existing = new Set(cw.forms.map(f => String(f.variant).toLowerCase()).filter(Boolean));
    const base = String(cw.word);
    const baseLower = base.toLowerCase();
    const example = cw.examples && cw.examples[0] ? cw.examples[0] : null;

    const nounVariants = cw.forms.filter(f => /\bnoun\b/i.test(f.type)).map(f => String(f.variant));
    const verbVariants = cw.forms.filter(f => /\bverb\b/i.test(f.type)).map(f => String(f.variant));

    const candidates = [];
    if (!existing.has(baseLower)) {
      candidates.push({ type: 'base', variant: base.toLowerCase(), sentence: example ? example.replace(/____/g, base) : `The ${base} was noted.` });
    }

    if (nounVariants.length) {
      const nounMatchBase = nounVariants.find(v => String(v).toLowerCase() === baseLower);
      const nounToPluralize = nounMatchBase || nounVariants[0];
      if (nounToPluralize) {
        const plural = String(nounToPluralize) + 's';
        if (!existing.has(plural.toLowerCase())) {
          candidates.push({ type: 'noun (plural)', variant: plural, sentence: example ? example.replace(/____/g, plural) : `The ${plural} were noted.` });
        }
      }
    }

    const verbSources = verbVariants.slice();
    if (!verbSources.length && /^to\s+/i.test(cw.definition || '')) {
      verbSources.push(base.toLowerCase());
    }

    for (const vsrc of verbSources) {
      const vs = String(vsrc);
      const ing = (vs.endsWith('e') && vs.length > 2) ? (vs.slice(0, -1) + 'ing') : (vs + 'ing');
      if (!existing.has(ing.toLowerCase())) candidates.push({ type: 'gerund', variant: ing, sentence: example ? example.replace(/____/g, ing) : `${ing} was observed.` });
      const ed = vs.endsWith('e') ? (vs + 'd') : (vs + 'ed');
      if (!existing.has(ed.toLowerCase())) candidates.push({ type: 'past', variant: ed, sentence: example ? example.replace(/____/g, ed) : `${ed} occurred.` });
    }

    // find which would be added (up to 4 total)
    const wouldAdd = [];
    const afterCount = cw.forms.length;
    for (const c of candidates) {
      if (cw.forms.length + wouldAdd.length >= 4) break;
      const v = String(c.variant);
      if (!v) continue;
      const key = v.toLowerCase();
      if (existing.has(key)) continue;
      wouldAdd.push({ word: cw.word, added: v, type: c.type });
      existing.add(key);
    }
    if (wouldAdd.length) augmentLog.push({ word: cw.word, added: wouldAdd });
  });
  return augmentLog;
}

const report = runAugment(wordData);
console.log(JSON.stringify(report, null, 2));
