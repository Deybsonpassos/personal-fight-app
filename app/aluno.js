// Evita envio duplicado por toque repetido
(() => { const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "onsubmit"); if (!d?.set) return;
  Object.defineProperty(HTMLFormElement.prototype, "onsubmit", { configurable: true, get() { return d.get.call(this); }, set(fn) { d.set.call(this, fn && (async function (e) { if (this.dataset.enviando) { e.preventDefault(); return; } this.dataset.enviando = "1"; const bs = [...this.querySelectorAll("button")].filter((b) => !b.disabled); bs.forEach((b) => (b.disabled = true)); try { return await fn.call(this, e); } finally { delete this.dataset.enviando; bs.forEach((b) => (b.disabled = false)); } })); } }); })();
/* =====================================================================
   Personal Fight — app do ALUNO / RESPONSÁVEL (Sprint 3 · pele B · Corner)
   Só leitura: o aluno vê agenda, diários, técnicas e o próprio perfil.
   Nada que o professor marcou como privado chega aqui (RLS no banco, não neste arquivo).
   Seções: 1 util · 2 db · 3 acesso/login · 4 AGENDA · 5 DIÁRIOS · 6 TÉCNICAS · 7 EU · 8 boot
   ===================================================================== */

// ---------------------------------------------------------------- 1. util
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"], DIAS_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const STATUS = { agendada: "Agendada", realizada: "Realizada", falta_sem_aviso: "Falta", cancelada_aluno: "Cancelada por você", cancelada_professor: "Cancelada pelo professor", remarcada: "Remarcada" };
const L = { condicionamento: "condicionamento/emagrecimento", defesa: "defesa pessoal", competir: "competir", tecnica: "evoluir na técnica", saude_mental: "saúde mental", hobby: "hobby", outro: "outro", termos: "Política de marcação", saude: "Uso dos dados da entrevista", imagem_gravacao: "Gravação das sessões", nao: "não autorizo", interno: "uso interno", interno_e_redes: "interno + redes" };
const lab = (x) => L[x] || x || "—";
const fmtHora = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtData = (d) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtCurta = (d) => { const x = new Date(d); return `${DIAS[x.getDay()]} ${String(x.getDate()).padStart(2, "0")}.${String(x.getMonth() + 1).padStart(2, "0")}`; };
const primeiroNome = (n) => (n || "").split(" ")[0], up = (s) => String(s || "").toUpperCase();
const fmtReais = (c) => (Number(c || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PERIODO_LABEL = { 1: "Mensal", 3: "Trimestral", 6: "Semestral", 12: "Anual" };
const S = (n) => "S" + String(n).padStart(3, "0");
let toastTimer; function toast(m, ms = 2800) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms); }
function abrirModal(titulo, html, eyebrow = "") { $("#modal-eyebrow").textContent = eyebrow; $("#modal-titulo").textContent = titulo; $("#modal-corpo").innerHTML = html; $("#modal").hidden = false; $(".modal-caixa").scrollTop = 0; return $("#modal-corpo"); }
function fecharModal() { $("#modal").hidden = true; } $("#modal-fechar").onclick = fecharModal; $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") fecharModal(); });
const topo = (sub, titulo, acao = "") => { $("#topo-sub").textContent = sub; $("#topo-titulo").textContent = titulo; $("#topo-acao").innerHTML = acao; };

// ---------------------------------------------------------------- 2. db
const sb = supabase.createClient(PF_CONFIG.SUPABASE_URL, PF_CONFIG.SUPABASE_ANON_KEY);
const db = {
  meusAlunos: () => sb.from("v_alunos").select("*").order("nome"),
  sessoes: (aid) => sb.from("sessoes").select("*, modalidades(nome), locais(apelido,bairro,endereco)").eq("aluno_id", aid).order("inicio"),
  horarios: (aid) => sb.from("horarios_fixos").select("*, locais(apelido,bairro)").eq("aluno_id", aid).eq("ativo", true).order("dia_semana"),
  pacotes: (aid) => sb.from("v_pacotes_saldo").select("*").eq("aluno_id", aid).order("comprado_em", { ascending: false }),
  programa: (aid) => sb.from("programa_sessoes").select("*").eq("aluno_id", aid).order("ordem"),
  tecnicas: (aid) => sb.from("alunos_tecnicas").select("*").eq("aluno_id", aid).order("atualizado_em", { ascending: false }),
  consentimentos: (aid) => sb.from("consentimentos").select("*").eq("aluno_id", aid).is("revogado_em", null).order("aceito_em", { ascending: false }),
  professor: async () => { const { data } = await sb.rpc("professor_contato"); return data || {}; },
  cobrancas: (aid) => sb.from("v_cobrancas").select("*").eq("aluno_id", aid).order("vence_em", { ascending: false }).limit(40),
};

