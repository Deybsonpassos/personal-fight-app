-- =====================================================================
-- Personal Fight — Sprint 2 (roda DEPOIS de schema.sql; pode rodar mais de uma vez)
--   • campos da entrevista inicial no aluno
--   • currículo de técnicas e catálogo de correções (provisórios, o professor edita no ACERVO)
--   • programa por aluno (bloco de 8 sessões) e status de técnica por aluno
--   • diário da sessão: correções, técnicas, RPE, peso, tarefa, revisado
--   • convites por link para a entrevista (sem login) via função segura
-- =====================================================================

-- ------------------------------------------------------------ 1. aluno: entrevista
alter table alunos
  add column if not exists email              text,
  add column if not exists origem             text,
  add column if not exists experiencia        text,      -- nunca / menos_1 / 1_3 / mais_3
  add column if not exists experiencia_detalhe text,
  add column if not exists outros_esportes    text,
  add column if not exists motivos            text[] not null default '{}',
  add column if not exists horizonte          text,      -- 3m / 6m / 1a / sem_prazo
  add column if not exists prioridades        text[] not null default '{}',
  add column if not exists condicionamento    smallint,  -- 1..5 (autoavaliação)
  add column if not exists movimentos         text[] not null default '{}',
  add column if not exists peso_kg            numeric(5,1),
  add column if not exists altura_cm          smallint,
  add column if not exists espaco             text,      -- amplo / apertado / nao_sei
  add column if not exists piso               text,      -- ceramica / madeira / tatame / grama
  add column if not exists equipamento        text[] not null default '{}',
  add column if not exists horarios_pref      text,
  add column if not exists aceita_tarefas     text,      -- diario / 2_3 / nao
  add column if not exists opcao_imagem       opcao_imagem,
  add column if not exists entrevista_em      timestamptz;

-- ------------------------------------------------------------ 2. currículo e correções
create table if not exists tecnicas (
  id            serial primary key,
  modalidade_id int not null references modalidades(id) on delete cascade,
  area          text not null,   -- base / socos / chutes / joelhos_cotovelos / clinch / defesa_esquiva / condicionamento / sparring
  nome          text not null,
  ordem         int  not null default 0,
  ativa         boolean not null default true,
  unique (modalidade_id, nome)
);

create table if not exists correcoes (
  id     serial primary key,
  nome   text unique not null,
  ordem  int not null default 0,
  ativa  boolean not null default true
);

