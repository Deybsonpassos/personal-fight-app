# Personal Fight App — Sprint 3 · app do aluno

App do professor para aulas individuais de muay thai e kickboxing (personal itinerante).
Sprint 1: alunos, locais, horários fixos, agenda semanal, sessões com política de cancelamento, pacotes e planos.
Sprint 2 (esta): visual **B · Corner** (escuro, lima, mono), abas **HOJE / ALUNOS / DIÁRIOS / ACERVO**,
**entrevista inicial por link** (sem login, token de uso único), **programa de 8 sessões** gerado do perfil +
currículo, **diário da sessão** (correções, técnicas, RPE, peso, tarefa, observação privada), **evolução** do aluno,
**acervo** editável de técnicas e correções, claquete falada pronta para a fase de vídeo.
Sprint 3 (esta): **app do aluno / responsável** (`aluno.html`: AGENDA / DIÁRIOS / TÉCNICAS / EU, só leitura), acesso por
**código de uso único** gerado na ficha (adulto → conta própria; menor → conta do responsável, que pode ter mais de um filho),
e correção de privacidade: observações do professor saem da tabela `alunos`.

Stack: HTML + CSS + JavaScript puro (sem framework) + Supabase (Postgres, login, permissões).

```
personal-fight-app/
├── supabase/schema.sql   ← banco Sprint 1: tabelas, views, regras e segurança (RLS)
├── supabase/sprint2.sql  ← banco Sprint 2: entrevista, currículo, programa, diário, convites (rodar DEPOIS)
├── supabase/sprint3.sql  ← banco Sprint 3: acesso do aluno/responsável, obs privadas separadas (rodar POR ÚLTIMO)
├── app/                  ← PWA do professor (publicar esta pasta)
│   ├── index.html
│   ├── entrevista.html   ← página pública da entrevista (abre pelo link do convite, sem login)
│   ├── aluno.html, aluno.js, aluno.webmanifest ← app do aluno/responsável (instala como "Meu treino")
│   ├── app.js            ← toda a lógica; seções numeradas no topo do arquivo
│   ├── style.css         ← pele B · Corner (variáveis em :root)
│   ├── config.js         ← URL e chave pública do Supabase (preencher)
│   ├── manifest.webmanifest, sw.js, icon-*.png
└── README.md
```

## 1. Banco (Supabase) — 10 minutos

1. Crie um projeto em https://supabase.com (região **South America (São Paulo)**). Guarde a senha do banco em local seguro.
2. Menu **SQL Editor** → **New query** → cole o conteúdo inteiro de `supabase/schema.sql` → **Run**. Depois `supabase/sprint2.sql`, depois `supabase/sprint3.sql`, um por query, nesta ordem. Todos podem rodar mais de uma vez sem problema.
3. Menu **Authentication → Providers → Email**: deixe ativo. Desative "Confirm email" se quiser entrar sem confirmar (opcional para testes).
4. Menu **Authentication → Users → Add user → Create new user**: e-mail e senha do professor.
5. Volte ao **SQL Editor** e rode, trocando o e-mail:

   ```sql
   update perfis set papel = 'professor'
   where id = (select id from auth.users where email = 'PROFESSOR@EMAIL.COM');
   ```

6. Menu **Project Settings → API**: copie **Project URL** e a chave **anon / public**.
   Nunca use a `service_role` no app.

## 2. App — configurar e publicar

1. Edite `app/config.js` com a URL e a chave anon.
2. Publique a pasta `app/` em qualquer hospedagem estática com HTTPS. Duas opções:
   - **Cloudflare Pages** ou **Netlify** (gratuitos, aceitam repositório privado): conecte o repo, "build command" vazio, "output directory" = `app`.
   - **GitHub Pages**: só funciona com repositório **público** no plano gratuito. Como este repo é privado, prefira as opções acima.
3. Abra a URL no celular do professor → menu do navegador → **Adicionar à tela de início**.
4. Entre com o e-mail e senha criados no passo 1.4.

Para testar localmente: `cd app && python3 -m http.server 8080` e abra http://localhost:8080.

