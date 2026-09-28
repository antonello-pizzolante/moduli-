import React from 'react';
import {
  BookOpen,
  Printer,
  X,
  ExternalLink,
  ShieldCheck,
  Key,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Mail,
  HelpCircle,
  Smartphone,
  Server,
  Info,
} from 'lucide-react';

interface ArubaPecTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArubaPecTutorialModal: React.FC<ArubaPecTutorialModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:rounded-none">
        {/* Header - Stampa friendly */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40 print:bg-white print:border-b-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs print:hidden">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Guida Operativa S.E.T. 118
                </span>
                <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono">
                  v2.6
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                Tutorial Aruba PEC per Dipendenti
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Istruzioni semplici passo-passo per collegare la casella ed inviare i fogli ore
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              title="Stampa questa guida o salvala in PDF"
              className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Stampa / Salva PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenuto scorrevole & leggibile su smartphone */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {/* Regola d'oro: Differenza Password */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
              <Key className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>REGOLA N°1: LA DIFFERENZA TRA LE DUE PASSWORD</span>
            </div>
            <ul className="text-xs space-y-1.5 text-amber-950 dark:text-amber-200/90 list-disc list-inside">
              <li>
                <strong>Password dell&apos;App 118:</strong> serve per entrare in questo portale turni con la tua matricola. Non serve per spedire le email.
              </li>
              <li>
                <strong>Password della tua PEC Aruba:</strong> è quella rilasciata da Aruba per la tua casella certificata. Se hai la verifica a due fattori attiva (SMS o app Aruba OTP), serve una <em>Password per programmi di posta</em> (vedi Passaggio 2).
              </li>
              <li>
                <strong>AVVISO DI SICUREZZA:</strong> Non inviare MAI la tua password a colleghi, coordinatori o all&apos;assistenza tramite WhatsApp, messaggi o screenshot.
              </li>
            </ul>
          </div>

          {/* Passaggio 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <span className="w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-800 text-white text-xs flex items-center justify-center font-mono">
                1
              </span>
              <span>Verifica di riuscire ad accedere alla Webmail Aruba</span>
            </div>
            <p className="text-xs pl-8 text-slate-600 dark:text-slate-400">
              Prima di configurare l&apos;applicazione, apri il browser e vai sul sito ufficiale di Aruba:{' '}
              <a
                href="https://webmail.pec.it"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 dark:text-emerald-400 underline font-semibold inline-flex items-center gap-0.5"
              >
                webmail.pec.it
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
              . Accertati di riuscire ad entrare con il tuo indirizzo PEC completo e la tua password ordinaria.
            </p>
          </div>

          {/* Passaggio 2: Verifica in due passaggi (2FA) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <span className="w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-800 text-white text-xs flex items-center justify-center font-mono">
                2
              </span>
              <span>Hai la Verifica in 2 Passaggi attiva? Genera una Password dedicata</span>
            </div>
            <div className="pl-8 text-xs space-y-2">
              <p className="text-slate-600 dark:text-slate-400">
                Se quando accedi alla Webmail ricevi una notifica sull&apos;app Aruba OTP o un codice via SMS, hai la <strong>Verifica in 2 passaggi</strong> attiva.
                <br />
                <strong>ATTENZIONE:</strong> Non disattivare la verifica in 2 passaggi (protegge la tua casella legale). Aruba prevede un metodo apposito:
              </p>
              <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5 font-mono text-[11px]">
                <p className="text-slate-900 dark:text-white font-sans font-bold">Come generarla su Aruba:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300 font-sans">
                  <li>Accedi alla Webmail Aruba (webmail.pec.it).</li>
                  <li>Fai clic sul tuo indirizzo in alto a destra e seleziona <strong>Gestione account</strong>.</li>
                  <li>Vai nella sezione <strong>Sicurezza e Password</strong> → <strong>Password per programmi di posta</strong>.</li>
                  <li>Fai clic su <strong>Genera nuova password</strong>, assegna il nome <em>Portale 118</em> e copia il codice generato.</li>
                </ol>
              </div>
              <p className="text-slate-500">
                Guida ufficiale Aruba per la password dedicata:{' '}
                <a
                  href="https://guide.aruba.it/pec/account-e-sicurezza/verifica-in-2-passaggi/cos-e"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 dark:text-emerald-400 underline"
                >
                  guide.aruba.it/pec/.../verifica-in-2-passaggi
                  <ExternalLink className="w-3 h-3 inline ml-0.5" />
                </a>
              </p>
            </div>
          </div>

          {/* Passaggio 3: Controllo Protocolli SMTP */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <span className="w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-800 text-white text-xs flex items-center justify-center font-mono">
                3
              </span>
              <span>Abilita i protocolli di posta nella Webmail</span>
            </div>
            <div className="pl-8 text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
              <p>
                Per consentire l&apos;invio dei prospetti, Aruba richiede che l&apos;accesso per programmi esterni sia abilitato:
              </p>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Dalla Webmail Aruba: Menu utente (in alto a destra) → Impostazioni → SMTP/POP/IMAP → Accessi.
              </p>
              <p>
                Assicurati che la voce <strong>SMTP</strong> sia attiva. (Attiva solo quanto necessario).
              </p>
              <p>
                Fonte ufficiale Aruba:{' '}
                <a
                  href="https://guide.aruba.it/pec/webmail-pec/impostazioni/protocolli"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 dark:text-emerald-400 underline"
                >
                  guide.aruba.it/pec/webmail-pec/impostazioni/protocolli
                  <ExternalLink className="w-3 h-3 inline ml-0.5" />
                </a>
              </p>
            </div>
          </div>

          {/* Passaggio 4: Parametri Precompilati nell'App */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <span className="w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-800 text-white text-xs flex items-center justify-center font-mono">
                4
              </span>
              <span>Inserimento parametri nella nostra App</span>
            </div>
            <div className="pl-8 text-xs space-y-2 text-slate-600 dark:text-slate-400">
              <p>I parametri tecnici del server Aruba sono già precompilati in modo sicuro:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px] bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">Server SMTP (Invio):</span>
                  <span className="font-bold text-slate-900 dark:text-white">smtps.pec.aruba.it</span> (Porta 465, SSL/TLS)
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Server IMAP (Ricevute):</span>
                  <span className="font-bold text-slate-900 dark:text-white">imaps.pec.aruba.it</span> (Porta 993, SSL/TLS)
                </div>
              </div>
              <p>
                Ti basta inserire il tuo <strong>Indirizzo PEC completo</strong> (es. <em>nome.cognome@pec.it</em>) e la <strong>Password per programmi di posta</strong> generata al Passaggio 2.
              </p>
              <p className="text-slate-500">
                Guida configurazione dispositivi mobili Aruba:{' '}
                <a
                  href="https://guide.aruba.it/pec/configurazione-programmi-di-posta/client-posta-e-dispositivi-mobili"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 dark:text-emerald-400 underline"
                >
                  guide.aruba.it/pec/configurazione-programmi-di-posta/...
                  <ExternalLink className="w-3 h-3 inline ml-0.5" />
                </a>
              </p>
            </div>
          </div>

          {/* Passaggio 5: Verifica Collegamento */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <span className="w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-800 text-white text-xs flex items-center justify-center font-mono">
                5
              </span>
              <span>Premi &quot;Verifica Collegamento&quot; e controlla l&apos;esito</span>
            </div>
            <div className="pl-8 text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
              <p>
                Il pulsante <strong>&quot;Verifica Collegamento&quot;</strong> controlla che utente e password siano corretti effettuando una stretta di mano protetta con il server Aruba.
              </p>
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Nessun messaggio viene inviato, modificato o cancellato durante il test di verifica.</span>
              </div>
            </div>
          </div>

          {/* Passaggio 6: Se cambi la password o vuoi scollegarla */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <span className="w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-800 text-white text-xs flex items-center justify-center font-mono">
                6
              </span>
              <span>Cosa fare se cambi la password o vuoi scollegare la casella</span>
            </div>
            <div className="pl-8 text-xs space-y-1 text-slate-600 dark:text-slate-400">
              <p>
                • <strong>Se cambi o revochi la password su Aruba:</strong> apri la configurazione nell&apos;app, digita la nuova password dedicata e premi Salva.
              </p>
              <p>
                • <strong>Per scollegare la casella:</strong> premi il pulsante rosso <strong>&quot;Scollega Casella PEC&quot;</strong>. Tutte le credenziali verranno cancellate istantaneamente dal server protetto.
              </p>
            </div>
          </div>

          {/* Tabella Diagnostica & Risoluzione Problemi */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mt-4">
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              <span>GUIDA RISOLUZIONE PROBLEMI (ERRORI ACCERTATI VS POSSIBILI CAUSE)</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              <div className="p-3 bg-white dark:bg-slate-900 space-y-1">
                <div className="font-bold text-rose-700 dark:text-rose-400">
                  Messaggio: Credenziali respinte dal server (Codice 535)
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  <strong>Causa accertata:</strong> La password inserita non è corretta oppure hai la verifica a due fattori attiva.<br />
                  <strong>Soluzione:</strong> Accedi a webmail.pec.it, genera una &quot;Password per programmi di posta&quot; (Passaggio 2) e incollala nell&apos;app.
                </p>
              </div>

              <div className="p-3 bg-slate-50/50 dark:bg-slate-900/50 space-y-1">
                <div className="font-bold text-amber-700 dark:text-amber-400">
                  Messaggio: Porta 465 non raggiungibile / Firewall di rete
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  <strong>Causa accertata:</strong> La rete internet del dispositivo o l&apos;ambiente di hosting blocca le connessioni in uscita sulla porta 465.<br />
                  <strong>Soluzione:</strong> Utilizza il pulsante <strong>&quot;Procedura Manuale Webmail Aruba&quot;</strong>: potrai scaricare il PDF firmato con un click, copiare il testo e inviarlo direttamente da webmail.pec.it.
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 space-y-1">
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  Messaggio: Protocollo SMTP non abilitato
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  <strong>Soluzione:</strong> Entra su webmail.pec.it → Impostazioni → SMTP/POP/IMAP → Accessi e attiva l&apos;interruttore SMTP.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 print:hidden">
          <span className="text-[11px] text-slate-500">
            Documento redatto per il personale S.E.T. 118 ASL Taranto
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            Chiudi Guida
          </button>
        </div>
      </div>
    </div>
  );
};
