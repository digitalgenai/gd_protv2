"""Transcrição (Whisper) + extração estruturada (chat completion) de gravações de voz feitas
direto no navegador. O casamento com o catálogo NÃO usa embedding/pgvector — a extensão não
está instalada ainda (só documentada como migration futura); usamos busca por similaridade de
texto (pg_trgm, já instalado) em routes/voz.py."""
import json
import unicodedata

from openai import OpenAI

from config import OPENAI_API_KEY

WHISPER_MODEL = "whisper-1"
EXTRACAO_MODEL = "gpt-4o-mini"

# Whisper "alucina" essas frases (legenda de vídeo, "obrigado por assistir" etc.) quando o áudio
# enviado está em silêncio/vazio ou não tem fala real — não é a IA "não entendendo português",
# é ela inventando texto plausível pra um trecho sem conteúdo. Detectar e tratar como "sem fala".
_FRASES_ALUCINACAO_SILENCIO = [
    "legendas pela comunidade amara.org",
    "subtitles by the amara.org community",
    "amara.org",
    "obrigado por assistir",
    "obrigada por assistir",
    "thanks for watching",
    "thank you for watching",
    "inscreva-se no canal",
    "subscribe to my channel",
    "www.",
]


def _eh_alucinacao_de_silencio(texto: str) -> bool:
    normalizado = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii").strip().lower()
    if len(normalizado) < 3:
        return True
    return any(frase in normalizado for frase in _FRASES_ALUCINACAO_SILENCIO)

_AMBIENTES_VALIDOS = [
    "Hall", "Estar", "Jantar", "Cozinha", "Home", "Escritório",
    "Suíte Master", "Varanda Suíte Master", "Quarto", "Varanda", "Banheiro", "Área Externa",
]

_EXTRACAO_SYSTEM_PROMPT = f"""\
Você extrai dados estruturados de uma transcrição em português (às vezes informal, corrida ou com \
frases incompletas) de um vendedor de móveis ditando uma proposta comercial. Responda SOMENTE com \
um JSON no formato:

{{
  "cliente": "nome do cliente ou null",
  "telefoneCliente": "telefone do cliente, só dígitos (com DDD) ou null",
  "emailCliente": "e-mail do cliente ou null",
  "enderecoCliente": "endereço do cliente (rua, número, bairro, cidade — o que foi dito) ou null",
  "arquiteto": "nome do arquiteto/escritório ou null",
  "descontoGlobal": 0,
  "itens": [
    {{
      "descricao": "descrição do móvel como foi dito, sem o nome do cliente/arquiteto",
      "quantidade": 1,
      "desconto": 0,
      "ambiente": "um destes valores, se citado, senão null: {', '.join(_AMBIENTES_VALIDOS)}"
    }}
  ]
}}

O cliente pode ser mencionado de várias formas — todas contam:
- "cliente Studio Lima", "para o cliente Studio Lima", "para Studio Lima"
- "na proposta do Cambly", "na proposta da Ana", "essa é a proposta do/da X"
- "eu tô aqui com a/o X", "aqui é a proposta da/do X"
- ou até só o nome próprio solto no início/fim da frase, sem a palavra "cliente"

Dados de contato do cliente (telefone/e-mail/endereço) costumam vir em frases como "quero
adicionar o telefone dela", "o e-mail dela é...", "o endereço dela é...", "o DDD é... e o
número é...". Extraia mesmo que venham em frases separadas do nome do cliente — normalize
telefone pra só dígitos (DDD + número, sem espaço/traço/parênteses).

E-mail ditado por voz quase sempre vem com os símbolos por extenso, não com o caractere em si
— a transcrição pode até já ter tentado converter errado (ex.: virar hífen). Reconstrua o
e-mail de volta pro formato correto, em minúsculas, interpretando essas palavras como símbolo:
"arroba" → @ · "ponto" → . · "underline"/"traço baixo" → _ · "hífen"/"traço" → -
Exemplo: "marcos underline andrade arroba gmail ponto com" → "marcos_andrade@gmail.com".

Itens também aparecem de formas variadas — todas contam como item, mesmo frases soltas tipo
"eu quero adicionar a Ariada" ou "coloca aí uma Nauê" ou só "mais uma mesa retangular":
verbos como adicionar/colocar/quero/também introduzem um item, não são parte da descrição dele.

Regras:
- "descontoGlobal" e o "desconto" de cada item são porcentagens (número, sem o símbolo %).
- Se não houver menção a um campo, use null (ou 0 para números, [] para itens).
- "itens" nunca inclui o cliente/arquiteto nem os dados de contato — só móveis/produtos mencionados.
- Cada trecho que descreve um móvel distinto vira um item separado — mesmo que a frase seja curta
  ("adicionar a Ariada" → um item com descricao "Ariada"), mesmo sem quantidade/nome de produto claro.
- Quantidade por extenso ("duas", "três") deve virar número; se não houver quantidade, use 1.
- "ambiente" só pode ser um dos valores da lista acima (ou null) — nunca invente um valor fora dela.
  Se um ambiente foi citado antes de vários itens na mesma frase, aplique o mesmo ambiente a todos eles.
- Na dúvida entre extrair algo ou deixar de fora, prefira extrair — é mais fácil o vendedor remover
  um item errado na revisão do que ter que redizer um item que não foi capturado.
"""


