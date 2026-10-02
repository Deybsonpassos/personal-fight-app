/* =====================================================================
   Personal Fight — app do professor (Sprint 2 · pele B · Corner)
   HTML/CSS/JS puro + supabase-js. Sem framework, de propósito.
   Seções:
     1. util        — DOM, datas, dinheiro, rótulos, toast, modal
     2. db          — todas as chamadas ao Supabase, num lugar só
     3. HOJE        — destaque da próxima sessão, claquete, lista do dia, semana
     4. ALUNOS      — lista, convite por link, ficha (programa/sessões/horários/evolução/perfil)
     5. DIÁRIOS     — sessões a registrar e registradas; formulário do diário
     6. ACERVO      — currículo de técnicas, correções, planos, política, convites
     7. formulários — aluno, local, horário, pacote, plano, sessão avulsa
     8. boot        — login e navegação
   ===================================================================== */

// ---------------------------------------------------------------- 1. util
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const DIAS_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const STATUS_LABEL = { agendada: "Agendada", realizada: "Realizada", falta_sem_aviso: "Falta sem aviso", cancelada_aluno: "Cancelada pelo aluno", cancelada_professor: "Cancelei eu", remarcada: "Remarcada" };
const LOCAL_LABEL = { casa_aluno: "Casa do aluno", condominio: "Condomínio", praca: "Praça / parque", outro: "Outro" };
const AREAS = ["base", "socos", "chutes", "joelhos_cotovelos", "clinch", "defesa_esquiva", "condicionamento", "sparring"];
const AREAS_LABEL = { base: "Base", socos: "Socos", chutes: "Chutes", joelhos_cotovelos: "Joelhos e cotovelos", clinch: "Clinch", defesa_esquiva: "Defesa", condicionamento: "Condicionamento", sparring: "Sparring" };
const L = { muay_thai: "Muay Thai", kickboxing: "Kickboxing", nunca: "nunca treinou", menos_1: "menos de 1 ano", "1_3": "1 a 3 anos", mais_3: "mais de 3 anos", condicionamento: "condicionamento/emagrecimento", defesa: "defesa pessoal", competir: "competir", tecnica: "evoluir na técnica", saude_mental: "saúde mental", hobby: "hobby", outro: "outro", "3m": "3 meses", "6m": "6 meses", "1a": "1 ano", sem_prazo: "sem prazo", base: "base e postura", socos: "socos", chutes: "chutes", joelhos_cotovelos: "joelhos e cotovelos", clinch: "clinch", defesa_esquiva: "defesa/esquiva", sparring: "sparring", agachar: "agachar", girar_tronco: "girar tronco", bracos_acima: "braços acima", pescoco: "pescoço", impacto: "impacto", nenhum: "nenhum", nao: "não", talvez: "talvez", sim: "sim", diario: "todo dia", "2_3": "2–3x/semana", amplo: "área livre", apertado: "apertado", nao_sei: "não sabe", ceramica: "cerâmica", madeira: "madeira", tatame: "tatame", grama: "grama", luvas: "luvas", bandagem: "bandagens", caneleira: "caneleiras", bucal: "protetor bucal", corda: "corda", interno: "uso interno", interno_e_redes: "interno + redes" };
const lab = (x) => Array.isArray(x) ? (x.length ? x.map((k) => L[k] || k).join(", ") : "—") : (L[x] || x || "—");

const fmtHora = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtData = (d) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtCurta = (d) => { const x = new Date(d); return `${DIAS[x.getDay()]} ${String(x.getDate()).padStart(2, "0")}.${String(x.getMonth() + 1).padStart(2, "0")}`; };
const fmtReais = (c) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const isoLocal = (d) => { const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const inicioDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const inicioSemana = (d) => { const x = inicioDia(d); x.setDate(x.getDate() - x.getDay()); return x; };
const primeiroNome = (n) => (n || "").split(" ")[0];
const up = (s) => String(s || "").toUpperCase();

let toastTimer;
function toast(msg, ms = 2600) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms); }
function abrirModal(titulo, html, eyebrow = "") { $("#modal-eyebrow").textContent = eyebrow; $("#modal-titulo").textContent = titulo; $("#modal-corpo").innerHTML = html; $("#modal").hidden = false; $(".modal-caixa").scrollTop = 0; return $("#modal-corpo"); }
function fecharModal() { $("#modal").hidden = true; $("#modal-corpo").innerHTML = ""; }
$("#modal-fechar").onclick = fecharModal;
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") fecharModal(); });
function formDados(form) { const o = {}; new FormData(form).forEach((v, k) => { o[k] = typeof v === "string" ? v.trim() : v; }); $$('input[type=checkbox]', form).forEach((c) => { if (c.value === "on") o[c.name] = c.checked; }); return o; }
async function copiar(texto, msg = "Copiado.") { try { await navigator.clipboard.writeText(texto); toast(msg); } catch { prompt("Copie o texto:", texto); } }
const cfg = { get antecedencia() { return Number(localStorage.getItem("pf_antecedencia") ?? PF_CONFIG.ANTECEDENCIA_CANCELAMENTO_HORAS); }, set antecedencia(v) { localStorage.setItem("pf_antecedencia", v); } };

// ---------------------------------------------------------------- 2. db
const sb = supabase.createClient(PF_CONFIG.SUPABASE_URL, PF_CONFIG.SUPABASE_ANON_KEY);
const SEL_SESSAO = "*, alunos!sessoes_aluno_id_fkey(nome, apelido, telefone, nascimento), modalidades(nome, slug), locais(apelido,bairro,endereco,referencia)";
const db = {
  async perfil() { const { data: { user } } = await sb.auth.getUser(); if (!user) return null; const { data } = await sb.from("perfis").select("*").eq("id", user.id).single(); return data; },
  modalidades: () => sb.from("modalidades").select("*").eq("ativa", true).order("nome"),
  alunos: (busca = "") => { let q = sb.from("v_alunos").select("*").order("nome"); if (busca) q = q.ilike("nome", `%${busca}%`); return q; },
  aluno: (id) => sb.from("v_alunos").select("*").eq("id", id).single(),
  alunoModalidades: (id) => sb.from("alunos_modalidades").select("modalidade_id, modalidades(slug, nome)").eq("aluno_id", id),
  locais: (alunoId) => sb.from("locais").select("*").eq("aluno_id", alunoId).order("padrao", { ascending: false }),
  horarios: (alunoId) => sb.from("horarios_fixos").select("*, locais(apelido,bairro)").eq("aluno_id", alunoId).eq("ativo", true).order("dia_semana"),
  horariosTodos: () => sb.from("horarios_fixos").select("*, alunos(nome), locais(apelido,bairro)").eq("ativo", true),
  pacotes: (alunoId) => sb.from("v_pacotes_saldo").select("*").eq("aluno_id", alunoId).order("comprado_em", { ascending: false }),
  saude: (alunoId) => sb.from("restricoes_saude").select("*").eq("aluno_id", alunoId).eq("ativo", true),
  planos: () => sb.from("planos").select("*").eq("ativo", true).order("sessoes"),
  sessoes: (de, ate) => sb.from("sessoes").select(SEL_SESSAO).gte("inicio", de.toISOString()).lt("inicio", ate.toISOString()).order("inicio"),
  sessao: (id) => sb.from("sessoes").select(SEL_SESSAO).eq("id", id).single(),
  sessoesAluno: (alunoId, n = 40) => sb.from("sessoes").select("*, modalidades(nome)").eq("aluno_id", alunoId).order("inicio", { ascending: false }).limit(n),
  pendencias: () => sb.from("sessoes").select(SEL_SESSAO).eq("status", "agendada").lt("inicio", new Date().toISOString()).order("inicio"),
  registradas: (n = 40) => sb.from("sessoes").select(SEL_SESSAO).neq("status", "agendada").order("inicio", { ascending: false }).limit(n),
  pacoteAtivo: async (alunoId) => { const { data } = await sb.from("v_pacotes_saldo").select("*").eq("aluno_id", alunoId).eq("vencido", false).gt("sessoes_restantes", 0).order("comprado_em").limit(1); return data?.[0] ?? null; },
  tecnicas: () => sb.from("tecnicas").select("*, modalidades(slug, nome)").eq("ativa", true).order("area").order("ordem"),
  correcoes: () => sb.from("correcoes").select("*").eq("ativa", true).order("ordem"),
  programa: (alunoId) => sb.from("programa_sessoes").select("*").eq("aluno_id", alunoId).order("ordem"),
  alunoTecnicas: (alunoId) => sb.from("alunos_tecnicas").select("*").eq("aluno_id", alunoId).order("atualizado_em", { ascending: false }),
  obs: (sessaoId) => sb.from("sessoes_obs_privadas").select("texto").eq("sessao_id", sessaoId).maybeSingle(),
  convites: () => sb.from("convites").select("*").is("usado_em", null).gt("expira_em", new Date().toISOString()).order("criado_em", { ascending: false }),
};
async function ok(promise, msgErro = "Erro ao salvar") { const { data, error } = await promise; if (error) { console.error(error); toast(`${msgErro}: ${error.message}`, 5000); throw error; } return data; }

// ---------------------------------------------------------------- 3. HOJE
const telas = {};
let telaAtual = "hoje", subHoje = "hoje", semanaBase = inicioSemana(new Date());
const TITULOS = { hoje: "Hoje", alunos: "Alunos", diarios: "Diários", acervo: "Acervo" };

async function render(nome = telaAtual) {
  telaAtual = nome;
  $$(".tabs button").forEach((b) => b.classList.toggle("ativo", b.dataset.tela === nome));
  $("#topo-titulo").textContent = TITULOS[nome]; $("#topo-sub").textContent = ""; $("#topo-acao").innerHTML = "";
  const main = $("#conteudo"); main.innerHTML = ""; window.scrollTo(0, 0);
  await telas[nome](main);
}
const topo = (sub, titulo, acaoHtml = "") => { $("#topo-sub").textContent = sub; $("#topo-titulo").textContent = titulo; $("#topo-acao").innerHTML = acaoHtml; };

