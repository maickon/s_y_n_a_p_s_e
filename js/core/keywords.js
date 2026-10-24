const STOP = new Set(('a o e é de da do das dos em no na nos nas um uma uns umas para por com sem que se sua seu suas seus ao aos à às como mais mas foi ser são era está estão isso este esta esse essa aquele aquela ' +
  'apenas sobre antes depois quando onde ainda já não sim muito pouco todo toda todos todas nada tudo eu tu ele ela nós eles elas me te lhe meu minha teu tua nosso nossa ou nem também entre até desde ' +
  'contra cada outro outra mesmo mesma sido ter tem têm tinha há pelo pela pelos pelas num numa qual quais sempre nunca agora aqui ali lá então assim porque pois seja sobre si mesmo').split(' '));

// palavras-chave por relevância (substantivos favorecidos por sufixo)
export function keywords(text, n = 2) {
  const ws = [...new Set(text.split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}-]/gu, '')).filter(w => w.length > 3 && !STOP.has(w.toLowerCase())))];
  const sc = w => w.length + (/(ção|ções|dade|mento|agem|ismo|eiro|eira|ura)$/i.test(w) ? 4 : 0) - (/(ar|er|ir|ou|ando|endo|indo|ram|ava|iam|emos|amos)$/i.test(w) ? 4 : 0) + (/^\p{Lu}/u.test(w) ? 2 : 0);
  return ws.sort((a, b) => sc(b) - sc(a)).slice(0, n);
}