// ---------------------------------------------------------------- 3. acesso / login
const codigo = new URLSearchParams(location.search).get("c") || (PF_CONFIG.DEMO && !sessionStorage.getItem("pf_demo_aluno_ok") ? "DEMO" : "");
let modoCriar = false, infoCodigo = null;
function mostrarLogin(msg = "") {
  $("#app").hidden = true; $("#tela-login").hidden = false;
  const e = $("#login-erro"); e.hidden = !msg; e.textContent = msg;
  const btn = $("#login-btn"), alt = $("#alternar");
  if (codigo && infoCodigo?.valido) {
    $("#login-eyebrow").textContent = infoCodigo.papel === "responsavel" ? `Responsável de ${infoCodigo.aluno}` : `Olá, ${infoCodigo.aluno}`;
    $("#login-titulo").textContent = modoCriar ? "Criar conta" : "Entrar";
    $("#login-texto").textContent = modoCriar ? "Escolha o e-mail e uma senha (6+ caracteres). Você usará isso para abrir o app." : "Já tem conta? Entre e o código será vinculado a ela.";
    btn.textContent = modoCriar ? "Criar conta e entrar" : "Entrar"; alt.hidden = false; alt.textContent = modoCriar ? "Já tenho conta" : "Criar conta com o código";
    $("#login-rodape").textContent = "";
  } else {
    $("#login-eyebrow").textContent = "Meu treino"; $("#login-titulo").textContent = "Entrar"; $("#login-texto").textContent = ""; btn.textContent = "Entrar"; alt.hidden = true;
    $("#login-rodape").textContent = codigo ? (infoCodigo?.usado ? "Este código já foi usado. Entre com sua conta." : "Código inválido ou expirado. Peça outro ao professor.") : "Sem código de acesso? Peça ao professor.";
  }
}
$("#alternar").onclick = () => { modoCriar = !modoCriar; mostrarLogin(); };
$("#form-login").onsubmit = async (e) => {
  e.preventDefault(); const f = e.target, email = f.email.value.trim(), password = f.senha.value;
  $("#login-erro").hidden = true;
  if (modoCriar) {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { nome: infoCodigo?.aluno || email.split("@")[0], papel: infoCodigo?.papel || "aluno" } } });
    if (error) return mostrarLogin("Não foi possível criar a conta: " + error.message);
    if (!data.session) return mostrarLogin("Conta criada. Confirme o e-mail que enviamos e abra este mesmo link de novo para entrar.");
  } else {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return mostrarLogin("Não foi possível entrar: " + error.message);
  }
  boot();
};

// ---------------------------------------------------------------- estado
let alunos = [], aluno = null, telaAtual = "agenda", cache = {};
const telas = {};
async function carregar() {
  const aid = aluno.id;
  const [{ data: ss }, { data: hs }, { data: pcs }, { data: prog }, { data: tecs }] = await Promise.all([db.sessoes(aid), db.horarios(aid), db.pacotes(aid), db.programa(aid), db.tecnicas(aid)]);
  const sessoes = ss || []; let n = 0; sessoes.forEach((s) => { if (s.status === "realizada") s.numero = ++n; });
  cache = { sessoes, hs: hs || [], pcs: pcs || [], prog: prog || [], tecs: tecs || [] };
}
async function render(nome = telaAtual) {
  telaAtual = nome; $$(".tabs button").forEach((b) => b.classList.toggle("ativo", b.dataset.tela === nome));
  const main = $("#conteudo"); main.innerHTML = ""; $("#topo-acao").innerHTML = ""; window.scrollTo(0, 0);
  await carregar(); await telas[nome](main);
  if (alunos.length > 1) { $("#topo-acao").innerHTML = `<select class="badge cinza" id="troca">${alunos.map((a) => `<option value="${a.id}" ${a.id === aluno.id ? "selected" : ""}>${esc(primeiroNome(a.nome))}</option>`).join("")}</select>`; $("#troca").onchange = (e) => { aluno = alunos.find((a) => a.id === e.target.value); render(); }; }
}
const quem = () => (alunos.length > 1 || aluno.perfil_id !== usuarioId ? primeiroNome(aluno.nome) : "Você");
let usuarioId = null;

