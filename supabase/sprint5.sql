-- =====================================================================
-- Personal Fight — Sprint 5: financeiro
--   • modelo de cobrança por aluno: por sessão, mensal ou pacote
--   • lançamentos (cobrancas) com vencimento e pagamento
--   • cobrança automática por sessão realizada / falta; mensalidades geradas por mês
--   • visão "a receber" (abertas + vencidas) para a aba Hoje
-- (roda DEPOIS de schema.sql, sprint2.sql, sprint3.sql e sprint4.sql; idempotente)
-- =====================================================================

-- ------------------------------------------------------------ 1. modelo de cobrança do aluno
alter table alunos add column if not exists cobranca_tipo  text not null default 'pacote' check (cobranca_tipo in ('sessao', 'mensal', 'pacote'));
alter table alunos add column if not exists valor_centavos int;                                   -- valor da sessão ou da mensalidade
alter table alunos add column if not exists dia_vencimento smallint check (dia_vencimento between 1 and 28);   -- só mensal

-- v_alunos usa a.* → precisa ser recriada para expor as colunas novas
drop view if exists v_alunos;
create view v_alunos as
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
  (select o.texto from alunos_obs_privadas o where o.aluno_id = a.id) as observacoes
from alunos a;
alter view v_alunos set (security_invoker = on);

-- ------------------------------------------------------------ 2. lançamentos
create table if not exists cobrancas (
  id              uuid primary key default gen_random_uuid(),
  aluno_id        uuid not null references alunos(id) on delete cascade,
  tipo            text not null check (tipo in ('sessao', 'mensal', 'outro')),
  descricao       text not null,                      -- "Mensalidade 10/2026", "Aula 04/10 09:00"
  competencia     date,                               -- 1º dia do mês (mensal)
  sessao_id       uuid references sessoes(id) on delete set null,
  valor_centavos  int  not null check (valor_centavos >= 0),
  vence_em        date not null,
  pago_em         date,
  forma_pagamento text,
  observacao      text,
  criado_em       timestamptz not null default now()
);
create unique index if not exists cobrancas_mensal_unq on cobrancas (aluno_id, competencia) where tipo = 'mensal';
create unique index if not exists cobrancas_sessao_unq on cobrancas (sessao_id) where sessao_id is not null;
create index if not exists cobrancas_aluno_idx on cobrancas (aluno_id, vence_em);

alter table cobrancas enable row level security;
drop policy if exists cobrancas_prof on cobrancas;
create policy cobrancas_prof on cobrancas for all using (eh_professor()) with check (eh_professor());
drop policy if exists cobrancas_read on cobrancas;
create policy cobrancas_read on cobrancas for select using (acessa_aluno(aluno_id));

-- ------------------------------------------------------------ 3. cobrança automática por sessão
--   Mesma regra do pacote: realizada e falta sem aviso cobram; cancelada pelo aluno fora do prazo
--   (consome_pacote = true) cobra; o resto não. Só para aluno com cobrança por sessão e sessão fora de pacote.
create or replace function cobranca_por_sessao() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_tipo text; v_valor int; cobra boolean;
begin
  select cobranca_tipo, valor_centavos into v_tipo, v_valor from alunos where id = new.aluno_id;
  cobra := new.status in ('realizada', 'falta_sem_aviso') or (new.status = 'cancelada_aluno' and new.consome_pacote);
  if cobra and v_tipo = 'sessao' and v_valor is not null and new.pacote_id is null then
    insert into cobrancas (aluno_id, tipo, descricao, sessao_id, valor_centavos, vence_em)
    values (new.aluno_id, 'sessao',
            'Aula ' || to_char(new.inicio at time zone 'America/Belem', 'DD/MM HH24:MI') || case when new.status = 'realizada' then '' else ' (' || replace(new.status::text, '_', ' ') || ')' end,
            new.id, v_valor, (new.inicio at time zone 'America/Belem')::date + 7)   -- 7 dias para acertar
    on conflict (sessao_id) where sessao_id is not null do update set valor_centavos = excluded.valor_centavos, descricao = excluded.descricao
      where cobrancas.pago_em is null;
  elsif not cobra then
    delete from cobrancas where sessao_id = new.id and pago_em is null;   -- status voltou atrás: some a cobrança ainda não paga
  end if;
  return new;
end $$;
drop trigger if exists trg_cobranca_por_sessao on sessoes;
create trigger trg_cobranca_por_sessao after insert or update of status, consome_pacote on sessoes
  for each row execute function cobranca_por_sessao();

-- ------------------------------------------------------------ 4. mensalidades do mês (botão na aba Hoje)
create or replace function gerar_mensalidades(p_competencia date default date_trunc('month', current_date)::date) returns int
language plpgsql security definer set search_path = public as $$
declare n int; comp date := date_trunc('month', p_competencia)::date;
begin
  if not eh_professor() then raise exception 'só o professor'; end if;
  insert into cobrancas (aluno_id, tipo, descricao, competencia, valor_centavos, vence_em)
  select a.id, 'mensal', 'Mensalidade ' || to_char(comp, 'MM/YYYY'), comp, a.valor_centavos, comp + (coalesce(a.dia_vencimento, 5) - 1)
  from alunos a
  where a.status = 'ativo' and a.cobranca_tipo = 'mensal' and a.valor_centavos is not null
  on conflict (aluno_id, competencia) where tipo = 'mensal' do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function gerar_mensalidades(date) from public;
grant execute on function gerar_mensalidades(date) to authenticated;

-- ------------------------------------------------------------ 5. visões
create or replace view v_cobrancas as
select c.*, a.nome as aluno_nome,
       case when c.pago_em is not null then 'paga' when c.vence_em < current_date then 'vencida' else 'aberta' end as situacao
from cobrancas c join alunos a on a.id = c.aluno_id;
alter view v_cobrancas set (security_invoker = on);

-- tudo que falta receber: lançamentos abertos + pacotes não pagos
create or replace view v_a_receber as
select 'cobranca' as origem, c.id, c.aluno_id, a.nome as aluno_nome, c.descricao, c.valor_centavos, c.vence_em, c.vence_em < current_date as vencida
  from cobrancas c join alunos a on a.id = c.aluno_id where c.pago_em is null
union all
select 'pacote', p.id, p.aluno_id, a.nome, p.nome, p.preco_centavos, p.comprado_em, p.comprado_em < current_date
  from pacotes p join alunos a on a.id = p.aluno_id where not p.pago;
alter view v_a_receber set (security_invoker = on);

-- ------------------------------------------------------------ 6. limpeza: pacotes duplicados por toque repetido (mantém 1 por aluno/nome/valor/data)
do $$
declare r record;
begin
  for r in
    select aluno_id, nome, sessoes_total, preco_centavos, comprado_em,
           (array_agg(id order by (select count(*) from sessoes s where s.pacote_id = p.id) desc, pago desc, id))[1] as fica,
           array_agg(id) as todos
    from pacotes p
    group by aluno_id, nome, sessoes_total, preco_centavos, comprado_em
    having count(*) > 1
  loop
    update sessoes set pacote_id = r.fica where pacote_id = any(r.todos) and pacote_id <> r.fica;
    delete from pacotes where id = any(r.todos) and id <> r.fica
      and not exists (select 1 from sessoes s where s.pacote_id = pacotes.id and s.consome_pacote);
  end loop;
end $$;
