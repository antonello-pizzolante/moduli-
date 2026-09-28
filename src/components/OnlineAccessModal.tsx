import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  Tablet,
  Laptop,
  QrCode,
  Copy,
  Check,
  Share2,
  X,
  ExternalLink,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface OnlineAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnlineAccessModal: React.FC<OnlineAccessModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const { isInstallable, install } = usePWAInstall();

  // Target online URL
  const sharedUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-yxhsf64hhzqel52rntqmf6-349571565749.europe-west2.run.app';

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(
        sharedUrl,
        {
          width: 260,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
        (err, url) => {
          if (!err && url) {
            setQrDataUrl(url);
          }
        }
      );
    }
  }, [isOpen, sharedUrl]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(sharedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Sanitaservice S.E.T. 118 Taranto',
          text: 'Accedi all\'applicazione Straordinari & Monte Ore S.E.T. 118 dal tuo smartphone:',
          url: sharedUrl,
        });
      } catch {
        // Ignored if user dismissed
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-red-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 backdrop-blur-xs rounded-xl border border-white/20">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                Accedi Online da Qualsiasi Dispositivo
              </h3>
              <p className="text-xs text-rose-100">
                S.E.T. 118 Taranto · Smartphone, Tablet e Computer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Top Banner / Device Types */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <Smartphone className="w-5 h-5 mx-auto text-rose-600 dark:text-rose-400 mb-1" />
              <div className="text-xs font-bold text-slate-900 dark:text-white">Smartphone</div>
              <div className="text-[10px] text-slate-500">iOS & Android</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <Tablet className="w-5 h-5 mx-auto text-indigo-600 dark:text-indigo-400 mb-1" />
              <div className="text-xs font-bold text-slate-900 dark:text-white">Tablet</div>
              <div className="text-[10px] text-slate-500">iPad & Galaxy Tab</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <Laptop className="w-5 h-5 mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
              <div className="text-xs font-bold text-slate-900 dark:text-white">Computer</div>
              <div className="text-[10px] text-slate-500">PC, Mac, Linux</div>
            </div>
          </div>

          {/* QR Code & Direct Link Row */}
          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col items-center shrink-0">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code per accesso smartphone"
                  className="w-40 h-40 rounded-xl bg-white p-2 border border-slate-300 dark:border-slate-600 shadow-xs"
                />
              ) : (
                <div className="w-40 h-40 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 animate-pulse">
                  <QrCode className="w-8 h-8" />
                </div>
              )}
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1.5 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5" />
                Inquadra con la Fotocamera
              </span>
            </div>

            <div className="flex-1 space-y-3 w-full">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Indirizzo Web Diretto:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={sharedUrl}
                    className="w-full text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copiato!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copia</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleShare}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Condividi Link (WhatsApp / Email)</span>
                </button>

                {isInstallable && (
                  <button
                    onClick={install}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Installa sul Dispositivo</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 p-2 rounded-lg border border-teal-200 dark:border-teal-800">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  Ogni dipendente accede con le proprie credenziali e visualizza esclusivamente i propri turni.
                </span>
              </div>
            </div>
          </div>

          {/* Device Specific Installation Instructions */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Come Installare come App sulla Schermata Home:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 dark:text-slate-300">
              {/* iPhone / iPad */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                  <span>Su iPhone / iPad (Safari)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                  <li>Apri il link in <strong>Safari</strong></li>
                  <li>Tocca l'icona <strong>Condividi</strong> (quadrato con freccia in su)</li>
                  <li>Scorri verso il basso e tocca <strong>&quot;Aggiungi alla schermata Home&quot;</strong></li>
                  <li>L&apos;icona S.E.T. 118 apparirà tra le tue app</li>
                </ol>
              </div>

              {/* Android */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                  <span>Su Android (Chrome / Edge)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                  <li>Apri il link in <strong>Google Chrome</strong></li>
                  <li>Tocca i <strong>3 puntini in alto a destra</strong></li>
                  <li>Tocca <strong>&quot;Installa app&quot;</strong> oppure <strong>&quot;Aggiungi a schermata Home&quot;</strong></li>
                  <li>Conferma per avere l&apos;accesso rapido con un tocco</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
