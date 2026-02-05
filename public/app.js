// Estado da aplicação
let modoBarcode = true;
let livros = [];
let timeoutBusca = null;

// Elementos
const inputPrincipal = document.getElementById('inputPrincipal');
const modoAtual = document.getElementById('modoAtual');
const toggleModo = document.getElementById('toggleModo');
const feedback = document.getElementById('feedback');
const resultadosBusca = document.getElementById('resultadosBusca');
const listaResultados = document.getElementById('listaResultados');
const cancelarBusca = document.getElementById('cancelarBusca');
const listaLivros = document.getElementById('listaLivros');
const semLivros = document.getElementById('semLivros');
const totalLivros = document.getElementById('totalLivros');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.querySelector('.modal-close');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  carregarLivros();
  setupEventListeners();
});

function setupEventListeners() {
  // Toggle modo
  toggleModo.addEventListener('click', () => {
    modoBarcode = !modoBarcode;
    atualizarModo();
    inputPrincipal.focus();
  });

  // Input principal
  inputPrincipal.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleInput();
    }
  });

  // Busca com debounce no modo busca
  inputPrincipal.addEventListener('input', () => {
    if (!modoBarcode && inputPrincipal.value.length > 2) {
      clearTimeout(timeoutBusca);
      timeoutBusca = setTimeout(() => buscarPorTitulo(), 500);
    }
  });

  // Cancelar busca
  cancelarBusca.addEventListener('click', () => {
    resultadosBusca.classList.add('hidden');
    inputPrincipal.value = '';
    inputPrincipal.focus();
  });

  // Modal
  modalClose.addEventListener('click', fecharModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) fecharModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharModal();
  });
}

function atualizarModo() {
  if (modoBarcode) {
    modoAtual.textContent = '📷 Modo: Código de Barras';
    toggleModo.textContent = 'Alternar para Busca';
    inputPrincipal.placeholder = 'Escaneie o código de barras...';
    resultadosBusca.classList.add('hidden');
  } else {
    modoAtual.textContent = '🔍 Modo: Busca por Título';
    toggleModo.textContent = 'Alternar para Código';
    inputPrincipal.placeholder = 'Digite o título do livro...';
  }
  inputPrincipal.value = '';
}

async function handleInput() {
  const valor = inputPrincipal.value.trim();
  if (!valor) return;

  if (modoBarcode) {
    await adicionarPorISBN(valor);
  } else {
    await buscarPorTitulo();
  }
}

async function adicionarPorISBN(isbn) {
  // Limpa caracteres não numéricos
  isbn = isbn.replace(/\D/g, '');
  
  if (isbn.length !== 10 && isbn.length !== 13) {
    mostrarFeedback('ISBN inválido. Deve ter 10 ou 13 dígitos.', 'error');
    return;
  }

  mostrarFeedback('🔍 Buscando livro...', 'loading');

  try {
    const response = await fetch('/api/livros/isbn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isbn })
    });

    const data = await response.json();

    if (response.ok) {
      mostrarFeedback(`✅ "${data.titulo}" adicionado com sucesso!`, 'success');
      carregarLivros();
      inputPrincipal.value = '';
    } else {
      mostrarFeedback(`❌ ${data.erro}`, 'error');
    }
  } catch (error) {
    mostrarFeedback('❌ Erro ao conectar com o servidor', 'error');
  }

  inputPrincipal.focus();
}

async function buscarPorTitulo() {
  const termo = inputPrincipal.value.trim();
  if (termo.length < 3) return;

  mostrarFeedback('🔍 Buscando...', 'loading');

  try {
    const response = await fetch(`/api/buscar?q=${encodeURIComponent(termo)}`);
    const resultados = await response.json();

    esconderFeedback();

    if (resultados.length === 0) {
      mostrarFeedback('Nenhum livro encontrado', 'error');
      return;
    }

    exibirResultadosBusca(resultados);
  } catch (error) {
    mostrarFeedback('❌ Erro na busca', 'error');
  }
}

function exibirResultadosBusca(resultados) {
  listaResultados.innerHTML = resultados.map((livro, index) => `
    <div class="resultado-item" data-index="${index}">
      ${livro.capa 
        ? `<img src="${livro.capa}" alt="Capa">`
        : `<div class="livro-capa sem-capa">📖</div>`
      }
      <div class="resultado-info">
        <h4>${livro.titulo}</h4>
        <p>${livro.autores.join(', ')}</p>
        <p>${livro.editora} ${livro.dataPublicacao ? `• ${livro.dataPublicacao}` : ''}</p>
      </div>
    </div>
  `).join('');

  // Event listeners para seleção
  document.querySelectorAll('.resultado-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      selecionarLivro(resultados[index]);
    });
  });

  resultadosBusca.classList.remove('hidden');
}

