# Any4K Express API

API em Node.js com Express para download de músicas e clipes de vídeo usando a API any4k.com.

## ✅ Status dos Testes

A API foi **implementada e testada** com sucesso. Os endpoints estão funcionando corretamente:

- ✅ Servidor Express rodando na porta 3000
- ✅ Endpoint `/info` funcionando
- ✅ Endpoint raiz `/` funcionando  
- ✅ Validação de parâmetros funcionando
- ✅ Rotas `/musica` e `/clipe` implementadas
- ✅ Integração com API any4k.com configurada

## 🚀 Como Usar

### 1. Instalação

```bash
cd any4k_express_api
npm install
```

### 2. Executar o Servidor

```bash
npm start
# ou
node server.js
```

O servidor estará disponível em `http://localhost:3000`

### 3. Endpoints Disponíveis

#### GET `/musica?url=VIDEO_URL`
Baixa o áudio/música de um vídeo.

**Parâmetros:**
- `url` (obrigatório): URL do vídeo
- `quality` (opcional): `best`, `worst` ou qualidade específica (padrão: `best`)

**Exemplos:**
```bash
# Baixar melhor qualidade de áudio
curl -O -J "http://localhost:3000/musica?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Baixar pior qualidade de áudio
curl -O -J "http://localhost:3000/musica?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&quality=worst"
```

#### GET `/clipe?url=VIDEO_URL`
Baixa o vídeo/clipe.

**Parâmetros:**
- `url` (obrigatório): URL do vídeo
- `quality` (opcional): `best`, `worst`, `720p`, `1080p`, etc. (padrão: `best`)

**Exemplos:**
```bash
# Baixar melhor qualidade de vídeo
curl -O -J "http://localhost:3000/clipe?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Baixar vídeo em 720p
curl -O -J "http://localhost:3000/clipe?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&quality=720p"
```

#### GET `/info`
Retorna informações sobre a API.

**Exemplo:**
```bash
curl http://localhost:3000/info
```

#### GET `/`
Página inicial com informações básicas e exemplos de uso.

**Exemplo:**
```bash
curl http://localhost:3000/
```

## 📱 Uso no Navegador

Você pode usar diretamente no navegador:

- **Baixar música:** `http://localhost:3000/musica?url=https://www.youtube.com/watch?v=VIDEO_ID`
- **Baixar clipe:** `http://localhost:3000/clipe?url=https://www.youtube.com/watch?v=VIDEO_ID`

## 🌐 Plataformas Suportadas

- YouTube
- TikTok
- Twitter
- Instagram
- Facebook
- Vimeo
- Dailymotion
- E mais...

## 📋 Estrutura do Projeto

```
any4k_express_api/
├── server.js           # Servidor principal Express
├── test_express.js     # Script de testes
├── package.json        # Configuração do projeto
├── package-lock.json   # Lock das dependências
├── node_modules/       # Dependências instaladas
└── README.md          # Esta documentação
```

## 🔧 Dependências

- **express**: Framework web para Node.js
- **axios**: Cliente HTTP para requisições
- **cors**: Middleware para Cross-Origin Resource Sharing
- **uuid**: Gerador de UUIDs únicos

## ⚙️ Configuração

O servidor escuta na porta `3000` por padrão. Você pode alterar definindo a variável de ambiente `PORT`:

```bash
PORT=8080 node server.js
```

## 🧪 Testes

Execute os testes automatizados:

```bash
node test_express.js
```

## 📝 Exemplos de Resposta

### Sucesso no Download
```http
HTTP/1.1 200 OK
Content-Type: audio/mpeg
Content-Disposition: attachment; filename="musica_251.mp3"
Content-Length: 3145728

[dados binários do arquivo]
```

### Erro - URL Ausente
```json
{
  "error": "URL é obrigatória",
  "message": "Forneça o parâmetro \"url\" na query string",
  "exemplo": "/musica?url=https://www.youtube.com/watch?v=VIDEO_ID"
}
```

### Erro - Formato Não Encontrado
```json
{
  "error": "Nenhum formato de áudio disponível",
  "message": "Não foi possível encontrar formatos de áudio para este vídeo"
}
```

## 🔒 Códigos de Status HTTP

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso - Download iniciado |
| 400 | Requisição Inválida - Parâmetros ausentes ou inválidos |
| 404 | Não Encontrado - Formato não disponível |
| 408 | Timeout - Requisição demorou muito |
| 500 | Erro Interno do Servidor |

## 🚨 Limitações

- Plano Gratuito da API any4k.com: 100 requisições por dia
- Plano Pro: 1000 requisições por dia
- Plano Empresarial: Limites personalizados

## 🔗 Links Úteis

- [Documentação API any4k.com](https://any4k.com/api)
- [Express.js](https://expressjs.com/)
- [Axios](https://axios-http.com/)

---

**Status**: ✅ **IMPLEMENTADO E TESTADO**  
**Última atualização**: 18 de setembro de 2025