-- seed PROVISÓRIO (o professor valida/renomeia no app)
with m as (select id, slug from modalidades)
insert into tecnicas (modalidade_id, area, nome, ordem)
select m.id, t.area, t.nome, t.ordem from m join (values
  ('muay_thai','base','Base e guarda',1),('muay_thai','base','Deslocamento (passo e retorno)',2),('muay_thai','base','Pivô e giro de quadril',3),('muay_thai','base','Respiração e ritmo',4),
  ('muay_thai','socos','Jab',1),('muay_thai','socos','Direto',2),('muay_thai','socos','Cruzado',3),('muay_thai','socos','Upper',4),('muay_thai','socos','Jab-direto (1-2)',5),('muay_thai','socos','1-2-3',6),
  ('muay_thai','chutes','Teep frontal',1),('muay_thai','chutes','Chute baixo (low kick)',2),('muay_thai','chutes','Chute médio',3),('muay_thai','chutes','Chute alto',4),('muay_thai','chutes','Defesa de low kick (check)',5),
  ('muay_thai','joelhos_cotovelos','Joelhada reta',1),('muay_thai','joelhos_cotovelos','Joelhada diagonal',2),('muay_thai','joelhos_cotovelos','Cotovelada horizontal',3),('muay_thai','joelhos_cotovelos','Cotovelada ascendente',4),
  ('muay_thai','clinch','Pegada de clinch',1),('muay_thai','clinch','Controle de postura no clinch',2),('muay_thai','clinch','Joelho no clinch',3),('muay_thai','clinch','Saída do clinch',4),
  ('muay_thai','defesa_esquiva','Bloqueio alto',1),('muay_thai','defesa_esquiva','Esquiva lateral',2),('muay_thai','defesa_esquiva','Recuo e contra',3),('muay_thai','defesa_esquiva','Defesa de teep',4),
  ('muay_thai','condicionamento','Corda',1),('muay_thai','condicionamento','Sombra por rounds',2),('muay_thai','condicionamento','Circuito de aparador',3),('muay_thai','condicionamento','Core e mobilidade de quadril',4),
  ('muay_thai','sparring','Troca controlada (só mãos)',1),('muay_thai','sparring','Troca controlada (mãos e pernas)',2),('muay_thai','sparring','Situacional de clinch',3),
  ('kickboxing','base','Base e guarda',1),('kickboxing','base','Deslocamento lateral',2),('kickboxing','base','Pivô',3),('kickboxing','base','Ritmo e distância',4),
  ('kickboxing','socos','Jab',1),('kickboxing','socos','Direto',2),('kickboxing','socos','Cruzado',3),('kickboxing','socos','Upper',4),('kickboxing','socos','1-2',5),('kickboxing','socos','1-2-3-2',6),
  ('kickboxing','chutes','Chute frontal',1),('kickboxing','chutes','Low kick',2),('kickboxing','chutes','Chute médio (roundhouse)',3),('kickboxing','chutes','Chute alto',4),('kickboxing','chutes','Chute lateral',5),('kickboxing','chutes','Defesa de chute (check)',6),
  ('kickboxing','joelhos_cotovelos','Joelhada reta (onde a regra permite)',1),
  ('kickboxing','defesa_esquiva','Bloqueio',1),('kickboxing','defesa_esquiva','Esquiva (slip)',2),('kickboxing','defesa_esquiva','Esquiva por baixo (duck)',3),('kickboxing','defesa_esquiva','Recuo e contra',4),
  ('kickboxing','condicionamento','Corda',1),('kickboxing','condicionamento','Sombra por rounds',2),('kickboxing','condicionamento','Circuito de aparador',3),('kickboxing','condicionamento','Core',4),
  ('kickboxing','sparring','Troca leve (só mãos)',1),('kickboxing','sparring','Troca leve (mãos e pernas)',2)
) as t(slug, area, nome, ordem) on t.slug = m.slug
on conflict (modalidade_id, nome) do nothing;

insert into correcoes (nome, ordem) values
  ('Guarda baixa',1),('Queixo alto',2),('Quadril não entra',3),('Pé de base não gira',4),('Mão não volta',5),
  ('Cotovelo aberto',6),('Prende a respiração',7),('Passo cruzado',8),('Olha pro chão',9),('Tronco na frente do quadril',10)
on conflict (nome) do nothing;

-- ------------------------------------------------------------ 3. programa e técnicas do aluno
do $$ begin
  create type status_tecnica as enum ('apresentada', 'praticada', 'dominada');
exception when duplicate_object then null; end $$;

create table if not exists programa_sessoes (
  id         uuid primary key default gen_random_uuid(),
  aluno_id   uuid not null references alunos(id) on delete cascade,
  ordem      smallint not null,
  fase       text not null,           -- Fundamentos / Construção / Integração
  tecnicas   text[] not null default '{}',
  fisico     text,
  nota       text,
  sessao_id  uuid references sessoes(id) on delete set null,  -- preenchido quando a sessão real acontece
  unique (aluno_id, ordem)
);

create table if not exists alunos_tecnicas (
  aluno_id      uuid not null references alunos(id) on delete cascade,
  tecnica       text not null,        -- nome (o catálogo pode ser renomeado; o histórico do aluno fica com o texto)
  status        status_tecnica not null,
  atualizado_em timestamptz not null default now(),
  primary key (aluno_id, tecnica)
);

-- ------------------------------------------------------------ 4. diário da sessão
alter table sessoes
  add column if not exists programa_ordem  smallint,
  add column if not exists correcoes_tags  text[] not null default '{}',
  add column if not exists tecnicas_status jsonb  not null default '{}'::jsonb,  -- {"Jab":"praticada",...}
  add column if not exists rpe             smallint,
  add column if not exists peso_kg         numeric(5,1),
  add column if not exists revisado        boolean not null default false,
  add column if not exists video_ref       text;     -- caminho no Drive / nome do arquivo bruto (fase de vídeo)

