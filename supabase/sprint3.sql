-- =====================================================================
-- Personal Fight — Sprint 3: app do aluno (roda DEPOIS de schema.sql e sprint2.sql; idempotente)
--   • correção: observações privadas do professor saem de `alunos` (o aluno conseguia ler a própria linha)
--   • acesso do aluno adulto e do responsável por CÓDIGO (convite tipo 'acesso'), vinculado à conta após login
--   • funções de leitura seguras para o app do aluno
-- =====================================================================

-- ------------------------------------------------------------ 1. observações privadas em tabela própria
create table if not exists alunos_obs_privadas (
  aluno_id      uuid primary key references alunos(id) on delete cascade,
  texto         text not null,
  atualizado_em timestamptz not null default now()
);
alter table alunos_obs_privadas enable row level security;
drop policy if exists alunos_obs_prof on alunos_obs_privadas;
create policy alunos_obs_prof on alunos_obs_privadas for all using (eh_professor()) with check (eh_professor());

-- migra o que já existia e remove a coluna (a view depende dela, então recria a view)
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'alunos' and column_name = 'observacoes') then
    insert into alunos_obs_privadas (aluno_id, texto)
      select id, observacoes from alunos where observacoes is not null and observacoes <> ''
      on conflict (aluno_id) do nothing;
    drop view if exists v_alunos;
    alter table alunos drop column observacoes;
  end if;
end $$;

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
  (select max(inicio) from sessoes s where s.aluno_id = a.id and s.status = 'realizada') as ultima_sessao,
  -- só o professor enxerga (RLS da tabela + view security_invoker → para o aluno vem null)
  (select o.texto from alunos_obs_privadas o where o.aluno_id = a.id) as observacoes
from alunos a;
alter view v_alunos set (security_invoker = on);

-- ------------------------------------------------------------ 2. convites de ACESSO (aluno adulto / responsável)
alter table convites
  add column if not exists papel_alvo papel,        -- 'aluno' ou 'responsavel' (só para tipo 'acesso')
  add column if not exists parentesco text;

-- o app do aluno pergunta ao banco o que é este código, antes de pedir login
create or replace function acesso_info(p_token text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'valido', (c.usado_em is null and c.expira_em > now()),
    'usado', c.usado_em is not null,
    'papel', c.papel_alvo,
    'aluno', split_part(a.nome, ' ', 1),
    'menor', idade(a.nascimento) < 18)
  from convites c join alunos a on a.id = c.aluno_id
  where c.token = p_token and c.tipo = 'acesso';
$$;

-- depois de logado, o usuário resgata o código: vincula a conta ao aluno (ou como responsável)
create or replace function acesso_resgatar(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare c convites; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'faça login primeiro'; end if;
  select * into c from convites where token = p_token and tipo = 'acesso' for update;
  if c.token is null then raise exception 'código inválido'; end if;
  if c.usado_em is not null then raise exception 'código já utilizado'; end if;
  if c.expira_em <= now() then raise exception 'código expirado'; end if;
  if c.papel_alvo = 'responsavel' then
    insert into responsaveis_alunos (perfil_id, aluno_id, parentesco) values (uid, c.aluno_id, c.parentesco) on conflict do nothing;
    update perfis set papel = 'responsavel' where id = uid and papel = 'aluno';
  else
    if exists (select 1 from alunos where id = c.aluno_id and perfil_id is not null and perfil_id <> uid) then raise exception 'este aluno já tem conta vinculada'; end if;
    if idade((select nascimento from alunos where id = c.aluno_id)) < 18 then raise exception 'menor de idade: o acesso é do responsável'; end if;
    update alunos set perfil_id = uid where id = c.aluno_id;
  end if;
  update convites set usado_em = now() where token = p_token;
  return json_build_object('ok', true, 'aluno_id', c.aluno_id, 'papel', c.papel_alvo);
end $$;

revoke all on function acesso_info(text) from public;
revoke all on function acesso_resgatar(text) from public;
grant execute on function acesso_info(text) to anon, authenticated;
grant execute on function acesso_resgatar(text) to authenticated;

-- ------------------------------------------------------------ 3. o que o aluno lê
-- `sessoes` já é legível pelo aluno pela política sessoes_read (nada privado fica nela desde a Sprint 2).
-- `programa_sessoes`, `alunos_tecnicas`, `pacotes`, `horarios_fixos`, `locais`, `consentimentos`: idem.
-- Cancelamento pelo aluno NÃO é feito pelo app nesta sprint (vai por WhatsApp): evita dar UPDATE em `sessoes` ao aluno.

-- perfil do professor visível ao aluno (nome e telefone para contato) — só papel professor, só esses campos
create or replace function professor_contato() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('nome', nome, 'telefone', telefone) from perfis where papel = 'professor' order by criado_em limit 1;
$$;
revoke all on function professor_contato() from public;
grant execute on function professor_contato() to authenticated;
