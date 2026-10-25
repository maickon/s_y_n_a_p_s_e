const STOP = new Set(('a o e é de da do das dos em no na nos nas um uma uns umas para por com sem que se sua seu suas seus ao aos à às como mais mas foi ser são era está estão isso este esta esse essa aquele aquela ' +
  'apenas sobre antes depois quando onde ainda já não sim muito pouco todo toda todos todas nada tudo eu tu ele ela nós eles elas me te lhe meu minha teu tua nosso nossa ou nem também entre até desde ' +
  'contra cada outro outra mesmo mesma sido ter tem têm tinha há pelo pela pelos pelas num numa qual quais sempre nunca agora aqui ali lá então assim porque pois seja sobre si mesmo').split(' '));

// palavras-chave por relevância (substantivos favorecidos por sufixo)
// palavras-chave por relevância: substantivos (após artigo/preposição) e sufixos nominais pesam mais; verbos pesam menos
const ART = new Set('o a os as um uma uns umas do da dos das no na nos nas ao aos pelo pela de em seu sua'.split(' '));
export function keywords(text, n = 2) {
  const raw = text.split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}-]/gu, '')), noun = new Set();
  raw.forEach((w, i) => i && ART.has(raw[i - 1].toLowerCase()) && noun.add(w));
  const ws = [...new Set(raw.filter(w => w.length > 2 && !STOP.has(w.toLowerCase())))];
  const sc = w => Math.min(w.length, 8) + (noun.has(w) ? 4 : 0) + (/(ção|ções|dade|mento|agem|ismo|eiro|eira|ura)$/i.test(w) ? 3 : 0)
    - (/(ar|er|ir|ou|ava|iam|emos|amos|ando|endo|indo|ram|a[mn]|e[mn])$/i.test(w) && !noun.has(w) ? 4 : 0) - (/(ina|ura|oso|osa|ente)$/i.test(w) && !noun.has(w) ? 1 : 0) + (/^\p{Lu}/u.test(w) ? 2 : 0);
  return ws.sort((a, b) => sc(b) - sc(a)).slice(0, n);
}
