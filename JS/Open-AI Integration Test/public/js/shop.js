(function () {
  if (typeof CATALOG === "undefined") {
    const el = document.getElementById("catalog");
    if (el) el.innerHTML = "<p>Não foi possível carregar os cursos.</p>";
    return;
  }

  const elCatalog = document.getElementById("catalog");
  const filtroArea = document.getElementById("filtroArea");
  const filtroNivel = document.getElementById("filtroNivel");
  const ordenarPor = document.getElementById("ordenarPor");

  const fmtBRL = (n) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  function render(items) {
    elCatalog.innerHTML = items
      .map(
        (c) => `
        <article class="card" data-id="${c.id}">
          <div class="badges">
            <span class="badge">${c.area}</span>
            <span class="badge">${c.nivel === "pos" ? "Pós" : "Graduação"}</span>
          </div>
          <h3>${c.nome}</h3>
          <div class="price">${fmtBRL(c.preco_base)}</div>
          <div class="actions">
            <button class="button primary" data-act="comprar" data-id="${c.id}">Comprar</button>
            <button class="button ghost" data-act="detalhes" data-id="${c.id}">Detalhes</button>
          </div>
        </article>
      `
      )
      .join("");
  }

  function aplicaFiltrosOrdenacao() {
    let lista = [...CATALOG];

    const area = filtroArea.value;
    const nivel = filtroNivel.value;

    if (area) lista = lista.filter((c) => c.area === area);
    if (nivel) lista = lista.filter((c) => c.nivel === nivel);

    const ord = ordenarPor.value;
    if (ord === "nome-asc") lista.sort((a, b) => a.nome.localeCompare(b.nome));
    if (ord === "nome-desc") lista.sort((a, b) => b.nome.localeCompare(a.nome));
    if (ord === "preco-asc") lista.sort((a, b) => a.preco_base - b.preco_base);
    if (ord === "preco-desc") lista.sort((a, b) => b.preco_base - a.preco_base);

    render(lista);
  }

  filtroArea.addEventListener("change", aplicaFiltrosOrdenacao);
  filtroNivel.addEventListener("change", aplicaFiltrosOrdenacao);
  ordenarPor.addEventListener("change", aplicaFiltrosOrdenacao);

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const curso = CATALOG.find((c) => c.id === id);
    if (!curso) return;
    if (btn.dataset.act === "comprar") {
      alert(`Para comprar ${curso.nome} — ${fmtBRL(curso.preco_base)} fale com o nosso atendente`);
    } else if (btn.dataset.act === "detalhes") {
      alert(`Detalhes ${curso.nome}:\nÁrea: ${curso.area}\nNível: ${curso.nivel}`);
    }
  });

  aplicaFiltrosOrdenacao();
})();
