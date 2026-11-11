// node teste.js — confere o dados.js e as regras do jogo
const assert = require('assert');
global.window = global;
require('./dados.js');
const Jogo = require('./jogo.js');
const D = window.DADOS;

assert.deepStrictEqual(Jogo.validar(D), [], 'dados.js com problema');

// textos curtos o bastante para ler no tempo de cada etapa (9º ano)
const palavras = s => s.trim().split(/\s+/).length;
const LIMITE = { cenario: 30, pergunta: 6, explicacao: 28, naEmpresa: 18, texto: 14, consequencia: 22, pista: 7 };
D.missoes.forEach((m, k) => {
  const onde = `missão ${k + 1} (${m.titulo})`;
  for (const c of ['cenario', 'pergunta', 'explicacao', 'naEmpresa']) {
    assert(palavras(m[c]) <= LIMITE[c], `${onde}: "${c}" passou de ${LIMITE[c]} palavras`);
  }
  assert(m.pista.length >= 1 && m.pista.length <= 3, `${onde}: a pista precisa de 1 a 3 linhas`);
  m.pista.forEach(l => assert(palavras(l) <= LIMITE.pista, `${onde}: linha da pista longa demais: ${l}`));
  m.opcoes.forEach(o => {
    assert(palavras(o.texto) <= LIMITE.texto, `${onde}: opção longa demais: ${o.texto}`);
    assert(palavras(o.consequencia) <= LIMITE.consequencia, `${onde}: consequência longa demais: ${o.consequencia}`);
    assert(!/\b[ABC]\)|opção [ABC]\b/i.test(o.texto + o.consequencia), `${onde}: não cite letras, a ordem é sorteada`);
  });
});
// a certa não pode se entregar por ser sempre a mais longa
const certaMaisLonga = D.missoes.filter(m => {
  const n = m.opcoes.map(o => palavras(o.texto));
  return palavras(m.opcoes.find(o => o.certa).texto) > Math.max(...n.filter((v, i) => !m.opcoes[i].certa));
}).length;
assert(certaMaisLonga <= Math.floor(D.missoes.length / 2), `a opção certa é a mais longa em ${certaMaisLonga} missões`);

// sorteio: todas as missões aparecem uma vez e a certa muda de lugar
let semente = 7;
const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
const lugares = new Set();
for (let i = 0; i < 200; i++) {
  const p = Jogo.partida(D, rnd);
  assert.strictEqual(new Set(p.map(x => x.m)).size, D.missoes.length, 'missão repetida ou faltando');
  p.forEach(x => {
    assert.strictEqual(x.ops.length, 3);
    assert.strictEqual(x.ops.filter(o => o.certa).length, 1);
    lugares.add(x.ops.findIndex(o => o.certa));
  });
}
assert.deepStrictEqual([...lugares].sort(), [0, 1, 2], 'a certa precisa aparecer em todas as posições');

// pontuação: certa conta, errada e tempo esgotado (-1) não contam
const p = Jogo.partida(D, rnd);
const todasCertas = p.map(x => x.ops.findIndex(o => o.certa));
const todasErradas = p.map(x => x.ops.findIndex(o => !o.certa));
assert.strictEqual(Jogo.acertos(p, todasCertas), D.missoes.length);
assert.strictEqual(Jogo.acertos(p, todasErradas), 0);
assert.strictEqual(Jogo.acertos(p, p.map(() => -1)), 0);
assert.strictEqual(Jogo.acertos(p, [todasCertas[0], -1]), 1);

// cada quantidade de acertos tem um cargo, e gabaritar dá o cargo mais alto
for (let n = 0; n <= D.missoes.length; n++) assert(Jogo.nivel(D, n), `sem cargo para ${n} acertos`);
assert.strictEqual(Jogo.nivel(D, D.missoes.length), D.niveis[0]);
assert.strictEqual(Jogo.nivel(D, 0), D.niveis[D.niveis.length - 1]);

console.log('ok: dados válidos, textos no tamanho, sorteio justo, pontuação e cargos certos');
