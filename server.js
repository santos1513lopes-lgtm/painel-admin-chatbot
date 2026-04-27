const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// 📁 PASTA COMPARTILHADA
const uploadDir = path.join(process.env.HOME, 'uploads');

// cria pasta se não existir
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ⚙️ CONFIGURAÇÃO DO MULTER
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

// 📤 ROTA DE UPLOAD
app.post('/upload', upload.single('arquivo'), (req, res) => {
  res.redirect('/upload');
});

// 📄 LISTAR ARQUIVOS
app.get('/upload', (req, res) => {
  const arquivos = fs.readdirSync(uploadDir);

  let html = `
  <h1>Upload de arquivos</h1>
  <form action="/upload" method="POST" enctype="multipart/form-data">
    <input type="file" name="arquivo" required />
    <button type="submit">Enviar</button>
  </form>

  <h2>Arquivos enviados</h2>
  <ul>
  `;

  arquivos.forEach(file => {
    html += `<li>${file}</li>`;
  });

  html += `</ul>`;

  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Painel rodando em http://localhost:${PORT}`);
});