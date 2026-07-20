class WearBloomPhone extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready === "true") return;
    this.dataset.ready = "true";

    const label = this.getAttribute("label") || "WearBloom iPhone mockup";
    const statusTheme = this.getAttribute("status") === "light" ? "#ffffff" : "#111111";
    const contents = Array.from(this.childNodes);

    const shell = document.createElement("section");
    shell.className = "phone-shell";
    shell.setAttribute("aria-label", label);

    const screen = document.createElement("div");
    screen.className = "phone-screen";
    screen.style.setProperty("--status-color", statusTheme);

    const status = document.createElement("div");
    status.className = "phone-status";
    status.setAttribute("aria-hidden", "true");
    status.innerHTML = `
      <span>9:41</span>
      <span class="phone-status__icons">
        <span class="phone-status__signal"></span>
        <span class="phone-status__wifi"></span>
        <span class="phone-status__battery"></span>
      </span>`;

    const content = document.createElement("div");
    content.className = "phone-content";
    contents.forEach((node) => content.appendChild(node));

    screen.append(status, content);
    shell.appendChild(screen);
    this.appendChild(shell);
  }
}

customElements.define("wb-phone", WearBloomPhone);

document.querySelectorAll("[data-open-all]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-proposal-link]").forEach((link) => {
      window.open(link.href, "_blank", "noopener");
    });
  });
});