async function selecionarLivro(livro) {
  mostrarFeedback('📚 Adicionando livro...', 'loading');

  try {
    const response = await fetch('/api/livros/adicionar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(livro)
    });

    const data = await response.json();

    if (response.ok) {
      mostrarFeedback(`✅ "${data.titulo}" adicionado com sucesso!`, 'success');
      resultadosBusca.classList.add('hidden');
      carregarLivros();
      inputPrincipal.value = '';
    } else {
      mostrarFeedback(`❌ ${data.erro}`, 'error');
    }
  } catch (error) {
    mostrarFeedback('❌ Erro ao adicionar livro', 'error');
  }

  inputPrincipal.focus();
}

async function carregarLivros() {
  try {
    const response = await fetch('/api/livros');
    livros = await response.json();
    renderizarLivros();
  } catch (error) {
    console.error('Erro ao carregar livros:', error);
  }
}

function renderizarLivros() {
  totalLivros.textContent = `${livros.length} livro${livros.length !== 1 ? 's' : ''}`;

  if (livros.length === 0) {
    listaLivros.classList.add('hidden');
    semLivros.classList.remove('hidden');
    return;
  }

  semLivros.classList.add('hidden');
  listaLivros.classList.remove('hidden');

  listaLivros.innerHTML = livros.map((livro, index) => `
    <div class="livro-card" data-index="${index}">
      ${livro.capa 
        ? `<img class="livro-capa" src="${livro.capa}" alt="Capa">`
        : `<div class="livro-capa sem-capa">📖</div>`
      }
      <div class="livro-info">
        <h3>${livro.titulo}</h3>
        <p class="autor">${livro.autores.join(', ')}</p>
        <div class="livro-meta">
          ${livro.editora ? `<span>📚 ${livro.editora}</span>` : ''}
          ${livro.paginas ? `<span>📄 ${livro.paginas} páginas</span>` : ''}
        </div>
      </div>
      <div class="livro-actions">
        <button class="btn-delete" onclick="event.stopPropagation(); removerLivro(${index})">
          🗑️ Remover
        </button>
      </div>
    </div>
  `).join('');

  // Event listeners para detalhes
  document.querySelectorAll('.livro-card').forEach(card => {
    card.addEventListener('click', () => {
      const index = parseInt(card.dataset.index);
      abrirDetalhes(livros[index]);
    });
  });
}

async function removerLivro(index) {
  if (!confirm('Tem certeza que deseja remover este livro?')) return;

  try {
    const response = await fetch(`/api/livros/${index}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      mostrarFeedback('🗑️ Livro removido', 'success');
      carregarLivros();
    }
  } catch (error) {
    mostrarFeedback('❌ Erro ao remover livro', 'error');
  }
}

function abrirDetalhes(livro) {
  modalBody.innerHTML = `
    <div class="modal-livro">
      <div class="modal-header">
        ${livro.capa 
          ? `<img class="modal-capa" src="${livro.capa}" alt="Capa">`
          : `<div class="modal-capa sem-capa" style="display:flex;align-items:center;justify-content:center;font-size:3rem;">📖</div>`
        }
        <div class="modal-titulo">
          <h2>${livro.titulo}</h2>
          <p class="modal-autor">${livro.autores.join(', ')}</p>
          <div class="modal-meta">
            ${livro.editora ? `<span>📚 Editora: ${livro.editora}</span>` : ''}
            ${livro.dataPublicacao ? `<span>📅 Publicação: ${livro.dataPublicacao}</span>` : ''}
            ${livro.paginas ? `<span>📄 Páginas: ${livro.paginas}</span>` : ''}
            ${livro.isbn ? `<span>🔖 ISBN: ${livro.isbn}</span>` : ''}
            ${livro.categorias?.length ? `<span>🏷️ ${livro.categorias.join(', ')}</span>` : ''}
          </div>
        </div>
      </div>
      ${livro.descricao ? `
        <div class="modal-descricao">
          <h4>Descrição</h4>
          <p>${livro.descricao}</p>
        </div>
      ` : ''}
    </div>
  `;
  modal.classList.remove('hidden');
}

function fecharModal() {
  modal.classList.add('hidden');
}

function mostrarFeedback(mensagem, tipo) {
  feedback.textContent = mensagem;
  feedback.className = `feedback ${tipo}`;
  feedback.classList.remove('hidden');

  if (tipo !== 'loading') {
    setTimeout(esconderFeedback, 3000);
  }
}

function esconderFeedback() {
  feedback.classList.add('hidden');
}