const claquete = (s) => { const d = new Date(s.inicio); return `Início. Aula individual. ${s.alunos?.nascimento && idadeDe(s.alunos.nascimento) < 18 ? "Aluno(a) menor" : "Aluno(a)"} ${s.alunos?.nome}. ${d.getDate()} ${MESES[d.getMonth()]}. ${fmtHora(s.inicio).replace(":", "h")} às ${fmtHora(s.fim).replace(":", "h")}.`; };
const idadeDe = (nasc) => { const n = new Date(nasc), h = new Date(); let i = h.getFullYear() - n.getFullYear(); if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate())) i--; return i; };
const linhaSessao = (s, i) => `${s.numero ? "S" + String(s.numero).padStart(3, "0") + " · " : ""}${up(s.modalidades?.nome || "")}${s.locais?.apelido ? " · " + up(s.locais.apelido) : ""}${s.locais?.bairro ? " · " + up(s.locais.bairro) : ""}`;

telas.hoje = async (root) => {
  const hoje = inicioDia(new Date());
  const [{ data: ss }, { data: pend }] = await Promise.all([db.sessoes(hoje, addDias(hoje, 1)), db.pendencias()]);
  const sessoes = ss || [], pendentes = (pend || []).filter((p) => inicioDia(new Date(p.inicio)).getTime() !== hoje.getTime());
  topo(`${fmtCurta(hoje)} · ${sessoes.length} ${sessoes.length === 1 ? "sessão" : "sessões"}`, "Hoje", pendentes.length ? `<button class="badge" id="ir-pend">${pendentes.length} pendente${pendentes.length > 1 ? "s" : ""}</button>` : `<span class="badge cinza">em dia</span>`);
  $("#ir-pend") && ($("#ir-pend").onclick = () => render("diarios"));

  root.innerHTML = `<div class="seg"><button data-s="hoje" class="${subHoje === "hoje" ? "on" : ""}">Hoje</button><button data-s="semana" class="${subHoje === "semana" ? "on" : ""}">Semana</button></div><div id="hoje-corpo"></div>`;
  $$(".seg button", root).forEach((b) => (b.onclick = () => { subHoje = b.dataset.s; render("hoje"); }));
  if (subHoje === "semana") return renderSemana($("#hoje-corpo", root));

  const corpo = $("#hoje-corpo", root);
  const prox = sessoes.find((s) => s.status === "agendada") || sessoes[0];
  if (!prox) { corpo.innerHTML = `<div class="bloco"><div class="pad vazio">Nenhuma sessão hoje. Veja a semana ou marque uma avulsa.</div></div><button class="btn" id="avulsa">+ Sessão avulsa</button>`; $("#avulsa", corpo).onclick = () => formSessao(); return; }

  // destaque: dados do aluno da próxima sessão
  const [{ data: hist }, { data: prog }, { data: tecs }] = await Promise.all([db.sessoesAluno(prox.aluno_id, 60), db.programa(prox.aluno_id), db.alunoTecnicas(prox.aluno_id)]);
  const h = hist || [], d30 = addDias(new Date(), -30);
  const rec = h.filter((s) => new Date(s.inicio) >= d30 && new Date(s.inicio) < new Date() && ["realizada", "falta_sem_aviso"].includes(s.status));
  const presenca = `${rec.filter((s) => s.status === "realizada").length}/${rec.length}`;
  const realizadas = h.filter((s) => s.status === "realizada").length;
  prox.numero = realizadas + 1;
  const programa = prog || [], proxProg = programa.find((p) => !p.sessao_id);
  const totalTec = new Set(programa.flatMap((p) => p.tecnicas)).size;
  const dominadas = (tecs || []).filter((t) => t.status === "dominada").length;
  const peso = h.find((s) => s.peso_kg)?.peso_kg;
  const outras = sessoes.filter((s) => s.id !== prox.id);

  corpo.innerHTML = `
    <div class="destaque">
      <div class="cab" id="abrir-prox"><div class="h">${fmtHora(prox.inicio)}</div><div class="n"><b>${esc(prox.alunos?.nome)}</b><span>${esc(linhaSessao(prox))}${prox.status !== "agendada" ? " · " + up(STATUS_LABEL[prox.status]) : ""}</span></div></div>
      <div class="kpi"><div><span>Presença 30d</span><b>${presenca}</b></div><div><span>Técnicas</span><b>${dominadas}<small>/${totalTec || "—"}</small></b></div><div><span>Peso</span><b>${peso ? String(peso).replace(".", ",") : "—"}<small> kg</small></b></div></div>
      <div class="pad">
        ${proxProg ? `<div class="eyebrow">Foco · sessão ${proxProg.ordem} · ${esc(proxProg.fase)}</div><div class="chips">${proxProg.tecnicas.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
          <div class="eyebrow lima" style="margin-top:10px">Plano da sessão · do programa</div><div class="plano">${esc(proxProg.tecnicas.join(" → "))}${proxProg.fisico ? ` → físico: ${esc(proxProg.fisico)}` : ""}</div>`
          : `<div class="eyebrow">Sem programa</div><div class="plano">Este aluno ainda não tem bloco de sessões. Gere na ficha (aba Programa).</div>`}
        <div class="acoes"><button class="btn primario" id="diario-prox">${prox.status === "agendada" ? "Abrir diário" : "Ver diário"}</button><button class="btn" id="ficha-prox">Ficha</button></div>
      </div>
    </div>
    <div class="claquete"><i></i><div>CLAQUETE: "${esc(claquete(prox))}"</div></div>
    <div class="secao lista">
      ${outras.map((s) => `<div class="item" data-id="${s.id}"><div class="hora">${fmtHora(s.inicio)}</div><div class="t"><b>${esc(s.alunos?.nome)}${s.alunos?.nascimento && idadeDe(s.alunos.nascimento) < 18 ? ' <span class="muted small">kids</span>' : ""}</b></div><div class="dir">${esc(up(s.modalidades?.nome || ""))}${s.locais?.apelido ? " · " + esc(up(s.locais.apelido)) : ""}${s.status !== "agendada" ? "<br>" + up(STATUS_LABEL[s.status]) : ""}</div></div>`).join("")}
      ${pendentes.length ? `<div class="item" id="rev-diarios"><div class="hora">—</div><div class="t"><b class="lima">Revisar ${pendentes.length} diário${pendentes.length > 1 ? "s" : ""}</b></div><div class="dir lima">${pendentes.slice(0, 3).map((p) => esc(up(primeiroNome(p.alunos?.nome)))).join(" ")}</div></div>` : ""}
    </div>
    <button class="btn" id="avulsa">+ Sessão avulsa</button>`;
  $("#abrir-prox", corpo).onclick = $("#diario-prox", corpo).onclick = () => abrirDiario(prox.id);
  $("#ficha-prox", corpo).onclick = () => fichaAluno(prox.aluno_id);
  $$(".item[data-id]", corpo).forEach((el) => (el.onclick = () => abrirDiario(el.dataset.id)));
  $("#rev-diarios", corpo) && ($("#rev-diarios", corpo).onclick = () => render("diarios"));
  $("#avulsa", corpo).onclick = () => formSessao();
};

async function renderSemana(root) {
  const fim = addDias(semanaBase, 7);
  const { data: ss } = await db.sessoes(semanaBase, fim);
  const hoje = inicioDia(new Date()).getTime();
  root.innerHTML = `<div class="linha-entre" style="margin-top:12px"><button class="link nav-sem" data-d="-7">‹ semana</button><strong class="mono small">${fmtData(semanaBase)} – ${fmtData(addDias(semanaBase, 6))}</strong><button class="link nav-sem" data-d="7">semana ›</button></div>
    <div class="semana">${Array.from({ length: 7 }, (_, i) => { const d = addDias(semanaBase, i); const doDia = (ss || []).filter((s) => inicioDia(new Date(s.inicio)).getTime() === d.getTime()); return `<div class="dia ${d.getTime() === hoje ? "hoje" : ""}"><div class="dn">${DIAS[i]}<br>${d.getDate()}</div>${doDia.map((s) => `<div class="s ${s.status}" data-id="${s.id}" title="${esc(s.alunos?.nome)}">${fmtHora(s.inicio)}<br>${esc(primeiroNome(s.alunos?.nome).slice(0, 6))}</div>`).join("")}</div>`; }).join("")}</div>
    <div class="acoes"><button class="btn" id="gerar">Gerar semana pelos horários fixos</button><button class="btn primario" id="avulsa">+ Avulsa</button></div>`;
  $$(".nav-sem", root).forEach((b) => (b.onclick = () => { semanaBase = addDias(semanaBase, Number(b.dataset.d)); render("hoje"); }));
  $$(".s", root).forEach((el) => (el.onclick = () => abrirDiario(el.dataset.id)));
  $("#gerar", root).onclick = () => gerarSemana(semanaBase, ss || []);
  $("#avulsa", root).onclick = () => formSessao();
}

async function gerarSemana(base, existentes) {
  const { data: hs } = await db.horariosTodos();
  if (!hs?.length) return toast("Nenhum horário fixo cadastrado. Cadastre na ficha do aluno.");
  const novas = [];
  for (const h of hs) {
    const d = addDias(base, h.dia_semana); const [hh, mm] = h.hora_inicio.split(":").map(Number);
    const ini = new Date(d); ini.setHours(hh, mm, 0, 0);
    if (inicioDia(ini).getTime() < inicioDia(new Date()).getTime()) continue;
    if (existentes.some((s) => s.aluno_id === h.aluno_id && Math.abs(new Date(s.inicio) - ini) < 36e5)) continue;
    const pacote = await db.pacoteAtivo(h.aluno_id);
    novas.push({ aluno_id: h.aluno_id, modalidade_id: h.modalidade_id, local_id: h.local_id, horario_fixo_id: h.id, pacote_id: pacote?.id ?? null, inicio: ini.toISOString(), fim: new Date(ini.getTime() + h.duracao_min * 60000).toISOString(), status: "agendada" });
  }
  if (!novas.length) return toast("Semana já está gerada.");
  await ok(sb.from("sessoes").insert(novas), "Erro ao gerar sessões");
  toast(`${novas.length} sessão(ões) criada(s).`); render("hoje");
}

// ---------------------------------------------------------------- 4. ALUNOS
telas.alunos = async (root) => {
  topo("Cadastro", "Alunos", `<button class="badge" id="novo-convite">+ Convite</button>`);
  $("#novo-convite").onclick = criarConvite;
  root.innerHTML = `<div class="linha-entre" style="margin-top:10px"><input type="search" class="busca" placeholder="Buscar aluno"><button class="btn primario inline" id="novo-aluno">+ Aluno</button></div><div class="lista" id="lista-alunos"></div>
    <p class="muted small" style="margin-top:14px">Aluno adulto novo: mande um <b>convite</b> (link da entrevista). Ele responde no celular e a ficha aparece aqui pronta. Menor de idade: cadastre manualmente por enquanto (entrevista do responsável na próxima sprint).</p>`;
  const lista = $("#lista-alunos", root);
  const carregar = async (busca = "") => {
    const { data: al } = await db.alunos(busca);
    lista.innerHTML = al?.length ? al.map((a) => `<div class="item" data-id="${a.id}"><div class="t"><b>${esc(a.nome)}${a.menor ? ' <span class="muted small">kids</span>' : ""}</b><span>${esc(a.modalidades || "sem modalidade")} · ${esc(a.bairro_padrao || "sem endereço")} · ${a.sessoes_restantes} no pacote${a.entrevista_em ? "" : " · sem entrevista"}</span></div>${a.status !== "ativo" ? `<span class="chip">${a.status}</span>` : ""}${a.sessoes_restantes <= 1 && a.status === "ativo" ? '<span class="chip alerta">renovar</span>' : ""}</div>`).join("") : `<div class="vazio">Nenhum aluno. Mande um convite ou toque em + Aluno.</div>`;
    $$(".item", lista).forEach((el) => (el.onclick = () => fichaAluno(el.dataset.id)));
  };
  let t; $(".busca", root).oninput = (e) => { clearTimeout(t); t = setTimeout(() => carregar(e.target.value), 250); };
  $("#novo-aluno", root).onclick = () => formAluno();
  await carregar();
};

function linkEntrevista(token) { return new URL(`entrevista.html?t=${token}`, location.href).href; }
async function criarConvite() {
  const rotulo = prompt("Para quem é o convite? (ex.: Gisele, indicação do João)"); if (rotulo === null) return;
  const perfil = await db.perfil();
  const c = await ok(sb.from("convites").insert({ rotulo: rotulo || null, criado_por: perfil?.id }).select("token").single(), "Erro ao criar convite");
  const link = linkEntrevista(c.token);
  abrirModal("Convite criado", `<p class="small">Mande este link para ${esc(rotulo || "a pessoa")}. Vale por 14 dias e só pode ser usado uma vez.</p><p class="mono small" style="word-break:break-all;border:1px solid var(--line);padding:10px">${esc(link)}</p>
    <div class="acoes"><button class="btn primario" id="cp">Copiar link</button><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`Olá! Antes da nossa primeira aula, responda esta entrevista rápida (uns 5 min): ${link}`)}">WhatsApp</a></div>`, "Entrevista inicial · adulto");
  $("#cp").onclick = () => copiar(link, "Link copiado.");
}

// código de acesso ao app do aluno (adulto → a própria conta; menor → conta do responsável)
async function gerarAcesso(a) {
  const responsavel = a.menor || confirm("Este código é para um RESPONSÁVEL (pai/mãe)? Cancelar = para o próprio aluno.");
  const parentesco = responsavel ? prompt("Parentesco do responsável (mãe, pai, avó...):") : null; if (responsavel && parentesco === null) return;
  const perfil = await db.perfil();
  const c = await ok(sb.from("convites").insert({ tipo: "acesso", aluno_id: a.id, papel_alvo: responsavel ? "responsavel" : "aluno", parentesco: parentesco || null, rotulo: a.nome, criado_por: perfil?.id }).select("token").single(), "Erro ao criar código");
  const link = new URL(`aluno.html?c=${c.token}`, location.href).href;
  const msg = `Olá! Seu acesso ao app de treino${responsavel ? ` de ${primeiroNome(a.nome)}` : ""}: ${link}\nAbra no celular, crie sua senha e adicione à tela de início.`;
  abrirModal("Código de acesso", `<p class="small">${responsavel ? `Para o responsável (${esc(parentesco || "")}) de <b>${esc(a.nome)}</b>.` : `Para <b>${esc(a.nome)}</b> entrar no app do aluno.`} Uso único, 14 dias. A pessoa cria e-mail e senha na primeira vez.</p><p class="mono small" style="word-break:break-all;border:1px solid var(--line);padding:10px">${esc(link)}</p>
    <div class="acoes"><button class="btn primario" id="cp">Copiar</button><a class="btn" target="_blank" rel="noopener" href="https://wa.me/${a.telefone ? "55" + a.telefone.replace(/\D/g, "") : ""}?text=${encodeURIComponent(msg)}">WhatsApp</a></div>`, "App do aluno");
  $("#cp").onclick = () => copiar(link, "Link copiado.");
}

// ---- Ficha do aluno (tela cheia, com abas)
let abaFicha = "programa";
async function fichaAluno(id, aba = abaFicha) {
  abaFicha = aba;
  const [{ data: a }, { data: locais }, { data: hs }, { data: pcs }, { data: saude }, { data: ss }, { data: prog }, { data: tecs }, { data: am }] = await Promise.all([db.aluno(id), db.locais(id), db.horarios(id), db.pacotes(id), db.saude(id), db.sessoesAluno(id), db.programa(id), db.alunoTecnicas(id), db.alunoModalidades(id)]);
  if (!a) return;
  a.slugs = (am || []).map((x) => x.modalidades?.slug).filter(Boolean);
  const ctx = { a, locais: locais || [], hs: hs || [], pcs: pcs || [], saude: saude || [], ss: ss || [], prog: prog || [], tecs: tecs || [] };
  const feitas = ctx.ss.filter((s) => s.status === "realizada").length;
  topo(`${a.modalidades || "sem modalidade"} · ${lab(a.experiencia)} · ${feitas} realizadas`, a.apelido || primeiroNome(a.nome), `<button class="badge cinza" id="voltar">← alunos</button>`);
  $("#voltar").onclick = () => render("alunos");
  const main = $("#conteudo"); window.scrollTo(0, 0);
  main.innerHTML = `<div class="abas">${["programa", "sessoes", "horarios", "evolucao", "perfil"].map((k) => `<button data-aba="${k}" class="${aba === k ? "on" : ""}">${{ programa: "Programa", sessoes: "Sessões", horarios: "Horários", evolucao: "Evolução", perfil: "Perfil" }[k]}</button>`).join("")}</div><div id="aba"></div>`;
  $$("[data-aba]", main).forEach((b) => (b.onclick = () => fichaAluno(id, b.dataset.aba)));
  ({ programa: abaPrograma, sessoes: abaSessoes, horarios: abaHorarios, evolucao: abaEvolucao, perfil: abaPerfil })[aba](ctx, $("#aba", main));
}

// programa: bloco de 8 sessões gerado a partir do perfil + currículo do ACERVO
async function gerarPrograma(a) {
  const { data: cat } = await db.tecnicas();
  const slug = a.slugs?.[0] || "muay_thai";
  const cur = {}; (cat || []).filter((t) => t.modalidades?.slug === slug).forEach((t) => (cur[t.area] = cur[t.area] || []).push(t.nome));
  if (!Object.keys(cur).length) { toast("Currículo vazio para esta modalidade. Cadastre técnicas no Acervo."); return null; }
  const nunca = a.experiencia === "nunca", pri = a.prioridades || [], cond = Number(a.condicionamento) || 3;
  const pool = (k) => (cur[k] || []).slice();
  const ordem = [...pri.filter((k) => k !== "base" && cur[k]?.length), "defesa_esquiva", "chutes", "socos"].filter((v, i, arr) => arr.indexOf(v) === i && cur[v]?.length);
  const usados = {}; const pega = (k, q) => { usados[k] = usados[k] || 0; const lst = pool(k), out = []; for (let j = 0; j < q && lst.length; j++) { out.push(lst[usados[k] % lst.length]); usados[k]++; } return out; };
  const sessoes = [];
  for (let i = 0; i < 8; i++) {
    const fase = i < 3 ? "Fundamentos" : i < 6 ? "Construção" : "Integração"; const tecs = [];
    if (i === 0) tecs.push(...pool("base").slice(0, 2), pool("socos")[0]);
    else if (i === 1) tecs.push(pool("base")[2] || pool("base")[0], pool("socos")[1], pool("socos")[4] || pool("socos")[0]);
    else { const k = ordem[(i - 2) % ordem.length]; tecs.push(...pega(k, 2)); const k2 = ordem[(i - 1) % ordem.length]; if (k2 !== k) tecs.push(...pega(k2, 1)); }
    if (i >= 6 && cur.sparring?.length && !nunca) tecs.push(cur.sparring[0]);
    const fisico = cond <= 2 ? "8–10 min leve: corda em blocos de 1 min, mobilidade" : cond === 3 ? "10 min: corda 3×2 min, core" : "12–15 min: circuito de aparador, core";
    sessoes.push({ aluno_id: a.id, ordem: i + 1, fase, tecnicas: [...new Set(tecs.filter(Boolean))], fisico, nota: i === 0 ? "Avaliar base e coordenação ao vivo; ajustar o programa depois desta sessão." : null });
  }
  await ok(sb.from("programa_sessoes").delete().eq("aluno_id", a.id));
  await ok(sb.from("programa_sessoes").insert(sessoes), "Erro ao gerar programa");
  return sessoes;
}

function abaPrograma({ a, prog }, root) {
  if (!prog.length) { root.innerHTML = `<div class="bloco"><div class="pad"><div class="eyebrow">Programa</div><p class="small">Nenhum bloco ainda. O gerador usa as respostas da entrevista (experiência, prioridades, condicionamento) e o currículo do Acervo. É um ponto de partida: você edita tudo depois.</p><button class="btn primario" id="gerar">Gerar bloco de 8 sessões</button></div></div>`; $("#gerar", root).onclick = async () => { if (await gerarPrograma(a)) { toast("Programa gerado."); fichaAluno(a.id, "programa"); } }; return; }
  root.innerHTML = `<p class="muted small" style="margin:10px 0 0">Toque no texto para editar. Currículo provisório, para você validar.</p>
    ${prog.map((s) => `<div class="sess"><h4><span>Sessão ${s.ordem} · ${esc(s.fase)}</span>${s.sessao_id ? '<span class="chip realizada">feita</span>' : ""}</h4>
      <div class="small"><span class="eyebrow">Técnicas</span> <span contenteditable="true" data-f="tecnicas" data-id="${s.id}">${esc(s.tecnicas.join(" · "))}</span></div>
      <div class="small"><span class="eyebrow">Físico</span> <span contenteditable="true" data-f="fisico" data-id="${s.id}">${esc(s.fisico || "")}</span></div>
      ${s.nota ? `<div class="small muted">${esc(s.nota)}</div>` : ""}</div>`).join("")}
    <button class="btn" id="regerar">Gerar de novo a partir do perfil</button>`;
  $$("[contenteditable]", root).forEach((el) => (el.onblur = async () => { const upd = el.dataset.f === "tecnicas" ? { tecnicas: el.textContent.split("·").map((x) => x.trim()).filter(Boolean) } : { fisico: el.textContent.trim() }; await ok(sb.from("programa_sessoes").update(upd).eq("id", el.dataset.id)); toast("Programa salvo."); }));
  $("#regerar", root).onclick = async () => { if (!confirm("Substituir o programa atual?")) return; if (await gerarPrograma(a)) fichaAluno(a.id, "programa"); };
}

function abaSessoes({ a, ss }, root) {
  root.innerHTML = `<div class="acoes"><button class="btn primario" id="nova">+ Marcar sessão</button></div>
    <div class="lista" style="margin-top:8px">${ss.length ? ss.map((s) => `<div class="item" data-s="${s.id}"><div class="hora">${fmtData(s.inicio)}</div><div class="t"><b>${fmtHora(s.inicio)} · ${esc(s.modalidades?.nome || "")}</b><span>${esc(s.resumo || (s.programa_ordem ? "sessão " + s.programa_ordem + " do programa" : "sem diário"))}</span></div><span class="chip ${s.status}">${STATUS_LABEL[s.status]}</span></div>`).join("") : '<div class="vazio">Nenhuma sessão ainda.</div>'}</div>`;
  $("#nova", root).onclick = () => formSessao({ aluno_id: a.id });
  $$("[data-s]", root).forEach((el) => (el.onclick = () => abrirDiario(el.dataset.s)));
}

function abaHorarios({ a, hs, locais, pcs }, root) {
  root.innerHTML = `
    <div class="secao"><div class="eyebrow">Horários fixos</div><div class="lista">${hs.map((h) => `<div class="item" data-h="${h.id}"><div class="hora">${h.hora_inicio.slice(0, 5)}</div><div class="t"><b>${DIAS_LONGO[h.dia_semana]}</b><span>${h.duracao_min} min · ${esc(h.locais?.apelido || "local")}${h.locais?.bairro ? " · " + esc(h.locais.bairro) : ""}</span></div><button class="link rm-h">remover</button></div>`).join("") || '<div class="vazio">Nenhum horário fixo.</div>'}</div><button class="btn" id="f-horario">+ Horário fixo</button></div>
    <div class="secao"><div class="eyebrow">Locais</div><div class="lista">${locais.map((l) => `<div class="item"><div class="t"><b>${esc(l.apelido || LOCAL_LABEL[l.tipo])}${l.padrao ? " (padrão)" : ""}</b><span>${esc(l.endereco)}${l.bairro ? " · " + esc(l.bairro) : ""}</span></div></div>`).join("") || '<div class="vazio">Nenhum local.</div>'}</div><button class="btn" id="f-local">+ Local</button></div>
    <div class="secao"><div class="eyebrow">Pacotes</div><div class="lista">${pcs.map((p) => `<div class="item"><div class="t"><b>${esc(p.nome)} — ${p.sessoes_restantes}/${p.sessoes_total}</b><span>${fmtReais(p.preco_centavos)} · ${p.pago ? "pago" : "<span class='vermelho'>NÃO PAGO</span>"}${p.vence_em ? " · vence " + fmtData(p.vence_em) : ""}${p.vencido ? " · VENCIDO" : ""}</span></div>${!p.pago ? `<button class="btn mini pg" data-p="${p.id}">pago</button>` : ""}</div>`).join("") || '<div class="vazio">Nenhum pacote.</div>'}</div><button class="btn" id="f-pacote">+ Pacote</button></div>`;
  $("#f-horario", root).onclick = () => formHorario(a, locais);
  $("#f-local", root).onclick = () => formLocal(a);
  $("#f-pacote", root).onclick = () => formPacote(a);
  $$(".rm-h", root).forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); await ok(sb.from("horarios_fixos").update({ ativo: false }).eq("id", b.closest("[data-h]").dataset.h)); fichaAluno(a.id, "horarios"); }));
  $$(".pg", root).forEach((b) => (b.onclick = async () => { await ok(sb.from("pacotes").update({ pago: true, pago_em: new Date().toISOString().slice(0, 10) }).eq("id", b.dataset.p)); toast("Pagamento registrado."); fichaAluno(a.id, "horarios"); }));
}

