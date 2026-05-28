# Correção de Cargas

Aplicação web para análise de carregamento em operações de perfuração e desmonte, com foco em identificar desvios de profundidade e carga total real em relação ao padrão estatístico do conjunto analisado.

## Resumo executivo

Este repositório entrega uma ferramenta leve, visual e de uso direto para diagnóstico operacional. A proposta é acelerar a leitura da base de carregamento, destacar furos fora do padrão e transformar dados brutos em informação acionável para decisão técnica e gerencial.

### Valor para o negócio

- Reduz o tempo de análise manual de planilhas e exportações operacionais.
- Evidencia outliers de profundidade e carga que merecem validação técnica.
- Organiza a leitura dos dados em uma interface clara, pronta para apresentação.
- Pode ser publicada no GitHub Pages sem infraestrutura adicional.

## O que a aplicação faz

- Importa arquivos `CSV`, `TSV` ou `TXT` estruturados.
- Lê a base real exportada do processo.
- Calcula estatísticas descritivas da profundidade e da carga.
- Detecta outliers por escore robusto com `MAD` ou, quando necessário, por desvio padrão.
- Exibe os resultados em cartões visuais com contexto operacional.
- Permite uso imediato com uma amostra local já incluída no repositório.

## Mensagem para apresentação a um CEO

Em termos de gestão, a solução ajuda a transformar uma etapa operacional frequentemente dispersa em um painel objetivo de exceções. O foco não é substituir a análise técnica, mas reduzir ruído, padronizar a leitura e acelerar a tomada de decisão sobre possíveis desvios de execução.

### Pergunta de negócio que a ferramenta responde

- A execução está aderente ao plano?
- Quais furos merecem revisão imediata?
- Há registros excluídos ou inconsistências relevantes no lote?
- A distribuição de profundidade e carga está estável ou com dispersão fora do esperado?

## Como funciona

1. O usuário importa a base.
2. O sistema normaliza os registros.
3. Registros excluídos são separados da amostra ativa.
4. A aplicação calcula média, mediana, MAD e desvio padrão.
5. A rotina identifica desvios significativos.
6. O resultado é exibido com resumo executivo e detalhes por furo.

## Arquitetura

- `index.html`: estrutura da interface.
- `styles.css`: identidade visual e responsividade.
- `app.js`: camada de interface, upload, renderização e estados de uso.
- `logic.js`: parsing, estatística e detecção de outliers.
- `test/outlier.test.js`: validação automatizada da lógica principal.

## Estrutura de dados esperada

O arquivo de entrada deve ser tabular e conter, no mínimo, colunas compatíveis com:

- `Number`
- `Length`
- `Length_Real`
- `Total_Charge`
- `Total_Charge_Real`
- `json`
- `eliminated`
- `problemList`

## Como executar localmente

```bash
npm install
npm test
```

Para abrir a aplicação, basta servir os arquivos estáticos com qualquer servidor local. Exemplo:

```bash
npx serve .
```

Depois acesse a página local exibida pelo servidor.

## Testes

Os testes cobrem:

- leitura da base real incluída em `input/PP210526_EXEC.csv`;
- detecção de registros excluídos;
- identificação de outliers de profundidade e carga.

Executar:

```bash
npm test
```

## GitHub Pages

O repositório já contém workflow para publicação automática em GitHub Pages via `.github/workflows/pages.yml`.

Fluxo:

1. Commit na branch `main`.
2. GitHub Actions empacota a aplicação em `public/`.
3. O artifact é enviado ao Pages.
4. O site é publicado automaticamente.

## Próximos aprimoramentos possíveis

- exportação de relatórios em PDF ou CSV;
- filtros por seção, turno, bancada ou desmonte;
- dashboard com histórico por período;
- indicadores executivos de estabilidade operacional.
