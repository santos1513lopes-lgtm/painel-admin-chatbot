const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 📁 PASTA COMPARTILHADA (IMPORTANTE)
const uploadDir = path.join(process.env.HOME, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ⚙️ MULTER
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const nome = Date.now() + '_' + file.originalname;
    cb(null, nome);
  }
});

const upload = multer({ storage });

// ================= DASHBOARD =================
app.get('/', (req, res) => {
  res.send(`
  <html>
  <head>
    <title>Dashboard</title>
    <style>
      body { font-family: Arial; background:#f5f6fa; margin:0; }
      .menu {
        width:200px;
        height:100vh;
        background:#2f3640;
        color:#fff;
        position:fixed;
        padding:20px;
      }
      .menu a {
        display:block;
        color:#fff;
        text-decoration:none;
        margin:10px 0;
      }
      .conteudo {
        margin-left:220px;
        padding:20px;
      }
      .card {
        background:#fff;
        padding:20px;
        border-radius:8px;
        box-shadow:0 0 5px rgba(0,0,0,0.1);
      }
    </style>
  </head>

  <body>
    <div class="menu">
      <h2>🤖 Chatbot</h2>
      <a href="/">Dashboard</a>
      <a href="/upload">Upload</a>
      <a href="/enviar">Enviar material</a>
    </div>

    <div class="conteudo">
      <h1>📊 Dashboard</h1>

      <div class="card">
        Sistema rodando com sucesso 🚀<br><br>
        Pasta compartilhada: <b>${uploadDir}</b>
      </div>
    </div>
  </body>
  </html>
  `);
});

// ================= UPLOAD =================
app.get('/upload', (req, res) => {
  const arquivos = fs.readdirSync(uploadDir);

  let lista = arquivos.map(a => `<li>${a}</li>`).join('');

  res.send(`
  <html>
  <head>
    <title>Upload</title>
  </head>
  <body style="font-family:Arial;background:#f5f6fa">

    <h1>📁 Upload de arquivos</h1>

    <form action="/upload" method="POST" enctype="multipart/form-data">
      <input type="file" name="arquivo" required />
      <button>Enviar</button>
    </form>

    <h2>Arquivos enviados</h2>
    <ul>${lista}</ul>

    <br><a href="/">⬅ Voltar</a>

  </body>
  </html>
  `);
});

app.post('/upload', upload.single('arquivo'), (req, res) => {
  res.redirect('/upload');
});

// ================= ENVIAR MATERIAL =================
app.get('/enviar', (req, res) => {
  const arquivos = fs.readdirSync(uploadDir);

  const options = arquivos.map(a => `<option value="${a}">${a}</option>`).join('');

  res.send(`
  <html>
  <body style="font-family:Arial">

    <h1>📤 Enviar material</h1>

    <form method="POST" action="/enviar">
      <input name="nome" placeholder="Nome do aluno" /><br><br>
      <input name="telefone" placeholder="Telefone WhatsApp" /><br><br>

      <textarea name="mensagem">Olá! Seguem seus materiais.</textarea><br><br>

      <select name="materiais" multiple size="5">
        ${options}
      </select><br><br>

      <button>Enviar</button>
    </form>

    <br><a href="/">⬅ Voltar</a>

  </body>
  </html>
  `);
});

app.post('/enviar', async (req, res) => {
  try {
    const { nome, telefone, mensagem, materiais } = req.body;

    await fetch('http://localhost:4000/enviar-material', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, telefone, mensagem, materiais })
    });

    res.send(`<h2>✅ Enviado com sucesso</h2><a href="/">Voltar</a>`);

  } catch (err) {
    res.send(`<h2>❌ Erro ao enviar</h2><a href="/">Voltar</a>`);
  }
});

// ================= START =================
app.listen(PORT, () => {
  console.log(`🚀 Painel rodando em http://localhost:${PORT}`);
});