-- =====================================================================
--  Personal Fight App — esquema do banco (Sprint 1)
--  Supabase / PostgreSQL. Cole inteiro no SQL Editor do Supabase e execute.
--  Idempotente: pode rodar mais de uma vez.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type papel as enum ('professor', 'aluno', 'responsavel');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_aluno as enum ('ativo', 'pausado', 'inativo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_local as enum ('casa_aluno', 'condominio', 'praca', 'outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_sessao as enum ('agendada', 'realizada', 'falta_sem_aviso', 'cancelada_aluno', 'cancelada_professor', 'remarcada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_consentimento as enum ('termos', 'saude', 'imagem_gravacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type opcao_imagem as enum ('nao', 'interno', 'interno_e_redes');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Perfis de usuário (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table if not exists perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  papel       papel not null default 'aluno',
  nome        text not null,
  telefone    text,
  criado_em   timestamptz not null default now()
);

-- cria o perfil automaticamente quando um usuário se cadastra
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome, telefone, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'telefone',
    coalesce((new.raw_user_meta_data->>'papel')::papel, 'aluno')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- helper: o usuário logado é professor?
create or replace function eh_professor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'professor');
$$;

-- ---------------------------------------------------------------------
-- 3. Modalidades (muay thai, kickboxing, ...)
-- ---------------------------------------------------------------------
create table if not exists modalidades (
  id          serial primary key,
  slug        text unique not null,
  nome        text not null,
  ativa       boolean not null default true
);

insert into modalidades (slug, nome) values
  ('muay_thai', 'Muay Thai'),
  ('kickboxing', 'Kickboxing')
on conflict (slug) do nothing;

-- graduações por modalidade (preencher após a entrevista com o professor)
create table if not exists graduacoes (
  id            serial primary key,
  modalidade_id int not null references modalidades(id) on delete cascade,
  ordem         int not null,
  nome          text not null,
  cor           text,
  unique (modalidade_id, ordem)
);

-- ---------------------------------------------------------------------
-- 4. Alunos e responsáveis
-- ---------------------------------------------------------------------
create table if not exists alunos (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  apelido          text,
  nascimento       date not null,
  telefone         text,
  foto_url         text,
  status           status_aluno not null default 'ativo',
  motivo_principal text,                -- competir / defesa / condicionamento / ...
  objetivo_frase   text,
  frequencia_semana smallint,
  contato_emergencia_nome     text,
  contato_emergencia_parentesco text,
  contato_emergencia_telefone text,
  aceita_dupla     boolean not null default false,
  observacoes      text,                -- visível só ao professor
  perfil_id        uuid references perfis(id) on delete set null,  -- conta do próprio aluno (adulto), se houver
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create or replace function set_atualizado_em() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;
drop trigger if exists trg_alunos_atualizado on alunos;
create trigger trg_alunos_atualizado before update on alunos for each row execute function set_atualizado_em();

-- idade e menoridade calculadas
create or replace function idade(nasc date) returns int language sql immutable as $$
  select extract(year from age(current_date, nasc))::int;
$$;

-- vínculo responsável ↔ aluno (um menor pode ter pai e mãe)
create table if not exists responsaveis_alunos (
  perfil_id   uuid not null references perfis(id) on delete cascade,
  aluno_id    uuid not null references alunos(id) on delete cascade,
  parentesco  text,
  primary key (perfil_id, aluno_id)
);

-- quem pode buscar o aluno (menores)
create table if not exists autorizados_buscar (
  id        uuid primary key default gen_random_uuid(),
  aluno_id  uuid not null references alunos(id) on delete cascade,
  nome      text not null,
  telefone  text
);

-- modalidades que o aluno pratica + graduação atual
create table if not exists alunos_modalidades (
  aluno_id       uuid not null references alunos(id) on delete cascade,
  modalidade_id  int  not null references modalidades(id),
  graduacao_id   int  references graduacoes(id),
  desde          date default current_date,
  primary key (aluno_id, modalidade_id)
);

-- ---------------------------------------------------------------------
-- 5. Locais de treino (personal itinerante)
-- ---------------------------------------------------------------------
create table if not exists locais (
  id           uuid primary key default gen_random_uuid(),
  aluno_id     uuid not null references alunos(id) on delete cascade,
  tipo         tipo_local not null default 'casa_aluno',
  apelido      text,                     -- "casa", "condomínio da avó"
  endereco     text not null,
  bairro       text,
  cidade       text default 'Belém',
  referencia   text,
  latitude     double precision,
  longitude    double precision,
  padrao       boolean not null default true
);

-- ---------------------------------------------------------------------
-- 6. Planos e pacotes
-- ---------------------------------------------------------------------
-- catálogo de preços do professor
create table if not exists planos (
  id              serial primary key,
  nome            text not null,               -- "Avulsa 1h", "Pacote 8", "Mensal 2x"
  sessoes         int  not null,               -- 1 = avulsa
  validade_dias   int,                         -- null = sem validade
  preco_centavos  int  not null,
  inclui_deslocamento boolean not null default true,
  ativo           boolean not null default true
);

-- compra de pacote por aluno (o saldo é calculado pelas sessões consumidas)
create table if not exists pacotes (
  id              uuid primary key default gen_random_uuid(),
  aluno_id        uuid not null references alunos(id) on delete cascade,
  plano_id        int  references planos(id),
  nome            text not null,
  sessoes_total   int  not null,
  preco_centavos  int  not null,
  comprado_em     date not null default current_date,
  vence_em        date,
  pago            boolean not null default false,
  pago_em         date,
  forma_pagamento text,                        -- pix / dinheiro / cartao / link
  observacao      text
);

-- ---------------------------------------------------------------------
-- 7. Horário fixo semanal (recorrência) e sessões
-- ---------------------------------------------------------------------
create table if not exists horarios_fixos (
  id             uuid primary key default gen_random_uuid(),
  aluno_id       uuid not null references alunos(id) on delete cascade,
  modalidade_id  int  references modalidades(id),
  local_id       uuid references locais(id) on delete set null,
  dia_semana     smallint not null check (dia_semana between 0 and 6),  -- 0 = domingo
  hora_inicio    time not null,
  duracao_min    int  not null default 60,
  ativo          boolean not null default true
);

create table if not exists sessoes (
  id             uuid primary key default gen_random_uuid(),
  aluno_id       uuid not null references alunos(id) on delete cascade,
  modalidade_id  int  references modalidades(id),
  local_id       uuid references locais(id) on delete set null,
  pacote_id      uuid references pacotes(id) on delete set null,
  horario_fixo_id uuid references horarios_fixos(id) on delete set null,
  inicio         timestamptz not null,
  fim            timestamptz not null,
  status         status_sessao not null default 'agendada',
  consome_pacote boolean not null default true,   -- falta sem aviso consome; cancelamento do professor não
  dupla_com      uuid references alunos(id),       -- sessão em dupla
  resumo         text,                              -- o que foi trabalhado (v1: manual; v2: IA)
  correcoes      text,
  tarefa_casa    text,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_sessoes_inicio on sessoes(inicio);
create index if not exists idx_sessoes_aluno on sessoes(aluno_id, inicio);

-- regra: status define se consome pacote
create or replace function aplica_regra_consumo() returns trigger language plpgsql as $$
begin
  if new.status in ('realizada', 'falta_sem_aviso') then
    new.consome_pacote := true;
  elsif new.status in ('cancelada_professor', 'remarcada', 'agendada') then
    new.consome_pacote := false;
  end if;
  -- cancelamento pelo aluno: mantém o que o professor decidir (regra de antecedência é aplicada no app)
  return new;
end $$;
drop trigger if exists trg_sessoes_consumo on sessoes;
create trigger trg_sessoes_consumo before insert or update on sessoes for each row execute function aplica_regra_consumo();

-- saldo de pacote
create or replace view v_pacotes_saldo as
select
  p.*,
  a.nome as aluno_nome,
  coalesce(c.consumidas, 0) as sessoes_consumidas,
  p.sessoes_total - coalesce(c.consumidas, 0) as sessoes_restantes,
  (p.vence_em is not null and p.vence_em < current_date) as vencido
from pacotes p
join alunos a on a.id = p.aluno_id
left join (
  select pacote_id, count(*) as consumidas
  from sessoes where consome_pacote and pacote_id is not null
  group by pacote_id
) c on c.pacote_id = p.id;

-- ---------------------------------------------------------------------
-- 8. Consentimentos e saúde (separados, versionados)
-- ---------------------------------------------------------------------
create table if not exists textos_consentimento (
  id       serial primary key,
  tipo     tipo_consentimento not null,
  versao   text not null,
  texto    text not null,
  vigente  boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists consentimentos (
  id             uuid primary key default gen_random_uuid(),
  aluno_id       uuid not null references alunos(id) on delete cascade,
  tipo           tipo_consentimento not null,
  texto_id       int references textos_consentimento(id),
  aceito         boolean not null,
  opcao_imagem   opcao_imagem,                 -- só para imagem_gravacao
  aceito_por     uuid references perfis(id),   -- quem clicou (aluno adulto ou responsável)
  aceito_em      timestamptz not null default now(),
  revogado_em    timestamptz
);
create index if not exists idx_consent_aluno on consentimentos(aluno_id, tipo);

-- tabela separada: só professor lê
create table if not exists restricoes_saude (
  id          uuid primary key default gen_random_uuid(),
  aluno_id    uuid not null references alunos(id) on delete cascade,
  texto       text not null,
  informado_em date not null default current_date,
  ativo       boolean not null default true
);

-- ---------------------------------------------------------------------
-- 9. Views de apoio ao app
-- ---------------------------------------------------------------------
create or replace view v_alunos as
select
  a.*,
  idade(a.nascimento) as idade,
  idade(a.nascimento) < 18 as menor,
  (select string_agg(m.nome, ', ' order by m.nome)
     from alunos_modalidades am join modalidades m on m.id = am.modalidade_id
    where am.aluno_id = a.id) as modalidades,
  (select l.endereco from locais l where l.aluno_id = a.id and l.padrao limit 1) as endereco_padrao,
  (select l.bairro from locais l where l.aluno_id = a.id and l.padrao limit 1) as bairro_padrao,
  (select coalesce(sum(sessoes_restantes), 0) from v_pacotes_saldo s
     where s.aluno_id = a.id and not s.vencido) as sessoes_restantes,
  (select max(inicio) from sessoes s where s.aluno_id = a.id and s.status = 'realizada') as ultima_sessao
from alunos a;

-- ---------------------------------------------------------------------
-- 10. Segurança (RLS)
--   Sprint 1: professor vê e edita tudo; aluno/responsável só lê o que é seu.
--   Dados de saúde e observações: só professor.
-- ---------------------------------------------------------------------
alter table perfis               enable row level security;
alter table modalidades          enable row level security;
alter table graduacoes           enable row level security;
alter table alunos               enable row level security;
alter table responsaveis_alunos  enable row level security;
alter table autorizados_buscar   enable row level security;
alter table alunos_modalidades   enable row level security;
alter table locais               enable row level security;
alter table planos               enable row level security;
alter table pacotes              enable row level security;
alter table horarios_fixos       enable row level security;
alter table sessoes              enable row level security;
alter table textos_consentimento enable row level security;
alter table consentimentos       enable row level security;
alter table restricoes_saude     enable row level security;

-- helper: o usuário logado tem vínculo com este aluno?
create or replace function acessa_aluno(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select eh_professor()
      or exists (select 1 from alunos where id = aid and perfil_id = auth.uid())
      or exists (select 1 from responsaveis_alunos where aluno_id = aid and perfil_id = auth.uid());
$$;

-- perfis
drop policy if exists perfis_self on perfis;
create policy perfis_self on perfis for select using (id = auth.uid() or eh_professor());
drop policy if exists perfis_update_self on perfis;
create policy perfis_update_self on perfis for update using (id = auth.uid());

-- catálogos: todos logados leem, professor edita
do $$ declare t text; begin
  foreach t in array array['modalidades','graduacoes','planos','textos_consentimento'] loop
    execute format('drop policy if exists %1$s_read on %1$s; create policy %1$s_read on %1$s for select using (auth.uid() is not null);', t);
    execute format('drop policy if exists %1$s_prof on %1$s; create policy %1$s_prof on %1$s for all using (eh_professor()) with check (eh_professor());', t);
  end loop;
end $$;

-- tabelas ligadas ao aluno: professor tudo; aluno/responsável leitura
do $$ declare t text; begin
  foreach t in array array['alunos_modalidades','locais','pacotes','horarios_fixos','sessoes','autorizados_buscar','consentimentos'] loop
    execute format('drop policy if exists %1$s_prof on %1$s; create policy %1$s_prof on %1$s for all using (eh_professor()) with check (eh_professor());', t);
    execute format('drop policy if exists %1$s_read on %1$s; create policy %1$s_read on %1$s for select using (acessa_aluno(aluno_id));', t);
  end loop;
end $$;

-- alunos: professor tudo; próprio aluno/responsável lê
drop policy if exists alunos_prof on alunos;
create policy alunos_prof on alunos for all using (eh_professor()) with check (eh_professor());
drop policy if exists alunos_read on alunos;
create policy alunos_read on alunos for select using (acessa_aluno(id));

-- vínculo responsável: professor tudo; o próprio responsável lê o seu
drop policy if exists resp_prof on responsaveis_alunos;
create policy resp_prof on responsaveis_alunos for all using (eh_professor()) with check (eh_professor());
drop policy if exists resp_read on responsaveis_alunos;
create policy resp_read on responsaveis_alunos for select using (perfil_id = auth.uid());

-- saúde: SÓ professor (nem o próprio aluno lê via app nesta versão; ele pode pedir cópia)
drop policy if exists saude_prof on restricoes_saude;
create policy saude_prof on restricoes_saude for all using (eh_professor()) with check (eh_professor());

-- consentimentos: aluno adulto / responsável pode INSERIR o próprio aceite
drop policy if exists consent_insert_self on consentimentos;
create policy consent_insert_self on consentimentos for insert with check (acessa_aluno(aluno_id) and aceito_por = auth.uid());

-- views herdam RLS das tabelas (security_invoker)
alter view v_alunos set (security_invoker = on);
alter view v_pacotes_saldo set (security_invoker = on);

-- ---------------------------------------------------------------------
-- 11. Primeiro professor
--   Depois de criar o usuário do professor em Authentication → Users,
--   rode (trocando o e-mail):
--   update perfis set papel = 'professor' where id = (select id from auth.users where email = 'PROFESSOR@EMAIL.COM');
-- ---------------------------------------------------------------------