// ---------------------------------------------------------------- 4. AGENDA
telas.agenda = async (root) => {
  const { sessoes, hs, pcs } = cache, agora = new Date();
  const futuras = sessoes.filter((s) => s.status === "agendada" && new Date(s.fim) >= agora);
  const prox = futuras[0], outras = futuras.slice(1, 8);
  const pacote = pcs.find((p) => !p.vencido && p.sessoes_restantes > 0) || pcs[0];
  const feitas = sessoes.filter((s) => s.status === "realizada").length;
  topo(`${aluno.modalidades || ""} · ${feitas} ${feitas === 1 ? "sessão feita" : "sessões feitas"}`, "Agenda");
  const prof = await db.professor();
  const wa = prof.telefone ? `https://wa.me/55${prof.telefone.replace(/\D/g, "")}` : null;
  root.innerHTML = `
    ${prox ? `<div class="destaque"><div class="cab"><div class="h">${fmtHora(prox.inicio)}</div><div class="n"><b>${fmtCurta(prox.inicio)}</b><span>${up(prox.modalidades?.nome || "")}${prox.locais?.apelido ? " · " + up(prox.locais.apelido) : ""}${prox.locais?.bairro ? " · " + up(prox.locais.bairro) : ""}</span></div></div>
      <div class="pad"><div class="eyebrow">Próxima sessão</div><div class="plano">${esc(prox.locais?.endereco || "local a combinar")} · ${fmtHora(prox.inicio)}–${fmtHora(prox.fim)}</div>
      ${wa ? `<a class="btn" style="margin-top:12px" target="_blank" rel="noopener" href="${wa}?text=${encodeURIComponent(`Olá! Sobre a sessão de ${fmtData(prox.inicio)} às ${fmtHora(prox.inicio)}:`)}">Falar com o professor</a>` : ""}</div></div>`
      : `<div class="bloco"><div class="pad"><div class="eyebrow">Próxima sessão</div><div class="plano">Nenhuma marcada. ${wa ? "Combine com o professor." : ""}</div>${wa ? `<a class="btn" target="_blank" rel="noopener" href="${wa}">Falar com o professor</a>` : ""}</div></div>`}
    ${outras.length ? `<div class="secao"><div class="eyebrow">Depois</div><div class="lista">${outras.map((s) => `<div class="item" style="cursor:default"><div class="hora">${fmtHora(s.inicio)}</div><div class="t"><b>${fmtCurta(s.inicio)}</b><span>${up(s.modalidades?.nome || "")}${s.locais?.apelido ? " · " + up(s.locais.apelido) : ""}</span></div></div>`).join("")}</div></div>` : ""}
    <div class="grade2">
      <div><div class="eyebrow">Horários fixos</div><div class="small">${hs.length ? hs.map((h) => `${DIAS_LONGO[h.dia_semana]} ${h.hora_inicio.slice(0, 5)}`).join("<br>") : "a combinar"}</div></div>
      <div><div class="eyebrow">Pacote</div><div class="small">${pacote ? `<b style="font-size:18px">${pacote.sessoes_restantes}</b> de ${pacote.sessoes_total} restantes${pacote.vence_em ? `<br>vence ${fmtData(pacote.vence_em)}` : ""}${pacote.pago ? "" : "<br><span class='vermelho'>pagamento pendente</span>"}` : "sem pacote ativo"}</div></div>
    </div>
    <div class="secao"><div class="eyebrow">Combinado</div><p class="small muted" style="margin:6px 0 0">Cancelamento com menos de ${PF_CONFIG.ANTECEDENCIA_CANCELAMENTO_HORAS} h de antecedência e falta sem aviso contam como sessão realizada. Cancelamento pelo professor não conta. Para desmarcar, avise pelo WhatsApp.</p></div>`;
};

