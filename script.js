"use strict";
const $ = s => document.querySelector(s);
const KEY = "vitapanel_v1";
const GOAL_ML = 2000, GLASS = 250, GOAL_GLASSES = GOAL_ML / GLASS;
const today = () => new Date().toISOString().slice(0, 10);
const newUser = name => ({ id: "u" + Date.now() + Math.random().toString(36).slice(2, 5), name, water: { d: today(), n: 0 }, food: [], photos: [], p: {} });

/* ---------- Estado persistente ---------- */
let S = (() => {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.users && d.users.length) return d; } catch (e) {}
  const u = newUser("Usuario");
  return { settings: { theme: "light", accent: "green", style: "clean", bg: "", clock: true, date: true, mode: "individual" }, users: [u], active: u.id };
})();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { alert("Almacenamiento lleno: elimina fotos o el fondo para seguir guardando."); }
}
const U = () => S.users.find(u => u.id === S.active) || S.users[0];

/* ---------- Utilidades ---------- */
function resizeImage(file, max = 700) {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onerror = fail;
    r.onload = () => {
      const img = new Image();
      img.onerror = fail;
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = img.width * k; c.height = img.height * k;
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL("image/jpeg", 0.75));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
const num = id => parseFloat($(id).value);
const esc = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- MÓDULO 1: TDEE + base de alimentos ---------- */
const FOODS = { "Arroz cocido": 130, "Pollo a la plancha": 165, "Huevo": 155, "Pan integral": 247, "Avena": 389, "Plátano": 89, "Manzana": 52, "Pasta cocida": 158, "Atún en agua": 116, "Salmón": 208, "Carne de res magra": 250, "Papa cocida": 87, "Frijoles cocidos": 127, "Lentejas cocidas": 116, "Aguacate": 160, "Almendras": 579, "Leche entera": 61, "Yogur natural": 61, "Queso fresco": 264, "Brócoli": 34, "Pizza": 266, "Hamburguesa": 295, "Papas fritas": 312, "Chocolate": 546, "Refresco": 42, "Arepa": 218, "Tortilla de maíz": 218 };
$("#foodList").innerHTML = Object.keys(FOODS).map(f => `<option value="${f}">`).join("");

$("#calcTdee").onclick = () => {
  const sex = $("#sex").value, age = num("#age"), w = num("#weight"), h = num("#height");
  if (!(age > 0 && w > 0 && h > 0)) { $("#tdeeOut").textContent = "⚠️ Ingresa edad, peso y altura válidos."; return; }
  // Mifflin-St Jeor
  const bmr = 10 * w + 6.25 * h - 5 * age + (sex === "m" ? 5 : -161);
  const tdee = bmr * parseFloat($("#activity").value);
  const target = Math.round(tdee + parseInt($("#goalCal").value));
  const prot = Math.round(w * 2), fat = Math.round(target * 0.25 / 9), carb = Math.max(0, Math.round((target - prot * 4 - fat * 9) / 4));
  U().p = { ...U().p, target, w, h };
  save(); renderTdee(); renderFood();
};
function renderTdee() {
  const p = U().p;
  if (!p.target) { $("#tdeeOut").textContent = "Completa los datos y pulsa Calcular."; return; }
  const prot = Math.round(p.w * 2), fat = Math.round(p.target * 0.25 / 9), carb = Math.max(0, Math.round((p.target - prot * 4 - fat * 9) / 4));
  $("#tdeeOut").innerHTML = `Meta diaria: <b>${p.target} kcal</b><br>Proteína ${prot} g · Grasas ${fat} g · Carbohidratos ${carb} g`;
}
$("#addFood").onclick = () => {
  const name = $("#foodName").value.trim(), g = num("#foodG");
  const key = Object.keys(FOODS).find(k => k.toLowerCase() === name.toLowerCase());
  if (!key) { alert("Alimento no encontrado. Elige uno de la lista de sugerencias."); return; }
  if (!(g > 0)) { alert("Ingresa los gramos."); return; }
  U().food.push({ d: today(), name: key, g, kcal: Math.round(FOODS[key] * g / 100) });
  $("#foodName").value = ""; save(); renderFood();
};
function renderFood() {
  const items = U().food.filter(f => f.d === today());
  $("#foodLog").innerHTML = items.map((f, i) => `<li><span>${esc(f.name)} · ${f.g} g</span><span>${f.kcal} kcal <button data-i="${i}" aria-label="Eliminar">✕</button></span></li>`).join("") || '<li class="muted">Sin comidas registradas hoy.</li>';
  const tot = items.reduce((a, f) => a + f.kcal, 0), t = U().p.target;
  $("#kcalTxt").textContent = t ? `${tot} / ${t} kcal (${Math.max(0, t - tot)} restantes)` : `${tot} kcal consumidas`;
  const bar = $("#kcalBar"); bar.style.width = (t ? Math.min(100, tot / t * 100) : 0) + "%"; bar.classList.toggle("over", t && tot > t);
}
$("#foodLog").onclick = e => {
  const i = e.target.dataset.i; if (i === undefined) return;
  const todayItems = U().food.filter(f => f.d === today()), item = todayItems[i];
  U().food.splice(U().food.indexOf(item), 1); save(); renderFood();
};

/* ---------- MÓDULO 2: Hidratación ---------- */
function confetti() {
  const box = $("#confetti");
  for (let i = 0; i < 40; i++) {
    const s = document.createElement("span");
    s.textContent = ["💧", "🎉", "⭐", "💙"][i % 4];
    s.style.left = Math.random() * 100 + "%"; s.style.animationDelay = Math.random() * 0.8 + "s";
    box.appendChild(s); setTimeout(() => s.remove(), 3800);
  }
}
function waterDay() { const w = U().water; if (w.d !== today()) { w.d = today(); w.n = 0; } return w; }
function renderWater(celebrate) {
  const n = waterDay().n, ml = n * GLASS, pct = Math.min(100, ml / GOAL_ML * 100);
  $("#waterFill").style.height = pct + "%";
  $("#waterTxt").textContent = `${ml} ml · ${Math.round(pct)}%`;
  $("#glasses").innerHTML = Array.from({ length: Math.max(GOAL_GLASSES, n) }, (_, i) => `<span class="${i < n ? "on" : ""}">🥛</span>`).join("");
  const msgs = [[0, "¡Empieza con tu primer vaso!"], [1, "Buen comienzo, sigue así 💪"], [3, "¡Vas por buen camino!"], [5, "Más de la mitad, no pares 🔥"], [7, "¡Casi lo logras, un vaso más!"]];
  $("#waterMsg").textContent = n >= GOAL_GLASSES ? "¡Meta cumplida! Tu cuerpo te lo agradece 🎯" : msgs.filter(m => n >= m[0]).pop()[1];
  $("#badge").hidden = n < GOAL_GLASSES;
  if (celebrate && n === GOAL_GLASSES) confetti();
}
$("#addGlass").onclick = () => { waterDay().n++; save(); renderWater(true); };
$("#remGlass").onclick = () => { const w = waterDay(); w.n = Math.max(0, w.n - 1); save(); renderWater(); };
$("#resetWater").onclick = () => { waterDay().n = 0; save(); renderWater(); };

/* ---------- MÓDULO 3: IMC, planes y fotos ---------- */
const PLANS = {
  masa: { diet: ["Superávit de +400 kcal sobre tu TDEE", "Proteína 1.8–2 g/kg, carbos altos (arroz, avena, papa)", "5 comidas al día + batido calórico"], routine: ["Lun: Pecho y tríceps", "Mar: Espalda y bíceps", "Mié: Descanso activo", "Jue: Pierna completa", "Vie: Hombro y core", "Sáb–Dom: Descanso"] },
  definicion: { diet: ["Déficit de -300 a -500 kcal", "Proteína 2–2.2 g/kg para conservar músculo", "Verduras en cada comida y grasas saludables"], routine: ["Lun: Torso fuerza", "Mar: Pierna + 15 min HIIT", "Mié: Cardio LISS 40 min", "Jue: Torso volumen", "Vie: Pierna + core", "Sáb: Cardio ligero"] },
  peso: { diet: ["Déficit moderado de -500 kcal", "Platos con ½ verduras, ¼ proteína, ¼ carbohidrato", "Evita bebidas azucaradas y ultraprocesados"], routine: ["Lun: Caminata rápida 45 min", "Mar: Fuerza cuerpo completo", "Mié: Bici o natación 40 min", "Jue: Fuerza cuerpo completo", "Vie: Cardio intervalos 30 min", "Sáb: Caminata larga"] },
  postura: { diet: ["Antiinflamatorios: pescado azul, frutos secos, verduras", "Calcio y vitamina D (lácteos, huevo, sol)", "Hidratación constante para los discos vertebrales"], routine: ["Lun: Movilidad torácica + remos", "Mar: Core (plancha, bird-dog)", "Mié: Estiramiento de pectoral y cadera", "Jue: Face pulls + glúteo", "Vie: Yoga/pilates 30 min", "Diario: pausas activas cada hora"] },
  explosividad: { diet: ["Carbohidratos antes de entrenar (plátano, avena)", "Proteína 1.8 g/kg para recuperación", "Creatina 3–5 g/día (consulta a tu médico)"], routine: ["Lun: Sentadilla pesada + saltos al cajón", "Mar: Press + lanzamientos de balón", "Mié: Descanso", "Jue: Peso muerto + sprints 10×20 m", "Vie: Pliometría y cargadas", "Sáb: Movilidad"] },
  atletismo: { diet: ["Carbohidratos complejos como base energética", "Proteína 1.6 g/kg repartida en el día", "Electrolitos y 2.5–3 L de agua en días de carga"], routine: ["Lun: Rodaje suave 5 km", "Mar: Series 6×400 m", "Mié: Fuerza de pierna y core", "Jue: Tempo run 30 min", "Vie: Descanso o natación", "Sáb: Fondo largo 10 km"] }
};
function bmiCategory(b) {
  if (b < 18.5) { return { t: "Bajo peso", tip: "Te conviene un superávit calórico y entrenamiento de fuerza. Objetivo sugerido: aumentar peso/masa.", g: "masa" }; }
  else {
    if (b < 25) {
      return { t: "Peso normal", tip: "Estás en rango saludable. Mantén tus hábitos o define tu físico.", g: "atletismo" };
    } else {
      if (b < 30) { return { t: "Sobrepeso", tip: "Un déficit moderado y actividad constante mejorarán tu composición corporal.", g: "peso" }; }
      else { return { t: "Obesidad", tip: "Empieza con caminatas y déficit gradual; consulta a un profesional de salud.", g: "peso" }; }
    }
  }
}
$("#calcBmi").onclick = () => {
  const w = num("#bw"), h = num("#bh");
  if (!(w > 0 && h > 0)) { $("#bmiOut").textContent = "⚠️ Ingresa peso y altura válidos."; return; }
  const bmi = w / Math.pow(h / 100, 2), c = bmiCategory(bmi);
  U().p = { ...U().p, bw: w, bh: h, bmi: +bmi.toFixed(1), cat: c.t, tip: c.tip, goal: $("#goal").value };
  if ($("#goal").dataset.touched !== "1") { $("#goal").value = c.g; U().p.goal = c.g; }
  save(); renderBmi();
};
$("#goal").onchange = () => { $("#goal").dataset.touched = "1"; U().p.goal = $("#goal").value; save(); renderPlan(); };
function renderBmi() {
  const p = U().p;
  $("#bmiOut").innerHTML = p.bmi ? `IMC: <b>${p.bmi}</b> — <b>${p.cat}</b><br>${p.tip}` : "Ingresa peso y altura.";
  renderPlan();
}
function renderPlan() {
  const pl = PLANS[U().p.goal || $("#goal").value];
  $("#dietList").innerHTML = pl.diet.map(x => `<li>${x}</li>`).join("");
  $("#routineList").innerHTML = pl.routine.map(x => `<li>${x}</li>`).join("");
}
$("#addPhoto").onclick = async () => {
  const f = $("#photoIn").files[0];
  if (!f) { alert("Selecciona una imagen primero."); return; }
  try {
    const src = await resizeImage(f);
    U().photos.push({ id: Date.now(), d: today(), w: num("#photoW") || null, src });
    $("#photoIn").value = ""; $("#photoW").value = ""; save(); renderPhotos();
  } catch (e) { alert("No se pudo leer la imagen."); }
};
function renderPhotos() {
  const ph = U().photos;
  $("#gallery").innerHTML = ph.map(p => `<figure><img src="${p.src}" alt="Foto ${p.d}"><button data-id="${p.id}" aria-label="Eliminar foto">✕</button><figcaption>${p.d}${p.w ? " · " + p.w + " kg" : ""}</figcaption></figure>`).join("");
  const w = ph.filter(p => p.w);
  if (w.length > 1) { const d = (w[w.length - 1].w - w[0].w).toFixed(1); $("#evoTxt").textContent = `Evolución de peso: ${d > 0 ? "+" : ""}${d} kg desde tu primera foto (${w[0].d}).`; }
  else $("#evoTxt").textContent = ph.length ? "Añade el peso en al menos dos fotos para ver tu evolución." : "Aún no hay fotos. Sube la primera para comenzar tu seguimiento.";
}
$("#gallery").onclick = e => {
  const id = e.target.dataset.id; if (!id) return;
  U().photos = U().photos.filter(p => p.id != id); save(); renderPhotos();
};

/* ---------- MÓDULO 4: Apariencia y usuarios ---------- */
const ACCENTS = { green: "#1f9d63", blue: "#2f7de1", purple: "#7e57d9", rose: "#e0507a", orange: "#e8832a", teal: "#14a3a8" };
$("#swatches").innerHTML = Object.entries(ACCENTS).map(([k, c]) => `<button data-a="${k}" style="background:${c}" aria-label="Acento ${k}"></button>`).join("");
function applySettings() {
  const s = S.settings, r = document.documentElement;
  r.dataset.theme = s.theme; r.dataset.accent = s.accent; r.dataset.style = s.style;
  $("#bgLayer").style.backgroundImage = s.bg ? `url(${s.bg})` : "none";
  $("#theme").value = s.theme; $("#style").value = s.style; $("#mode").value = s.mode;
  $("#showClock").checked = s.clock; $("#showDate").checked = s.date;
  document.querySelectorAll("#swatches button").forEach(b => b.classList.toggle("sel", b.dataset.a === s.accent));
  tick();
}
$("#theme").onchange = e => { S.settings.theme = e.target.value; save(); applySettings(); };
$("#style").onchange = e => { S.settings.style = e.target.value; save(); applySettings(); };
$("#swatches").onclick = e => { if (e.target.dataset.a) { S.settings.accent = e.target.dataset.a; save(); applySettings(); } };
$("#bgIn").onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { S.settings.bg = await resizeImage(f, 1600); save(); applySettings(); } catch (err) { alert("No se pudo cargar la imagen."); }
};
$("#bgClear").onclick = () => { S.settings.bg = ""; save(); applySettings(); };
$("#showClock").onchange = e => { S.settings.clock = e.target.checked; save(); tick(); };
$("#showDate").onchange = e => { S.settings.date = e.target.checked; save(); tick(); };

