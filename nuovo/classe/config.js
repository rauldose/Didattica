/*
 * Impara giocando – "La mia classe": configuration.
 *
 * CLASSE_API is the address of the class API (the Cloudflare Worker in
 * server/), e.g. "https://impara-classe.example.workers.dev".
 * Empty ""  → every online feature is hidden and the site works as before.
 *
 * Override on one device (for tests or for a school hosting its own API):
 * open the browser console on any page of the site and run
 *     localStorage.setItem("impara.api", "https://mia-scuola.example.org")
 * and to go back to the value written here:
 *     localStorage.removeItem("impara.api")
 * Only http(s) addresses are accepted; "off" disables the online features
 * on that device even when an address is written here.
 */
window.CLASSE_API = "";

(function () {
  "use strict";
  var v = null;
  try { v = localStorage.getItem("impara.api"); } catch (e) { /* storage blocked */ }
  if (v != null) {
    v = String(v).trim().replace(/^"(.*)"$/, "$1");          // also accept a JSON string
    if (v === "off") window.CLASSE_API = "";
    else if (/^https?:\/\/[^\s"'<>]+$/i.test(v)) window.CLASSE_API = v;
  }
  window.CLASSE_API = String(window.CLASSE_API || "").replace(/\/+$/, "");
})();
