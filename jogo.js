/* Desafio ADM — jogo de missões do ADM Experience · Técnico em Administração · EEB Eurico Pinz
   Lógica do jogo. As missões e os textos ficam em dados.js. */
(function () {
  'use strict';

  // ---------- regras puras (verificadas por teste.js) ----------
  const Jogo = {
    embaralhar(lista, rnd = Math.random) {
      const a = lista.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },

    // cada partida sorteia a ordem das missões e das cartas: a certa não fica sempre no mesmo lugar
    partida(D, rnd = Math.random) {
      return Jogo.embaralhar(D.missoes, rnd).map(m => ({ m, ops: Jogo.embaralhar(m.opcoes, rnd) }));
    },

    // escolha = posição da carta jogada (-1 quando o tempo acabou)
    acertou(passo, escolha) {
      const o = passo.ops[escolha];
      return !!(o && o.certa);
    },

    acertos(partida, escolhas) {
      return partida.filter((p, k) => Jogo.acertou(p, escolhas[k])).length;
    },

    // níveis vão do maior "min" para o menor; o último vale para 0 acertos
    nivel(D, acertos) {
      return D.niveis.find(n => acertos >= n.min) || D.niveis[D.niveis.length - 1];
    },

    // avisa no console se alguém editar dados.js e quebrar o jogo
    validar(D) {
      const erros = [];
      const campos = ['titulo', 'etiqueta', 'cenario', 'pergunta', 'area', 'icone', 'cor', 'explicacao', 'naEmpresa'];
      D.missoes.forEach((m, k) => {
        const onde = `Missão ${k + 1}`;
        campos.forEach(c => { if (!m[c]) erros.push(`${onde}: falta "${c}"`); });
        if (!Array.isArray(m.opcoes) || m.opcoes.length !== 3) erros.push(`${onde}: precisa de 3 opções`);
        else if (m.opcoes.filter(o => o.certa).length !== 1) erros.push(`${onde}: precisa de exatamente 1 opção certa`);
        (m.opcoes || []).forEach((o, j) => { if (!o.texto || !o.consequencia) erros.push(`${onde}, opção ${j + 1}: falta texto ou consequência`); });
      });
      const mins = D.niveis.map(n => n.min);
      if (mins.some((v, k) => k > 0 && v >= mins[k - 1])) erros.push('Níveis precisam ir do maior "min" para o menor');
      if (mins[mins.length - 1] !== 0) erros.push('O último nível precisa ter min: 0');
      if (mins[0] > D.missoes.length) erros.push('O primeiro nível pede mais acertos do que existem missões');
      return erros;
    },
  };

  if (typeof module !== 'undefined') module.exports = Jogo;
  if (typeof document === 'undefined') return;

  // ---------- interface ----------
  const D = window.DADOS;
  const T = D.textos;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tempo = ms => (reduzido ? Math.min(ms, 150) : ms);
  const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (x, k) => (k in v ? v[k] : x));
  const problemas = Jogo.validar(D);
  if (problemas.length) console.warn('[dados.js]', problemas);

  let partida = [];
  let atual = 0;
  let escolhas = [];
  let nome = '';
  let travado = false;
  let liberadoEm = 0;

  const vars = { n: D.missoes.length, s: D.tempos.decisao };
  $$('[data-t]').forEach(el => { el.textContent = fmt(T[el.dataset.t], vars); });
  $$('[data-t-label]').forEach(el => { el.setAttribute('aria-label', T[el.dataset.tLabel]); });
  $('#campo-nome').placeholder = T.name_placeholder;

  function mostrar(id) {
    $$('.tela').forEach(t => t.classList.toggle('ativa', t.id === id));
    document.body.dataset.tela = id;
    liberadoEm = performance.now() + 400; // clique duplo não pula a tela seguinte
    window.scrollTo(0, 0);
  }

  // reinicia as animações de entrada quando a mesma tela é reaproveitada
  function reanimar(el) {
    el.classList.remove('anima');
    void el.offsetWidth;
    el.classList.add('anima');
  }

  const pronto = () => !travado && performance.now() >= liberadoEm;

  function texto(tag, classe, conteudo) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    el.textContent = conteudo;
    return el;
  }

  function icone(id) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const use = document.createElementNS(ns, 'use');
    svg.setAttribute('aria-hidden', 'true');
    use.setAttribute('href', `#${id}`);
    svg.append(use);
    return svg;
  }

  // ---------- relógio: uma contagem por vez, que pode ser pausada ----------
  const relogio = { total: 1, resto: 0, antes: 0, raf: 0, seg: -1, el: null, aoAcabar: null };
  let pausado = false;

  function cronometrar(segundos, el, aoAcabar) {
    parar();
    Object.assign(relogio, { total: segundos * 1000, resto: segundos * 1000, seg: -1, el, aoAcabar, antes: performance.now() });
    desenhar();
    relogio.raf = requestAnimationFrame(tique);
  }

  function tique(agora) {
    // com a aba escondida o navegador para de chamar; o limite evita pular tempo na volta
    const passou = Math.min(agora - relogio.antes, 250);
    relogio.antes = agora;
    if (!pausado) relogio.resto = Math.max(0, relogio.resto - passou);
    desenhar();
    if (relogio.resto > 0) {
      relogio.raf = requestAnimationFrame(tique);
      return;
    }
    const fim = relogio.aoAcabar;
    parar();
    if (fim) fim();
  }

  function parar() {
    cancelAnimationFrame(relogio.raf);
    relogio.aoAcabar = null;
  }

  function desenhar() {
    const { el } = relogio;
    el.style.setProperty('--p', (relogio.resto / relogio.total).toFixed(4));
    const seg = Math.ceil(relogio.resto / 1000);
    if (seg === relogio.seg) return;
    const primeiro = relogio.seg < 0;
    relogio.seg = seg;
    const num = $('.relogio-seg', el);
    if (!num) return;
    num.textContent = seg;
    el.classList.toggle('acabando', seg <= 10);
    el.classList.toggle('urgente', seg <= 5);
    if (!primeiro && seg > 0 && seg <= 5) som('tique');
  }

  function pausar(valor = !pausado) {
    pausado = valor;
    document.body.classList.toggle('pausado', valor);
    const b = $('#btn-pausa');
    b.setAttribute('aria-pressed', String(valor));
    b.setAttribute('aria-label', valor ? T.retomar_label : T.pausar_label);
  }

  // ---------- peças: carta de área, crachá, trilha ----------
  function cartaArea(m) {
    const el = $('#tpl-area').content.firstElementChild.cloneNode(true);
    el.style.setProperty('--c', m.cor);
    $('.ca-num', el).textContent = String(D.missoes.indexOf(m) + 1).padStart(2, '0');
    $('.ca-rotulo', el).textContent = T.carta_rotulo;
    $('use', el).setAttribute('href', `#a-${m.icone}`);
    $('.ca-nome', el).textContent = m.area;
    el.setAttribute('aria-label', `${T.carta_label} ${m.area}`);
    return el;
  }

  function iniciais(s) {
    const partes = s.split(/\s+/).filter(Boolean);
    return partes.length ? partes.slice(0, 2).map(p => [...p][0]).join('').toUpperCase() : '?';
  }

  function criarCracha() {
    const el = $('#tpl-cracha').content.firstElementChild.cloneNode(true);
    $('.cr-selos', el).replaceChildren(...D.missoes.map(m => {
      const li = document.createElement('li');
      li.style.setProperty('--c', m.cor);
      return li;
    }));
    return el;
  }

  // conquistas: lista na ordem de D.missoes (true = carta conquistada); sem ela, é a prévia
  function preencherCracha(el, nomeVisivel, cargo, conquistas) {
    $('.cr-nome', el).textContent = nomeVisivel;
    $('.cr-iniciais', el).textContent = iniciais(nome);
    $('.cr-cargo', el).textContent = cargo;
    $$('.cr-selos li', el).forEach((li, k) => li.classList.toggle('ok', !!(conquistas && conquistas[k])));
    $('.cr-acertos', el).textContent = conquistas
      ? fmt(T.placar, { n: conquistas.filter(Boolean).length, total: conquistas.length })
      : '';
  }

  const previa = criarCracha();
  $('.nome-previa').append(previa);
  function atualizarPrevia() {
    nome = $('#campo-nome').value.trim().replace(/\s+/g, ' ').slice(0, 20);
    preencherCracha(previa, nome || T.previa_vazio, T.cargo_previa);
  }

  // tela inicial: as cartas de área na mão, em leque
  $('.leque').replaceChildren(...D.missoes.map((m, k, todas) => {
    const el = cartaArea(m);
    el.style.setProperty('--k', k);
    el.style.setProperty('--n', todas.length);
    el.style.setProperty('--d', k - (todas.length - 1) / 2);
    return el;
  }));

  function montarTrilha() {
    $('.trilha').replaceChildren(...partida.map((p, k) => {
      const li = document.createElement('li');
      li.append(icone('i-x'), texto('span', 'sr', ''));
      marcarTrilha(k, 'pendente', li);
      return li;
    }));
  }

  function marcarTrilha(k, estado, li = $$('.trilha li')[k]) {
    li.dataset.estado = estado;
    $('.sr', li).textContent = fmt(T.trilha_item, { n: k + 1, estado: T[`trilha_${estado}`] });
    if (estado === 'certa') {
      li.style.setProperty('--c', partida[k].m.cor);
      $('use', li).setAttribute('href', `#a-${partida[k].m.icone}`);
    }
    if (estado === 'certa' || estado === 'errada') {
      li.classList.remove('bump');
      void li.offsetWidth;
      li.classList.add('bump');
    }
  }

  function preencherPista(ul, linhas = []) {
    ul.replaceChildren(...linhas.map(t => texto('li', '', t)));
  }

  // ---------- as quatro etapas de cada missão ----------
  function comecar() {
    partida = Jogo.partida(D);
    atual = 0;
    escolhas = [];
    travado = false;
    pausar(false);
    montarTrilha();
    abrirMissao();
  }

  // 1. a missão: o problema, para ler com calma
  function abrirMissao() {
    const { m } = partida[atual];
    const sec = $('#missao');
    $('.missao-rotulo', sec).textContent = fmt(T.missao_rotulo, { n: atual + 1, total: partida.length });
    $('.etiqueta', sec).textContent = m.etiqueta;
    $('.missao-titulo', sec).textContent = m.titulo;
    $('.missao-cenario', sec).textContent = m.cenario;
    preencherPista($('.pista', sec), m.pista);
    marcarTrilha(atual, 'atual');
    reanimar(sec);
    mostrar('missao');
    $('.missao-titulo', sec).focus({ preventScroll: true });
    cronometrar(D.tempos.missao, $('.tempo-barra', sec), abrirDecisao);
    som('virar');
  }

  // 2. a decisão: três cartas, tempo correndo
  function abrirDecisao() {
    const { m, ops } = partida[atual];
    const sec = $('#decisao');
    $('.etiqueta', sec).textContent = m.etiqueta;
    $('.decisao-cenario', sec).textContent = m.cenario;
    $('.enunciado', sec).textContent = m.pergunta;
    preencherPista($('.pista', sec), m.pista);
    const mao = $('.mao', sec);
    mao.replaceChildren(...ops.map((o, k) => cartaOpcao(o.texto, 'ABC'[k], k)));
    mao.classList.remove('respondida');
    sec.classList.remove('esgotado');
    reanimar(sec);
    mostrar('decisao');
    $('.enunciado', sec).focus({ preventScroll: true });
    cronometrar(D.tempos.decisao, $('.relogio', sec), () => escolher(-1));
    som('carta');
  }

  function canto(classe, letra) {
    const s = texto('span', `canto ${classe}`, letra);
    s.setAttribute('aria-hidden', 'true');
    const naipe = document.createElement('img');
    naipe.src = 'assets/marca/curso-simbolo.webp';
    naipe.alt = '';
    s.append(naipe);
    return s;
  }

  function cartaOpcao(conteudo, letra, k) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'carta opcao';
    b.style.setProperty('--i', k);
    b.setAttribute('aria-keyshortcuts', letra);
    b.append(canto('canto-a', letra), texto('span', 'opcao-texto', conteudo), canto('canto-b', letra));
    b.addEventListener('click', () => escolher(k, b));
    return b;
  }

  function escolher(k, carta) {
    if (travado || (carta && !pronto())) return;
    travado = true;
    parar();
    escolhas[atual] = k;
    if (carta) {
      carta.classList.add('jogada');
      som('carta');
    } else {
      $('#decisao').classList.add('esgotado');
      som('tempo');
    }
    $('#decisao .mao').classList.add('respondida');
    setTimeout(() => { travado = false; abrirConsequencia(); }, tempo(carta ? 650 : 1000));
  }

  // 3. a consequência: a carta escolhida vira e mostra o que aconteceu
  function abrirConsequencia() {
    const passo = partida[atual];
    const k = escolhas[atual];
    const o = passo.ops[k];
    const certa = Jogo.acertou(passo, k);
    const veredito = !o ? 'tempo' : certa ? 'certa' : 'errada';
    const sec = $('#consequencia');
    sec.dataset.veredito = veredito;
    $('.carimbo', sec).textContent = T[`carimbo_${veredito}`];
    $('.conseq-letra', sec).textContent = o ? 'ABC'[k] : '';
    $('.conseq-escolha-texto', sec).textContent = o ? o.texto : T.sem_escolha;
    $('.conseq-texto', sec).textContent = o ? o.consequencia : T.tempo_esgotado;
    $('.melhor', sec).hidden = certa;
    $('.melhor-texto', sec).textContent = passo.ops.find(x => x.certa).texto;
    reanimar(sec);
    mostrar('consequencia');
    $('.carimbo', sec).focus({ preventScroll: true });
    cronometrar(D.tempos.consequencia, $('.acoes-etapa .tempo-barra', sec), abrirResultado);
    som('virar');
    setTimeout(() => { if (document.body.dataset.tela === 'consequencia') som(certa ? 'certo' : 'errado'); }, tempo(520));
  }

  // 4. o resultado: qual área da Administração entrou em jogo
  function abrirResultado() {
    const passo = partida[atual];
    const { m } = passo;
    const certa = Jogo.acertou(passo, escolhas[atual]);
    const sec = $('#resultado');
    sec.dataset.veredito = certa ? 'certa' : 'errada';
    sec.style.setProperty('--c', m.cor);
    const area = $('.res-carta-area', sec);
    const velha = $('.carta-area', area);
    if (velha) velha.remove();
    area.prepend(cartaArea(m));
    $('.res-kicker', sec).textContent = certa ? T.res_kicker_certa : T.res_kicker_errada;
    const [antes, depois = ''] = (certa ? T.res_usou : T.res_faltou).split('{area}');
    $('.res-titulo', sec).replaceChildren(antes, texto('span', 'res-area', m.area), depois);
    $('.res-explicacao', sec).textContent = m.explicacao;
    $('.res-empresa-texto', sec).textContent = m.naEmpresa;
    $('.btn-resultado-texto', sec).textContent = atual + 1 < partida.length ? T.proxima_missao : T.ver_cracha;
    marcarTrilha(atual, certa ? 'certa' : 'errada');
    reanimar(sec);
    mostrar('resultado');
    $('.res-titulo', sec).focus({ preventScroll: true });
    cronometrar(D.tempos.resultado, $('.tempo-barra', sec), proxima);
    if (certa) setTimeout(() => { if (document.body.dataset.tela === 'resultado') som('conquista'); }, tempo(900));
  }

  function proxima() {
    atual++;
    if (atual < partida.length) return abrirMissao();
    abrirFinal();
  }

  // ---------- final: o crachá com o cargo conquistado ----------
  function abrirFinal() {
    parar();
    pausar(false);
    const n = Jogo.acertos(partida, escolhas);
    const nv = Jogo.nivel(D, n);
    const conquistas = D.missoes.map(m => {
      const k = partida.findIndex(p => p.m === m);
      return k >= 0 && Jogo.acertou(partida[k], escolhas[k]);
    });
    const sec = $('#final');
    const lugar = $('.final-cracha', sec);
    const velho = $('.cracha', lugar);
    if (velho) velho.remove();
    const cracha = criarCracha();
    preencherCracha(cracha, nome || T.cracha_sem_nome, nv.titulo, conquistas);
    cracha.setAttribute('aria-label', fmt(T.cracha_label, { nome: nome || T.cracha_sem_nome, cargo: nv.titulo }));
    lugar.prepend(cracha);
    $('.final-coroa', sec).hidden = n < partida.length;
    $('.final-cargo', sec).textContent = nv.titulo;
    $('.final-frase', sec).textContent = nv.frase;
    $('.final-mensagem', sec).textContent = nv.mensagem;
    $('.colecao-titulo', sec).textContent = fmt(T.colecao_titulo, { n, total: partida.length });
    $('.colecao-lista', sec).replaceChildren(...D.missoes.map((m, k) => selo(m, conquistas[k])));
    reanimar(sec);
    mostrar('final');
    $('.final-cargo', sec).focus({ preventScroll: true });
    setTimeout(() => som('revelar'), tempo(1200));
  }

  function selo(m, ganhou) {
    const li = document.createElement('li');
    li.className = ganhou ? 'selo' : 'selo perdida';
    li.style.setProperty('--c', m.cor);
    const naipe = texto('span', 'selo-naipe', '');
    naipe.append(icone(`a-${m.icone}`));
    li.append(naipe, m.area, texto('span', 'sr', ganhou ? T.selo_ganhou : T.selo_perdeu));
    return li;
  }

  function reiniciar() {
    parar();
    pausar(false);
    $('#campo-nome').value = '';
    atualizarPrevia();
    reanimar($('#inicio'));
    mostrar('inicio');
  }

  // ---------- som (Web Audio, sem arquivos) ----------
  let audio = null;
  let somLigado = true;
  try { somLigado = localStorage.getItem('desafio-adm-som') !== 'off'; } catch (e) { /* sem storage: segue ligado */ }

  function nota(freq, ini, dur, tipo, vol, fim) {
    const o = audio.createOscillator();
    const g = audio.createGain();
    const t = audio.currentTime + ini;
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (fim) o.frequency.exponentialRampToValueAtTime(fim, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur);
  }

  // ruído filtrado: som de papel (carta, carimbo)
  function papel(dur, freq, vol) {
    const n = Math.floor(audio.sampleRate * dur);
    const buf = audio.createBuffer(1, n, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const fonte = audio.createBufferSource();
    const filtro = audio.createBiquadFilter();
    const g = audio.createGain();
    fonte.buffer = buf;
    filtro.type = 'bandpass';
    filtro.frequency.value = freq;
    filtro.Q.value = 0.7;
    g.gain.value = vol;
    fonte.connect(filtro).connect(g).connect(audio.destination);
    fonte.start();
  }

  function som(tipo) {
    if (!somLigado) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      if (tipo === 'carta') { papel(0.13, 2600, 0.7); nota(520, 0.02, 0.07, 'triangle', 0.06); }
      if (tipo === 'virar') papel(0.22, 1800, 0.55);
      if (tipo === 'tique') nota(1250, 0, 0.05, 'square', 0.035);
      if (tipo === 'tempo') { nota(196, 0, 0.55, 'square', 0.05, 150); papel(0.2, 500, 0.5); }
      if (tipo === 'certo') {
        papel(0.09, 700, 0.9);
        [523.25, 659.25, 783.99].forEach((f, k) => nota(f, 0.06 + k * 0.08, 0.32, 'triangle', 0.12));
      }
      if (tipo === 'errado') {
        papel(0.09, 700, 0.9);
        nota(311.13, 0.06, 0.24, 'sawtooth', 0.045, 293.66);
        nota(246.94, 0.32, 0.5, 'sawtooth', 0.045, 220);
      }
      if (tipo === 'conquista') [659.25, 783.99, 1046.5, 1318.5].forEach((f, k) => nota(f, k * 0.07, 0.35, 'triangle', 0.09));
      if (tipo === 'revelar') {
        nota(140, 0, 0.3, 'sine', 0.45, 50);
        [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => nota(f, 0.12 + k * 0.08, 0.45, 'triangle', 0.1));
      }
    } catch (e) { /* navegador sem Web Audio: joga sem som */ }
  }

  function marcarSom() {
    const b = $('#btn-som');
    b.setAttribute('aria-pressed', String(somLigado));
    b.classList.toggle('mudo', !somLigado);
  }

  // ---------- eventos ----------
  $('#btn-comecar').addEventListener('click', () => {
    reanimar($('#nome'));
    mostrar('nome');
    $('#campo-nome').focus({ preventScroll: true });
  });
  $('#campo-nome').addEventListener('input', atualizarPrevia);
  $('#form-nome').addEventListener('submit', e => {
    e.preventDefault();
    atualizarPrevia();
    comecar();
  });
  $('#missao .missao-seguir').addEventListener('click', () => { if (pronto()) abrirDecisao(); });
  $('#btn-conseq').addEventListener('click', () => { if (pronto()) abrirResultado(); });
  $('#btn-resultado').addEventListener('click', () => { if (pronto()) proxima(); });
  $('#btn-pausa').addEventListener('click', () => pausar());
  $('#btn-som').addEventListener('click', () => {
    somLigado = !somLigado;
    try { localStorage.setItem('desafio-adm-som', somLigado ? 'on' : 'off'); } catch (e) { /* ok */ }
    marcarSom();
  });
  $('#btn-imprimir').addEventListener('click', () => window.print());
  $('#btn-reiniciar').addEventListener('click', reiniciar);

  const BOTAO_PRINCIPAL = { missao: '#missao .missao-seguir', consequencia: '#btn-conseq', resultado: '#btn-resultado' };
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const tela = document.body.dataset.tela;
    const k = e.key.toLowerCase();
    if (k === 'p' && ['missao', 'decisao', 'consequencia', 'resultado'].includes(tela)) {
      e.preventDefault();
      pausar();
    } else if (tela === 'decisao' && k in { a: 1, b: 1, c: 1, 1: 1, 2: 1, 3: 1 }) {
      const carta = $$('#decisao .opcao')[{ a: 0, b: 1, c: 2, 1: 0, 2: 1, 3: 2 }[k]];
      if (carta) { e.preventDefault(); carta.click(); }
    } else if (k === 'enter' && BOTAO_PRINCIPAL[tela] && !e.target.closest('button')) {
      e.preventDefault();
      $(BOTAO_PRINCIPAL[tela]).click();
    }
  });

  pausar(false);
  marcarSom();
  atualizarPrevia();
  reanimar($('#inicio'));
  mostrar('inicio');
})();
