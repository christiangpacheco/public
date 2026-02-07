require('dotenv').config();
const express = require('express');
const path = require('path');
const { OpenAI } = require('openai');
const fetch = require('node-fetch');
const SESSIONS = {};
const APP = express();

APP.use(express.json());
APP.use(express.static(path.join(__dirname, 'public')));

const OPENAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CATALOG = [
  { id: "g-ti-ads", nivel: "graduacao", area: "TI", nome: "Análise e Desenvolvimento de Sistemas", preco_base: 649.90 },
  { id: "g-adm", nivel: "graduacao", area: "Administração", nome: "Administração", preco_base: 599.90 },
  { id: "p-ds", nivel: "pos", area: "TI", nome: "Pós em Data Science", preco_base: 749.90 },
  { id: "p-gestao-saude", nivel: "pos", area: "Saúde", nome: "Pós em Gestão em Saúde", preco_base: 699.90 }
];
const TODAY = process.env.TODAY_DATE ? new Date(process.env.TODAY_DATE) : new Date();
const BATCH_CLOSING_DATE = process.env.BATCH_CLOSING ? new Date(process.env.BATCH_CLOSING) : new Date();
const WEBHOOK_LINK = process.env.WEBHOOK_LINK;
const FRIEND_DISCOUNT = Number(process.env.FRIEND_DISCOUNT || 5) / 100;
const CARD_DISCOUNT = Number(process.env.CARD_DISCOUNT || 5) / 100;
const AREA_DISCOUNT = Number(process.env.AREA_DISCOUNT || 10) / 100;
const URGENCY_DISCOUNT = Number(process.env.URGENCY_DISCOUNT || 7) / 100;

