# Chatbot OPENAI

## 1. Plataforma usada e por que escolheu
O projeto usa **Node.js (Express)** como backend porque:
- É leve e rápido para criar endpoints HTTP;
- Facilita integração com APIs externas (ex.: `fetch` para webhook);
- Trabalha bem com JSON, o mesmo formato do chatbot e do webhook;
- Permite manter o estado simples em memória (`sessions[userId]`) durante os testes.

O chatbot no front usa HTML, CSS e JavaScript puro para ser embutido em qualquer página.

---
## 2. Como testar

1. **Instalar dependências**
   ```bash
   npm install
   ```
2. **Criar o arquivo `.env` na raiz:**
   ```env
    OPENAI_API_KEY = sua_chave_aqui
    PORT = 8080
    TODAY_DATE = 2025-11-04
    BATCH_CLOSING = 2025-11-07
    WEBHOOK_LINK = https://webhook.site/b4cc710e-d145-4aa3-95c3-64dd19a77a55
    FRIEND_DISCOUNT = 5
    CARD_DISCOUNT = 5
    AREA_DISCOUNT = 10
    URGENCY_DISCOUNT = 7
   ```

3. **Subir o servidor**
   ```bash
   npm start
   ```
   ou
   ```bash
   node server.js
   ```

4. **Abrir o navegador**
   - Acesse: http://localhost:8080

5. **Testar o envio de leads**
   - No canto direito clique para abrir o chat e ele ira começar a interagir automaticamente usando a openai
   - Os dados serão enviados para o webhook configurado ao final do cadastro.

---

## 3. Onde alterar datas e descontos

Tudo fica no `.env`:

```env
# descontos
FRIEND_DISCOUNT=5  ---Indicação de amigo
CARD_DISCOUNT=5    ---Pagamento recorrente no cartão
AREA_DISCOUNT=10   ---Trabalha na área (apenas Pós)
URGENCY_DISCOUNT=7 ---Urgência (lote a ≤7 dias do fechamento)

# datas
TODAY_DATE=2025-11-05 ---Para simular a data de hoje
BATCH_CLOSING=2025-11-12 ---Data de fechamento de lote
```

## 4. Endpoints e payload usado

### **POST /chatbot**
Recebe a mensagem do usuário e devolve a resposta.

**Request:**
```json
{
  "clientId": "1234-abc",
  "message": "quero um curso de TI"
}
```

**Response:**
```json
{
  "reply": "Não use saudações, sugira até 3 cursos..."
}
```

---

### **POST /reset-session**
Limpa a sessão do usuário no servidor.

**Request:**
```json
{
  "clientId": "1234-abc"
}
```

**Response:**
```json
{
  "status": "ok"
}
```

---

### **Webhook de lead (envio automático)**

**URL exemplo:**
```
https://webhook.site/08a7f78d-9695-4119-8e83-970adc7eea08
```

**Payload enviado:**
```json
{
  "origin": "chatbot",
  "name": "Nome do Cliente",
  "cpf": "00000000000",
  "phone": "11999999999",
  "address": "Rua Exemplo, 123",
  "courseName": "Pós em Data Science",
  "courseLevel": "pos",
  "courseLevel": "pos",
  "courseFinalPrice": "739,00",
  "time": "2025-11-05T14:22:31.000Z"
}
```
---

## 5. Observações

- É possível testar o envio de leads de forma gratuita usando [https://webhook.site](https://webhook.site)
- O comando **"parar"** ou **"cancelar"** ativa o modo de encerramento do atendimento.
- O prompt do atendente é totalmente controlado pelo backend.
