# MLDBOT

Bot Discord construit cu Node.js 18+ și discord.js 14, cu funcții de casino, level, invitații, verificare, tichete și mesaje configurabile.

## Instalare și configurare

1. Creează aplicația și botul în [Discord Developer Portal](https://discord.com/developers/applications) și invită botul cu scope-urile `bot` și `applications.commands`.
2. Activează **Server Members Intent** și **Message Content Intent** în pagina **Bot** a aplicației.
3. Copiază `.env.example` în `.env` și completează tokenul Discord și ID-ul aplicației. `DISCORD_TOKEN` este variabila recomandată; `TOKEN` este acceptată ca alternativă. `OWNER_IDS` este opțional și poate conține ID-urile ownerilor separate prin virgulă.
4. Configurează funcțiile din Discord: `/setup-verify` cere rolul de verificare, `/setup-ticket` cere categoria tichetelor, rolul staff și canalele necesare, iar `/setup-level` cere canalul pentru anunțurile de level-up și acceptă un banner opțional.
5. Mesajele de bun venit se configurează direct din Discord cu `/setup-welcome`: selectează canalul și, opțional, încarcă o imagine. Dacă nu alegi imagine, se folosește bannerul local `assets/mldbot-banner.jpg`. Folosește `/disable-welcome` pentru a opri mesajele. Botul trebuie să aibă permisiunea **Manage Server** (pentru citirea invitațiilor) și permisiunea de a trimite mesaje în canalele configurate.
6. Instalează dependențele și publică toate comenzile:

```sh
npm install
npm run deploy:commands
npm start
```

### Dashboard web

Dashboard-ul din proiectul `sitebot` rulează pe Cloudflare Workers și salvează sesiunile OAuth și configurările în D1. Botul poate rămâne pe Railway; pentru sincronizarea securizată configurează în variabilele Railway:

- `DASHBOARD_SYNC_URL=https://botsite.oltenia.xyz/api/internal/configs` (înlocuiește domeniul dacă folosești altul).
- `DASHBOARD_SYNC_SECRET` cu aceeași valoare configurată ca secret în Worker-ul Cloudflare.

După publicarea acestei versiuni, botul preia setările de dashboard la pornire și apoi periodic, actualizează fișierele locale și confirmă sincronizarea în Cloudflare. Comenzile `/setup-verify`, `/setup-ticket` și `/setup-level` sincronizează înapoi câmpurile aferente. Nu pune tokenul botului sau secretul de sincronizare în cod ori în repository.

Comenzile slash sunt publicate global, iar propagarea lor poate dura. Pentru actualizare rapidă într-un server, poți seta temporar `GUILD_ID` în mediul procesului când publici comenzile. ID-ul aplicației poate fi furnizat drept `CLIENT_ID` sau `APPLICATION_ID`.

Botul are nevoie de permisiuni pentru gestionarea rolurilor, canalelor, mesajelor, embed-urilor și componentelor, în funcție de funcțiile folosite. Rolul botului trebuie să fie deasupra rolului de verificare. Pentru a publica din nou comenzile, rulează `npm run deploy:commands`.

Nu publica și nu partaja fișierul `.env`. Imaginile MLDBOT folosite implicit sunt păstrate în `assets`.

## Funcții și comenzi

### Economie și jocuri

- Prefix implicit `!`, configurabil prin `PREFIX`.
- `!credite` (sau `!credits`), `!transfer @utilizator <sumă>`, `!daily`, `!leaderboard`, `!stats [@utilizator]`
- `!blackjack <miză>`, `!poker <miză>`, `!craps <miză>` și comenzile admin `!admin_add_credits`, `!admin_remove_credits`, `!admin_reset`
- Comenzi slash pentru economie, jocuri și administrare (`/credite`, `/credits`, `/transfer`, `/daily`, `/leaderboard`, `/stats`, `/blackjack`, `/poker`, `/craps`, `/admin_*`), plus `/glitchhelp` și `!glitchhelp`.
- Soldurile și statisticile sunt păstrate în `data/database.json` (sau în calea configurată prin `DATA_FILE`).
- Activitatea în chat oferă XP cu un cooldown de 60 de secunde per utilizator/server. `/level` (sau `!level`) arată nivelul și progresul; `/missions` (sau `!missions`) arată misiunile zilnice de chat și folosire a unei comenzi publice alese pentru ziua respectivă.

### Verificare, tichete și mesaje

- `/setup-verify rol:<rol>` salvează rolul pentru server și publică mesajul de verificare; butonul atribuie acel rol.
- `/setup-ticket categorie:<categorie> staff:<rol> sugestii:<canal> [loguri] [panou]` salvează setările și publică panoul pentru bug-uri, cheateri și sugestii.
- Tichetele sunt private, iar autorul și staff-ul le pot închide.
- `/post` ghidează administratorul la publicarea unui mesaj cu imagine opțională.
- `/setup-welcome` selectează canalul și imaginea pentru mesajele automate, iar `/disable-welcome` dezactivează funcția. Configurația este separată pentru fiecare server și salvată în `data/welcome-config.json`.
- `/setup-level canal:<canal> [imagine]` selectează canalul și bannerul pentru anunțurile de nivel; mesajul menționează membrul și nivelul atins, fără numele contului Discord. XP-ul și progresul misiunilor se păstrează în `data/levels.json`.
- Rolurile/canalele de verificare și tichete sunt salvate per server în `data/server-config.json`, nu în `.env`.
- Trackerul de invitații identifică inviter-ul la intrarea unui membru și afișează totalul invitațiilor în canalul ales. Istoricul invitațiilor este salvat în `data/invites.json`.

## Teste

Rulează `npm test` pentru testele economiei, jocurilor, comenzilor și datelor persistente.
