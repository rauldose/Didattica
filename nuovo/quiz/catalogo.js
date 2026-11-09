/*
 * Impara giocando – quiz: catalogue of Prof. Muscolino's exercise sets.
 * id = "EG:<id in dati/eg/eg-dati.js>" or "EM:<cartella in dati/em/em-dati.js>".
 * eta = [from, to] class index (0 = 3ª primaria … 5 = 3ª media), used for the
 * age hint and to map the child's class onto the set's levels.
 * livelli = number of distinct levels (checked by the tests).
 * The pure demo/example sets (A1–A4DEMO, EM esempio1–5, talete) are left out,
 * but gioca.html can still play them (?set=EM:esempio4).
 */
window.QUIZ_CATALOGO = [
  /* ---------------- Italiano ---------------- */
  { id: "EG:ERRORI", materia: "ita", emoji: "🔍", titolo: "Caccia all'errore", sotto: "Trova la parola sbagliata e scrivila giusta", eta: [1, 4], livelli: 2 },
  { id: "EG:DOPPIE", materia: "ita", emoji: "✏️", titolo: "Doppie", sotto: "Completa le parole con le lettere giuste", eta: [0, 2], livelli: 1 },
  { id: "EG:PLURAL", materia: "ita", emoji: "👨‍👩‍👧", titolo: "Plurali", sotto: "Dal singolare al plurale… e ritorno!", eta: [0, 3], livelli: 1 },
  { id: "EG:VERBI", materia: "ita", emoji: "🏃", titolo: "Verbi", sotto: "Coniuga il verbo come ti chiede", eta: [2, 5], livelli: 2 },
  { id: "EM:verbi", materia: "ita", emoji: "📝", titolo: "Verbi nella frase", sotto: "Completa la frase con il verbo giusto", eta: [3, 5], livelli: 1 },
  { id: "EG:GRAMMA", materia: "ita", emoji: "📚", titolo: "Grammatica", sotto: "Vero o falso, sillabe e parole da correggere", eta: [0, 3], livelli: 4 },
  /* ---------------- Scienze ---------------- */
  { id: "EG:BATTERI", materia: "sci", emoji: "🦠", titolo: "Batteri", sotto: "Completa le frasi sui batteri", eta: [2, 4], livelli: 1 },
  { id: "EG:CELLULA", materia: "sci", emoji: "🔬", titolo: "La cellula", sotto: "Nucleo, cloroplasti e altri organuli", eta: [2, 4], livelli: 1 },
  { id: "EM:schele", materia: "sci", emoji: "🦴", titolo: "Lo scheletro", sotto: "Tocca le ossa sul disegno!", eta: [2, 5], livelli: 5 },
  /* ---------------- Matematica ---------------- */
  { id: "EG:OPERAZ", materia: "mat", emoji: "➕", titolo: "Operazioni", sotto: "Tabelline, somme, sottrazioni e divisioni", eta: [0, 3], livelli: 5 },
  { id: "EM:operaz", materia: "mat", emoji: "✖️", titolo: "Calcolo veloce", sotto: "Prodotti, somme, sottrazioni e divisioni", eta: [0, 3], livelli: 5 },
  { id: "EG:MUDI", materia: "mat", emoji: "➗", titolo: "Multipli e divisori", sotto: "Quando un numero è divisibile per un altro?", eta: [2, 3], livelli: 2 },
  { id: "EG:FATTORI", materia: "mat", emoji: "🧩", titolo: "Scomposizione in fattori", sotto: "Scomponi i numeri in fattori primi", eta: [3, 4], livelli: 4 },
  { id: "EG:POTENZE1", materia: "mat", emoji: "🚀", titolo: "Potenze", sotto: "Calcola le potenze e usa le proprietà", eta: [3, 4], livelli: 1 },
  { id: "EG:TOT", materia: "mat", emoji: "🧮", titolo: "Espressioni", sotto: "Risolvi le espressioni passo dopo passo", eta: [3, 5], livelli: 3 }
];
window.QUIZ_MATERIE = {
  ita: { nome: "Italiano", emoji: "📖", tema: "t-ita" },
  sci: { nome: "Scienze", emoji: "🌱", tema: "t-sci" },
  mat: { nome: "Matematica", emoji: "🔢", tema: "t-mat" },
  altro: { nome: "Altro", emoji: "💡", tema: "t-lab" }
};