// ---------------------------------------------------------------- 5. DIÁRIOS
telas.diarios = async (root) => {
  const { sessoes, prog } = cache;
  const feitas = sessoes.filter((s) => s.status === "realizada").reverse();
  const doBloco = feitas.filter((s) => s.programa_ordem).length;
  topo(prog.length ? `Bloco atual · ${doBloco} de ${prog.length}` : `${feitas.length} sessões`, "Diários");
  root.innerHTML = `${prog.length ? `<div class="linha-entre eyebrow" style="margin-top:12px"><span>Bloco de ${prog.length} sessões</span><span>${Math.round(100 * doBloco / prog.length)}%</span></div><div class="barra"><i style="width:${Math.round(100 * doBloco / prog.length)}%"></i></div>` : ""}
    <div class="lista" style="margin-top:8px">${feitas.length ? feitas.map((s) => `<div class="item" data-id="${s.id}"><div class="hora">${fmtData(s.inicio)}</div><div class="t"><b>${esc(s.resumo ? s.resumo.split(" · ").slice(0, 2).join(" · ") : s.modalidades?.nome || "Sessão")}</b><span>${S(s.numero)}${s.correcoes_tags?.length ? " · " + s.correcoes_tags.length + " corr" : ""}${Object.keys(s.tecnicas_status || {}).length ? " · " + Object.keys(s.tecnicas_status).length + " téc" : ""}${s.tarefa_casa ? " · tarefa" : ""}</span></div><span class="dir">${s.video_ref ? "VÍDEO" : ""}</span></div>`).join("") : '<div class="vazio">Seu primeiro diário aparece depois da primeira sessão.</div>'}</div>`;
  $$(".item[data-id]", root).forEach((el) => (el.onclick = () => abrirDiario(el.dataset.id)));
};

function abrirDiario(id) {
  const { sessoes, prog } = cache; const s = sessoes.find((x) => x.id === id); if (!s) return;
  const prox = sessoes.find((x) => x.status === "agendada" && new Date(x.inicio) > new Date(s.inicio) && new Date(x.fim) > new Date());
  const tec = Object.entries(s.tecnicas_status || {}), corr = s.correcoes_tags || [];
  const marc = [...tec.map(([t, st]) => ({ k: "TÉC", x: `${t} — ${st}` })), ...corr.map((c) => ({ k: "CORR", x: `Correção: ${c}` }))];
  const doBloco = sessoes.filter((x) => x.status === "realizada" && x.programa_ordem).length;
  abrirModal("Diário", `
    <div class="video"><div class="cab eyebrow">${s.video_ref ? `GRAVAÇÃO GUARDADA · ${marc.length} MARCADORES` : "SEM GRAVAÇÃO NESTA SESSÃO"}</div><div class="msg">${s.video_ref ? "vídeo disponível com o professor" : "marcadores com tempo entram quando a gravação começar"}</div><div class="trilha"><i style="width:${s.video_ref ? 45 : 0}%"></i></div>${s.video_ref ? '<div class="mk" style="left:20%"></div><div class="mk" style="left:45%"></div><div class="mk" style="left:68%"></div>' : ""}</div>
    ${s.resumo ? `<div class="secao"><div class="eyebrow">O que treinamos</div><div class="plano">${esc(s.resumo)}</div></div>` : ""}
    ${marc.length ? `<div class="marc">${marc.map((m) => `<div class="${m.k === "CORR" ? "corr" : ""}"><span class="t">—</span><span class="x">${esc(m.x)}</span><span class="k">${m.k}</span></div>`).join("")}</div>` : ""}
    <div class="grade2">
      <div><div class="eyebrow">Tarefa até a próxima</div><div class="small">${esc(s.tarefa_casa || "nenhuma")}</div></div>
      <div><div class="eyebrow">Próxima</div><div class="small">${prox ? `${fmtCurta(prox.inicio)} ${fmtHora(prox.inicio)}${prox.locais?.apelido ? " · " + esc(prox.locais.apelido) : ""}` : "a combinar"}</div></div>
    </div>
    ${prog.length ? `<div class="secao"><div class="linha-entre eyebrow"><span>Bloco de ${prog.length}</span><span>${Math.round(100 * doBloco / prog.length)}%</span></div><div class="barra"><i style="width:${Math.round(100 * doBloco / prog.length)}%"></i></div></div>` : ""}
    ${s.rpe ? `<p class="small muted" style="margin-top:12px">Intensidade que você sentiu: ${s.rpe}/5${s.peso_kg ? ` · peso ${String(s.peso_kg).replace(".", ",")} kg` : ""}</p>` : ""}`,
    `${S(s.numero)} · ${fmtCurta(s.inicio)} · ${fmtHora(s.inicio)}–${fmtHora(s.fim)}`);
}

