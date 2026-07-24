# Turni & Ferie — versione 4.0 definitiva

Pacchetto consolidato e verificato prima del deploy.

Correzioni principali:
- login Supabase reale;
- finestra di recupero password con email obbligatoria;
- gestione del link Supabase PASSWORD_RECOVERY;
- cambio password dal profilo con conferma e logout;
- cache disattivata per HTML, JavaScript e CSS;
- nessun service worker;
- grafica minimal;
- istogramma ferie con mesi sull’asse orizzontale;
- tooltip calendario;
- titolo senza anno;
- indicatore visibile “Versione 4.0” nella pagina di accesso.

Commit consigliato: `Versione 4 definitiva verificata`


## Versione 4.2
- Selezione di uno o più periodi di ferie.
- Generazione automatica del testo per il dirigente.
- Copia del testo e apertura dell'email già compilata.
- Destinatario memorizzato solo nel browser.

- Versione 4.3: aggiunti istogramma giornaliero ferie con giorni sotto il reticolo e calendario ferie/sabati più integrato.

- Versione 4.4: colori operatori più distinti; caselle ferie colorate per operatore e divise in più colori; clic sul giorno per inserire ferie o gestire il turno del sabato.

- Versione 4.5: gestione completa dal calendario: aggiunta, modifica e rimozione ferie per singolo giorno; inserimento, modifica ed eliminazione turno del sabato.


## Versione 4.6
- nuova voce di menu Inserisci ferie con pannello dedicato;
- anteprima durata, sabati compresi e conflitti;
- salvataggio e generazione immediata della richiesta;
- note giornaliere condivise, modificabili dal calendario;
- indicatore nota e testo nel tooltip.

Prima del deploy eseguire AGGIORNAMENTO_SUPABASE_NOTE.sql nel SQL Editor di Supabase.

- Versione 4.7: dashboard con riepilogo individuale dei sabati assegnati, svolti e da svolgere per Ivan Murelli, Michele Doris e Piero Canteri.

- Versione 4.8: aggiunta pagina Promemoria turni per singolo operatore o prospetto completo, con copia, email e stampa/PDF.


## Versione 5.0 consolidata
- anno selezionabile e viste filtrate per anno;
- destinatari condivisi in Supabase;
- selezione manuale dei turni da comunicare;
- tracciamento comunicazioni preparate/inviate;
- controlli su duplicati, sovrapposizioni e conflitti prima del salvataggio;
- registro modifiche più leggibile.

Prima del deploy eseguire `AGGIORNAMENTO_SUPABASE_V5.sql` nel SQL Editor di Supabase.