def _client() -> OpenAI:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY não configurada no .env.")
    return OpenAI(api_key=OPENAI_API_KEY)


def transcrever_audio(arquivo_bytes: bytes, filename: str) -> str:
    """Manda o áudio gravado no navegador (webm/mp4/wav/ogg) pro Whisper e devolve o texto.
    `language="pt"` fixa português (evita o Whisper "detectar" outro idioma em trechos curtos/
    ambíguos); o `prompt` dá uma pista do vocabulário esperado (termos do domínio de móveis/
    vendas em pt-BR), o que ajuda bastante a acertar nomes próprios e jargão específico.
    Retorna "" (em vez do texto alucinado) se o áudio não tinha fala real — ver
    _eh_alucinacao_de_silencio."""
    resposta = _client().audio.transcriptions.create(
        model=WHISPER_MODEL,
        file=(filename, arquivo_bytes),
        language="pt",
        prompt=(
            "Transcrição em português do Brasil de um vendedor de móveis ditando uma proposta "
            "comercial: nomes de clientes e arquitetos, desconto, e produtos como sofá, poltrona, "
            "mesa de jantar, cadeira, aparador, tapete."
        ),
    )
    texto = resposta.text.strip()
    if _eh_alucinacao_de_silencio(texto):
        # Log do texto bruto que o Whisper devolveu antes de descartar — sem isso, fica
        # impossível diferenciar "áudio realmente sem fala" de "filtro pegando falso positivo"
        # quando o vendedor reportar que "não funcionou" de novo.
        print(f"[voz] Whisper devolveu provável alucinação de silêncio (descartada): {texto!r}", flush=True)
        return ""
    return texto


def extrair_dados_proposta(transcricao: str) -> dict:
    """Pede pro modelo de chat extrair cliente/arquiteto/desconto/itens da transcrição, em JSON.
    O casamento de cada item com um produto real do catálogo acontece depois, em routes/voz.py
    (busca por similaridade de texto — pg_trgm), não aqui."""
    resposta = _client().chat.completions.create(
        model=EXTRACAO_MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _EXTRACAO_SYSTEM_PROMPT},
            {"role": "user", "content": transcricao},
        ],
        temperature=0,
    )
    conteudo = resposta.choices[0].message.content or "{}"
    dados = json.loads(conteudo)
    telefone = (dados.get("telefoneCliente") or "").strip()
    email = (dados.get("emailCliente") or "").strip()
    endereco = (dados.get("enderecoCliente") or "").strip()
    return {
        "cliente": dados.get("cliente") or None,
        "telefoneCliente": telefone or None,
        "emailCliente": email.lower() or None,
        "enderecoCliente": endereco or None,
        "arquiteto": dados.get("arquiteto") or None,
        "descontoGlobal": dados.get("descontoGlobal") or 0,
        "itens": [
            {
                "descricao": (item.get("descricao") or "").strip(),
                "quantidade": item.get("quantidade") or 1,
                "desconto": item.get("desconto") or 0,
                "ambiente": item.get("ambiente") if item.get("ambiente") in _AMBIENTES_VALIDOS else None,
            }
            for item in (dados.get("itens") or [])
            if (item.get("descricao") or "").strip()
        ],
    }