function abaEvolucao({ a, ss, prog, tecs }, root) {
  const feitas = ss.filter((s) => s.status === "realizada"), total = prog.length;
  const dom = tecs.filter((t) => t.status === "dominada").length, prat = tecs.filter((t) => t.status === "praticada").length, apr = tecs.filter((t) => t.status === "apresentada").length;
  const cc = {}; feitas.forEach((s) => (s.correcoes_tags || []).forEach((c) => (cc[c] = (cc[c] || 0) + 1)));
  const top = Object.entries(cc).sort((x, y) => y[1] - x[1]).slice(0, 3);
  const ultima = feitas[0];
  const pct = total ? Math.round(100 * feitas.filter((s) => s.programa_ordem).length / total) : 0;
  const texto = [`EVOLUÇÃO — ${a.apelido || a.nome}`, total ? `${feitas.filter((s) => s.programa_ordem).length} de ${total} sessões do bloco` : `${feitas.length} sessões realizadas`, `Técnicas: ${dom} dominadas · ${prat} praticando · ${apr} apresentadas`, top.length ? `Foco de correção: ${top.map(([c]) => c).join(", ")}` : null, ultima?.tarefa_casa ? `Tarefa atual: ${ultima.tarefa_casa}` : null, `Objetivo: ${a.objetivo_frase || lab(a.motivo_principal)}`].filter(Boolean).join("\n");
  root.innerHTML = `<p class="muted small" style="margin:10px 0 0">É isto que o aluno verá no app dele. Nada privado aparece aqui.</p>
    <div class="bloco"><div class="pad">
      <div class="linha-entre eyebrow"><span>Bloco atual</span><span>${pct}%</span></div><div class="barra"><i style="width:${pct}%"></i></div>
      <div class="grade2"><div><div class="eyebrow">Objetivo</div><div class="small">${esc(a.objetivo_frase || lab(a.motivo_principal))}</div></div><div><div class="eyebrow">Tarefa atual</div><div class="small">${esc(ultima?.tarefa_casa || "—")}</div></div></div>
      ${top.length ? `<div class="eyebrow" style="margin-top:12px">Estamos trabalhando</div><div class="chips">${top.map(([c]) => `<span>${esc(c)}</span>`).join("")}</div>` : ""}
    </div></div>
    <div class="secao"><div class="eyebrow">Técnicas</div>${tecs.length ? tecs.map((t) => `<div class="tec"><span>${esc(t.tecnica)}</span><span class="chip ${t.status}">${t.status}</span></div>`).join("") : '<div class="vazio">Aparece depois do primeiro diário com técnicas marcadas.</div>'}</div>
    <div class="secao"><div class="eyebrow">Linha do tempo</div>${feitas.length ? feitas.map((s) => `<div class="tec" style="grid-template-columns:auto 1fr"><span class="mono small muted">${fmtData(s.inicio)}</span><span class="small">${esc(s.resumo || "")}</span></div>`).join("") : '<div class="vazio">Nenhuma sessão ainda.</div>'}</div>
    <button class="btn" id="cop-ev">Copiar evolução para o aluno</button>`;
  $("#cop-ev", root).onclick = () => copiar(texto, "Copiado. Cole no WhatsApp do aluno.");
}

