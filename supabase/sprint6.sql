-- =====================================================================
-- Personal Fight — Sprint 6: Caixa
--   • períodos (mensal, trimestral, semestral, anual) na cobrança recorrente
--   • despesas do professor (saídas) → saldo real do mês
--   • chave Pix do professor (Caminho 1: QR gerado no app, confirmação em um toque)
--   • aluno avisa "já paguei"; aluno renova pacote pelo app
--   • visão de caixa (entradas pagas + saídas) e "a receber" com aviso do aluno
-- (roda DEPOIS de sprint5.sql; idempotente)
-- =====================================================================

-- ------------------------------------------------------------ 1. período da cobrança recorrente
alter table alunos add column if not exists periodo_meses smallint not null default 1 check (periodo_meses in (1, 3, 6, 12));

-- v_alunos (a.*) precisa expor a coluna nova
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

-- cobrança recorrente cobre um período: competencia = 1º mês coberto; periodo_meses copiado na hora de gerar
alter table cobrancas add column if not exists periodo_meses smallint not null default 1;
alter table cobrancas add column if not exists aluno_informou_em timestamptz;   -- aluno tocou "já paguei"
alter table pacotes   add column if not exists aluno_informou_em timestamptz;

-- gerar_mensalidades agora respeita o período: só gera se o último período do aluno não cobre o mês pedido
create or replace function gerar_mensalidades(p_competencia date default date_trunc('month', current_date)::date) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; comp date := date_trunc('month', p_competencia)::date; a record; ult record; ini date; fim date; descr text;
begin
  if not eh_professor() then raise exception 'só o professor'; end if;
  for a in select * from alunos where status = 'ativo' and cobranca_tipo = 'mensal' and valor_centavos is not null loop
    select * into ult from cobrancas c where c.aluno_id = a.id and c.tipo = 'mensal' order by c.competencia desc limit 1;
    if ult.id is not null and (ult.competencia + (ult.periodo_meses * interval '1 month'))::date > comp then continue; end if;   -- ainda coberto
    ini := case when ult.id is null then comp else (ult.competencia + (ult.periodo_meses * interval '1 month'))::date end;
    if ini > comp then continue; end if;
    fim := (ini + (a.periodo_meses * interval '1 month') - interval '1 day')::date;
    descr := case a.periodo_meses when 1 then 'Mensalidade ' || to_char(ini, 'MM/YYYY')
                                  when 3 then 'Trimestre ' || to_char(ini, 'MM/YYYY') || ' a ' || to_char(fim, 'MM/YYYY')
                                  when 6 then 'Semestre ' || to_char(ini, 'MM/YYYY') || ' a ' || to_char(fim, 'MM/YYYY')
                                  else 'Anuidade ' || to_char(ini, 'MM/YYYY') || ' a ' || to_char(fim, 'MM/YYYY') end;
    insert into cobrancas (aluno_id, tipo, descricao, competencia, periodo_meses, valor_centavos, vence_em)
    values (a.id, 'mensal', descr, ini, a.periodo_meses, a.valor_centavos, ini + (coalesce(a.dia_vencimento, 5) - 1))
    on conflict (aluno_id, competencia) where tipo = 'mensal' do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ------------------------------------------------------------ 2. despesas (saídas do professor)
create table if not exists despesas (
  id             uuid primary key default gen_random_uuid(),
  data           date not null default current_date,
  categoria      text not null default 'outros',     -- deslocamento | equipamento | aluguel_espaco | marketing | taxas | outros
  descricao      text not null,
  valor_centavos int  not null check (valor_centavos >= 0),
  criado_em      timestamptz not null default now()
);
alter table despesas enable row level security;
drop policy if exists despesas_prof on despesas;
create policy despesas_prof on despesas for all using (eh_professor()) with check (eh_professor());

