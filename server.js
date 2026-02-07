import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;
const LIVROS_FILE = join(__dirname, 'livros.json');
const API_KEY = process.env.APIKEY;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Carrega livros do arquivo
function carregarLivros() {
  if (!existsSync(LIVROS_FILE)) {
    writeFileSync(LIVROS_FILE, '[]');
    return [];
  }
  try {
    return JSON.parse(readFileSync(LIVROS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

// Salva livros no arquivo
function salvarLivros(livros) {
  writeFileSync(LIVROS_FILE, JSON.stringify(livros, null, 2));
}

// Busca livro na Google Books API por ISBN
async function buscarPorISBN(isbn) {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.totalItems > 0) {
      const livro = data.items[0].volumeInfo;
      return {
        isbn: isbn,
        titulo: livro.title || 'Título desconhecido',
        autores: livro.authors || ['Autor desconhecido'],
        editora: livro.publisher || 'Editora desconhecida',
        dataPublicacao: livro.publishedDate || '',
        descricao: livro.description || '',
        paginas: livro.pageCount || 0,
        capa: livro.imageLinks?.thumbnail || '',
        categorias: livro.categories || [],
        dataAdicionado: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error('Erro ao buscar por ISBN:', error.message);
  }
  return null;
}

// Busca livro na Google Books API por título
async function buscarPorTitulo(titulo) {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(titulo)}&maxResults=5&key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.totalItems > 0) {
      return data.items.map(item => {
        const livro = item.volumeInfo;
        const isbn = livro.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier ||
                     livro.industryIdentifiers?.find(id => id.type === 'ISBN_10')?.identifier || '';
        return {
          isbn: isbn,
          titulo: livro.title || 'Título desconhecido',
          autores: livro.authors || ['Autor desconhecido'],
          editora: livro.publisher || 'Editora desconhecida',
          dataPublicacao: livro.publishedDate || '',
          descricao: livro.description || '',
          paginas: livro.pageCount || 0,
          capa: livro.imageLinks?.thumbnail || '',
          categorias: livro.categories || []
        };
      });
    }
  } catch (error) {
    console.error('Erro ao buscar por título:', error.message);
  }
  return [];
}

// GET - Lista todos os livros
app.get('/api/livros', (req, res) => {
  const livros = carregarLivros();
  res.json(livros);
});

// POST - Busca e adiciona livro por ISBN
app.post('/api/livros/isbn', async (req, res) => {
  const { isbn } = req.body;
  
  if (!isbn) {
    return res.status(400).json({ erro: 'ISBN é obrigatório' });
  }

  const livros = carregarLivros();
  
  // Verifica se já existe
  if (livros.some(l => l.isbn === isbn)) {
    return res.status(409).json({ erro: 'Livro já cadastrado' });
  }

  const livro = await buscarPorISBN(isbn);
  
  if (!livro) {
    // Salva como incompleto quando o ISBN não é encontrado na API
    const livroIncompleto = {
      isbn: isbn,
      titulo: `ISBN: ${isbn}`,
      autores: ['Desconhecido'],
      editora: '',
      dataPublicacao: '',
      descricao: '',
      paginas: 0,
      capa: '',
      categorias: [],
      incompleto: true,
      dataAdicionado: new Date().toISOString()
    };
    livros.unshift(livroIncompleto);
    salvarLivros(livros);
    return res.json(livroIncompleto);
  }

  // Adiciona no início (pilha)
  livros.unshift(livro);
  salvarLivros(livros);
  
  res.json(livro);
});

// GET - Busca livros por título (para seleção)
app.get('/api/buscar', async (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({ erro: 'Termo de busca é obrigatório' });
  }

  const resultados = await buscarPorTitulo(q);
  res.json(resultados);
});

// POST - Adiciona livro selecionado da busca
app.post('/api/livros/adicionar', (req, res) => {
  const livro = req.body;
  
  if (!livro.titulo) {
    return res.status(400).json({ erro: 'Dados do livro são obrigatórios' });
  }

  const livros = carregarLivros();
  
  // Verifica duplicata por ISBN ou título
  if (livro.isbn && livros.some(l => l.isbn === livro.isbn)) {
    return res.status(409).json({ erro: 'Livro já cadastrado' });
  }

  livro.dataAdicionado = new Date().toISOString();
  livros.unshift(livro);
  salvarLivros(livros);
  
  res.json(livro);
});

// POST - Adiciona livro manualmente (título inserido pelo usuário, incompleto)
app.post('/api/livros/manual', (req, res) => {
  const { titulo } = req.body;

  if (!titulo || !titulo.trim()) {
    return res.status(400).json({ erro: 'Título é obrigatório' });
  }

  const livros = carregarLivros();

  // Verifica duplicata por título
  if (livros.some(l => l.titulo.toLowerCase() === titulo.trim().toLowerCase())) {
    return res.status(409).json({ erro: 'Livro já cadastrado' });
  }

  const livro = {
    isbn: '',
    titulo: titulo.trim(),
    autores: ['Desconhecido'],
    editora: '',
    dataPublicacao: '',
    descricao: '',
    paginas: 0,
    capa: '',
    categorias: [],
    incompleto: true,
    dataAdicionado: new Date().toISOString()
  };

  livros.unshift(livro);
  salvarLivros(livros);

  res.json(livro);
});

// DELETE - Remove livro
app.delete('/api/livros/:index', (req, res) => {
  const index = parseInt(req.params.index);
  const livros = carregarLivros();
  
  if (index < 0 || index >= livros.length) {
    return res.status(404).json({ erro: 'Livro não encontrado' });
  }

  livros.splice(index, 1);
  salvarLivros(livros);
  
  res.json({ sucesso: true });
});

app.listen(PORT, () => {
  console.log(`📚 Servidor rodando em http://localhost:${PORT}`);
});
