import {
  MORPH_BOT_EFFECTS,
  MORPH_BOT_SHAPES,
} from "../morph-bot.js";
import {
  MORPH_LABELS_ZH as effectDescriptions,
  SHAPE_LABELS_ZH as shapeLabels,
  STATE_GROUPS,
  STATE_IDS as orderedStates,
  STATE_LABELS_ZH as stateLabels,
} from "../catalog.js";
import {
  GLASS_PRESETS,
  GRADIENT_PRESETS,
  MATERIAL_IDS,
  MATERIAL_LABELS,
  SOLID_PRESETS,
  materialCssBackground,
} from "../materials.js";

const stateGroups = STATE_GROUPS.map((group) => ({ label: group.label.zh, states: group.states }));

const bot = document.querySelector("#docs-bot");
const stateSelect = document.querySelector("#docs-state");
const shapeSelect = document.querySelector("#docs-shape");
const effectSelect = document.querySelector("#docs-effect");
const materialSelect = document.querySelector("#docs-material");
const materialPresetSelect = document.querySelector("#docs-material-preset");
const snapshotOutput = document.querySelector("#live-snapshot");
const pauseButton = document.querySelector("#toggle-pause");

for (const state of orderedStates) stateSelect.add(new Option(`${stateLabels[state]} · ${state}`, state));
for (const shape of MORPH_BOT_SHAPES) shapeSelect.add(new Option(`${shapeLabels[shape]} · ${shape}`, shape));
for (const effect of MORPH_BOT_EFFECTS) effectSelect.add(new Option(`${effectDescriptions[effect]} · ${effect}`, effect));
for (const material of MATERIAL_IDS) materialSelect.add(new Option(`${MATERIAL_LABELS[material].zh} · ${material}`, material));
stateSelect.value = "idle";
shapeSelect.value = "blob";
effectSelect.value = "dots";
materialSelect.value = "solid";

function materialCatalog(material = materialSelect.value) {
  if (material === "solid") return SOLID_PRESETS;
  if (material === "gradient") return GRADIENT_PRESETS;
  return GLASS_PRESETS;
}

function materialBackground(material, preset) {
  return materialCssBackground(material, preset);
}

function fillMaterialPresetSelect(preferred = null) {
  materialPresetSelect.replaceChildren();
  for (const preset of materialCatalog()) materialPresetSelect.add(new Option(`${preset.label.zh} · ${preset.id}`, preset.id));
  if (preferred && materialCatalog().some(({ id }) => id === preferred)) materialPresetSelect.value = preferred;
}

function applyPresetToBot(target, material = materialSelect.value, presetId = materialPresetSelect.value) {
  const preset = materialCatalog(material).find(({ id }) => id === presetId) || materialCatalog(material)[0];
  if (material === "solid") target.setMaterial("solid", { color: preset.color });
  else target.setMaterial(material, { preset: preset.id });
}

fillMaterialPresetSelect("ink");

const stateReference = document.querySelector("#state-reference");
for (const group of stateGroups) {
  const section = document.createElement("section");
  section.className = "reference-group";
  const heading = document.createElement("h3");
  heading.textContent = `${group.label} · ${group.states.length}`;
  const grid = document.createElement("div");
  grid.className = "state-reference";
  for (const state of group.states) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.docsState = state;
    button.innerHTML = `<strong>${stateLabels[state]}</strong><code>${state}</code>`;
    grid.append(button);
  }
  section.append(heading, grid);
  stateReference.append(section);
}

const shapeReference = document.querySelector("#shape-reference");
for (const shape of MORPH_BOT_SHAPES) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.docsShape = shape;
  const preview = document.createElement("morph-bot");
  preview.setAttribute("state", "idle");
  preview.setAttribute("shape", shape);
  preview.setAttribute("size", "44");
  preview.setAttribute("decorative", "");
  preview.setAttribute("thumbnail", "");
  const label = document.createElement("span");
  label.innerHTML = `<strong>${shapeLabels[shape]}</strong><code>${shape}</code>`;
  button.append(preview, label);
  shapeReference.append(button);
}

const effectReference = document.querySelector("#effect-reference");
for (const effect of MORPH_BOT_EFFECTS) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.docsEffect = effect;
  button.innerHTML = `<strong>${effect}</strong><span>${effectDescriptions[effect]}</span><i>▶</i>`;
  effectReference.append(button);
}

