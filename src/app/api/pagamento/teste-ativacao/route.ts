import { NextResponse } from 'next/server';

export async function GET() {
  // Página HTML simples para testar ativação de assinatura
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Teste de Ativação de Assinatura</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          line-height: 1.6;
        }
        form {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: bold;
        }
        input, select {
          width: 100%;
          padding: 8px;
          margin-bottom: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
          box-sizing: border-box;
        }
        button {
          background: #4285f4;
          color: white;
          border: none;
          padding: 10px 15px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        }
        button:hover {
          background: #3367d6;
        }
        .response {
          background: #e8f5e9;
          padding: 20px;
          border-radius: 8px;
          margin-top: 20px;
          white-space: pre-wrap;
          display: none;
        }
        .error {
          background: #ffebee;
        }
        code {
          display: block;
          background: #f1f1f1;
          padding: 15px;
          border-radius: 4px;
          margin: 10px 0;
          overflow-x: auto;
        }
      </style>
    </head>
    <body>
      <h1>Teste de Ativação de Assinatura</h1>
      
      <p>Use este formulário para simular a ativação de uma assinatura. Isso é equivalente a quando um cliente paga pelo plano premium.</p>
      
      <form id="activationForm">
        <div>
          <label for="userId">ID do Usuário:</label>
          <input type="text" id="userId" name="userId" placeholder="ID do usuário (UID do Firebase)" required>
        </div>
        
        <div>
          <label for="plano">Plano:</label>
          <select id="plano" name="plano">
            <option value="premium" selected>Premium</option>
            <option value="basico">Básico</option>
          </select>
        </div>
        
        <div>
          <label for="modo">Status da Assinatura:</label>
          <select id="modo" name="modo">
            <option value="ativa" selected>Ativa</option>
            <option value="teste">Teste</option>
          </select>
        </div>
        
        <div>
          <label for="email">Email (opcional, para criar usuário):</label>
          <input type="email" id="email" name="email" placeholder="email@exemplo.com">
        </div>
        
        <div>
          <label for="criarUsuario">
            <input type="checkbox" id="criarUsuario" name="criarUsuario" style="width: auto" checked> 
            Criar usuário se não existir
          </label>
        </div>
        
        <button type="submit">Ativar Assinatura</button>
      </form>
      
      <div>
        <h3>Código para console (se preferir):</h3>
        <code id="consoleCode">
fetch('/api/usuario/ativar-manual', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: "[SEU_USER_ID]", // Substitua pelo ID do usuário
    modo: "ativa",
    plano: "premium",
    criarUsuario: true
  })
})
.then(response => response.json())
.then(data => console.log('Resposta:', data));</code>
      </div>
      
      <h3>Resposta da API:</h3>
      <div id="response" class="response"></div>
      
      <script>
        document.getElementById('activationForm').addEventListener('submit', async function(e) {
          e.preventDefault();
          
          const userId = document.getElementById('userId').value;
          const plano = document.getElementById('plano').value;
          const modo = document.getElementById('modo').value;
          const email = document.getElementById('email').value;
          const criarUsuario = document.getElementById('criarUsuario').checked;
          
          const responseEl = document.getElementById('response');
          responseEl.style.display = 'block';
          responseEl.textContent = 'Enviando requisição...';
          responseEl.className = 'response';
          
          try {
            const response = await fetch('/api/usuario/ativar-manual', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, plano, modo, email, criarUsuario })
            });
            
            const data = await response.json();
            
            responseEl.textContent = JSON.stringify(data, null, 2);
            
            if (!response.ok) {
              responseEl.classList.add('error');
            }
            
            // Atualizar o código para o console
            document.getElementById('consoleCode').textContent = 
\`fetch('/api/usuario/ativar-manual', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: "${userId}", 
    modo: "${modo}",
    plano: "${plano}",
    criarUsuario: ${criarUsuario}${email ? `,
    email: "${email}"` : ''}
  })
})
.then(response => response.json())
.then(data => console.log('Resposta:', data));\`;
            
            if (data.success) {
              setTimeout(() => {
                if (confirm('Ativação concluída com sucesso! Deseja ir para o dashboard agora?')) {
                  window.location.href = '/dashboard';
                }
              }, 1500);
            }
            
          } catch (error) {
            responseEl.textContent = 'Erro ao processar requisição: ' + error.message;
            responseEl.classList.add('error');
          }
        });
      </script>
    </body>
    </html>
  `;
  
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
} 