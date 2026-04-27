const express = require('express');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ================= LOGIN =================
const ADMIN_USER = 'admin';
const ADMIN_PASS = '123456'; // TROQUE DEPOIS

const sessoes = new Set();

const proteger = (req, res, next) => {
    if (req.path === '/login') return next();

    const cookie = req.headers.cookie || '';
    const token = cookie.split(';').find(c => c.trim().startsWith('sessao='))?.split('=')[1];

    if (token && sessoes.has(token)) return next();

    res.redirect('/login');
};

app.use(proteger);

// ================= CONFIG =================
const urlAcessos = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTkKOq4I2d3sxQe9JRxHdaWBYg4bkEkYzU-JRB43TFo0RhqXNC2UmNkkIdfpxUoUtNug9Zk7ZiSACXI/pub?gid=0&single=true&output=csv';

const urlRespostas = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT0jpFV50k9Ju50f_0jiWPLNAuKkDid4nwyrLl6AyYHTKCMKV95A04fL_-aNl5uHrjobXWeikTu1B0B/pub?gid=1636028158&single=true&output=csv';

const urlApiBot = 'http://localhost:4000/enviar-material';

const uploadDir = path.join(process.env.HOME, 'uploads');
const arquivoAgendamentos = path.join(__dirname, 'agendamentos.json');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(arquivoAgendamentos)) fs.writeFileSync(arquivoAgendamentos, '[]');

// ================= UPLOAD =================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
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

const listarArquivos = () => fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];

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
        .map(l => l.trim())
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
    return axios.post(urlApiBot, { nome, telefone, mensagem, materiais });
};