const materialReference = document.querySelector("#material-reference");
for (const material of MATERIAL_IDS) {
  const section = document.createElement("section");
  section.innerHTML = `<h3>${MATERIAL_LABELS[material].zh}<code>${material}</code></h3>`;
  const grid = document.createElement("div");
  for (const preset of materialCatalog(material)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.docsMaterial = material;
    button.dataset.docsMaterialPreset = preset.id;
    const preview = document.createElement("morph-bot");
    preview.setAttribute("state", "idle");
    preview.setAttribute("shape", material === "rainbow-glass" ? "gem" : "blob");
    preview.setAttribute("size", "46");
    preview.setAttribute("thumbnail", "");
    preview.setAttribute("decorative", "");
    applyPresetToBot(preview, material, preset.id);
    const swatch = document.createElement("i");
    swatch.style.setProperty("--material-swatch", materialBackground(material, preset));
    const label = document.createElement("span");
    label.innerHTML = `<strong>${preset.label.zh}</strong><code>${preset.id}</code>`;
    button.append(preview, swatch, label);
    grid.append(button);
  }
  section.append(grid);
  materialReference.append(section);
}

function applyMaterial() {
  applyPresetToBot(bot);
  shapeReference.querySelectorAll("morph-bot").forEach((preview) => applyPresetToBot(preview));
}

function applyState() {
  bot.setState(stateSelect.value, { replay: true });
  bot.setShape(shapeSelect.value);
  applyMaterial();
}

document.querySelector("#apply-state").addEventListener("click", applyState);
document.querySelector("#replay-state").addEventListener("click", () => bot.replay());
document.querySelector("#play-morph").addEventListener("click", () => bot.playMorph(effectSelect.value, { hold: 1200, restore: "default" }));
pauseButton.addEventListener("click", () => {
  bot.paused = !bot.paused;
  pauseButton.textContent = bot.paused ? "继续" : "暂停";
});

materialSelect.addEventListener("change", () => {
  fillMaterialPresetSelect();
  applyMaterial();
});
materialPresetSelect.addEventListener("change", applyMaterial);

stateReference.addEventListener("click", (event) => {
  const button = event.target.closest("[data-docs-state]");
  if (!button) return;
  stateSelect.value = button.dataset.docsState;
  applyState();
  document.querySelector(".live-api").scrollIntoView({ behavior: "smooth", block: "nearest" });
});

shapeReference.addEventListener("click", (event) => {
  const button = event.target.closest("[data-docs-shape]");
  if (!button) return;
  shapeSelect.value = button.dataset.docsShape;
  applyState();
});

effectReference.addEventListener("click", (event) => {
  const button = event.target.closest("[data-docs-effect]");
  if (!button) return;
  effectSelect.value = button.dataset.docsEffect;
  bot.playMorph(effectSelect.value, { hold: 1200, restore: "default" });
});

materialReference.addEventListener("click", (event) => {
  const button = event.target.closest("[data-docs-material]");
  if (!button) return;
  materialSelect.value = button.dataset.docsMaterial;
  fillMaterialPresetSelect(button.dataset.docsMaterialPreset);
  applyMaterial();
});

document.querySelectorAll("[data-copy-code]").forEach((button) => button.addEventListener("click", async () => {
  const source = button.closest(".code-block").querySelector("code").textContent;
  try {
    await navigator.clipboard.writeText(source);
    button.textContent = "已复制";
    button.classList.add("is-copied");
    window.setTimeout(() => {
      button.textContent = "复制";
      button.classList.remove("is-copied");
    }, 1200);
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(button.closest(".code-block").querySelector("code"));
    selection.removeAllRanges();
    selection.addRange(range);
    button.textContent = "已选中";
  }
}));

const navLinks = [...document.querySelectorAll(".docs-nav a")];
const sections = navLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
if (globalThis.IntersectionObserver) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`));
  }, { rootMargin: "-18% 0px -68%", threshold: [0, 0.2, 0.6] });
  sections.forEach((section) => observer.observe(section));
}

let lastSnapshot = 0;
function updateSnapshot(now) {
  if (now - lastSnapshot > 180) {
    const snapshot = bot.snapshot();
    if (snapshot) {
      snapshotOutput.textContent = JSON.stringify({
        state: snapshot.state,
        expressionIndex: snapshot.expressionIndex,
        eyeOpen: Number(snapshot.eyeOpen.toFixed(2)),
        morphEffect: snapshot.morphEffect,
        morphAmount: Number(snapshot.morphAmount.toFixed(2)),
        morphPhase: snapshot.morphPhase,
        paused: snapshot.paused,
      }, null, 2);
    }
    lastSnapshot = now;
  }
  requestAnimationFrame(updateSnapshot);
}

requestAnimationFrame(updateSnapshot);