-- ------------------------------------------------------------ 3. chave Pix do professor (uma linha)
create table if not exists config_recebimento (
  id          boolean primary key default true check (id),   -- singleton
  chave_pix   text,
  nome        text,          -- como aparece no Pix (até 25 caracteres, sem acento)
  cidade      text,          -- até 15 caracteres, sem acento
  mensagem    text,          -- texto padrão do WhatsApp de cobrança
  atualizado_em timestamptz not null default now()
);
insert into config_recebimento (id) values (true) on conflict do nothing;
alter table config_recebimento enable row level security;
drop policy if exists cfg_prof on config_recebimento;
create policy cfg_prof on config_recebimento for all using (eh_professor()) with check (eh_professor());
-- aluno não lê a tabela; recebe os dados do Pix só pela função abaixo, para a cobrança que é dele

-- dados para o app montar o QR Pix de uma cobrança (professor, ou o próprio aluno/responsável)
create or replace function pix_dados(p_origem text, p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare cfg config_recebimento; v_aluno uuid; v_valor int; v_desc text; v_pago boolean;
begin
  select * into cfg from config_recebimento where id;
  if p_origem = 'pacote' then
    select aluno_id, preco_centavos, nome, pago into v_aluno, v_valor, v_desc, v_pago from pacotes where id = p_id;
  else
    select aluno_id, valor_centavos, descricao, pago_em is not null into v_aluno, v_valor, v_desc, v_pago from cobrancas where id = p_id;
  end if;
  if v_aluno is null then return json_build_object('erro', 'cobrança não encontrada'); end if;
  if not (eh_professor() or acessa_aluno(v_aluno)) then return json_build_object('erro', 'sem acesso'); end if;
  if cfg.chave_pix is null or cfg.chave_pix = '' then return json_build_object('erro', 'professor ainda não cadastrou a chave Pix'); end if;
  return json_build_object('chave', cfg.chave_pix, 'nome', coalesce(cfg.nome, 'PERSONAL FIGHT'), 'cidade', coalesce(cfg.cidade, 'BELEM'),
                           'valor_centavos', v_valor, 'descricao', v_desc, 'pago', v_pago,
                           'txid', 'PF' || upper(substr(replace(p_id::text, '-', ''), 1, 20)));
end $$;
revoke all on function pix_dados(text, uuid) from public;
grant execute on function pix_dados(text, uuid) to authenticated;

-- aluno avisa que pagou
create or replace function informar_pagamento(p_origem text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_aluno uuid;
begin
  if p_origem = 'pacote' then select aluno_id into v_aluno from pacotes where id = p_id;
  else select aluno_id into v_aluno from cobrancas where id = p_id; end if;
  if v_aluno is null or not (eh_professor() or acessa_aluno(v_aluno)) then raise exception 'sem acesso'; end if;
  if p_origem = 'pacote' then update pacotes set aluno_informou_em = now() where id = p_id and not pago;
  else update cobrancas set aluno_informou_em = now() where id = p_id and pago_em is null; end if;
end $$;
revoke all on function informar_pagamento(text, uuid) from public;
grant execute on function informar_pagamento(text, uuid) to authenticated;

-- aluno renova: cria a próxima cobrança (mensal) ou um novo pacote igual ao último (pacote), ainda não pago
create or replace function renovar_plano(p_aluno uuid) returns json
language plpgsql security definer set search_path = public as $$
declare a alunos; ult record; ini date; fim date; descr text; novo uuid;
begin
  if not (eh_professor() or acessa_aluno(p_aluno)) then raise exception 'sem acesso'; end if;
  select * into a from alunos where id = p_aluno;
  if a.cobranca_tipo = 'mensal' then
    if a.valor_centavos is null then raise exception 'professor ainda não definiu o valor'; end if;
    select * into ult from cobrancas c where c.aluno_id = a.id and c.tipo = 'mensal' order by c.competencia desc limit 1;
    if ult.id is not null and ult.pago_em is null then return json_build_object('origem', 'cobranca', 'id', ult.id, 'ja_existia', true); end if;
    ini := case when ult.id is null then date_trunc('month', current_date)::date else (ult.competencia + (ult.periodo_meses * interval '1 month'))::date end;
    fim := (ini + (a.periodo_meses * interval '1 month') - interval '1 day')::date;
    descr := case a.periodo_meses when 1 then 'Mensalidade ' || to_char(ini, 'MM/YYYY') when 3 then 'Trimestre ' || to_char(ini, 'MM/YYYY') || ' a ' || to_char(fim, 'MM/YYYY')
                                  when 6 then 'Semestre ' || to_char(ini, 'MM/YYYY') || ' a ' || to_char(fim, 'MM/YYYY') else 'Anuidade ' || to_char(ini, 'MM/YYYY') || ' a ' || to_char(fim, 'MM/YYYY') end;
    insert into cobrancas (aluno_id, tipo, descricao, competencia, periodo_meses, valor_centavos, vence_em)
    values (a.id, 'mensal', descr, ini, a.periodo_meses, a.valor_centavos, greatest(current_date, ini + (coalesce(a.dia_vencimento, 5) - 1)))
    returning id into novo;
    return json_build_object('origem', 'cobranca', 'id', novo);
  elsif a.cobranca_tipo = 'pacote' then
    select * into ult from pacotes p where p.aluno_id = a.id order by p.comprado_em desc, p.id limit 1;
    if ult.id is null then raise exception 'nenhum pacote anterior; combine com o professor'; end if;
    if not ult.pago then return json_build_object('origem', 'pacote', 'id', ult.id, 'ja_existia', true); end if;
    insert into pacotes (aluno_id, plano_id, nome, sessoes_total, preco_centavos, comprado_em, vence_em, forma_pagamento, pago)
    values (a.id, ult.plano_id, ult.nome, ult.sessoes_total, ult.preco_centavos, current_date,
            case when ult.vence_em is not null then current_date + (ult.vence_em - ult.comprado_em) end, 'pix', false)
    returning id into novo;
    return json_build_object('origem', 'pacote', 'id', novo);
  else
    raise exception 'cobrança por sessão não tem renovação; pague as aulas em aberto';
  end if;
end $$;
revoke all on function renovar_plano(uuid) from public;
grant execute on function renovar_plano(uuid) to authenticated;

-- ------------------------------------------------------------ 4. visões do caixa
-- a receber: agora com o aviso do aluno
create or replace view v_a_receber as
select 'cobranca' as origem, c.id, c.aluno_id, a.nome as aluno_nome, c.descricao, c.valor_centavos, c.vence_em, c.vence_em < current_date as vencida, c.aluno_informou_em
  from cobrancas c join alunos a on a.id = c.aluno_id where c.pago_em is null
union all
select 'pacote', p.id, p.aluno_id, a.nome, p.nome, p.preco_centavos, p.comprado_em, p.comprado_em < current_date, p.aluno_informou_em
  from pacotes p join alunos a on a.id = p.aluno_id where not p.pago;
alter view v_a_receber set (security_invoker = on);

-- movimentos realizados: entradas pagas e saídas, por data
create or replace view v_caixa as
select 'entrada' as tipo, 'cobranca' as origem, c.id, c.pago_em as data, a.nome as quem, c.descricao, c.valor_centavos, c.forma_pagamento as detalhe
  from cobrancas c join alunos a on a.id = c.aluno_id where c.pago_em is not null
union all
select 'entrada', 'pacote', p.id, coalesce(p.pago_em, p.comprado_em), a.nome, p.nome, p.preco_centavos, p.forma_pagamento
  from pacotes p join alunos a on a.id = p.aluno_id where p.pago
union all
select 'saida', 'despesa', d.id, d.data, d.categoria, d.descricao, d.valor_centavos, d.categoria
  from despesas d;
alter view v_caixa set (security_invoker = on);
