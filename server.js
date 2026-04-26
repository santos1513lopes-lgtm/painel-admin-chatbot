const express = require('express');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ================= CONFIG =================
const urlAcessos = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTkKOq4I2d3sxQe9JRxHdaWBYg4bkEkYzU-JRB43TFo0RhqXNC2UmNkkIdfpxUoUtNug9Zk7ZiSACXI/pub?gid=0&single=true&output=csv';

const urlRespostas = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT0jpFV50k9Ju50f_0jiWPLNAuKkDid4nwyrLl6AyYHTKCMKV95A04fL_-aNl5uHrjobXWeikTu1B0B/pub?gid=1636028158&single=true&output=csv';

const urlApiBot = 'http://localhost:4000/enviar-material';

const pastaUploads = path.join(__dirname, 'uploads');
const arquivoAgendamentos = path.join(__dirname, 'agendamentos.json');

if (!fs.existsSync(pastaUploads)) fs.mkdirSync(pastaUploads);
if (!fs.existsSync(arquivoAgendamentos)) fs.writeFileSync(arquivoAgendamentos, '[]');

// ================= UPLOAD =================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, pastaUploads),
    filename: (req, file, cb) => {
        const nome = file.originalname
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9._-]/g, '');

        cb(null, Date.now() + '_' + nome);
    }
});

const upload = multer({ storage });

// ================= FUNÇÕES =================
const parseCSV = (data) => {
    const linhas = data.split('\n').slice(1);
    return linhas
        .filter(l => l.trim() !== '')
        .map(l => l.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim()));
};

const listarArquivos = () => {
    if (!fs.existsSync(pastaUploads)) return [];
    return fs.readdirSync(pastaUploads);
};

const lerAgendamentos = () => {
    try {
        return JSON.parse(fs.readFileSync(arquivoAgendamentos, 'utf8'));
    } catch {
        return [];
    }
};

const salvarAgendamentos = (dados) => {
    fs.writeFileSync(arquivoAgendamentos, JSON.stringify(dados, null, 2));
};

const formatarTelefones = (texto) => {
    return texto
        .split('\n')
        .map(linha => linha.trim())
        .filter(Boolean)
        .map(linha => {
            const partes = linha.split('|');
            return {
                nome: partes[0]?.trim() || 'Aluno',
                telefone: (partes[1] || partes[0] || '').replace(/\D/g, '')
            };
        })
        .filter(a => a.telefone);
};

const enviarParaBot = async ({ nome, telefone, mensagem, materiais }) => {
    return axios.post(urlApiBot, {
        nome,
        telefone,
        mensagem,
        materiais
    });
};

const layout = (conteudo) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Painel</title>