// ---------------------------------------------------------------- 6. TÉCNICAS
telas.tecnicas = async (root) => {
  const { tecs, prog } = cache;
  const vistas = new Set(tecs.map((t) => t.tecnica));
  const futuras = [...new Set(prog.flatMap((p) => p.tecnicas))].filter((t) => !vistas.has(t));
  const g = (st) => tecs.filter((t) => t.status === st);
  topo(`${g("dominada").length} dominadas · ${g("praticada").length} praticando`, "Técnicas");
  const bloco = (titulo, lista, chip) => lista.length ? `<div class="secao"><div class="eyebrow">${titulo}</div>${lista.map((t) => `<div class="tec"><span>${esc(t.tecnica || t)}</span>${chip ? `<span class="chip ${chip}">${chip}</span>` : '<span class="chip">no programa</span>'}</div>`).join("")}</div>` : "";
  const total = vistas.size + futuras.length;
  root.innerHTML = `${total ? `<div class="linha-entre eyebrow" style="margin-top:12px"><span>Dominadas</span><span>${g("dominada").length}/${total}</span></div><div class="barra"><i style="width:${Math.round(100 * g("dominada").length / total)}%"></i></div>` : ""}
    ${bloco("Dominadas", g("dominada"), "dominada")}${bloco("Praticando", g("praticada"), "praticada")}${bloco("Apresentadas", g("apresentada"), "apresentada")}${bloco("Ainda vamos ver", futuras, null)}
    ${!total ? '<div class="vazio">Suas técnicas aparecem aqui conforme o professor registra as sessões.</div>' : ""}`;
};

