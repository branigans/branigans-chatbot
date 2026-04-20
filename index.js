const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const VERIFY_TOKEN = "branigans2024";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `Eres el asistente virtual oficial de Branigans Authentic, marca mexicana de ropa originaria de Guadalajara, Jalisco. Instagram: @branigans_authentic. Web: www.branigans.mx.

Responde SIEMPRE en español. Sé cálido, breve y profesional, como en WhatsApp. Usa emojis con moderación.

INFORMACIÓN CLAVE:
- Marca 100% de Guadalajara, Jalisco, México.
- Producto estrella: CAMISAS — incluyendo línea de bambú premium.
- Catálogo: camisas, playeras, pantalones, accesorios de moda.
- Tallas: desde Chica (S) hasta 5XL — inclusivo para todos.
- Envíos a los 32 estados de la República Mexicana (3-5 días hábiles).
- Sucursal: Calle General Carlos Fuero 262, Zona Medrano, Guadalajara, Jalisco.
- Horario: Martes a Sábado 10:00am–7:00pm / Domingos 10:30am–3:00pm / Lunes cerrado.

FLUJO MENUDEO (compra personal, regalo o amigos):
- Invítalos a www.branigans.mx
- Menciona que pueden visitar la sucursal con dirección y horario.

FLUJO MAYOREO (tienen tienda y quieren revender):
- Pide en un solo mensaje: nombre completo, estado de la República y nombre de su tienda.
- Una vez que tengas los 3 datos confirma: tallas S a 5XL, envíos a 32 estados, precios según volumen, asesor los contactará pronto.

REGLAS:
- Nunca inventes precios de mayoreo.
- Menudeo → www.branigans.mx
- Mayoreo → captura 3 datos primero.
- Si no sabes algo → un asesor los atenderá.`;

const conversationHistory = {};

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message || message.type !== "text") return;
    const from = message.from;
    const text = message.text.body;
    if (!conversationHistory[from]) conversationHistory[from] = [];
    conversationHistory[from].push({ role: "user", content: text });
    if (conversationHistory[from].length > 20) {
      conversationHistory[from] = conversationHistory[from].slice(-20);
    }
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: conversationHistory[from],
      },
      {
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      }
    );
    const reply = response.data.content[0].text;
    conversationHistory[from].push({ role: "assistant", content: reply });
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        type: "text",
        text: { body: reply },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
});

app.get("/", (req, res) => res.send("Branigans Chatbot activo"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
