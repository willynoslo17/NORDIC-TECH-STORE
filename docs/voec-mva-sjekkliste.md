# Sjekkliste VOEC / MVA — Novverk

Tekst til intern avklaring. Ingen tall er lagt inn her utover det som allerede står på nettstedet. Det som ikke er avklart, er merket **por confirmar**. Betaling og Stripe er ikke endret.

## Det som allerede står på novverk.no

- Selger som er oppgitt: Martinez Lozano Internasjonal Handel, norsk enkeltpersonforetak (ENK), org.nr 935 407 095 MVA, Norbygata 19, 0187 Oslo, Norge.
- Personvernet oppgir at foretaket er registrert i Merverdiavgiftsregisteret.
- Butikken oppgir salg til Norge.
- Bunnteksten på forsiden oppgir: «Priser i NOK inkl. 25 % MVA».
- Fraktsiden oppgir frakt «inkl. MVA».
- Kassen er av. Ingenting belastes før lager, levering og produktsikkerhet er verifisert for hver vare.

## Avklar før VOEC eller MVA brukes i tekst, faktura eller kasse

- [ ] **por confirmar:** Om salget skal føres som ordinær norsk MVA (foretaket er oppgitt som MVA-registrert i Norge) eller under VOEC-ordningen for utenlandske selgere. Ikke konkluder ut fra denne filen.
- [ ] **por confirmar:** Om varer som sendes fra lager utenfor Norge endrer MVA-behandlingen, import eller toll. Stedene som allerede er nevnt på fraktsiden (blant annet Asia, Europa, Tyskland og Tsjekkia) er ikke en avgjørelse.
- [ ] **por confirmar:** Beløpsgrense for VOEC. Ikke skriv inn et tall før det er bekreftet for denne butikken.
- [ ] **por confirmar:** MVA-sats per varetype. Forsiden nevner 25 %. Om den satsen gjelder alle varer i katalogen, er ikke avklart.
- [ ] **por confirmar:** At hver utsalgspris i katalogen (`priceNok`) er inklusive MVA, og at frakten som vises i kassen er regnet på samme måte. Beløpene står på nettstedet; sammensetningen er ikke dokumentert i denne filen.
- [ ] **por confirmar:** VOEC-nummer. Det finnes ikke i repoet.
- [ ] **por confirmar:** Om faktura eller ordrebekreftelse må vise MVA-spesifikasjon, og med hvilke felter. Malen i `docs/ordrebekreftelse-mal.md` har plass til beløp fra ordren, ikke en MVA-linje.
- [ ] **por confirmar:** Hvem som leverer MVA-melding, og for hvilken periode. Ingen frist er satt her.
- [ ] **por confirmar:** Om noen varer er unntatt MVA eller har redusert sats.

## Ikke gjort

- Ingen endring i Stripe, i sjekken av nøkkel, eller i kasseflagget.
- Ingen e-post er sendt.
- Ingen sats, terskel eller VOEC-nummer er funnet på eller lagt inn.
