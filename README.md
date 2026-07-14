# Turni & Ferie 2026

Web app privata pronta per la pubblicazione su Netlify.

## Funzioni incluse
- login demo;
- dashboard;
- turni del sabato;
- distinzione GIP Penale e GIP Civile;
- ferie e approvazioni;
- controllo automatico conflitti turno/ferie;
- calendario mensile;
- statistiche per operatore;
- registro modifiche;
- esportazione backup JSON;
- installazione come PWA.

## Accesso demo
- Email: `admin@demo.it`
- Password: `demo123`

## Pubblicazione su Netlify
1. Decomprimere il file ZIP.
2. Trascinare la cartella nella sezione Netlify Drop, oppure collegarla a un repository GitHub.
3. Non è richiesto alcun comando di build.

## Dati
Questa versione salva i dati nel browser tramite `localStorage`. È ideale per provare grafica e flusso operativo, ma non per l'uso simultaneo da più dispositivi.

Per l'uso reale da 3/4 persone occorre collegare il progetto a Supabase, sostituendo il salvataggio locale con tabelle condivise e autenticazione Supabase.