APP.post('/chatbot', async (req, res) => {
  const userId = req.body.clientId || req.ip;
  let { message } = req.body;
  message = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c");

  if (!SESSIONS[userId]) {
    SESSIONS[userId] = {
      name: '',
      phone: '',
      zipCode: '',
      cpf: '',
      discountTypes: [],
      courseID: '',
      courseLevel: '',
      courseArea: '',
      courseName: '',
      courseFinalPrice: '',
      step: 1,
      persist: true,
      leadSended: false,
      messages: [],
    };
  }

  const userSession = SESSIONS[userId];

  if (!message) {
    return res.status(400).json({ error: 'Mensagem vazia' });
  }

  try {
    let step = userSession.step;
    let systemPrompt = 'Você é um atendente virtual. ';
    if (message.includes('parar') || message.includes('cancelar')) {
      systemPrompt += 'Questione se o cliente tem certeza que deseja encerrar o atendimento. Finalize exigindo uma resposta de sim ou não.';
      userSession.persist = false;
    }
    if (userSession.persist === false) {
      if (message.includes('sim')) {
        systemPrompt += 'Encerrre o cancelamento do atendimento de forma educada.';
        resetSession(userId);
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ];
        userSession.messages = messages;
        const completion = await OPENAI.chat.completions.create({
          model: 'gpt-4o-mini',
          messages
        });
        const reply = completion.choices[0].message.content;
        return res.json({ reply });
      } else if (message.includes('nao')) {
        step = step - 1;
        userSession.persist = true;
      } else {
        systemPrompt += 'Questione novamente se o cliente deseja encerrar o atendimento. Responda apenas com sim ou não.';
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ];
        userSession.messages = messages;
        const completion = await OPENAI.chat.completions.create({
          model: 'gpt-4o-mini',
          messages
        });
        const reply = completion.choices[0].message.content;
        return res.json({ reply });
      }
    }
    if (userSession.persist === true) {
      switch (step) {
        case 1: {
          const hasUpcomingHoliday = await checkHolidays();
          systemPrompt += 'Apresente-se brevemente saudando o cliente.';
          if (hasUpcomingHoliday) {
            systemPrompt += 'Informe que os horários de atentimento podem estar reduzidos em questão do feriado.';
          }
          systemPrompt += 'Quebre uma linha. Finalize solicitando o nome completo do cliente.';
          step = 2;
          break;
        }
        case 2: {
          userSession.name = message.trim();
          systemPrompt += 'Não use saudações. Se comunique com o cliente usando seu nome"' + userSession.name + '". Quebre uma linha, requsisite o telefone com DDD.';
          step = 3;
          break;
        }
        case 3: {
          const cleanedMessage = message.trim();
          if (!userSession.phone) {
            if (isPhoneNumber(cleanedMessage)) {
              userSession.phone = cleanedMessage;
              systemPrompt += 'Não use saudações. Agradeça por informar o telefone. Finalize solicitando o CPF do cliente.';
              step = 4;
            } else {
              systemPrompt += 'Não use saudações, Informe que o número informado parece inválido. Solicite um telefone válido com DDD (ex: 11987654321).';
            }
          } else {
            systemPrompt += 'Não use saudações, requisite de forma natural e objetiva o CPF do cliente.';
            step = 4;
          }
          break;
        }
        case 4: {
          const cpf = message.replace(/\D/g, '');
          if (isCPF(message)) {
            if (validateCPF(cpf)) {
              userSession.cpf = cpf;
              systemPrompt += 'Não use saudações, informe que o CPF foi validado. Quebre uma linha, solicite o CEP.';
              step = 5;
            } else {
              systemPrompt += 'Não use saudações, informe que o CPF informado parece inválido. Solicite novamente o CPF.';
              step = 4;
            }
          } else {
            systemPrompt += 'Não use saudações, informe que CPF informado está em formato incorreto. Requisite novamente no formato 000.000.000-00.';
            step = 4;
          }
          break;
        }
        case 5: {
          const zipCode = isZipCode(message);
          if (zipCode) {
            const zipCodeInfo = await getAddressViaZipCode(zipCode);
            if (zipCodeInfo) {
              userSession.address = zipCodeInfo;
              systemPrompt +=
                'Não use saudações, diga "O CEP informado é ' + zipCodeInfo.zipCode +
                ' - Cidade: ' + zipCodeInfo.city +
                ', UF: ' + zipCodeInfo.state +
                ', logradouro: ' + zipCodeInfo.street +
                '", Quebre uma linha, pergunte se o cliente quer um curso de graduação ou pós-graduação.';
              step = 6;
            } else {
              systemPrompt += 'Não use saudações, informe CEP digitado não foi encontrado. Requisite o CEP novamente.';
            }
          } else {
            systemPrompt += 'Não use saudações, informe que CEP digitado está em formato incorreto. Requisite o CEP novamente no formato 00000-000.';
          }
          break;
        }
        case 6: {
          const level = message
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ç/g, "c");

          if (level.includes('graduacao')) {
            userSession.courseLevel = 'graduacao';
            systemPrompt += 'Não use saudações, pergunte qual área ele prefere: TI, Saúde ou Administração.';
            step = 7;
          } else if (level.includes('pos')) {
            userSession.courseLevel = 'pos';
            systemPrompt += 'Não use saudações, pergunte qual área ele prefere: TI, Saúde ou Administração.';
            step = 7;
          } else {
            systemPrompt += 'Não use saudações, pergunte objetivamente se o cliente quer se matricular em uma graduação ou pós-graduação.';
          }
          break;
        }
        case 7: {
          if (message.includes('ti')) {
            userSession.courseArea = 'TI';
          } else if (message.includes('saude')) {
            userSession.courseArea = 'Saúde';
          } else if (message.includes('admin')) {
            userSession.courseArea = 'Administração';
          } else {
            systemPrompt += 'Não use saudações, pergunte novamente qual área ele prefere: TI, Saúde ou Administração.';
          }
          const courses = getCourses(userSession.courseLevel, userSession.courseArea);
          
          if (userSession.courseArea) {
            if (courses.length > 0) {
              systemPrompt += 'Não use saudações, se exister no catalogo sugira até 3 cursos informando nome, nível, área e preço deste catálogo: ' + JSON.stringify(courses) + ' não invente nenhuma informação. Quebre um linha e diga "Por favor informe o nome do curso em que deseja se matricular"';
              step = 8;
              
            } else {
              systemPrompt += 'Não use saudações. Informe que não há nenhuma curso compativel com os filtros do cliente. Quebre uma linha, pergunte se o cliente quer um curso de graduação ou pós-graduação.';
              step = 6;
            }
          }
          break;
        }
        case 8: {
          const courses = getCourses(userSession.courseLevel, userSession.courseArea);
          if (message.includes("analise") || message.includes("desenvolvimento") || message.includes("sistemas")) {
            userSession.courseID = "g-ti-ads";
            userSession.courseName = "Análise e Desenvolvimento de Sistemas";
          } else if (message.includes("administracao") || message.includes("rh")) {
            userSession.courseID = "g-adm";
            userSession.courseName = "Administração";
          } else if (message.includes("data") || message.includes("science")) {
            userSession.courseID = "p-ds";
            userSession.courseName = "Pós em Data Science";
          } else if (message.includes("gestao em saude") || message.includes("gestao saude") || message.includes("saude") || message.includes("gestao")) {
            userSession.courseID = "p-gestao-saude";
            userSession.courseName = "Pós em Gestão em Saúde";
          }

          if (userSession.courseID) {
            systemPrompt = `
              Você é um atendente virtual. Não use saudações. Responda de forma natural e curta.
              Não invente novos descontos. Use apenas os valores fornecidos.
              No final, faça apenas uma pergunta ao cliente.

              Diga apenas o seguinte texto (substituindo os valores abaixo):

              "Apresentei os métodos de desconto disponíveis:
              - Indicação de amigo: -${(FRIEND_DISCOUNT * 100).toFixed(0)}%
              - Pagamento recorrente no cartão: -${(CARD_DISCOUNT * 100).toFixed(0)}%
              - Trabalha na área (apenas Pós): -${(AREA_DISCOUNT * 100).toFixed(0)}%
              - Urgência (lote a ≤7 dias do fechamento): -${(URGENCY_DISCOUNT * 100).toFixed(0)}%

              O fechamento do lote atual está previsto para ${BATCH_CLOSING_DATE.toISOString().slice(0, 10)}.

              Qual método de desconto você deseja aplicar? Ou digite "pular" para prosseguir"
              `;
            step = 9;
          } else {
            systemPrompt += 'Não use saudações, se exister no catalogo sugira até 3 cursos informando nome, nível, área e preço deste catálogo: ' + JSON.stringify(courses) + ' não invente nenhuma informação. Quebre um linha e diga "Por favor informe o nome do curso em que deseja se matricular"';
          }
          break;
        }
        case 9: {

          let discountType = null;
          const sevenDaysBeforeClosing = new Date(BATCH_CLOSING_DATE);
          sevenDaysBeforeClosing.setDate(sevenDaysBeforeClosing.getDate() - 7);

          systemPrompt = "Não use saudações. Pergunte de forma natural e objetiva se o cliente seja aplicar mais algum desconto. Finalize perguntando de forma natural se o cliente deseja aplicar algum método de desconto, solicitando que o cliente responda o nome do desconto ou a palavra 'Não'";

          if (message.includes('amigo') || message.includes('indicacao')) {
            discountType = 'friend';
          }
          if (message.includes('cartao') || message.includes('pagamento') || message.includes('recorrente')) {
            discountType = 'card';
          }
          if (message.includes('area') || message.includes('trabalha') || message.includes('trabalho') || message.includes('pos')) {
            if (userSession.courseLevel === 'pos') {
              discountType = 'area';
            } else {
              systemPrompt = "Não use saudações, responda objetivamente que o tipo de desconto é para somente pós-graduações. Finalize perguntando de forma natural se o cliente deseja aplicar algum método de desconto, solicitando que o cliente responda o nome do desconto ou a palavra 'Não'";
            }
          }
          if (message.includes('urgencia') || message.includes('lote') || message.includes('fechamento') || message.includes('7 dias')) {
            if (TODAY >= sevenDaysBeforeClosing && TODAY <= BATCH_CLOSING_DATE) {
              discountType = 'urgency';
            } else {
              systemPrompt = "Não use saudações, responda objetivamente que a data de hoje está fora da oferta. Finalize perguntando de forma natural se o cliente deseja aplicar algum método de desconto, solicitando que o cliente responda o nome do desconto ou a palavra 'Não'";
            }
          }
          if (!userSession.discountTypes.includes(discountType) && discountType) {
            userSession.discountTypes.push(discountType);
          } else if (discountType && userSession.discountTypes.includes(discountType)) {
            systemPrompt = "Não use saudações, responda objetivamente que o cliente ja aplicou esse desconto. Finalize perguntando de forma natural se o cliente deseja aplicar algum método de desconto, solicitando que o cliente responda o nome do desconto ou a palavra 'Não'";
          }
          if (message.includes('nao') || userSession.discountTypes.length > 3 || message.includes('pular')) {
            if (userSession.courseID) {
              const courses = getCourses(userSession.courseLevel, userSession.courseArea);
              const priced = calculateDiscount(
                courses[0].preco_base,
                userSession.discountTypes,
                userSession.courseLevel
              )
              if (userSession.discountTypes.length > 0) {
                systemPrompt = `Não use saudações. Diga algo como: "Com os descontos aplicados, o valor do curso passa de R$ ${courses[0].preco_base.toFixed(2)} para R$ ${priced.finalPrice}, representando um total de ${priced.totalDiscountPercent} de desconto. Finalize perguntando se ele deseja finalizar a matricula ou falar com um atendente"`;
              } else {
                systemPrompt = `Não use saudações. Diga algo como: "O valor do curso fica de R$ ${priced.finalPrice}. Finalize perguntando se ele deseja finalizar a matricula ou falar com um atendente"`;
              }
              userSession.courseFinalPrice = priced.finalPrice;
              
              step = 10;
            }
          }
          break;
        }
        case 10: {
          systemPrompt += 'Não use saudações. Pergunte de forma objetiva se o cliente deseja prosseguir com a matrícula ou prefere falar com um atendente humano para mais detalhes.';
          if (!userSession.leadSended) {
          try {
              const lead = {
                  origin: 'chatbot',
                  name: userSession.name,
                  cpf: userSession.cpf,
                  phone: userSession.phone,
                  address: userSession.address,
                  courseName: userSession.courseName,
                  courseLevel: userSession.courseLevel,
                  discountTypes: userSession.discountTypes,
                  courseFinalPrice: userSession.courseFinalPrice,
                  time: TODAY.toISOString(),
                };
                const response = await fetch(WEBHOOK_LINK, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(lead),
                });
                userSession.leadSended = true;
              } catch (error) {
                console.error("Error sending lead to webhook:", error.message);
              }
            }
          if (message.includes('falar') || message.includes('atendente')) {
              systemPrompt = `Responda de forma objetiva ao cliente "${userSession.name}", informando que seus dados foram encaminhados a um atendente humano e que em instantes alguém entrará em contato para concluir a matrícula.`;


              const randomAgent = ["Marcos", "Carla", "Fernanda", "Rafael", "Paula", "João"];
              const agentName = randomAgent[Math.floor(Math.random() * randomAgent.length)];

              systemPrompt += `Agora finja ser um atendente humano chamado ${agentName}, dando uma saudação natural e simpática para iniciar o atendimento de matrícula. Finalize quebrando uma linha e exibindo o link ${webhookViewUrl()}}`;
            // step = 11;
          } else if (message.includes('prosseguir') || message.includes('matricula') || message.includes('finalizar')) {
            const link = `https://vitrinedecursosteste.com/finalizar-matricula?curso=${encodeURIComponent(userSession.courseID)}&cpf=${userSession.cpf}`;
              systemPrompt = `Informe o cliente de nome "${userSession.name}" que ele pode pode concluir sua matrícula no link ${link}. Finalize quebrando uma linha e exibindo o link ${webhookViewUrl()}}`;
            //step = 12;
          }
          break;
        } case 20: {
            systemPrompt += "Agradeça pela o cliente e deseje uma boa semana";
          break;
        } default: {
          systemPrompt += 'Continue o atendimento, oferecendo condições de desconto e perguntando se quer falar com um atendente.';
          break;
        }
      }
      userSession.step = step;
     


    }
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];
    userSession.messages = messages;
    const completion = await OPENAI.chat.completions.create({
      model: 'gpt-4o-mini',
      messages
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ops! Parece que houve algum erro.' });
  }
});