-- observação privada da sessão: tabela separada, só professor (mesmo padrão de restricoes_saude)
create table if not exists sessoes_obs_privadas (
  sessao_id  uuid primary key references sessoes(id) on delete cascade,
  texto      text not null,
  atualizado_em timestamptz not null default now()
);

-- ao registrar a sessão com programa_ordem, vincula ao programa e propaga status das técnicas (só sobe, nunca desce)
create or replace function apos_diario_sessao() returns trigger language plpgsql security definer set search_path = public as $$
declare k text; v text;
begin
  if new.programa_ordem is not null then
    update programa_sessoes set sessao_id = new.id where aluno_id = new.aluno_id and ordem = new.programa_ordem;
  end if;
  for k, v in select * from jsonb_each_text(coalesce(new.tecnicas_status, '{}'::jsonb)) loop
    if v in ('apresentada','praticada','dominada') then
      insert into alunos_tecnicas (aluno_id, tecnica, status) values (new.aluno_id, k, v::status_tecnica)
      on conflict (aluno_id, tecnica) do update
        set status = greatest(alunos_tecnicas.status, excluded.status), atualizado_em = now();
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists trg_sessoes_diario on sessoes;
create trigger trg_sessoes_diario after insert or update of tecnicas_status, programa_ordem on sessoes
  for each row execute function apos_diario_sessao();


-- ------------------------------------------------------------ 5. convites (entrevista por link, sem login)
create table if not exists convites (
  token      text primary key default encode(gen_random_bytes(9), 'hex'),
  tipo       text not null default 'entrevista',
  rotulo     text,                          -- "Gisele (indicação do João)"
  criado_por uuid references perfis(id),
  criado_em  timestamptz not null default now(),
  expira_em  timestamptz not null default now() + interval '14 days',
  usado_em   timestamptz,
  aluno_id   uuid references alunos(id) on delete set null
);

-- o formulário público só descobre se o link vale; não lê nada além disso
create or replace function entrevista_info(p_token text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'valido', (usado_em is null and expira_em > now()),
    'rotulo', rotulo,
    'usado', usado_em is not null,
    'expirado', expira_em <= now())
  from convites where token = p_token and tipo = 'entrevista';
$$;