function perfilTexto(a, saude) {
  const m = a.motivos || [], pr = a.prioridades || [], mov = (a.movimentos || []).filter((x) => x !== "nenhum"), eq = a.equipamento || [];
  const cond = Number(a.condicionamento) || 3, exp = a.experiencia;
  const nivel = !exp || exp === "nunca" ? "Iniciante" : exp === "menos_1" ? "Iniciante com base" : exp === "1_3" ? "Intermediário" : "Avançado";
  const bloco = a.motivo_principal === "competir" && exp !== "nunca" ? "competidor: técnica + condicionamento específico, avaliar sparring" : exp === "nunca" && cond <= 2 ? "iniciante leve: base, guarda, socos retos, físico progressivo" : exp === "nunca" ? "iniciante: base, guarda, socos e chutes básicos" : a.motivo_principal === "condicionamento" ? "condicionamento: combinações em aparador, intervalado, mobilidade" : "intermediário: revisar fundamentos na 1ª sessão e ajustar";
  return [
    `Nível de entrada: ${nivel}${a.experiencia_detalhe ? ` (${a.experiencia_detalhe})` : ""}`,
    `Bloco inicial: ${bloco}`,
    `Volume: ${a.frequencia_semana || "?"}x/semana, 60 min · intensidade inicial ${cond <= 2 ? "baixa, progressão lenta" : cond === 3 ? "moderada" : "moderada a alta"}`,
    `Ênfase: ${lab(a.motivo_principal)}${m.length > 1 ? ` (também: ${m.filter((x) => x !== a.motivo_principal).map((k) => L[k] || k).join(", ")})` : ""} · foco técnico: ${lab(pr)}`,
    mov.length || saude.length ? `Cuidados: ${[mov.length ? "adaptar " + lab(mov) : null, saude.length ? "ver restrição informada (só você vê)" : null].filter(Boolean).join(" · ")}` : "Cuidados: nenhum informado",
    `Formato: espaço ${lab(a.espaco)}, piso ${lab(a.piso)}${a.espaco === "apertado" ? " → priorizar aparador parado, pouca movimentação" : ""}${a.piso === "ceramica" ? " → atenção a pivô descalço e impacto" : ""}`,
    `Equipamento a providenciar: ${["luvas", "bandagem", "caneleira", "bucal"].filter((k) => !eq.includes(k)).map((k) => L[k]).join(", ") || "já tem o básico"}`,
    `Entre sessões: ${lab(a.aceita_tarefas)} · dupla: ${a.aceita_dupla ? "sim" : "não"}`,
  ];
}
function emailBoasVindas(a, locais) {
  const nome = a.apelido || primeiroNome(a.nome), end = locais.find((l) => l.padrao)?.endereco || locais[0]?.endereco || "";
  return `Para: ${a.email || ""}\nAssunto: Bem-vindo(a) ao treino, ${nome}!\n\nOlá, ${nome}!\n\nQue bom ter você no time. Recebi sua avaliação inicial e já montei o ponto de partida do seu treino de ${a.modalidades || ""}.\n\nSeu objetivo: ${a.objetivo_frase || lab(a.motivo_principal)}\nFrequência combinada: ${a.frequencia_semana || "?"}x por semana · ${a.horarios_pref || ""}\nLocal: ${end}\n\nAntes da primeira sessão:\n- Separe roupa leve e uma toalha; treinamos ${a.piso === "ceramica" ? "em piso liso, então leve um tapete ou tênis de sola fina" : "descalço ou de tênis leve, como preferir"}.\n- ${["luvas", "bandagem", "caneleira", "bucal"].filter((k) => !(a.equipamento || []).includes(k)).length ? "Não precisa comprar nada ainda: levo o equipamento nas primeiras aulas e te oriento o que vale ter." : "Traga seu equipamento; vamos conferir se está do tamanho certo."}\n- Se algo mudar na sua saúde ou disponibilidade, me avise antes da aula.\n\nCombinados: cancelamento com menos de ${cfg.antecedencia} horas e falta sem aviso contam como sessão. Se eu precisar cancelar, não conta e remarcamos.\n\nQualquer dúvida, é só responder este e-mail ou chamar no WhatsApp.\n\nAté o treino!`;
}
function abaPerfil({ a, saude, locais }, root) {
  root.innerHTML = `
    ${a.entrevista_em ? `<div class="secao"><div class="eyebrow">Perfil de treino (da entrevista de ${fmtData(a.entrevista_em)})</div><ul style="margin:6px 0 0;padding-left:18px;line-height:1.6;font-size:14px">${perfilTexto(a, saude).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : `<div class="secao muted small">Sem entrevista. Perfil montado só com o cadastro manual.</div>`}
    ${saude.length ? `<div class="aviso"><span class="eyebrow vermelho">Restrição de saúde · só você vê · nunca entra em regra automática</span><br>${saude.map((s) => esc(s.texto)).join("; ")}</div>` : ""}
    <div class="grade2">
      <div><div class="eyebrow">Contato</div><div class="small">${esc(a.telefone || "—")}<br>${esc(a.email || "sem e-mail")}</div></div>
      <div><div class="eyebrow">Emergência</div><div class="small">${esc(a.contato_emergencia_nome || "—")}<br>${esc(a.contato_emergencia_telefone || "")}</div></div>
      <div><div class="eyebrow">Corpo</div><div class="small">${a.idade} anos${a.peso_kg ? " · " + a.peso_kg + " kg" : ""}${a.altura_cm ? " · " + a.altura_cm + " cm" : ""}<br>condicionamento ${a.condicionamento || "?"}/5 · ${esc(lab(a.movimentos))}</div></div>
      <div><div class="eyebrow">Motivos</div><div class="small">${esc(lab(a.motivos))}<br>principal: ${esc(lab(a.motivo_principal))} · ${esc(lab(a.horizonte))}</div></div>
      <div><div class="eyebrow">Gravação</div><div class="small">${esc(lab(a.opcao_imagem))}</div></div>
      <div><div class="eyebrow">Origem</div><div class="small">${esc(a.origem || "—")}</div></div>
    </div>
    ${a.observacoes ? `<div class="secao"><div class="eyebrow">Observações privadas</div><div class="small">${esc(a.observacoes)}</div></div>` : ""}
    <div class="acoes"><button class="btn" id="editar">Editar cadastro</button><button class="btn" id="email">E-mail boas-vindas</button></div>
    <div class="acoes"><button class="btn primario" id="acesso">${a.perfil_id ? "Conta do aluno vinculada" : a.menor ? "Código de acesso · responsável" : "Código de acesso · app do aluno"}</button></div>
    ${a.telefone ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/55${a.telefone.replace(/\D/g, "")}">WhatsApp do aluno</a>` : ""}`;
  $("#editar", root).onclick = () => formAluno(a);
  $("#acesso", root).onclick = () => gerarAcesso(a);
  $("#email", root).onclick = () => copiar(emailBoasVindas(a, locais), `Copiado. Envie para ${a.email || "o e-mail do aluno"}.`);
}

// ---------------------------------------------------------------- 5. DIÁRIOS
telas.diarios = async (root) => {
  const [{ data: pend }, { data: reg }] = await Promise.all([db.pendencias(), db.registradas()]);
  const p = pend || [], r = reg || [];
  topo(`${p.length} a registrar · ${r.length} recentes`, "Diários");
  const linha = (s) => `<div class="item" data-id="${s.id}"><div class="hora">${fmtData(s.inicio)}</div><div class="t"><b>${esc(s.alunos?.nome)}</b><span>${fmtHora(s.inicio)} · ${esc(s.modalidades?.nome || "")}${s.programa_ordem ? " · S" + s.programa_ordem : ""}${s.resumo ? " · " + esc(s.resumo) : ""}${s.correcoes_tags?.length ? " · " + s.correcoes_tags.length + " corr" : ""}</span></div><span class="chip ${s.status === "agendada" ? "alerta" : s.status}">${s.status === "agendada" ? "registrar" : STATUS_LABEL[s.status]}</span></div>`;
  root.innerHTML = `
    <div class="secao"><div class="eyebrow ${p.length ? "lima" : ""}">A registrar</div><div class="lista">${p.length ? p.map(linha).join("") : '<div class="vazio">Nada pendente. Todas as sessões passadas têm diário.</div>'}</div></div>
    <div class="secao"><div class="eyebrow">Registrados</div><div class="lista">${r.length ? r.map(linha).join("") : '<div class="vazio">Nenhum diário ainda.</div>'}</div></div>`;
  $$(".item", root).forEach((el) => (el.onclick = () => abrirDiario(el.dataset.id)));
};

// o diário da sessão: status + o que foi trabalhado + correções + técnicas + RPE + peso + tarefa + obs privada
async function abrirDiario(id) {
  const [{ data: s }, { data: cat }] = await Promise.all([db.sessao(id), db.correcoes()]);
  if (!s) return;
  const [{ data: prog }, { data: obs }] = await Promise.all([db.programa(s.aluno_id), db.obs(id)]);
  const programa = prog || [];
  const sel = s.programa_ordem ? programa.find((x) => x.ordem === s.programa_ordem) : programa.find((x) => !x.sessao_id);
  const horasAte = (new Date(s.inicio) - new Date()) / 36e5, dentroPrazo = horasAte >= cfg.antecedencia;
  const corrs = [...new Set([...(cat || []).map((c) => c.nome), ...(s.correcoes_tags || [])])];
  const tecStatus = s.tecnicas_status || {};
  const blocoTec = (tecs) => tecs.map((t) => `<div class="tec"><span>${esc(t)}</span><select name="tec::${esc(t)}"><option value="">—</option>${["apresentada", "praticada", "dominada"].map((o) => `<option ${tecStatus[t] === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>`).join("");
  const corpo = abrirModal(`${esc(s.alunos?.nome)}`, `
    <div class="mono small muted">${esc(up(s.modalidades?.nome || ""))} · ${esc(up(s.locais?.apelido || "local não definido"))}${s.locais?.endereco ? " · " + esc(s.locais.endereco) : ""}${s.locais?.referencia ? " · " + esc(s.locais.referencia) : ""}<br>${s.pacote_id ? "PACOTE" : "AVULSA"} · <span class="chip ${s.status}">${STATUS_LABEL[s.status]}</span></div>
    <div class="claquete"><i></i><div>"${esc(claquete(s))}"</div></div>
    ${s.alunos?.telefone && s.status === "agendada" ? `<a class="btn" href="https://wa.me/55${s.alunos.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Confirmando nossa sessão ${fmtData(s.inicio)} às ${fmtHora(s.inicio)}.`)}" target="_blank" rel="noopener">Confirmar pelo WhatsApp</a>` : ""}
    <form class="form" id="fd">
      ${programa.length ? `<label>Sessão do programa<select name="programa_ordem"><option value="">nenhuma (fora do bloco)</option>${programa.map((x) => `<option value="${x.ordem}" ${sel?.ordem === x.ordem ? "selected" : ""}>Sessão ${x.ordem} · ${esc(x.fase)}${x.sessao_id && x.sessao_id !== s.id ? " (feita)" : ""}</option>`).join("")}</select></label>` : `<p class="muted small">Sem programa: gere um na ficha do aluno para pré-preencher o diário.</p>`}
      <label>O que foi trabalhado</label><textarea name="resumo" id="resumo">${esc(s.resumo ?? (sel ? `${sel.tecnicas.join(" · ")}${sel.fisico ? " · Físico: " + sel.fisico : ""}` : ""))}</textarea>
      <label>Correções que mais repetiu</label><div class="chips">${corrs.map((c) => `<label><input type="checkbox" name="corr" value="${esc(c)}" ${(s.correcoes_tags || []).includes(c) ? "checked" : ""}><span>${esc(c)}</span></label>`).join("")}</div>
      <input name="corr_outra" placeholder="outra correção (entra no Acervo)" style="margin-top:8px">
      <label>Técnicas: como saiu hoje?</label><div id="tecs">${blocoTec([...new Set([...(sel?.tecnicas || []), ...Object.keys(tecStatus)])])}</div>
      <input name="tec_extra" placeholder="técnica fora do plano (nome exato do Acervo)" style="margin-top:8px">
      <label>Intensidade percebida pelo aluno</label><div class="escala">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="rpe" value="${n}" ${s.rpe === n ? "checked" : ""}><span>${n}</span></label>`).join("")}</div>
      <div class="duas"><label>Peso hoje (kg)<input type="number" step="0.1" name="peso_kg" value="${s.peso_kg ?? ""}"></label><label>Tarefa até a próxima<input name="tarefa_casa" value="${esc(s.tarefa_casa)}"></label></div>
      <label>Observação privada (só você)<textarea name="obs">${esc(obs?.texto)}</textarea></label>
      <div class="acoes"><button class="btn primario" data-st="realizada" type="button">Realizada</button><button class="btn perigo" data-st="falta_sem_aviso" type="button">Falta</button></div>
      <div class="acoes"><button class="btn" data-st="cancelada_aluno" type="button">Cancelou${dentroPrazo ? "" : " (fora do prazo)"}</button><button class="btn" data-st="cancelada_professor" type="button">Cancelei eu</button></div>
      <p class="small muted">Política: cancelamento com menos de ${cfg.antecedencia} h consome a sessão. ${horasAte > 0 ? `Faltam ${horasAte.toFixed(1)} h.` : "Sessão já passou."} Salvar como Realizada marca o diário como revisado.</p>
      <div class="linha-entre"><button class="link" id="s-salvar" type="button">salvar sem mudar status</button><button class="link" id="s-excluir" type="button" style="color:var(--red)">excluir sessão</button></div>
    </form>`, `${fmtCurta(s.inicio)} · ${fmtHora(s.inicio)}–${fmtHora(s.fim)}`);
  const f = $("#fd", corpo);
  if (f.programa_ordem) f.programa_ordem.onchange = () => { const x = programa.find((p) => String(p.ordem) === f.programa_ordem.value); if (!x) return; $("#resumo", corpo).value = `${x.tecnicas.join(" · ")}${x.fisico ? " · Físico: " + x.fisico : ""}`; $("#tecs", corpo).innerHTML = blocoTec(x.tecnicas); };
  const salvar = async (st) => {
    const fd = new FormData(f); const d = Object.fromEntries(fd.entries());
    const corr = fd.getAll("corr"); if (d.corr_outra) { corr.push(d.corr_outra); await sb.from("correcoes").insert({ nome: d.corr_outra, ordem: 99 }); }
    const tec = {}; fd.forEach((v, k) => { if (k.startsWith("tec::") && v) tec[k.slice(5)] = v; }); if (d.tec_extra) tec[d.tec_extra] = tec[d.tec_extra] || "praticada";
    const upd = { resumo: d.resumo || null, correcoes_tags: corr, tecnicas_status: tec, rpe: d.rpe ? Number(d.rpe) : null, peso_kg: d.peso_kg ? Number(d.peso_kg) : null, tarefa_casa: d.tarefa_casa || null, programa_ordem: d.programa_ordem ? Number(d.programa_ordem) : null };
    if (st) { upd.status = st; if (st === "cancelada_aluno") upd.consome_pacote = !dentroPrazo; if (st === "realizada") upd.revisado = true; }
    await ok(sb.from("sessoes").update(upd).eq("id", id));
    if (d.obs) await ok(sb.from("sessoes_obs_privadas").upsert({ sessao_id: id, texto: d.obs, atualizado_em: new Date().toISOString() })); else if (obs) await sb.from("sessoes_obs_privadas").delete().eq("sessao_id", id);
    toast(st ? `Registrado: ${STATUS_LABEL[st]}.` : "Diário salvo."); fecharModal(); render();
  };
  $$("[data-st]", corpo).forEach((b) => (b.onclick = () => salvar(b.dataset.st)));
  $("#s-salvar", corpo).onclick = () => salvar(null);
  $("#s-excluir", corpo).onclick = async () => { if (!confirm("Excluir esta sessão?")) return; await ok(sb.from("sessoes").delete().eq("id", id)); fecharModal(); render(); };
}

// ---------------------------------------------------------------- 6. ACERVO
let subAcervo = "tecnicas";
telas.acervo = async (root) => {
  topo("Currículo · catálogos · ajustes", "Acervo");
  root.innerHTML = `<div class="seg">${["tecnicas", "correcoes", "planos", "ajustes"].map((k) => `<button data-s="${k}" class="${subAcervo === k ? "on" : ""}">${{ tecnicas: "Técnicas", correcoes: "Correções", planos: "Planos", ajustes: "Ajustes" }[k]}</button>`).join("")}</div><div id="ac"></div>`;
  $$(".seg button", root).forEach((b) => (b.onclick = () => { subAcervo = b.dataset.s; render("acervo"); }));
  const ac = $("#ac", root);
  if (subAcervo === "tecnicas") {
    const [{ data: cat }, { data: mods }] = await Promise.all([db.tecnicas(), db.modalidades()]);
    ac.innerHTML = `<p class="muted small" style="margin:10px 0 0">Currículo provisório. Toque no nome para renomear com o termo que você usa; use "remover" para tirar do gerador. O histórico dos alunos guarda o nome da época.</p>` + (mods || []).map((m) => `<div class="secao"><h2>${esc(m.nome)}</h2>${AREAS.map((ar) => { const ts = (cat || []).filter((t) => t.modalidade_id === m.id && t.area === ar); return `<div class="secao"><div class="linha-entre"><span class="eyebrow">${AREAS_LABEL[ar]}</span><button class="btn mini add" data-m="${m.id}" data-a="${ar}">+ técnica</button></div>${ts.map((t) => `<div class="tec"><span contenteditable="true" data-t="${t.id}">${esc(t.nome)}</span><button class="link rm" data-t="${t.id}">remover</button></div>`).join("") || '<div class="vazio small">—</div>'}</div>`; }).join("")}</div>`).join("");
    $$("[contenteditable]", ac).forEach((el) => (el.onblur = async () => { const nome = el.textContent.trim(); if (!nome) return; await ok(sb.from("tecnicas").update({ nome }).eq("id", el.dataset.t)); toast("Renomeada."); }));
    $$(".rm", ac).forEach((b) => (b.onclick = async () => { await ok(sb.from("tecnicas").update({ ativa: false }).eq("id", b.dataset.t)); render("acervo"); }));
    $$(".add", ac).forEach((b) => (b.onclick = async () => { const nome = prompt(`Nova técnica em ${AREAS_LABEL[b.dataset.a]}:`); if (!nome) return; await ok(sb.from("tecnicas").insert({ modalidade_id: Number(b.dataset.m), area: b.dataset.a, nome: nome.trim(), ordem: 50 })); render("acervo"); }));
  } else if (subAcervo === "correcoes") {
    const { data: cat } = await db.correcoes();
    ac.innerHTML = `<p class="muted small" style="margin:10px 0 0">Aparecem como chips no diário. Toque para renomear.</p><div class="secao">${(cat || []).map((c) => `<div class="tec"><span contenteditable="true" data-c="${c.id}">${esc(c.nome)}</span><button class="link rm" data-c="${c.id}">remover</button></div>`).join("")}</div><button class="btn" id="add">+ Correção</button>`;
    $$("[contenteditable]", ac).forEach((el) => (el.onblur = async () => { const nome = el.textContent.trim(); if (!nome) return; await ok(sb.from("correcoes").update({ nome }).eq("id", el.dataset.c)); toast("Renomeada."); }));
    $$(".rm", ac).forEach((b) => (b.onclick = async () => { await ok(sb.from("correcoes").update({ ativa: false }).eq("id", b.dataset.c)); render("acervo"); }));
    $("#add", ac).onclick = async () => { const nome = prompt("Nova correção:"); if (!nome) return; await ok(sb.from("correcoes").insert({ nome: nome.trim(), ordem: 50 })); render("acervo"); };
  } else if (subAcervo === "planos") {
    const { data: pl } = await db.planos();
    ac.innerHTML = `<div class="secao"><div class="eyebrow">Planos e preços</div><div class="lista">${pl?.length ? pl.map((p) => `<div class="item"><div class="t"><b>${esc(p.nome)}</b><span>${p.sessoes} sessão(ões) · ${fmtReais(p.preco_centavos)}${p.validade_dias ? " · " + p.validade_dias + " dias" : ""}${p.inclui_deslocamento ? "" : " · deslocamento à parte"}</span></div></div>`).join("") : '<div class="vazio">Nenhum plano. Ex.: "Avulsa 1h", "Pacote 8", "Mensal 2x/semana".</div>'}</div><button class="btn" id="novo-plano">+ Plano</button></div>`;
    $("#novo-plano", ac).onclick = formPlano;
  } else {
    const { data: cv } = await db.convites();
    ac.innerHTML = `
      <div class="secao"><div class="eyebrow">Política de cancelamento</div><div class="form"><label>Antecedência mínima (horas) para cancelar sem perder a sessão</label><div class="duas"><input type="number" id="cfg-ant" min="0" max="72" value="${cfg.antecedencia}"><button class="btn" id="salvar-cfg" style="margin:0">Salvar</button></div></div></div>
      <div class="secao"><div class="eyebrow">Convites de entrevista em aberto</div><div class="lista">${cv?.length ? cv.map((c) => `<div class="item" data-tk="${c.token}"><div class="t"><b>${esc(c.rotulo || "sem nome")}</b><span>criado ${fmtData(c.criado_em)} · expira ${fmtData(c.expira_em)}</span></div><button class="btn mini cp" data-tk="${c.token}">copiar link</button></div>`).join("") : '<div class="vazio">Nenhum. Crie em Alunos → + Convite.</div>'}</div></div>
      <div class="secao"><div class="eyebrow">Sobre</div><p class="small muted">Versão ${PF_CONFIG.VERSAO} · Supabase: ${PF_CONFIG.SUPABASE_URL.includes("SEU-PROJETO") ? "não configurado (edite config.js)" : "conectado"}<br>Restrições de saúde e observações privadas nunca saem do papel professor. Consentimentos versionados por tipo.</p><button class="btn" id="sair">Sair</button></div>`;
    $("#salvar-cfg", ac).onclick = () => { cfg.antecedencia = Number($("#cfg-ant", ac).value); toast("Política salva."); };
    $$(".cp", ac).forEach((b) => (b.onclick = () => copiar(linkEntrevista(b.dataset.tk), "Link copiado.")));
    $("#sair", ac).onclick = async () => { await sb.auth.signOut(); location.reload(); };
  }
};

// ---------------------------------------------------------------- 7. formulários
async function formAluno(a = null) {
  const { data: mods } = await db.modalidades();
  const { data: am } = a ? await db.alunoModalidades(a.id) : { data: [] };
  const marcadas = new Set((am || []).map((x) => x.modalidade_id));
  const corpo = abrirModal(a ? "Editar cadastro" : "Novo aluno", `
    <form class="form" id="fa">
      <label>Nome completo<input name="nome" required value="${esc(a?.nome)}"></label>
      <div class="duas"><label>Como gosta de ser chamado<input name="apelido" value="${esc(a?.apelido)}"></label><label>Nascimento<input type="date" name="nascimento" required value="${a?.nascimento || ""}"></label></div>
      <div class="duas"><label>WhatsApp<input name="telefone" inputmode="tel" value="${esc(a?.telefone)}"></label><label>E-mail<input type="email" name="email" value="${esc(a?.email)}"></label></div>
      <fieldset><legend>Modalidades</legend>${(mods || []).map((m) => `<label class="check"><input type="checkbox" name="mod_${m.id}" ${marcadas.has(m.id) ? "checked" : ""}> ${esc(m.nome)}</label>`).join("")}</fieldset>
      <label>Motivo principal<select name="motivo_principal">${["", "condicionamento", "defesa", "competir", "tecnica", "saude_mental", "hobby", "outro"].map((o) => `<option value="${o}" ${a?.motivo_principal === o ? "selected" : ""}>${o ? L[o] : ""}</option>`).join("")}</select></label>
      <label>Objetivo em uma frase<input name="objetivo_frase" value="${esc(a?.objetivo_frase)}" placeholder="ex.: perder 8 kg até dezembro"></label>
      <div class="duas"><label>Experiência<select name="experiencia">${["", "nunca", "menos_1", "1_3", "mais_3"].map((o) => `<option value="${o}" ${a?.experiencia === o ? "selected" : ""}>${o ? L[o] : ""}</option>`).join("")}</select></label><label>Condicionamento (1–5)<input type="number" name="condicionamento" min="1" max="5" value="${a?.condicionamento || ""}"></label></div>
      <div class="duas"><label>Sessões por semana<input type="number" name="frequencia_semana" min="1" max="7" value="${a?.frequencia_semana || ""}"></label><label>Status<select name="status">${["ativo", "pausado", "inativo"].map((o) => `<option ${(a?.status || "ativo") === o ? "selected" : ""}>${o}</option>`).join("")}</select></label></div>
      <label class="check"><input type="checkbox" name="aceita_dupla" ${a?.aceita_dupla ? "checked" : ""}> Aceita sessão em dupla</label>
      <fieldset><legend>Contato de emergência</legend><label>Nome<input name="contato_emergencia_nome" value="${esc(a?.contato_emergencia_nome)}"></label><div class="duas"><label>Parentesco<input name="contato_emergencia_parentesco" value="${esc(a?.contato_emergencia_parentesco)}"></label><label>Telefone<input name="contato_emergencia_telefone" inputmode="tel" value="${esc(a?.contato_emergencia_telefone)}"></label></div></fieldset>
      <fieldset><legend>Restrição de saúde para a aula (só você vê)</legend><label>Lesão, limitação, alergia grave — só o que muda a conduta<textarea name="saude_texto" placeholder="deixe em branco se não houver"></textarea></label><p class="small muted">Dado sensível, tabela separada. Não entra em regra automática.</p></fieldset>
      <label>Observações do professor (privadas)<textarea name="observacoes">${esc(a?.observacoes)}</textarea></label>
      ${!a ? `<fieldset><legend>Primeiro local de treino</legend><label>Endereço<input name="endereco" placeholder="Rua, número, complemento"></label><div class="duas"><label>Bairro<input name="bairro"></label><label>Tipo<select name="tipo_local">${Object.entries(LOCAL_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label></div></fieldset>` : ""}
      <button class="btn primario" type="submit">Salvar</button>
    </form>`);
  $("#fa", corpo).onsubmit = async (e) => {
    e.preventDefault(); const d = formDados(e.target);
    const registro = { nome: d.nome, apelido: d.apelido || null, nascimento: d.nascimento, telefone: d.telefone || null, email: d.email || null, motivo_principal: d.motivo_principal || null, objetivo_frase: d.objetivo_frase || null, experiencia: d.experiencia || null, condicionamento: d.condicionamento ? Number(d.condicionamento) : null, frequencia_semana: d.frequencia_semana ? Number(d.frequencia_semana) : null, status: d.status, aceita_dupla: !!d.aceita_dupla, contato_emergencia_nome: d.contato_emergencia_nome || null, contato_emergencia_parentesco: d.contato_emergencia_parentesco || null, contato_emergencia_telefone: d.contato_emergencia_telefone || null };
    let id = a?.id;
    if (a) await ok(sb.from("alunos").update(registro).eq("id", id)); else { const novo = await ok(sb.from("alunos").insert(registro).select("id").single()); id = novo.id; }
    const escolhidas = (mods || []).filter((m) => d[`mod_${m.id}`]).map((m) => m.id);
    await ok(sb.from("alunos_modalidades").delete().eq("aluno_id", id).not("modalidade_id", "in", `(${escolhidas.join(",") || 0})`));
    if (escolhidas.length) await ok(sb.from("alunos_modalidades").upsert(escolhidas.map((mid) => ({ aluno_id: id, modalidade_id: mid })), { onConflict: "aluno_id,modalidade_id" }));
    if (d.saude_texto) await ok(sb.from("restricoes_saude").insert({ aluno_id: id, texto: d.saude_texto }));
    if (d.observacoes) await ok(sb.from("alunos_obs_privadas").upsert({ aluno_id: id, texto: d.observacoes, atualizado_em: new Date().toISOString() })); else if (a?.observacoes) await sb.from("alunos_obs_privadas").delete().eq("aluno_id", id);
    if (!a && d.endereco) await ok(sb.from("locais").insert({ aluno_id: id, endereco: d.endereco, bairro: d.bairro || null, tipo: d.tipo_local, apelido: LOCAL_LABEL[d.tipo_local], padrao: true }));
    toast("Aluno salvo."); fecharModal(); a ? fichaAluno(id, "perfil") : render("alunos");
  };
}

function formLocal(a) {
  const corpo = abrirModal("Novo local", `
    <form class="form" id="fl">
      <label>Apelido<input name="apelido" placeholder="casa, condomínio da avó..."></label>
      <label>Endereço<input name="endereco" required></label>
      <div class="duas"><label>Bairro<input name="bairro"></label><label>Tipo<select name="tipo">${Object.entries(LOCAL_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label></div>
      <label>Referência (portaria, bloco, como chegar)<input name="referencia"></label>
      <label class="check"><input type="checkbox" name="padrao"> Tornar local padrão</label>
      <button class="btn primario" type="submit">Salvar</button>
    </form>`, a.nome);
  $("#fl", corpo).onsubmit = async (e) => {
    e.preventDefault(); const d = formDados(e.target);
    if (d.padrao) await ok(sb.from("locais").update({ padrao: false }).eq("aluno_id", a.id));
    await ok(sb.from("locais").insert({ aluno_id: a.id, apelido: d.apelido || null, endereco: d.endereco, bairro: d.bairro || null, tipo: d.tipo, referencia: d.referencia || null, padrao: !!d.padrao }));
    toast("Local salvo."); fecharModal(); fichaAluno(a.id, "horarios");
  };
}

async function formHorario(a, locais) {
  const { data: mods } = await db.modalidades();
  const corpo = abrirModal("Horário fixo", `
    <form class="form" id="fh">
      <div class="duas"><label>Dia<select name="dia_semana">${DIAS_LONGO.map((d, i) => `<option value="${i}" ${i === 1 ? "selected" : ""}>${d}</option>`).join("")}</select></label><label>Hora<input type="time" name="hora_inicio" required value="18:00"></label></div>
      <div class="duas"><label>Duração (min)<input type="number" name="duracao_min" value="60" min="30" step="15"></label><label>Modalidade<select name="modalidade_id">${(mods || []).map((m) => `<option value="${m.id}">${esc(m.nome)}</option>`).join("")}</select></label></div>
      <label>Local<select name="local_id">${locais.map((l) => `<option value="${l.id}" ${l.padrao ? "selected" : ""}>${esc(l.apelido || LOCAL_LABEL[l.tipo])} — ${esc(l.bairro || l.endereco)}</option>`).join("") || '<option value="">(cadastre um local primeiro)</option>'}</select></label>
      <button class="btn primario" type="submit">Salvar</button>
    </form>`, a.nome);
  $("#fh", corpo).onsubmit = async (e) => {
    e.preventDefault(); const d = formDados(e.target);
    await ok(sb.from("horarios_fixos").insert({ aluno_id: a.id, dia_semana: Number(d.dia_semana), hora_inicio: d.hora_inicio, duracao_min: Number(d.duracao_min), modalidade_id: Number(d.modalidade_id) || null, local_id: d.local_id || null }));
    toast("Horário salvo. Gere a semana em Hoje → Semana."); fecharModal(); fichaAluno(a.id, "horarios");
  };
}

async function formPacote(a) {
  const { data: planos } = await db.planos();
  const corpo = abrirModal("Novo pacote", `
    <form class="form" id="fp">
      <label>Plano<select name="plano_id"><option value="">personalizado</option>${(planos || []).map((p) => `<option value="${p.id}" data-s="${p.sessoes}" data-v="${p.preco_centavos}" data-d="${p.validade_dias || ""}">${esc(p.nome)} — ${fmtReais(p.preco_centavos)}</option>`).join("")}</select></label>
      <label>Nome<input name="nome" required placeholder="Pacote 8"></label>
      <div class="duas"><label>Sessões<input type="number" name="sessoes_total" min="1" required></label><label>Preço (R$)<input type="number" step="0.01" name="preco" required></label></div>
      <div class="duas"><label>Comprado em<input type="date" name="comprado_em" value="${new Date().toISOString().slice(0, 10)}"></label><label>Vence em<input type="date" name="vence_em"></label></div>
      <div class="duas"><label>Pagamento<select name="forma_pagamento"><option>pix</option><option>dinheiro</option><option>cartão</option><option>link</option><option>a combinar</option></select></label><label class="check" style="margin-top:32px"><input type="checkbox" name="pago"> Já está pago</label></div>
      <button class="btn primario" type="submit">Salvar</button>
    </form>`, a.nome);
  const f = $("#fp", corpo);
  f.plano_id.onchange = () => { const o = f.plano_id.selectedOptions[0]; if (!o.value) return; f.nome.value = o.textContent.split(" — ")[0]; f.sessoes_total.value = o.dataset.s; f.preco.value = (Number(o.dataset.v) / 100).toFixed(2); if (o.dataset.d) f.vence_em.value = addDias(new Date(f.comprado_em.value), Number(o.dataset.d)).toISOString().slice(0, 10); };
  f.onsubmit = async (e) => {
    e.preventDefault(); const d = formDados(f);
    await ok(sb.from("pacotes").insert({ aluno_id: a.id, plano_id: d.plano_id ? Number(d.plano_id) : null, nome: d.nome, sessoes_total: Number(d.sessoes_total), preco_centavos: Math.round(Number(d.preco) * 100), comprado_em: d.comprado_em, vence_em: d.vence_em || null, forma_pagamento: d.forma_pagamento, pago: !!d.pago, pago_em: d.pago ? d.comprado_em : null }));
    toast("Pacote salvo."); fecharModal(); fichaAluno(a.id, "horarios");
  };
}

function formPlano() {
  const corpo = abrirModal("Novo plano", `
    <form class="form" id="fpl">
      <label>Nome<input name="nome" required placeholder="Avulsa 1h / Pacote 8 / Mensal 2x"></label>
      <div class="duas"><label>Sessões<input type="number" name="sessoes" min="1" value="1" required></label><label>Preço (R$)<input type="number" step="0.01" name="preco" required></label></div>
      <label>Validade (dias, opcional)<input type="number" name="validade_dias" placeholder="30"></label>
      <label class="check"><input type="checkbox" name="inclui_deslocamento" checked> Deslocamento incluído no preço</label>
      <button class="btn primario" type="submit">Salvar</button>
    </form>`);
  $("#fpl", corpo).onsubmit = async (e) => {
    e.preventDefault(); const d = formDados(e.target);
    await ok(sb.from("planos").insert({ nome: d.nome, sessoes: Number(d.sessoes), preco_centavos: Math.round(Number(d.preco) * 100), validade_dias: d.validade_dias ? Number(d.validade_dias) : null, inclui_deslocamento: !!d.inclui_deslocamento }));
    toast("Plano salvo."); fecharModal(); render("acervo");
  };
}

async function formSessao(pre = {}) {
  const [{ data: alunos }, { data: mods }] = await Promise.all([db.alunos(), db.modalidades()]);
  const agora = new Date(); agora.setMinutes(0, 0, 0); agora.setHours(agora.getHours() + 1);
  const corpo = abrirModal("Marcar sessão", `
    <form class="form" id="fs">
      <label>Aluno<select name="aluno_id" required>${(alunos || []).filter((x) => x.status === "ativo").map((x) => `<option value="${x.id}" ${pre.aluno_id === x.id ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></label>
      <div class="duas"><label>Início<input type="datetime-local" name="inicio" required value="${isoLocal(agora)}"></label><label>Duração (min)<input type="number" name="duracao" value="60" step="15"></label></div>
      <div class="duas"><label>Modalidade<select name="modalidade_id">${(mods || []).map((m) => `<option value="${m.id}">${esc(m.nome)}</option>`).join("")}</select></label><label>Local<select name="local_id"></select></label></div>
      <label class="check"><input type="checkbox" name="usa_pacote" checked> Descontar do pacote ativo</label>
      <button class="btn primario" type="submit">Marcar</button>
    </form>`);
  const f = $("#fs", corpo);
  const carregarLocais = async () => { const { data: ls } = await db.locais(f.aluno_id.value); f.local_id.innerHTML = (ls || []).map((l) => `<option value="${l.id}" ${l.padrao ? "selected" : ""}>${esc(l.apelido || LOCAL_LABEL[l.tipo])} — ${esc(l.bairro || "")}</option>`).join("") || '<option value="">sem local</option>'; };
  f.aluno_id.onchange = carregarLocais; await carregarLocais();
  f.onsubmit = async (e) => {
    e.preventDefault(); const d = formDados(f);
    const ini = new Date(d.inicio), fim = new Date(ini.getTime() + Number(d.duracao) * 60000);
    const pacote = d.usa_pacote ? await db.pacoteAtivo(d.aluno_id) : null;
    if (d.usa_pacote && !pacote) toast("Aluno sem pacote ativo — sessão marcada como avulsa.", 4000);
    await ok(sb.from("sessoes").insert({ aluno_id: d.aluno_id, modalidade_id: Number(d.modalidade_id) || null, local_id: d.local_id || null, pacote_id: pacote?.id ?? null, inicio: ini.toISOString(), fim: fim.toISOString(), status: "agendada" }));
    toast("Sessão marcada."); fecharModal(); pre.aluno_id ? fichaAluno(pre.aluno_id, "sessoes") : render("hoje");
  };
}

// ---------------------------------------------------------------- 8. boot
$$(".tabs button").forEach((b) => (b.onclick = () => render(b.dataset.tela)));
$("#form-login").onsubmit = async (e) => {
  e.preventDefault(); const d = formDados(e.target); const erro = $("#login-erro"); erro.hidden = true;
  const { error } = await sb.auth.signInWithPassword({ email: d.email, password: d.senha });
  if (error) { erro.textContent = "Não foi possível entrar: " + error.message; erro.hidden = false; return; }
  boot();
};
async function boot() {
  const perfil = await db.perfil();
  if (!perfil) { $("#tela-login").hidden = false; $("#app").hidden = true; return; }
  if (perfil.papel !== "professor") { $("#tela-login").hidden = false; $("#app").hidden = true; $("#login-erro").textContent = "Esta área é só do professor. Seu acesso é de " + perfil.papel + "."; $("#login-erro").hidden = false; await sb.auth.signOut(); return; }
  $("#tela-login").hidden = true; $("#app").hidden = false; render("hoje");
}
if (PF_CONFIG.SUPABASE_URL.includes("SEU-PROJETO")) { $("#tela-login").hidden = false; $("#login-erro").textContent = "Configure SUPABASE_URL e SUPABASE_ANON_KEY em config.js."; $("#login-erro").hidden = false; } else boot();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