async function getHolidays(year) {
  try {
    const response = await fetch('https://brasilapi.com.br/api/feriados/v1/' + year);
    return await response.json();
  } catch (e) {
    console.log('Erro ao buscar feriados:', e.message);
    return [];
  }
}

function isPhoneNumber(phone) {
  const normalizedPhone = phone.replace(/\D/g, '');
  const phoneRegex = /^(\d{10,11})$/;
  return phoneRegex.test(normalizedPhone);
}

async function getAddressViaZipCode(zipCode) {
  try {
    const normalizedZipCode = zipCode.replace(/\D/g, '');
    const response = await fetch('https://viacep.com.br/ws/' + normalizedZipCode + '/json/');
    const data = await response.json();
    if (data.erro) {
      return null;
    }
    return {
      zipCode: data.cep,
      street: data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf
    };
  } catch (e) {
    console.log('Erro ao buscar CEP:', e.message);
    return null;
  }
}

function isZipCode(zipCodeInput) {
  const match = zipCodeInput.match(/\b\d{5}-?\d{3}\b/);
  if (match) {
    return match[0];
  }
  return null;
}

function getCourses(courseLevel, courseArea) {
  return CATALOG
    .filter(c =>
      c.nivel === courseLevel &&
      c.area.toLowerCase() === courseArea.toLowerCase()
    )
    .slice(0, 3);
}


