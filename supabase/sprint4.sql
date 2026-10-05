-- =====================================================================
-- Personal Fight — Sprint 4: disponibilidade do professor + agendamento pelo aluno após a entrevista
-- (roda DEPOIS de schema.sql, sprint2.sql e sprint3.sql; idempotente)
-- =====================================================================

-- ------------------------------------------------------------ 1. janelas semanais em que o professor atende
create table if not exists disponibilidade (
  id          uuid primary key default gen_random_uuid(),
  dia_semana  smallint not null check (dia_semana between 0 and 6),   -- 0 = domingo
  hora_inicio time not null,
  hora_fim    time not null check (hora_fim > hora_inicio),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
alter table disponibilidade enable row level security;
drop policy if exists disp_prof on disponibilidade;
create policy disp_prof on disponibilidade for all using (eh_professor()) with check (eh_professor());
-- anon e aluno não leem a tabela: só pelas funções abaixo

-- horários fixos criados pelo próprio aluno ficam marcados
alter table horarios_fixos add column if not exists origem text not null default 'professor';   -- professor | aluno
alter table convites add column if not exists telefone text;

-- ------------------------------------------------------------ 2. horários semanais livres (para o aluno escolher logo após a entrevista)
--   Regra: um horário (dia da semana + hora cheia, 60 min) está livre se cabe numa janela de disponibilidade
--   e nenhum horário fixo ativo de outro aluno ocupa o mesmo dia/hora.
--   Só responde para um convite de entrevista já usado (aluno criado) e que ainda não tem horário fixo.
create or replace function horarios_livres(p_token text) returns json
language plpgsql stable security definer set search_path = public as $$
declare c convites; r json;
begin
  select * into c from convites where token = p_token and tipo = 'entrevista';
  if c.token is null or c.aluno_id is null then return json_build_object('erro', 'convite inválido'); end if;
  if exists (select 1 from horarios_fixos where aluno_id = c.aluno_id and ativo) then return json_build_object('erro', 'já agendado'); end if;
  select json_build_object(
    'frequencia', (select frequencia_semana from alunos where id = c.aluno_id),
    'duracao', 60,
    'slots', coalesce((
      select json_agg(json_build_object('dia_semana', s.dia_semana, 'hora', to_char(s.hora, 'HH24:MI')) order by s.dia_semana, s.hora)
      from (
        select d.dia_semana, (d.hora_inicio + (g * interval '1 hour'))::time as hora
        from disponibilidade d
        cross join lateral generate_series(0, (extract(epoch from (d.hora_fim - d.hora_inicio)) / 3600)::int - 1) as g
        where d.ativo
      ) s
      where not exists (
        select 1 from horarios_fixos h
        where h.ativo and h.dia_semana = s.dia_semana
          and h.hora_inicio < s.hora + interval '1 hour' and (h.hora_inicio + (h.duracao_min * interval '1 minute')) > s.hora
      )
    ), '[]'::json)
  ) into r;
  return r;
end $$;

-- ------------------------------------------------------------ 3. o aluno escolhe horários semanais → horários fixos + sessões das próximas 4 semanas
create or replace function agendar_por_convite(p_token text, p_slots jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare c convites; a alunos; mid int; lid uuid; s jsonb; dow int; h time; n int := 0; criadas int := 0; d date; ini timestamptz; livre json; freq int;
begin
  select * into c from convites where token = p_token and tipo = 'entrevista' for update;
  if c.token is null or c.aluno_id is null then raise exception 'convite inválido'; end if;
  if c.usado_em < now() - interval '2 hours' then raise exception 'prazo para escolher horários expirou; combine com o professor'; end if;
  if exists (select 1 from horarios_fixos where aluno_id = c.aluno_id and ativo) then raise exception 'horários já escolhidos'; end if;
  select * into a from alunos where id = c.aluno_id;
  freq := greatest(1, least(coalesce(a.frequencia_semana, 1), 4));
  if jsonb_array_length(p_slots) < 1 or jsonb_array_length(p_slots) > freq then raise exception 'escolha de 1 a % horário(s)', freq; end if;
  select modalidade_id into mid from alunos_modalidades where aluno_id = a.id limit 1;
  select id into lid from locais where aluno_id = a.id and padrao limit 1;
  livre := horarios_livres(p_token);

  for s in select * from jsonb_array_elements(p_slots) loop
    dow := (s->>'dia_semana')::int; h := (s->>'hora')::time;
    -- precisa estar entre os livres
    if not exists (select 1 from json_array_elements(livre->'slots') e where (e->>'dia_semana')::int = dow and (e->>'hora')::time = h) then
      raise exception 'um dos horários escolhidos não está mais disponível; escolha outro';
    end if;
    insert into horarios_fixos (aluno_id, modalidade_id, local_id, dia_semana, hora_inicio, duracao_min, origem)
    values (a.id, mid, lid, dow, h, 60, 'aluno');
    n := n + 1;
    -- sessões das próximas 4 semanas (a partir de amanhã), no fuso de Belém
    d := current_date + 1;
    while d <= current_date + 28 loop
      if extract(dow from d)::int = dow then
        ini := (d + h) at time zone 'America/Belem';
        if not exists (select 1 from sessoes x where x.aluno_id = a.id and x.inicio = ini) then
          insert into sessoes (aluno_id, modalidade_id, local_id, inicio, fim, status, consome_pacote)
          values (a.id, mid, lid, ini, ini + interval '60 minutes', 'agendada', false);
          criadas := criadas + 1;
        end if;
      end if;
      d := d + 1;
    end loop;
  end loop;
  return json_build_object('horarios', n, 'sessoes', criadas);
end $$;

revoke all on function horarios_livres(text) from public;
revoke all on function agendar_por_convite(text, jsonb) from public;
grant execute on function horarios_livres(text) to anon, authenticated;
grant execute on function agendar_por_convite(text, jsonb) to anon, authenticated;