const layout = (conteudo) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Painel Chatbot</title>
<style>
body { margin:0; font-family:Arial, sans-serif; background:#f4f6f8; color:#111827; }
.container { display:flex; min-height:100vh; }
.sidebar { width:240px; background:#111827; color:white; padding:24px 18px; }
.sidebar h2 { margin-bottom:30px; }
.sidebar a { display:block; color:#d1d5db; text-decoration:none; padding:12px; border-radius:8px; margin-bottom:8px; }
.sidebar a:hover { background:#1f2937; color:white; }
.main { flex:1; padding:32px; }
.card { background:white; padding:22px; border-radius:14px; box-shadow:0 4px 14px rgba(0,0,0,.08); margin-bottom:22px; }
.cards { display:flex; gap:20px; flex-wrap:wrap; }
.card strong { font-size:28px; display:block; margin-top:8px; }
table { width:100%; border-collapse:collapse; background:white; border-radius:14px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,.08); }
th { background:#2563eb; color:white; text-align:left; padding:14px; }
td { padding:13px; border-bottom:1px solid #e5e7eb; }
input, textarea, select { width:100%; padding:11px; margin:7px 0 16px; border:1px solid #d1d5db; border-radius:8px; box-sizing:border-box; }
textarea { min-height:110px; }
button, .btn { background:#2563eb; color:white; border:none; padding:11px 17px; border-radius:8px; font-weight:bold; cursor:pointer; text-decoration:none; display:inline-block; }
button:hover, .btn:hover { background:#1d4ed8; }
.sucesso { background:#dcfce7; color:#166534; padding:12px; border-radius:8px; margin-bottom:16px; }
.erro { background:#fee2e2; color:#991b1b; padding:12px; border-radius:8px; margin-bottom:16px; }
.info { background:#e0f2fe; color:#075985; padding:12px; border-radius:8px; margin-bottom:16px; }
.status-pendente { background:#fef3c7; color:#92400e; padding:6px 10px; border-radius:999px; font-weight:bold; }
.status-enviado { background:#dcfce7; color:#166534; padding:6px 10px; border-radius:999px; font-weight:bold; }
.status-erro { background:#fee2e2; color:#991b1b; padding:6px 10px; border-radius:999px; font-weight:bold; }
@media print { .sidebar, .btn, button { display:none; } .main { padding:0; } }
</style>
</head>
<body>
<div class="container">
<aside class="sidebar">
<h2>🤖 Chatbot Admin</h2>
<a href="/">📊 Dashboard</a>
<a href="/acessos">👨‍🎓 Acessos</a>
<a href="/respostas">💬 Respostas</a>
<a href="/upload">📁 Upload</a>
<a href="/enviar">📤 Enviar material</a>
<a href="/agenda">📅 Agendamentos</a>
<a href="/login?logout=1">🚪 Sair</a>
</aside>
<main class="main">${conteudo}</main>
</div>
</body>
</html>
`;

// ================= LOGIN =================
app.get('/login', (req, res) => {
    if (req.query.logout) {
        res.setHeader('Set-Cookie', 'sessao=; Max-Age=0; Path=/');
    }

    res.send(`
    <html><head><meta charset="UTF-8"><title>Login</title>
    <style>
    body{font-family:Arial;background:#111827;display:flex;justify-content:center;align-items:center;height:100vh}
    form{background:white;padding:30px;border-radius:14px;width:320px}
    input{width:100%;padding:12px;margin:8px 0;border:1px solid #ddd;border-radius:8px}
    button{width:100%;padding:12px;background:#2563eb;color:white;border:0;border-radius:8px;font-weight:bold}
    </style></head>
    <body>
    <form method="POST" action="/login">
        <h2>🤖 Login do Painel</h2>
        <input name="usuario" placeholder="Usuário" required>
        <input name="senha" type="password" placeholder="Senha" required>
        <button>Entrar</button>
    </form>
    </body></html>
    `);
});

app.post('/login', (req, res) => {
    const { usuario, senha } = req.body;

    if (usuario === ADMIN_USER && senha === ADMIN_PASS) {
        const token = crypto.randomBytes(24).toString('hex');
        sessoes.add(token);
        res.setHeader('Set-Cookie', `sessao=${token}; Path=/; HttpOnly`);
        return res.redirect('/');
    }

    res.send('<h2>Login inválido</h2><a href="/login">Voltar</a>');
});

// ================= ROTAS =================
app.get('/', async (req, res) => {
    try {
        const r = await axios.get(urlAcessos);
        const acessos = parseCSV(r.data);
        const agendamentos = lerAgendamentos();

        const conteudo = `
        <h1>📊 Dashboard</h1>
        <div class="cards">
            <div class="card"><span>Total de acessos</span><strong>${acessos.length}</strong></div>
            <div class="card"><span>Agendamentos</span><strong>${agendamentos.length}</strong></div>
            <div class="card"><span>Pasta compartilhada</span><strong style="font-size:16px">${uploadDir}</strong></div>
        </div>

        <h2>Últimos acessos</h2>
        <table>
        <tr><th>Data</th><th>Nome</th><th>Telefone</th><th>Materiais</th><th>Status</th></tr>
        ${acessos.slice(-10).reverse().map(l => `
            <tr><td>${l[0] || ''}</td><td>${l[1] || ''}</td><td>${l[2] || ''}</td><td>${l[3] || ''}</td><td>${l[4] || ''}</td></tr>
        `).join('')}
        </table>
        `;

        res.send(layout(conteudo));
    } catch (error) {
        res.send(layout(`<h1>Erro</h1><p>${error.message}</p>`));
    }
});

app.get('/acessos', async (req, res) => {
    const r = await axios.get(urlAcessos);
    const dados = parseCSV(r.data);

    res.send(layout(`
    <h1>👨‍🎓 Acessos</h1>
    <table>
    <tr><th>Data</th><th>Nome</th><th>Telefone</th><th>Materiais</th><th>Status</th></tr>
    ${dados.reverse().map(l => `<tr><td>${l[0]}</td><td>${l[1]}</td><td>${l[2]}</td><td>${l[3]}</td><td>${l[4]}</td></tr>`).join('')}
    </table><br>
    <button onclick="window.print()">🖨️ Imprimir / PDF</button>
    `));
});

app.get('/respostas', async (req, res) => {
    const r = await axios.get(urlRespostas);
    const dados = parseCSV(r.data);

    res.send(layout(`
    <h1>💬 Respostas</h1>
    <table>
    <tr><th>Gatilho</th><th>Resposta</th><th>Status</th></tr>
    ${dados.map(l => `<tr><td>${l[0]}</td><td>${l[1]}</td><td>${l[2]}</td></tr>`).join('')}
    </table><br>
    <button onclick="window.print()">🖨️ Imprimir / PDF</button>
    `));
});

app.get('/upload', (req, res) => {
    const arquivos = listarArquivos();

    res.send(layout(`
    <h1>📁 Upload de arquivos</h1>
    <div class="card">
        <form action="/upload" method="POST" enctype="multipart/form-data">
            <label><strong>Escolha o arquivo</strong></label>
            <input type="file" name="arquivo" required>
            <button>⬆️ Enviar</button>
        </form>
    </div>

    <h2>Arquivos enviados</h2>
    <table>
    <tr><th>Nome</th><th>Caminho</th></tr>
    ${arquivos.map(a => `<tr><td>${a}</td><td>${uploadDir}/${a}</td></tr>`).join('')}
    </table>
    `));
});

app.post('/upload', upload.single('arquivo'), (req, res) => {
    res.redirect('/upload');
});

app.get('/enviar', (req, res) => {
    const arquivos = listarArquivos();

    const alerta = req.query.sucesso
        ? `<div class="sucesso">✅ Material enviado com sucesso!</div>`
        : req.query.erro ? `<div class="erro">❌ Erro: ${req.query.erro}</div>` : '';

    res.send(layout(`
    <h1>📤 Enviar material</h1>
    ${alerta}
    <div class="card">
    <form method="POST" action="/enviar">
        <label>Nome do aluno</label>
        <input name="nome" required>

        <label>Telefone WhatsApp</label>
        <input name="telefone" placeholder="557599999999" required>

        <label>Mensagem inicial</label>
        <textarea name="mensagem">Olá! Seguem seus materiais. 📚</textarea>

        <label>Materiais</label>
        <select name="materiais" multiple size="8">
            ${arquivos.map(a => `<option value="${a}">${a}</option>`).join('')}
        </select>

        <p><small>Segure CTRL para selecionar mais de um arquivo.</small></p>
        <button>📤 Enviar agora</button>
    </form>
    </div>
    `));
});

app.post('/enviar', async (req, res) => {
    try {
        let { nome, telefone, mensagem, materiais } = req.body;
        if (!Array.isArray(materiais)) materiais = materiais ? [materiais] : [];

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

    res.send(layout(`
    <h1>📅 Agendamentos</h1>
    <p><a class="btn" href="/agenda/novo">➕ Novo agendamento</a></p>
    <table>
    <tr><th>Nome</th><th>Data/Hora</th><th>Alunos</th><th>Materiais</th><th>Status</th><th>Ação</th></tr>
    ${agendamentos.map(a => `
        <tr>
            <td>${a.nome}</td>
            <td>${a.dataHora}</td>
            <td>${a.alunos.length}</td>
            <td>${a.materiais.join('; ')}</td>
            <td><span class="status-${a.status}">${a.status}</span></td>
            <td>
                <form method="POST" action="/agenda/excluir/${a.id}">
                    <button>Excluir</button>
                </form>
            </td>
        </tr>
    `).join('')}
    </table>
    `));
});

app.get('/agenda/novo', (req, res) => {
    const arquivos = listarArquivos();

    res.send(layout(`
    <h1>➕ Novo agendamento</h1>
    <div class="card">
    <form method="POST" action="/agenda/novo">
        <label>Nome do agendamento</label>
        <input name="nome" required>

        <label>Data e hora</label>
        <input type="datetime-local" name="dataHora" required>

        <label>Mensagem</label>
        <textarea name="mensagem">Olá! Seguem seus materiais. 📚</textarea>

        <label>Alunos / Telefones</label>
        <textarea name="alunos" placeholder="João Silva | 557599999999&#10;Maria Souza | 557588888888" required></textarea>

        <label>Materiais</label>
        <select name="materiais" multiple size="8">
        ${arquivos.map(a => `<option value="${a}">${a}</option>`).join('')}
        </select>

        <button>💾 Salvar agendamento</button>
    </form>
    </div>
    `));
});

app.post('/agenda/novo', (req, res) => {
    let { nome, dataHora, mensagem, alunos, materiais } = req.body;
    if (!Array.isArray(materiais)) materiais = materiais ? [materiais] : [];

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
    salvarAgendamentos(lerAgendamentos().filter(a => a.id !== req.params.id));
    res.redirect('/agenda');
});

// ================= EXECUTOR =================
const executarAgendamentos = async () => {
    const agora = new Date();
    const agendamentos = lerAgendamentos();
    let mudou = false;

    for (const a of agendamentos) {
        if (a.status !== 'pendente') continue;

        if (new Date(a.dataHora) <= agora) {
            try {
                for (const aluno of a.alunos) {
                    await enviarParaBot({
                        nome: aluno.nome,
                        telefone: aluno.telefone,
                        mensagem: a.mensagem,
                        materiais: a.materiais
                    });

                    await new Promise(resolve => setTimeout(resolve, 5000));
                }

                a.status = 'enviado';
                a.enviadoEm = new Date().toISOString();
                a.erro = null;
            } catch (error) {
                a.status = 'erro';
                a.erro = error.response?.data?.erro || error.message;
            }

            mudou = true;
        }
    }

    if (mudou) salvarAgendamentos(agendamentos);
};

setInterval(executarAgendamentos, 30000);

// ================= START =================
app.listen(PORT, () => {
    console.log(`🚀 Painel rodando em http://localhost:${PORT}`);
    console.log(`📁 Uploads em: ${uploadDir}`);
});