---
paths:
  - "index.html"
  - "css/**"
  - "js/ui/**"
  - "js/main.js"
---
# Interface
- Campos com `data-persist` são salvos/restaurados automaticamente (`store.bindForm`); para persistir um controle novo basta o atributo + `id`.
- Use os componentes próprios (`ui/modal.js` no lugar de alert/confirm, `ui/controls.js` para selects/ranges, `ui/toast.js` para progresso). Ícones: Lucide (`data-lucide="nome"`).
- Classe Tailwind nova exige regenerar `css/tw.css` (comando no CLAUDE.md). Avisos não podem roubar o foco da digitação.
- Nada é processado ao abrir o app: prévia só por ação do usuário (botão Prévia / Ctrl+Enter).
