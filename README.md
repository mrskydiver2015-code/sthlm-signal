# STHLM Signal

En fristående Three.js-prototyp av Stockholm. Appen körs direkt från statiska filer, utan backend eller byggsteg.

## Förhandsvisa i molnmiljön

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Öppna sidan i en WebGL-kompatibel webbläsare. Three.js r128 serveras från den incheckade `vendor/three.min.js`; de valfria typsnitten använder `fonts.googleapis.com` och `fonts.gstatic.com`.

## Styrning

- **Dator:** WASD eller piltangenter, Skift eller dubbeltryck och håll W för att springa 2×, dra med musen för att titta och skrolla för kameraavstånd. E interagerar, H visar hjälp, R återställer positionen och M växlar ljud.
- **Hastigheter:** 1× gång, 2× löpning, 4× snabb färd. Tangenterna 1/2/3 och HUD-knapparna väljer läge; 3 växlar mellan 4× och 1×. Skift ändrar tillfälligt gång till 2×.
- **Mobil:** vänster touchyta styr rörelse och höger touchyta kameran. Båda kan användas samtidigt. Rörelse är relativ till kameran på båda plattformarna.
- Gester och nedtryckta tangenter nollställs vid fokusförlust, panelöppning och storleksändring. Touchytorna använder `touch-action: none`; formulär kan fortfarande användas normalt.

## Kvällens kvarter

Följ vägvisaren till de upplysta entréringarna och tryck **E** eller **Gå in**:

- **NOD-passagen**, en fiktiv designpassage vid Galleri NOD på Biblioteksgatan: skärgårdslykta, keramik och en liten bokutställning.
- **Sturegallerian**, väster om Svampen: mässing, musik, Salongen, Signalstudion och fem animerade konstverk.

Utforska montrar och prata med förbipasserande. Fem objekt bildar en kvällssamling under den aktuella sessionen. Vägvisarens knapp växlar mellan galleriorna; inne visar den avståndet till utgången. HUD:s utgångsknapp ger också en väg tillbaka. Vid spelområdets gränser finns synliga markeringar.

Arkitektur, navigationsaudit och mätmetod finns i [docs/urban-iteration.md](docs/urban-iteration.md).

## Lokal utvecklingsinloggning

Ange ett användarnamn och välj **Logga in lokalt**. En mockanvändare sparas under `sthlmSignalDevUser`, medan avatar, intressen och kontakter sparas under `sthlmSignalProfile` i `localStorage`. Ingen autentisering eller nätverksöverföring sker. En återkommande profil kan öppnas direkt eller redigeras via signal-knappen.

`config.js` innehåller flaggan `externalAuthEnabled`, som är `false` som standard. `true` visar de tidigare isolerade Google/Facebook/e-post-skärmarna. De är fortfarande platshållare, inte fungerande OAuth. Riktig OAuth kräver separat implementation. Eftersom appen är statisk läser den inte serverns miljövariabler; vid driftsättning kan ett konfigurationssteg generera `config.js` från en miljövariabel. Lägg aldrig hemligheter i den filen.

Ta bort båda lagringsnycklarna i webbläsarens utvecklarverktyg för att återställa den lokala profilen. Mockinloggningen är endast för utveckling och ger inga åtkomstskydd.

## Grafik och mobilbudget

Renderingen använder ACES Filmic, sRGB-utdata och PBR-material med separata egenskaper för sten, tyg, våt mark och metall. En liten procedurgenererad HDR-miljö filtreras med PMREM en gång vid start för IBL; ingen extern HDR-fil eller löpande miljöfångst behövs. Miljön är stiliserad och ersätter inte exakta lokala spegelreflektioner.

Utomhus följer en begränsad PCFSoft-skuggkarta spelaren. Mobil använder 512² skuggor, högst 1,25 i pixelkvot, ingen MSAA och inga NPC-skuggor; dator använder 1024² och högst 2 i pixelkvot. Inomhus används miljöljus utan den yttre månens skuggor. Det finns inga skuggkastande punktljus eller extra efterbehandlingspass. Upprepade props och medborgarkroppar använder instansiering och delad geometri. Avlägsna medborgare förenklas; animerade konsttexturer uppdateras högst 12 gånger per sekund. Procedurfasader begränsas till 256 pixlar på mobil och 512 på dator. Canvastexturerna är små men inte GPU-komprimerade KTX2-filer. Verklig 60 FPS måste verifieras på måltelefoner.

## Webbläsartester

Node.js och Playwright används enbart för tester; appen behöver ingen npm-installation.

```sh
npm ci
npx playwright install chromium
npm test
```

Testerna startar en egen lokal server och täcker kamerarelativ WASD/pilstyrning i fyra riktningar, fokusförlust, musdragning, lokal inloggning/omladdning, HTML-säker visning av namn, mobilens multitouch/avbrott/rotation, grafikinställningar och leverantörsflaggan. Stadstesterna verifierar 1×/2×/4×, dubbeltryck W, mobil joystick vid 4×, kollisionskartans tillgänglighet, båda entréer/utgångar, samtliga montrar och dialoger. Skärmbilder skrivs till ignorerade `test-results/`.

För befintlig Chromium: `BROWSER_PATH=/usr/bin/chromium npm test`.
Kör byggning och tester i molnmiljön; Windows-kopian är ett passivt arkiv.

### Arkitekturregressioner

- `npm run test:input` jämför tangentbord och riktiga emulerade touchhändelser mot kamerans faktiska framåt-/högerriktning vid 0°, 90°, 180° och 270°. Motstående tangenter, diagonal hastighet, fokusförlust och touch-avbrott kontrolleras också.
- `npm run test:budget` kör den riktiga renderingsloopen med slumpfrö 1842 och fast tidssteg 1/60 s. Scenen står vid (0, 0, 30), yaw 0 och pitch 0,28, i desktop- och mobilprofil; desktop kontrolleras också vid startplatsen (0, 0, -14). Alla 12 uppvärmningsbilder och 60 efterföljande bilder måste hålla högst 400 draw calls.
- `renderer.info.autoReset = false` och en återställning i början av varje applikationsbild gör att skuggpasset ingår. Saknad rendering, överskriden gräns samt runtime-/shaderfel underkänner testet.
- `npm test` inkluderar dessa tester och befintliga smoke-/stadstester. GitHub Actions kör samma svit vid push och pull request och sparar testunderlag.
- Rapporten `test-results/render-budget.json` innehåller mätvärden, miljö, scenparametrar och revision. Resursantal är inte uppmätt GPU-minne. En representativ vy är inte full täckning av alla scener och övergångar.
- `input-manager.js` äger gemensam rörelseinput. DOM-adaptrarna ligger kvar i `index.html`; kamerans världskoordinater beräknas i rörelsekontrollern.
- Three.js är låst till npm-version 0.128.0. Efter en avsiktlig versionsuppdatering körs `npm run vendor:three` och både lockfil, bibliotek och licens checkas in. Testerna kontrollerar att den lokala bibliotekskopian matchar paketet.

`sthlmDiagnostics()` visar nu hela bildrutans draw calls. Faktisk FPS, frame pacing och fysisk touchkänsla måste verifieras på målmaskiner mot den publicerade versionen.
