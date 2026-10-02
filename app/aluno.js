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
};

// ---------------------------------------------------------------- 3. acesso / login
const codigo = new URLSearchParams(location.search).get("c") || "";
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
    <button class="btn" id="sair" style="margin-top:24px">Sair</button>
    <p class="small muted" style="text-align:center">Versão ${PF_CONFIG.VERSAO}</p>`;
  $("#sair", root).onclick = async () => { await sb.auth.signOut(); location.href = location.pathname; };
};

// ---------------------------------------------------------------- 8. boot
$$(".tabs button").forEach((b) => (b.onclick = () => render(b.dataset.tela)));
async function boot() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return mostrarLogin();
  usuarioId = user.id;
  if (codigo && infoCodigo?.valido) {
    const { error } = await sb.rpc("acesso_resgatar", { p_token: codigo });
    if (error) return mostrarLogin("Código não pôde ser vinculado: " + error.message);
    infoCodigo.valido = false; history.replaceState(null, "", location.pathname); toast("Acesso vinculado.");
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
