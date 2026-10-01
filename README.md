# pixp

Gera a página Pix (NFC/QR da placa) de cada cliente.

1. Crie `clientes/<slug>/` com `config.json` (copie o de `clientes/exemplo`) e `logo.svg` ou `logo.png`.
2. Campos: `nome`, `recebedor` (até 25, MAIÚSCULO, sem acento), `cidade` (até 15, sem acento), `chave`,
   `tipoChave` (cpf, cnpj, celular, email, aleatoria), `corPrincipal` (#RRGGBB), `corSecundaria` (opcional), `nomeNoBanco`.
3. `npm install` (uma vez) e `npm run build <slug>`.
4. Saída em `dist/<slug>/`: `index.html` (publicar) e `placa-qr.svg` (modelagem da placa).