async function sendLead(payload) {
  console.log('Lead recebido (aqui você enviaria pro seu endpoint):', payload);
}

function isCPF(value) {
  if (!value) {
    return false;
  }
  const cpfFormatRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;
  return cpfFormatRegex.test(value.trim());
}

function validateCPF(cpf) {
  cpf = cpf.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(9))) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  return remainder === parseInt(cpf.charAt(10));
}

async function checkHolidays() {
  const holidays = await getHolidays(TODAY.getFullYear());
  const todayDate = new Date(TODAY.toISOString().slice(0, 10));
  const limitDate = new Date(todayDate);
  limitDate.setDate(limitDate.getDate() + 3);

  const upcoming = holidays
    .map(h => ({ ...h, dateObj: new Date(h.date) }))
    .filter(h => h.dateObj >= todayDate && h.dateObj <= limitDate);

  return upcoming.length > 0;
}

function calculateDiscount(basePrice, discountTypes, courseLevel) {
  const discounts = {
    friend: FRIEND_DISCOUNT,
    card: CARD_DISCOUNT,
    area: AREA_DISCOUNT,
    urgency: URGENCY_DISCOUNT
  };

  let totalDiscount = 0;
  for (const type of discountTypes) {
    if (type === 'area' && courseLevel !== 'pos') continue;
    totalDiscount += discounts[type] || 0;
  }
  if (totalDiscount > 0.20) {
    totalDiscount = 0.20;
  }

  const finalPrice = basePrice * (1 - totalDiscount);
  return {
    basePrice,
    totalDiscountPercent: (totalDiscount * 100).toFixed(1) + '%',
    finalPrice: finalPrice.toFixed(2)
  };
}
function webhookViewUrl() {
  const base = "https://webhook.site/#!/view/";
  const parts = WEBHOOK_LINK.split("/");
  const id = parts[parts.length - 1]; // b4cc710e-d145-4aa3-95c3-64dd19a77a55
  return base + id;
}

function resetSession(userId) {
  if (SESSIONS[userId]) {
    delete SESSIONS[userId];
  }
}

APP.post('/reset-session', (req, res) => {
  const userId = req.body.clientId || req.ip;
  resetSession(userId);
  res.json({ success: true });
});



const PORT = process.env.PORT || 8080;
APP.listen(PORT, () => console.log('Servidor conectado na porta ' + PORT));