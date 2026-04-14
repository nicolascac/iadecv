// 1. Importações
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require('mongoose'); // IMPORTAÇÃO DO BANCO DE DADOS

// 2. Configurações
const app = express();
app.use(express.json());
app.use(cors());

// 3. Conexão com o MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('📦 Conectado ao MongoDB Atlas com sucesso!'))
  .catch((err) => console.error('❌ Erro ao conectar no banco:', err));

// 4. Definindo a "Tabela" (Schema e Model) do Mongoose
const MensagemSchema = new mongoose.Schema({
    role: String, // 'user' (usuário) ou 'model' (IA)
    parts: [{ text: String }], // O conteúdo da mensagem
    dataHora: { type: Date, default: Date.now } // Hora exata
});
const Mensagem = mongoose.model('Mensagem', MensagemSchema);

// 5. Configuração da IA
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Rota de Status - Teste no Navegador
app.get('/api/status', (req, res) => {
    res.json({ status: "Servidor Online e com Memória de Elefante! 🐘🚀" });
});

// 6. Rota do Chat (POST) - AGORA COM MEMÓRIA
app.post('/api/chat', async (req, res) => {
    try {
        const { pergunta } = req.body;

        if (!pergunta) {
            return res.status(400).json({ erro: "Envie uma 'pergunta' no JSON." });
        }

        console.log(`📩 Pergunta recebida: ${pergunta}`);

        // A) Salva a pergunta do usuário no Banco de Dados
        await Mensagem.create({ role: "user", parts: [{ text: pergunta }] });

        // B) Busca o histórico de conversas no Banco (limitado às últimas 20 mensagens)
        // Ocultamos o _id e dataHora, pois o Gemini só quer saber de 'role' e 'parts'
        const historico = await Mensagem.find()
                                        .select('role parts -_id') 
                                        .sort({ dataHora: 1 })
                                        .limit(20);

        // C) Inicia o chat do Gemini, ENVIANDO O HISTÓRICO JUNTO
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const chat = model.startChat({
            history: historico // A MÁGICA ACONTECE AQUI! O Gemini lê isso e "lembra".
        });

        // D) Manda a nova pergunta para a IA dentro do contexto do chat
        const result = await chat.sendMessage(pergunta);
        const respostaDaIA = result.response.text();

        // E) Salva a resposta da IA no Banco de Dados para a próxima conversa
        await Mensagem.create({ role: "model", parts: [{ text: respostaDaIA }] });

        // F) Devolve a resposta para o Front-end
        return res.status(200).json({ 
            sucesso: true,
            resposta: respostaDaIA 
        });

    } catch (erro) {
        console.error("❌ Erro:", erro);
        res.status(500).json({ erro: "Amnésia do servidor. Erro na IA ou no Banco de Dados." });
    }
});

// 7. DESAFIO HACKER: Rota para apagar a memória (DELETE)
app.delete('/api/chat/limpar', async (req, res) => {
    try {
        // Deleta todos os documentos da Collection 'Mensagem'
        await Mensagem.deleteMany({});
        console.log("🧹 Memória apagada com sucesso!");
        
        return res.status(200).json({ sucesso: true, mensagem: "Memória formatada! A IA esqueceu tudo." });
    } catch (erro) {
        console.error("❌ Erro ao apagar memória:", erro);
        res.status(500).json({ erro: "Não foi possível apagar a memória." });
    }
});

// 8. Ligar o Servidor
const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
    console.log(`✅ Servidor rodando na porta ${PORTA}`);
});