// Test suite di verifica di sicurezza e integrità con dati 100% sintetici
const http = require('http');

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:3000${path}`);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== INIZIO VERIFICA DI SICUREZZA (DATI SINTETICI) ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Visitatore non autenticato non può leggere dati
  console.log('--- TEST 1: Controllo Accesso Non Autenticato ---');
  const unauthBootstrap = await request('GET', '/api/bootstrap');
  assert(unauthBootstrap.status === 401, 'GET /api/bootstrap senza token risponde 401 Unauthorized');

  const unauthProfile = await request('GET', '/api/profile');
  assert(unauthProfile.status === 401, 'GET /api/profile senza token risponde 401 Unauthorized');

  const unauthSheets = await request('GET', '/api/sheets');
  assert(unauthSheets.status === 401, 'GET /api/sheets senza token risponde 401 Unauthorized');

  const unauthPec = await request('GET', '/api/pec-settings');
  assert(unauthPec.status === 401, 'GET /api/pec-settings senza token risponde 401 Unauthorized');

  // Tentativo di bypass con header x-user-matricola falso
  const forgedHeader = await request('GET', '/api/bootstrap', { 'x-user-matricola': '0000001705' });
  assert(forgedHeader.status === 401, 'GET /api/bootstrap con header x-user-matricola contraffatto viene respinto (401)');

  // 2. Accessi rapidi e password predefinite non funzionano più
  console.log('\n--- TEST 2: Rimozione Accessi Rapidi e Password Predefinite ---');
  const quickLogin = await request('POST', '/api/auth/quick-login');
  assert(quickLogin.status === 404 || quickLogin.status === 401, 'Endpoint /api/auth/quick-login disabilitato / non trovato (404)');

  const defaultPassLogin = await request('POST', '/api/auth/login', {}, {
    identifier: 'NON_EXISTENT_9999',
    password: 'DefaultBypassPassword!',
  });
  assert(defaultPassLogin.status === 401, 'Tentativo di login con credenziali arbitrarie respinto (401)');

  // 3. Registrazione protetta da Codice Invito Aziendale
  console.log('\n--- TEST 3: Registrazione Protetta da Codice Invito ---');
  const uid = Date.now();
  const matA = `SYNTH-${uid}-A`;
  const matB = `SYNTH-${uid}-B`;

  const regWithoutCode = await request('POST', '/api/auth/register', {}, {
    nome: 'TEST',
    cognome: 'DIPENDENTE_A',
    matricola: matA,
    email: `synth.${uid}.a@test.local`,
    postazione: 'Taranto Centro - Postazione 118',
    password: 'PasswordSicura123!',
    codiceInvito: 'CODICE_ERRATO',
  });
  assert(regWithoutCode.status === 403, 'Registrazione con codice invito errato respinta con 403 Forbidden');

  // Registrazione valida per Dipendente A con codice valido
  const regUserA = await request('POST', '/api/auth/register', {}, {
    nome: 'TEST',
    cognome: 'DIPENDENTE_A',
    matricola: matA,
    email: `synth.${uid}.a@test.local`,
    postazione: 'Taranto Centro - Postazione 118',
    password: 'PasswordSicura123!',
    codiceInvito: 'SET118-ATTIVAZIONE-2026',
  });
  assert(regUserA.status === 201 && regUserA.body.token, 'Registrazione dipendente A con codice valido avvenuta con successo (201) e token emesso');
  const tokenA = regUserA.body.token;

  // Registrazione valida per Dipendente B
  const regUserB = await request('POST', '/api/auth/register', {}, {
    nome: 'TEST',
    cognome: 'DIPENDENTE_B',
    matricola: matB,
    email: `synth.${uid}.b@test.local`,
    postazione: 'Taranto Sud - Postazione 118',
    password: 'PasswordSicura456!',
    codiceInvito: 'SET118-ATTIVAZIONE-2026',
  });
  assert(regUserB.status === 201 && regUserB.body.token, 'Registrazione dipendente B avvenuta con successo (201) e token emesso');
  const tokenB = regUserB.body.token;

  // 4. Isolamento Dati: Dipendente A non può accedere o modificare i dati di Dipendente B
  console.log('\n--- TEST 4: Isolamento Rigoroso tra Dipendenti (RBAC & Multi-tenant) ---');
  // Dipendente A crea un foglio turni
  const saveSheetA = await request(
    'POST',
    '/api/sheets/2026-09',
    { Authorization: `Bearer ${tokenA}` },
    {
      id: '2026-09',
      anno: 2026,
      mese: 9,
      nomeMese: 'SETTEMBRE 2026',
      entries: [
        {
          id: 'entry-a-1',
          giorno: '05/09/2026',
          orarioOrdinario: '07:00 - 13:00',
          orarioStraordinario: '13:00 - 16:00',
          motivo: 'Soccorso 118 Prolungato',
          tipoDestinazione: 'MONTE_ORE',
          minutiEffettuati: 180,
          totaleOreMonteOre: '3h 00m',
          totaleOreStraordinario: '0h 00m',
          oreDecimali: 3,
        },
      ],
      totaleMinutiMonteOre: 180,
      totaleMinutiStraordinario: 0,
      totaleMinutiComplessivo: 180,
      status: 'BOZZA',
    }
  );
  assert(saveSheetA.status === 200, 'Dipendente A salva il proprio foglio orari');

  // Dipendente B legge i propri fogli
  const sheetsB = await request('GET', '/api/sheets', { Authorization: `Bearer ${tokenB}` });
  const hasSheetFromA = (sheetsB.body.sheets || []).some((s) => s.entries?.some((e) => e.id === 'entry-a-1'));
  assert(!hasSheetFromA, 'Dipendente B NON vede i turni di Dipendente A (Isolamento garantito)');

  // Dipendente B tenta di impersonare A inviando header o parametri malevoli
  const impersonateAttempt = await request(
    'GET',
    `/api/bootstrap?user=${matA}`,
    { Authorization: `Bearer ${tokenB}`, 'x-user-matricola': matA }
  );
  assert(
    impersonateAttempt.body.profile?.matricola === matB,
    'Tentativo di Dipendente B di manipolare parametri per leggere Dipendente A ignorato: server restituisce solo dati di B'
  );

  // 5. Verifica Conteggi Straordinari e Monte Ore
  console.log('\n--- TEST 5: Verifica Correttezza Logica Conteggi Straordinari e Monte Ore ---');
  const sheetsA = await request('GET', '/api/sheets/2026-09', { Authorization: `Bearer ${tokenA}` });
  const sheetA = sheetsA.body.sheet;
  assert(
    sheetA && sheetA.totaleMinutiMonteOre === 180 && sheetA.totaleOreMonteOreFormatted === '3h 00m',
    'Conteggio Monte Ore conforme: 180 minuti = 3h 00m esatte'
  );

  // Aggiunta secondo turno con destinazione straordinario (120 min)
  const addOvertime = await request(
    'POST',
    '/api/sheets/2026-09',
    { Authorization: `Bearer ${tokenA}` },
    {
      ...sheetA,
      entries: [
        ...sheetA.entries,
        {
          id: 'entry-a-2',
          giorno: '12/09/2026',
          orarioOrdinario: '13:00 - 19:00',
          orarioStraordinario: '19:00 - 21:00',
          motivo: 'Emergenza Territoriale',
          tipoDestinazione: 'STRAORDINARIO',
          minutiEffettuati: 120,
        },
      ],
    }
  );
  assert(
    addOvertime.body.sheet.totaleMinutiMonteOre === 180 &&
      addOvertime.body.sheet.totaleMinutiStraordinario === 120 &&
      addOvertime.body.sheet.totaleMinutiComplessivo === 300,
    'Conteggio cumulativo perfetto: 180m Monte Ore + 120m Straordinario = 300m Complessivi (5h 00m)'
  );

  // 6. Test Invio PEC in Simulazione / Demo (Zero invii reali)
  console.log('\n--- TEST 6: Protezione PEC e Nessun Invio Reale ---');
  // Accesso all'Ambiente Demo
  const demoLogin = await request('POST', '/api/auth/demo-login');
  assert(demoLogin.status === 200 && demoLogin.body.isDemo === true, 'Login in Ambiente Dimostrativo riuscito con isDemo=true');
  const demoToken = demoLogin.body.token;

  // Invio PEC in Demo (DEVE essere intercettato come simulazione)
  const demoPecSend = await request(
    'POST',
    '/api/pec/send',
    { Authorization: `Bearer ${demoToken}` },
    {
      sheetId: '2026-09',
      tipoDocumento: 'PROSPETTO_STRAORDINARI',
    }
  );
  assert(
    demoPecSend.status === 200 &&
      demoPecSend.body.log?.esito === 'SIMULATO' &&
      demoPecSend.body.sheet?.pecInvioInfo?.ricevutaAccettazione === false,
    'Invio PEC in ambiente Demo marcato rigorosamente come SIMULATO (Nessuna email reale inviata, nessuna ricevuta finta)'
  );

  // Test connessione PEC in Demo
  const demoPecTest = await request('POST', '/api/pec/test-connection', { Authorization: `Bearer ${demoToken}` });
  assert(
    demoPecTest.status === 200 && demoPecTest.body.message.includes('Ambiente Dimostrativo'),
    'Test connessione PEC in Demo gestito in simulazione senza connessioni di rete reali'
  );

  // 7. Test Logout e Revoca Sessione
  console.log('\n--- TEST 7: Logout e Revoca della Sessione ---');
  const logoutRes = await request('POST', '/api/auth/logout', { Authorization: `Bearer ${tokenA}` });
  assert(logoutRes.status === 200, 'Logout effettuato con successo');

  const afterLogout = await request('GET', '/api/bootstrap', { Authorization: `Bearer ${tokenA}` });
  assert(afterLogout.status === 401, 'Token revocato: richiesta successiva con il vecchio token risponde 401 Unauthorized');

  // 8. Test Protezione Brute-force (Rate Limiting)
  console.log('\n--- TEST 8: Protezione Brute-force (Rate Limiting su tentativi ripetuti) ---');
  const bruteMat = `BRUTE-${Date.now()}`;
  for (let i = 0; i < 5; i++) {
    await request('POST', '/api/auth/login', {}, { identifier: bruteMat, password: 'WrongPassword!' });
  }
  const blockedAttempt = await request('POST', '/api/auth/login', {}, { identifier: bruteMat, password: 'WrongPassword!' });
  assert(blockedAttempt.status === 429, 'Dopo 5 tentativi errati, il sistema scatta in blocco con HTTP 429 Too Many Requests');

  console.log('\n=========================================');
  console.log(`RISULTATO TEST: ${passed} superati, ${failed} falliti.`);
  console.log('=========================================');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
