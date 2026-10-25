# Prove manuali prima del rilascio

Da fare a mano nel browser (`pnpm dev`, poi `http://localhost:5173`); i test automatici non
coprono questi comportamenti visivi. Spunta ogni voce, poi **elimina questo file** prima di
taggare la release.

Per fare da viewer usa una finestra in incognito o un altro browser, così non sei riconosciuto
come editor.

## Salvataggio dei commenti

- [ ] **Testo rifiutato che torna nella casella.** Da viewer, apri la review space; da editor,
      in un'altra finestra, attiva "Read-only" sul mockup. Senza ricaricare, da viewer:
  - [ ] scrivi una risposta e inviala → compare l'errore e il testo torna nella casella;
  - [ ] crea un pin con un commento → il popover del pin si riapre con il testo;
  - [ ] scrivi un commento generale (`C`) → il popover si riapre con il testo;
  - [ ] modifica un tuo commento → la modifica si riapre con il testo nuovo.
- [ ] **Coda offline.** DevTools → Network → Offline. Crea un pin, poi rispondi al suo thread:
      la toolbar mostra "Offline — retrying". Torna online: si salvano entrambi, nell'ordine,
      senza errori, e la toolbar mostra "Saved".
- [ ] **Bozza non persa.** Offline, scrivi e invia una risposta, poi chiudi la scheda prima di
      tornare online. Torna online e riapri il link e quel thread: il testo non inviato è di
      nuovo nella casella di risposta.

## Link revocati

- [ ] Da viewer tieni aperta la review space; da editor disattiva il link → entro ~25 secondi il
      viewer vede "Link not available".
- [ ] Come sopra, ma con "New link" (rigenera) → stesso risultato.
- [ ] Come sopra, ma impostando una scadenza tra un minuto → dopo la scadenza, stesso risultato.
- [ ] L'editor con il link disattivato continua a usare la review space normalmente.

## Pin

- [ ] **Numeri stabili.** Crea tre pin, poi cancella il commento del pin 2 (il thread sparisce):
      il pin 3 resta 3 e il prossimo pin creato è il 4, già mentre si salva.
- [ ] **Pin che seguono la pagina.** Su un mockup con contenuti dinamici (tab, accordion,
      elementi aggiunti da script), i pin restano sugli elementi giusti quando la pagina cambia.

## Toolbar

- [ ] Trascinala verso ogni bordo: si ferma a pochi pixel dal bordo, senza uscire.
- [ ] Spostala in un angolo, poi rimpicciolisci la finestra: rientra nello schermo.

## Sviluppo

- [ ] Con `pnpm dev` attivo, modifica qualcosa in `src/bridge` (per esempio il colore
      dell'evidenziazione in `overlay.ts`) e ricarica la review space: la modifica si vede
      senza riavviare il server.