-- grava a entrevista inteira numa transação: aluno, modalidades, local, saúde (separada), consentimentos
create or replace function entrevista_enviar(p_token text, d jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare c convites; aid uuid; v_slug text; mid int; nasc date; img opcao_imagem;
begin
  select * into c from convites where token = p_token and tipo = 'entrevista' for update;
  if c.token is null then raise exception 'convite inválido'; end if;
  if c.usado_em is not null then raise exception 'convite já utilizado'; end if;
  if c.expira_em <= now() then raise exception 'convite expirado'; end if;

  nasc := (d->>'nascimento')::date;
  if nasc is null or idade(nasc) < 18 then raise exception 'entrevista de adulto: menor de 18 precisa do responsável'; end if;
  img := case d->>'imagem' when 'interno' then 'interno' when 'interno_redes' then 'interno_e_redes' else 'nao' end;

  insert into alunos (nome, apelido, nascimento, telefone, email, origem, experiencia, experiencia_detalhe, outros_esportes,
                      motivos, motivo_principal, objetivo_frase, horizonte, prioridades, condicionamento, movimentos, peso_kg, altura_cm,
                      espaco, piso, equipamento, frequencia_semana, horarios_pref, aceita_dupla, aceita_tarefas,
                      contato_emergencia_nome, contato_emergencia_telefone, opcao_imagem, entrevista_em)
  values (d->>'nome', nullif(d->>'apelido',''), nasc, d->>'telefone', d->>'email', nullif(d->>'origem',''),
          d->>'experiencia', nullif(d->>'experiencia_detalhe',''), nullif(d->>'outros_esportes',''),
          coalesce(array(select jsonb_array_elements_text(d->'motivos')), '{}'), d->>'motivo_principal', nullif(d->>'objetivo_frase',''), d->>'horizonte',
          coalesce(array(select jsonb_array_elements_text(d->'prioridades')), '{}'), nullif(d->>'condicionamento','')::smallint,
          coalesce(array(select jsonb_array_elements_text(d->'movimentos')), '{}'), nullif(d->>'peso','')::numeric, nullif(d->>'altura','')::smallint,
          d->>'espaco', d->>'piso', coalesce(array(select jsonb_array_elements_text(d->'equipamento')), '{}'),
          nullif(d->>'frequencia','')::smallint, d->>'horarios', coalesce((d->>'dupla') = 'sim', false), d->>'tarefas',
          d->>'emerg_nome', d->>'emerg_tel', img, now())
  returning id into aid;

  for v_slug in select jsonb_array_elements_text(d->'modalidades') loop
    select id into mid from modalidades where modalidades.slug = v_slug;
    if mid is not null then insert into alunos_modalidades (aluno_id, modalidade_id) values (aid, mid) on conflict do nothing; end if;
  end loop;

  insert into locais (aluno_id, tipo, apelido, endereco, padrao)
  values (aid, (case d->>'local' when 'condominio' then 'condominio' when 'praca' then 'praca' when 'outro' then 'outro' else 'casa_aluno' end)::tipo_local,
          case d->>'local' when 'condominio' then 'Condomínio' when 'praca' then 'Praça / parque' when 'outro' then 'Outro' else 'Casa' end,
          d->>'endereco', true);

  if nullif(d->>'saude','') is not null then
    insert into restricoes_saude (aluno_id, texto) values (aid, d->>'saude');
  end if;

  -- consentimentos: aceito_por fica nulo (sem login); texto_id aponta para a versão vigente, se já cadastrada
  insert into consentimentos (aluno_id, tipo, texto_id, aceito, opcao_imagem)
  values (aid, 'termos', (select id from textos_consentimento where tipo='termos' and vigente order by criado_em desc limit 1), coalesce((d->>'aceite_politica')::boolean, false), null),
         (aid, 'saude', (select id from textos_consentimento where tipo='saude' and vigente order by criado_em desc limit 1), coalesce((d->>'aceite_dados')::boolean, false), null),
         (aid, 'imagem_gravacao', (select id from textos_consentimento where tipo='imagem_gravacao' and vigente order by criado_em desc limit 1), img <> 'nao', img);

  update convites set usado_em = now(), aluno_id = aid where token = p_token;
  return aid;
end $$;

revoke all on function entrevista_info(text) from public;
revoke all on function entrevista_enviar(text, jsonb) from public;
grant execute on function entrevista_info(text) to anon, authenticated;
grant execute on function entrevista_enviar(text, jsonb) to anon, authenticated;

-- ------------------------------------------------------------ 6. RLS das tabelas novas
alter table tecnicas         enable row level security;
alter table correcoes        enable row level security;
alter table programa_sessoes enable row level security;
alter table alunos_tecnicas  enable row level security;
alter table convites         enable row level security;
alter table sessoes_obs_privadas enable row level security;
drop policy if exists obs_prof on sessoes_obs_privadas;
create policy obs_prof on sessoes_obs_privadas for all using (eh_professor()) with check (eh_professor());

do $$ declare t text; begin
  foreach t in array array['tecnicas','correcoes'] loop
    execute format('drop policy if exists %1$s_read on %1$s; create policy %1$s_read on %1$s for select using (auth.uid() is not null);', t);
    execute format('drop policy if exists %1$s_prof on %1$s; create policy %1$s_prof on %1$s for all using (eh_professor()) with check (eh_professor());', t);
  end loop;
  foreach t in array array['programa_sessoes','alunos_tecnicas'] loop
    execute format('drop policy if exists %1$s_prof on %1$s; create policy %1$s_prof on %1$s for all using (eh_professor()) with check (eh_professor());', t);
    execute format('drop policy if exists %1$s_read on %1$s; create policy %1$s_read on %1$s for select using (acessa_aluno(aluno_id));', t);
  end loop;
end $$;
drop policy if exists convites_prof on convites;
create policy convites_prof on convites for all using (eh_professor()) with check (eh_professor());
-- anon não tem policy nenhuma em convites: só passa pelas funções acima.