// ---------------------------------------------------------------- 7. EU
telas.eu = async (root) => {
  const { data: cons } = await db.consentimentos(aluno.id);
  const prof = await db.professor();
  topo(aluno.modalidades || "", aluno.apelido || primeiroNome(aluno.nome));
  root.innerHTML = `
    <div class="grade2">
      <div><div class="eyebrow">Objetivo</div><div class="small">${esc(aluno.objetivo_frase || lab(aluno.motivo_principal))}</div></div>
      <div><div class="eyebrow">Frequência</div><div class="small">${aluno.frequencia_semana ? aluno.frequencia_semana + "x por semana" : "—"}${aluno.horarios_pref ? "<br>" + esc(aluno.horarios_pref) : ""}</div></div>
      <div><div class="eyebrow">Local de treino</div><div class="small">${esc(aluno.endereco_padrao || "—")}</div></div>
      <div><div class="eyebrow">Contato de emergência</div><div class="small">${esc(aluno.contato_emergencia_nome || "—")}<br>${esc(aluno.contato_emergencia_telefone || "")}</div></div>
    </div>
    <div class="secao"><div class="eyebrow">Combinados aceitos</div>${(cons || []).length ? cons.map((c) => `<div class="tec"><span>${lab(c.tipo)}${c.opcao_imagem ? ` <span class="muted small">(${lab(c.opcao_imagem)})</span>` : ""}</span><span class="chip ${c.aceito ? "realizada" : ""}">${c.aceito ? "aceito" : "não"} · ${fmtData(c.aceito_em)}</span></div>`).join("") : '<div class="vazio">Nenhum registro.</div>'}
      <p class="small muted">Para pedir cópia, correção ou exclusão dos seus dados, fale com o professor.</p></div>
    <div class="secao"><div class="eyebrow">Professor</div><div class="small">${esc(prof.nome || "")}</div>${prof.telefone ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/55${prof.telefone.replace(/\D/g, "")}">WhatsApp do professor</a>` : ""}</div>
    <div class="acoes" style="margin-top:24px"><button class="btn" id="trocar-senha">Trocar senha</button><button class="btn" id="sair">Sair</button></div>
    <p class="small muted" style="text-align:center">Versão ${PF_CONFIG.VERSAO}</p>`;
  $("#trocar-senha", root).onclick = () => { const corpo = abrirModal("Trocar senha", `<form class="form" id="fsenha"><label>Nova senha (mínimo 8 caracteres)<input type="password" name="s1" minlength="8" required></label><label>Repita<input type="password" name="s2" minlength="8" required></label><button class="btn primario" type="submit">Salvar</button></form>`); $("#fsenha", corpo).onsubmit = async (e) => { e.preventDefault(); const f = e.target; if (f.s1.value !== f.s2.value) return toast("As senhas não conferem."); const { error } = await sb.auth.updateUser({ password: f.s1.value }); if (error) return toast("Não foi possível trocar: " + error.message); toast("Senha trocada."); fecharModal(); }; };
  $("#sair", root).onclick = async () => { await sb.auth.signOut(); try { sessionStorage.removeItem("pf_demo_aluno_ok"); } catch {} location.reload(); };
};

// ---------------------------------------------------------------- 7b. PLANO (o que está coberto, quando renova, pagar)
telas.plano = async (root) => {
  const { data: cb } = await db.cobrancas(aluno.id);
  const cobs = cb || [], pcs = cache.pcs, ss = cache.sessoes;
  const abertas = cobs.filter((c) => c.situacao !== "paga"), pacotesAbertos = pcs.filter((p) => !p.pago);
  const pendentes = [...abertas.map((c) => ({ origem: "cobranca", id: c.id, descricao: c.descricao, valor: c.valor_centavos, vence: c.vence_em, vencida: c.situacao === "vencida", avisou: c.aluno_informou_em })), ...pacotesAbertos.map((p) => ({ origem: "pacote", id: p.id, descricao: p.nome, valor: p.preco_centavos, vence: p.comprado_em, vencida: false, avisou: p.aluno_informou_em }))];
  const tipo = aluno.cobranca_tipo || "pacote";
  topo(quem() === "Você" ? "Seu plano com o professor" : `Plano de ${primeiroNome(aluno.nome)}`, "Plano");
  let card = "";
  if (tipo === "mensal") {
    const ult = cobs.find((c) => c.tipo === "mensal");
    const ini = ult ? new Date(ult.competencia + "T12:00:00") : null, fim = ini ? new Date(ini.getFullYear(), ini.getMonth() + (ult.periodo_meses || 1), 0) : null;
    const feitas = fim ? ss.filter((x) => x.status === "realizada" && new Date(x.inicio) >= ini && new Date(x.inicio) <= fim).length : 0;
    const faltas = fim ? ss.filter((x) => (x.status === "falta_sem_aviso") && new Date(x.inicio) >= ini && new Date(x.inicio) <= fim).length : 0;
    const previstas = fim ? ss.filter((x) => x.status === "agendada" && new Date(x.inicio) >= new Date() && new Date(x.inicio) <= fim).length : 0;
    const tot = Math.max(feitas + faltas + previstas, 1);
    card = `<div class="plano-card"><div class="n">${PERIODO_LABEL[aluno.periodo_meses || 1]}${aluno.frequencia_semana ? ` · ${aluno.frequencia_semana}x por semana` : ""}</div>
      <div class="d">${fmtReais(aluno.valor_centavos)} por ${{ 1: "mês", 3: "trimestre", 6: "semestre", 12: "ano" }[aluno.periodo_meses || 1]}${fim ? ` · período até ${fmtData(fim)} · renova dia ${aluno.dia_vencimento || 5}` : " · ainda sem período gerado"}</div>
      ${fim ? `<div class="barra"><i style="width:${(feitas / tot) * 100}%;background:var(--accent)"></i><i style="width:${(faltas / tot) * 100}%;background:#ffc24d"></i></div><div class="legenda"><span><i style="background:var(--accent)"></i>${feitas} feitas</span>${faltas ? `<span><i style="background:#ffc24d"></i>${faltas} falta(s)</span>` : ""}<span><i style="background:var(--line)"></i>${previstas} marcadas até o fim</span></div>` : ""}</div>`;
  } else if (tipo === "pacote") {
    const pacotesAtivos = pcs.filter((p) => p.pago && !p.vencido && p.sessoes_restantes > 0), p = pacotesAtivos[0] || pcs.find((x) => x.pago) || null;
    card = p ? `<div class="plano-card"><div class="n">${esc(p.nome)}</div><div class="d">${fmtReais(p.preco_centavos)} · ${p.sessoes_restantes} de ${p.sessoes_total} aulas restantes${p.vence_em ? ` · válido até ${fmtData(p.vence_em)}` : ""}${p.vencido ? " · VENCIDO" : ""}</div>
      <div class="barra"><i style="width:${(p.sessoes_consumidas / p.sessoes_total) * 100}%;background:var(--accent)"></i></div><div class="legenda"><span><i style="background:var(--accent)"></i>${p.sessoes_consumidas} usadas</span><span><i style="background:var(--line)"></i>${p.sessoes_restantes} cobertas</span></div></div>`
      : `<div class="plano-card"><div class="n">Pacote de aulas</div><div class="d">nenhum pacote ativo — combine com o professor</div></div>`;
  } else {
    const semPagar = abertas.filter((c) => c.tipo === "sessao").length;
    card = `<div class="plano-card"><div class="n">Por aula</div><div class="d">${fmtReais(aluno.valor_centavos)} por aula realizada · ${semPagar ? `<span class="vermelho">${semPagar} aula(s) em aberto</span>` : "nada em aberto"}</div></div>`;
  }
  const item = (x) => `<div class="tec abre-pag" data-o="${x.origem}" data-id="${x.id}"><span>${esc(x.descricao)}<br><span class="muted small">${fmtReais(x.valor)} · ${x.vencida ? "<span class='vermelho'>venceu " + fmtData(x.vence) + "</span>" : "vence " + fmtData(x.vence)}${x.avisou ? " · você avisou que pagou" : ""}</span></span><span class="chip ${x.vencida ? "falta_sem_aviso" : "agendada"}">${x.avisou ? "aguardando" : x.vencida ? "vencido" : "pagar"}</span></div>`;
  root.innerHTML = `${card}
    <div class="secao"><div class="eyebrow">Em aberto</div>${pendentes.map(item).join("") || '<div class="vazio">Nada a pagar. 👊</div>'}</div>
    ${tipo !== "sessao" ? `<button class="btn primario" id="renovar">${tipo === "mensal" ? "Renovar · gerar próximo período" : "Renovar pacote"}</button>` : ""}
    <div class="secao"><div class="eyebrow">Histórico</div>${cobs.filter((c) => c.situacao === "paga").slice(0, 12).map((c) => `<div class="tec"><span>${esc(c.descricao)}<br><span class="muted small">${fmtReais(c.valor_centavos)} · pago em ${fmtData(c.pago_em)}${c.forma_pagamento ? " · " + esc(c.forma_pagamento) : ""}</span></span><span class="chip realizada">pago</span></div>`).join("")}${pcs.filter((p) => p.pago).map((p) => `<div class="tec"><span>${esc(p.nome)}<br><span class="muted small">${fmtReais(p.preco_centavos)} · pago em ${fmtData(p.pago_em || p.comprado_em)}</span></span><span class="chip realizada">pago</span></div>`).join("") || (cobs.some((c) => c.situacao === "paga") ? "" : '<div class="vazio">Nenhum pagamento registrado ainda.</div>')}</div>`;
  $$(".abre-pag", root).forEach((el) => (el.onclick = () => modalPagar(el.dataset.o, el.dataset.id)));
  $("#renovar", root) && ($("#renovar", root).onclick = async (e) => { e.target.disabled = true; const { data, error } = await sb.rpc("renovar_plano", { p_aluno: aluno.id }); if (error) { e.target.disabled = false; return toast(error.message.replace(/^.*?: /, ""), 5000); } if (data.ja_existia) toast("Já existe uma cobrança em aberto; pague esta."); modalPagar(data.origem, data.id); });
};

async function modalPagar(origem, id) {
  const { data: pix } = await sb.rpc("pix_dados", { p_origem: origem, p_id: id });
  if (!pix || pix.erro) return toast(pix?.erro || "Não foi possível montar o Pix.", 5000);
  if (pix.pago) { toast("Esta cobrança já está paga."); return render("plano"); }
  const cod = PF_PIX.codigo(pix);
  const prof = await db.professor();
  const corpo = abrirModal(pix.descricao, `
    <div class="linha-entre"><b class="mono" style="font-size:22px">${fmtReais(pix.valor_centavos)}</b><span class="chip agendada">Pix</span></div>
    <p class="small muted">Abra o app do seu banco, escolha <b>Pix → ler QR Code</b> ou <b>Pix copia e cola</b>. Favorecido: ${esc(pix.nome)}.</p>
    <div class="qr-box">${PF_PIX.svg(cod)}</div>
    <div class="copia mono">${esc(cod)}</div>
    <div class="acoes"><button class="btn primario" id="cp">Copiar código Pix</button></div>
    <div class="acoes"><button class="btn" id="paguei">Já paguei</button>${prof.telefone ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/55${prof.telefone.replace(/\D/g, "")}?text=${encodeURIComponent("Oi! Acabei de pagar " + pix.descricao + " (" + fmtReais(pix.valor_centavos) + ") por Pix.")}">Enviar comprovante</a>` : ""}</div>
    <p class="small muted">"Já paguei" avisa o professor; ele confirma quando o valor aparecer na conta dele.</p>`, "Pagar");
  $("#cp", corpo).onclick = async () => { try { await navigator.clipboard.writeText(cod); toast("Código copiado. Cole no app do banco."); } catch { prompt("Copie o código:", cod); } };
  $("#paguei", corpo).onclick = async (e) => { e.target.disabled = true; const { error } = await sb.rpc("informar_pagamento", { p_origem: origem, p_id: id }); if (error) return toast("Não deu: " + error.message); toast("Professor avisado. Obrigado!"); fecharModal(); render("plano"); };
}

// ---------------------------------------------------------------- 8. boot
$$(".tabs button").forEach((b) => (b.onclick = () => render(b.dataset.tela)));
async function boot() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return mostrarLogin();
  usuarioId = user.id;
  if (codigo && infoCodigo?.valido) {
    const { error } = await sb.rpc("acesso_resgatar", { p_token: codigo });
    if (error) return mostrarLogin("Código não pôde ser vinculado: " + error.message);
    infoCodigo.valido = false; try { history.replaceState(null, "", location.pathname); } catch {} try { sessionStorage.setItem("pf_demo_aluno_ok", "1"); } catch {} toast("Acesso vinculado.");
  }
  const { data: al } = await db.meusAlunos();
  alunos = al || [];
  if (!alunos.length) { await sb.auth.signOut(); return mostrarLogin("Sua conta ainda não está ligada a nenhum aluno. Peça ao professor um código de acesso e abra o link dele."); }
  aluno = alunos.find((a) => a.perfil_id === user.id) || alunos[0];
  $("#tela-login").hidden = true; $("#app").hidden = false; render("agenda");
}
(async () => {
  if (PF_CONFIG.SUPABASE_URL.includes("SEU-PROJETO")) return mostrarLogin("App não configurado (config.js).");
  if (codigo) { const { data } = await sb.rpc("acesso_info", { p_token: codigo }); infoCodigo = data || { valido: false }; modoCriar = !!infoCodigo.valido; }
  boot();
})();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