## 3. Primeiro uso (ordem recomendada)

1. **Acervo → Técnicas / Correções**: confira o currículo provisório; renomeie com os termos que você usa, remova o que não faz sentido.
2. **Acervo → Planos**: cadastre os preços (ex.: "Avulsa 1h", "Pacote 8", "Mensal 2x/semana").
3. **Alunos → + Convite**: gere o link da entrevista e mande pelo WhatsApp. Quando a pessoa responde, a ficha aparece pronta (perfil, restrição de saúde separada, local, consentimentos).
   Menor de idade ou quem não vai responder pelo celular: **+ Aluno** (cadastro manual).
4. Na ficha: **Programa → Gerar bloco de 8 sessões** (edite tocando no texto) · **Horários → + Horário fixo / + Pacote**.
5. **Hoje → Semana → Gerar semana pelos horários fixos** (toda semana) ou **+ Avulsa**.
6. Na aula: **Hoje** mostra a próxima sessão com foco do programa e a claquete para falar ao gravar. Depois: **Abrir diário** → status, correções, como saiu cada técnica, RPE, tarefa → **Realizada**.
7. **Diários** lista o que falta registrar. **Evolução** (na ficha) é o que o aluno vê no app dele.
8. **Ficha → Perfil → Código de acesso**: gera o link do app do aluno (`aluno.html?c=...`). Adulto cria e-mail e senha e entra; para menor, o código é do responsável. Se em Authentication → Providers → Email a opção "Confirm email" estiver ligada, a pessoa precisa confirmar o e-mail e abrir o mesmo link de novo.

Regras já embutidas:
- **Realizada** e **Falta sem aviso** consomem sessão do pacote. **Cancelei eu** e **Remarcada** não.
- **Cancelada pelo aluno** dentro da antecedência (Ajustes, padrão 12 h) não consome; fora do prazo, consome.
- O saldo do pacote é calculado pelo banco (view `v_pacotes_saldo`), nunca digitado.
- Restrições de saúde ficam em tabela separada, visível **só** ao papel professor (RLS).

## 4. O que NÃO está nesta sprint (por decisão)

- Cancelamento de sessão pelo aluno dentro do app (vai por WhatsApp; evita dar permissão de escrita em `sessoes`).
- Entrevista do responsável para menor de idade (o cadastro do menor é manual pelo professor).
- Gravação de sessão, marcadores no vídeo, pipeline de vídeo e sugestão por IA (Sprint 4+). A claquete e o campo `video_ref` já estão prontos para isso.
- Pagamento por link (Asaas / Mercado Pago) e lembretes automáticos por WhatsApp.
- Graduações por modalidade (tabela `graduacoes` pronta, aguardando o professor).

## 5. Segurança e LGPD — resumo do que o código faz

- Só usuários com `perfis.papel = 'professor'` conseguem ler/escrever tudo; aluno/responsável só lê o que é seu.
- `restricoes_saude`, `alunos_obs_privadas` e `sessoes_obs_privadas` nunca saem para outro papel (tabelas separadas com política só-professor; a Sprint 1 tinha `alunos.observacoes` na própria linha do aluno, legível por ele — corrigido na Sprint 3).
- Acesso do aluno: conta comum do Supabase Auth + vínculo feito pela função `acesso_resgatar(token)`, que recusa menor como titular e código repetido. O app do aluno só lê; toda restrição é RLS no banco, não JavaScript.
- A entrevista pública não lê nem escreve tabela nenhuma diretamente: passa por duas funções (`entrevista_info`, `entrevista_enviar`) que só aceitam um token válido, de uso único, com validade de 14 dias. Anônimo não enxerga `convites`.
- Status de técnica do aluno só sobe (apresentada → praticada → dominada), calculado por gatilho no banco.
- Consentimentos são versionados (`textos_consentimento` + `consentimentos`) e separados por tipo: termos, saúde, imagem/gravação.
- A chave `anon` pode ficar no front-end **porque** a segurança está nas políticas RLS do banco, não na chave.