<style>
body { margin:0; font-family:Arial; background:#f4f6f8; color:#111827; }
.container { display:flex; min-height:100vh; }
.sidebar {
    width:220px;
    background:#111827;
    color:white;
    padding:20px;
}
.sidebar a {
    display:block;
    color:#ccc;
    text-decoration:none;
    padding:10px;
    border-radius:8px;
    margin-bottom:6px;
}
.sidebar a:hover { background:#1f2937; color:white; }

.main { flex:1; padding:30px; }

.card {
    background:white;
    padding:20px;
    border-radius:10px;
    margin-bottom:20px;
    box-shadow:0 4px 14px rgba(0,0,0,0.08);
}

table {
    width:100%;
    border-collapse:collapse;
    background:white;
    border-radius:10px;
    overflow:hidden;
    box-shadow:0 4px 14px rgba(0,0,0,0.08);
}

th {
    background:#2563eb;
    color:white;
    padding:10px;
    text-align:left;
}

td {
    padding:10px;
    border-bottom:1px solid #eee;
}

input, textarea, select {
    width:100%;
    padding:10px;
    margin-top:6px;
    margin-bottom:14px;
    border:1px solid #d1d5db;
    border-radius:8px;
    font-size:14px;
    box-sizing:border-box;
}

textarea { min-height:120px; }

button, .btn {
    padding:10px 16px;
    background:#2563eb;
    color:white;
    border:none;
    border-radius:8px;
    cursor:pointer;
    font-weight:bold;
    text-decoration:none;
    display:inline-block;
}

button:hover, .btn:hover { background:#1d4ed8; }

.print-btn { margin-top:20px; }

.sucesso {
    background:#dcfce7;
    color:#166534;
    padding:12px;
    border-radius:8px;
    margin-bottom:16px;
}

.erro {
    background:#fee2e2;
    color:#991b1b;
    padding:12px;
    border-radius:8px;
    margin-bottom:16px;
}

.info {
    background:#e0f2fe;
    color:#075985;
    padding:12px;
    border-radius:8px;
    margin-bottom:16px;
}

.status-pendente {
    background:#fef3c7;
    color:#92400e;
    padding:6px 10px;
    border-radius:999px;
    font-weight:bold;
}

.status-enviado {
    background:#dcfce7;
    color:#166534;
    padding:6px 10px;
    border-radius:999px;
    font-weight:bold;
}

.status-erro {
    background:#fee2e2;
    color:#991b1b;
    padding:6px 10px;
    border-radius:999px;
    font-weight:bold;
}

@media print {
    .sidebar, .print-btn, .btn { display:none; }
    body { background:white; }
    .main { padding:0; }
}
</style>

</head>

<body>
<div class="container">

<div class="sidebar">
<h2>🤖 Chatbot</h2>
<a href="/">📊 Dashboard</a>
<a href="/acessos">👨‍🎓 Acessos</a>
<a href="/respostas">💬 Respostas</a>
<a href="/upload">📁 Upload</a>
<a href="/enviar">📤 Enviar material</a>
<a href="/agenda">📅 Agendamentos</a>
</div>

<div class="main">
${conteudo}
</div>

</div>
</body>
</html>
`;

// ================= ROTAS =================

// DASHBOARD
app.get('/', async (req, res) => {
    try {
        const r = await axios.get(urlAcessos);
        const dados = parseCSV(r.data);
        const agendamentos = lerAgendamentos();

        const conteudo = `
        <h1>📊 Dashboard</h1>

        <div class="card">
            Total de acessos: <strong>${dados.length}</strong><br>
            Agendamentos: <strong>${agendamentos.length}</strong>
        </div>

        <table>
        <tr><th>Data</th><th>Nome</th><th>Telefone</th><th>Materiais</th><th>Status</th></tr>
        ${dados.slice(-10).reverse().map(l => `
            <tr>
            <td>${l[0] || ''}</td>
            <td>${l[1] || ''}</td>
            <td>${l[2] || ''}</td>
            <td>${l[3] || ''}</td>
            <td>${l[4] || ''}</td>
            </tr>
        `).join('')}
        </table>
        `;

        res.send(layout(conteudo));

    } catch (error) {
        res.send(layout(`<h1>Erro</h1><p>${error.message}</p>`));
    }
});

// ACESSOS
app.get('/acessos', async (req, res) => {
    try {
        const r = await axios.get(urlAcessos);
        const dados = parseCSV(r.data);

        const conteudo = `
        <h1>👨‍🎓 Acessos</h1>

        <table>
        <tr><th>Data</th><th>Nome</th><th>Telefone</th><th>Materiais</th><th>Status</th></tr>
        ${dados.reverse().map(l => `
            <tr>
            <td>${l[0] || ''}</td>
            <td>${l[1] || ''}</td>
            <td>${l[2] || ''}</td>
            <td>${l[3] || ''}</td>
            <td>${l[4] || ''}</td>
            </tr>
        `).join('')}
        </table>

        <button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>
        `;

        res.send(layout(conteudo));
    } catch (error) {
        res.send(layout(`<h1>Erro ao carregar acessos</h1><p>${error.message}</p>`));
    }
});

// RESPOSTAS
app.get('/respostas', async (req, res) => {
    try {
        const r = await axios.get(urlRespostas);
        const dados = parseCSV(r.data);

        const conteudo = `
        <h1>💬 Respostas</h1>

        <table>
        <tr><th>Gatilho</th><th>Resposta</th><th>Status</th></tr>
        ${dados.map(l => `
            <tr>
            <td>${l[0] || ''}</td>
            <td>${l[1] || ''}</td>
            <td>${l[2] || ''}</td>
            </tr>
        `).join('')}
        </table>

        <button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>
        `;

        res.send(layout(conteudo));
    } catch (error) {
        res.send(layout(`<h1>Erro ao carregar respostas</h1><p>${error.message}</p>`));
    }
});

// UPLOAD
app.get('/upload', (req, res) => {
    const arquivos = listarArquivos();

    const conteudo = `
    <h1>📁 Upload de arquivos</h1>

    <div class="card">
        <form action="/upload" method="POST" enctype="multipart/form-data">
            <label><strong>Escolha o arquivo</strong></label>
            <input type="file" name="arquivo" required>
            <button type="submit">⬆️ Enviar</button>
        </form>
    </div>

    <h2>Arquivos enviados</h2>

    <table>
    <tr><th>Nome</th><th>Caminho</th></tr>
    ${arquivos.map(a => `
        <tr>
        <td>${a}</td>
        <td>uploads/${a}</td>
        </tr>
    `).join('')}
    </table>
    `;

    res.send(layout(conteudo));
});

app.post('/upload', upload.single('arquivo'), (req, res) => {
    res.redirect('/upload');
});

// ENVIAR MATERIAL IMEDIATO
app.get('/enviar', (req, res) => {
    const arquivos = listarArquivos();

    const mensagem = req.query.sucesso
        ? `<div class="sucesso">✅ Material enviado com sucesso!</div>`
        : req.query.erro
            ? `<div class="erro">❌ Erro ao enviar: ${req.query.erro}</div>`
            : `<div class="info">Digite o telefone com DDI e DDD. Exemplo: 557599999999</div>`;

    const conteudo = `
    <h1>📤 Enviar material pelo painel</h1>

    ${mensagem}

    <div class="card">
        <form action="/enviar" method="POST">
            <label><strong>Nome do aluno</strong></label>
            <input type="text" name="nome" placeholder="Ex: João Silva" required>

            <label><strong>Telefone WhatsApp</strong></label>
            <input type="text" name="telefone" placeholder="Ex: 557599999999" required>

            <label><strong>Mensagem inicial</strong></label>
            <textarea name="mensagem">Olá! Seguem seus materiais. 📚</textarea>

            <label><strong>Materiais</strong></label>
            <select name="materiais" multiple size="8">
                ${arquivos.map(a => `<option value="${a}">${a}</option>`).join('')}
            </select>

            <p><small>Segure CTRL para selecionar mais de um arquivo.</small></p>

            <button type="submit">📤 Enviar agora</button>
        </form>
    </div>
    `;

    res.send(layout(conteudo));
});

app.post('/enviar', async (req, res) => {
    try {
        let { nome, telefone, mensagem, materiais } = req.body;

        telefone = telefone.replace(/\D/g, '');

        if (!Array.isArray(materiais)) {
            materiais = materiais ? [materiais] : [];
        }

        await enviarParaBot({ nome, telefone, mensagem, materiais });

        res.redirect('/enviar?sucesso=1');

    } catch (error) {
        const detalhe = error.response?.data?.erro || error.message;
        res.redirect('/enviar?erro=' + encodeURIComponent(detalhe));
    }
});

// ================= AGENDAMENTOS =================

app.get('/agenda', (req, res) => {
    const agendamentos = lerAgendamentos();

    const conteudo = `
    <h1>📅 Agendamentos</h1>

    <p>
        <a class="btn" href="/agenda/novo">➕ Novo agendamento</a>
    </p>

    <table>
    <tr>
        <th>Nome</th>
        <th>Data/Hora</th>
        <th>Alunos</th>
        <th>Materiais</th>
        <th>Status</th>
        <th>Ação</th>
    </tr>

    ${agendamentos.map(a => `
        <tr>
            <td>${a.nome}</td>
            <td>${a.dataHora}</td>
            <td>${a.alunos.length}</td>
            <td>${a.materiais.join('; ')}</td>
            <td><span class="status-${a.status}">${a.status}</span></td>
            <td>
                <form action="/agenda/excluir/${a.id}" method="POST" onsubmit="return confirm('Excluir agendamento?')">
                    <button type="submit">Excluir</button>
                </form>
            </td>
        </tr>
    `).join('')}
    </table>
    `;

    res.send(layout(conteudo));
});

app.get('/agenda/novo', (req, res) => {
    const arquivos = listarArquivos();

    const conteudo = `
    <h1>➕ Novo agendamento</h1>

    <div class="card">
        <form action="/agenda/novo" method="POST">
            <label><strong>Nome do agendamento</strong></label>
            <input type="text" name="nome" placeholder="Ex: Envio Aula 15" required>

            <label><strong>Data e hora do envio</strong></label>
            <input type="datetime-local" name="dataHora" required>

            <label><strong>Mensagem</strong></label>
            <textarea name="mensagem">Olá! Seguem seus materiais. 📚</textarea>

            <label><strong>Alunos / Telefones</strong></label>
            <textarea name="alunos" placeholder="Um por linha. Ex:
João Silva | 557599999999
Maria Souza | 557588888888" required></textarea>

            <label><strong>Materiais</strong></label>
            <select name="materiais" multiple size="8">
                ${arquivos.map(a => `<option value="${a}">${a}</option>`).join('')}
            </select>

            <p><small>Segure CTRL para selecionar mais de um arquivo.</small></p>

            <button type="submit">💾 Salvar agendamento</button>
        </form>
    </div>
    `;

    res.send(layout(conteudo));
});

app.post('/agenda/novo', (req, res) => {
    let { nome, dataHora, mensagem, alunos, materiais } = req.body;

    if (!Array.isArray(materiais)) {
        materiais = materiais ? [materiais] : [];
    }

    const agendamentos = lerAgendamentos();

    agendamentos.push({
        id: Date.now().toString(),
        nome,
        dataHora,
        mensagem,
        alunos: formatarTelefones(alunos),
        materiais,
        status: 'pendente',
        criadoEm: new Date().toISOString(),
        enviadoEm: null,
        erro: null
    });

    salvarAgendamentos(agendamentos);

    res.redirect('/agenda');
});

app.post('/agenda/excluir/:id', (req, res) => {
    const agendamentos = lerAgendamentos().filter(a => a.id !== req.params.id);
    salvarAgendamentos(agendamentos);
    res.redirect('/agenda');
});

// ================= EXECUTOR DE AGENDAMENTOS =================

const executarAgendamentos = async () => {
    const agora = new Date();
    const agendamentos = lerAgendamentos();
    let alterou = false;

    for (const agendamento of agendamentos) {
        if (agendamento.status !== 'pendente') continue;

        const dataAgendada = new Date(agendamento.dataHora);

        if (dataAgendada <= agora) {
            console.log(`⏰ Executando agendamento: ${agendamento.nome}`);

            try {
                for (const aluno of agendamento.alunos) {
                    await enviarParaBot({
                        nome: aluno.nome,
                        telefone: aluno.telefone,
                        mensagem: agendamento.mensagem,
                        materiais: agendamento.materiais
                    });

                    await new Promise(resolve => setTimeout(resolve, 5000));
                }

                agendamento.status = 'enviado';
                agendamento.enviadoEm = new Date().toISOString();
                agendamento.erro = null;

            } catch (error) {
                agendamento.status = 'erro';
                agendamento.erro = error.response?.data?.erro || error.message;
                console.error('Erro no agendamento:', agendamento.erro);
            }

            alterou = true;
        }
    }

    if (alterou) {
        salvarAgendamentos(agendamentos);
    }
};

setInterval(executarAgendamentos, 30000);

// START
app.listen(PORT, () => {
    console.log('Rodando em http://localhost:3000');
    console.log('📅 Agendador ativo: verificando a cada 30 segundos');
});