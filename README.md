# One Piece TCG Manager

Gerenciador de coleção de cartas One Piece TCG com identificação por foto, busca de preços e sincronização com Google Drive.

## Setup

### 1. Instalar dependências
```bash
npm install
```

### 2. Rodar localmente
```bash
npm run dev
```

### 3. Deploy (GitHub Pages)

1. Crie um repositório no GitHub chamado `onepiece-tcg-manager`
2. Vá em **Settings → Pages → Source** e selecione **GitHub Actions**
3. Faça push para a branch `main`:

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/onepiece-tcg-manager.git
git push -u origin main
```

4. O deploy acontece automaticamente. Seu app estará em:
   `https://SEU_USUARIO.github.io/onepiece-tcg-manager/`

## Atualização via Claude Code

Quando você confirmar novas cartas no chat, o Claude Code edita `src/App.jsx` diretamente:

```bash
# No terminal, dentro da pasta do projeto:
claude
```

## Estrutura

```
onepiece-tcg-manager/
├── src/
│   ├── App.jsx        ← lógica principal do app
│   └── main.jsx       ← entry point React
├── index.html
├── package.json
├── vite.config.js
└── .github/
    └── workflows/
        └── deploy.yml ← deploy automático no push
```