function tick() {
  const n = new Date(), s = S.settings;
  $("#time").textContent = n.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  $("#date").textContent = n.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  $("#time").hidden = !s.clock; $("#date").hidden = !s.date; $("#clock").hidden = !s.clock && !s.date;
}
setInterval(tick, 1000);

function renderUsers() {
  const trainer = S.settings.mode === "entrenador";
  $("#userBox").hidden = !trainer; $("#renameBox").hidden = trainer;
  $("#userSel").innerHTML = S.users.map(u => `<option value="${u.id}" ${u.id === S.active ? "selected" : ""}>${esc(u.name)}</option>`).join("");
  $("#rename").value = U().name;
  $("#bannerName").textContent = U().name;
  $("#avatar").textContent = U().name.charAt(0).toUpperCase() || "U";
  $("#bannerSub").textContent = trainer ? `Modo entrenador · ${S.users.length} persona(s) registradas` : "Modo individual";
}
$("#mode").onchange = e => { S.settings.mode = e.target.value; save(); renderUsers(); };
$("#rename").oninput = e => { U().name = e.target.value.trim() || "Usuario"; save(); $("#bannerName").textContent = U().name; $("#avatar").textContent = U().name[0].toUpperCase(); };
$("#addUser").onclick = () => {
  const n = $("#newUser").value.trim(); if (!n) { alert("Escribe un nombre."); return; }
  const u = newUser(n); S.users.push(u); S.active = u.id; $("#newUser").value = ""; save(); renderAll();
};
$("#userSel").onchange = e => { S.active = e.target.value; save(); renderAll(); };
$("#delUser").onclick = () => {
  if (S.users.length < 2) { alert("Debe existir al menos un usuario."); return; }
  if (!confirm(`¿Eliminar a ${U().name} y todos sus datos?`)) return;
  S.users = S.users.filter(u => u.id !== S.active); S.active = S.users[0].id; save(); renderAll();
};

/* ---------- Render global (cambia de usuario) ---------- */
function renderAll() {
  const p = U().p;
  $("#weight").value = p.w || ""; $("#height").value = p.h || "";
  $("#bw").value = p.bw || ""; $("#bh").value = p.bh || "";
  $("#goal").value = p.goal || "masa";
  renderUsers(); renderTdee(); renderFood(); renderWater(); renderBmi(); renderPhotos();
}
applySettings(); renderAll();
