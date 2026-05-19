'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Phone, Settings, Plus, Trash2, User, ImagePlus, Camera, Mic, MicOff, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

/* ─── Types ─── */
interface Contact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  photo: string;
}

/* ─── Defaults ─── */
const DEFAULT_CONTACTS: Contact[] = [
  { id: '1', name: 'Maria', phone: '', relation: 'Hija', photo: '' },
  { id: '2', name: 'Carlos', phone: '', relation: 'Hijo', photo: '' },
  { id: '3', name: 'Ana', phone: '', relation: 'Nieta', photo: '' },
];

function loadContacts(): Contact[] {
  if (typeof window === 'undefined') return DEFAULT_CONTACTS;
  try {
    const saved = localStorage.getItem('mis-queridos-contacts');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return DEFAULT_CONTACTS;
}

const AVATAR_COLORS = [
  'bg-orange-400', 'bg-emerald-500', 'bg-sky-500',
  'bg-violet-500', 'bg-rose-500', 'bg-amber-500',
];

function getAvatarColor(id: string) {
  return AVATAR_COLORS[parseInt(id) % AVATAR_COLORS.length];
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

/* ─── Image resize helper ─── */
function resizeImage(file: File, maxSize = 400, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
        } else {
          if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/* ─── Speech Recognition Hook ─── */
function useVoiceRecognition(
  contacts: Contact[],
  onContactMatch: (contact: Contact) => void,
  enabled: boolean
) {
  const [listening, setListening] = useState(false);
  const [lastHeard, setLastHeard] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }
    setVoiceSupported(true);

    if (!enabled) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-ES';
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim().toLowerCase();
        setLastHeard(transcript);

        // Check each contact name
        for (const contact of contacts) {
          if (!contact.phone) continue;
          const name = contact.name.toLowerCase().trim();
          // Match: just the name, or "llamar a [nombre]", or "[nombre] llama"
          if (
            transcript.includes(name) ||
            transcript.includes(`llamar a ${name}`) ||
            transcript.includes(`${name} llama`) ||
            transcript.includes(`hablar con ${name}`)
          ) {
            onContactMatch(contact);
            return;
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.log('Speech error:', event.error);
      // Restart on error (except if not allowed)
      if (event.error !== 'not-allowed' && event.error !== 'aborted') {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = setTimeout(() => {
          try { recognition.start(); } catch { /* ignore */ }
        }, 1000);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still enabled
      if (enabled) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = setTimeout(() => {
          try { recognition.start(); } catch { /* ignore */ }
        }, 500);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }

    return () => {
      clearTimeout(restartTimeoutRef.current);
      try { recognition.stop(); } catch { /* ignore */ }
    };
  }, [contacts, enabled, onContactMatch]);

  const toggle = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setListening(true);
      } catch { /* ignore */ }
    }
  }, [listening]);

  return { listening, lastHeard, voiceSupported, toggle };
}

/* ─── Wake Lock Hook ─── */
function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!('wakeLock' in navigator)) return;

    let active = true;
    const request = async () => {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          if (active) {
            setTimeout(request, 1000);
          }
        });
      } catch {
        // Ignore wake lock errors
      }
    };
    request();

    return () => {
      active = false;
      wakeLockRef.current?.release();
    };
  }, [enabled]);
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function Home() {
  const [contacts, setContacts] = useState<Contact[]>(loadContacts);
  const [showSettings, setShowSettings] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const { toast } = useToast();

  // Voice call confirmation overlay
  const [pendingCall, setPendingCall] = useState<Contact | null>(null);
  const [countdown, setCountdown] = useState(3);
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  const saveContacts = useCallback((newContacts: Contact[]) => {
    setContacts(newContacts);
    localStorage.setItem('mis-queridos-contacts', JSON.stringify(newContacts));
  }, []);

  /* ── Call logic ── */
  const makeCall = useCallback((contact: Contact) => {
    if (!contact.phone) {
      toast({
        title: 'Sin numero',
        description: `Configura el numero de ${contact.name} primero.`,
        variant: 'destructive',
      });
      return;
    }
    const cleaned = contact.phone.replace(/[^\d+]/g, '');
    window.location.href = `tel:${cleaned}`;
  }, [toast]);

  // Triggered by voice recognition
  const handleVoiceMatch = useCallback((contact: Contact) => {
    setPendingCall(contact);
    setCountdown(3);
  }, []);

  // Cancel voice call
  const cancelVoiceCall = useCallback(() => {
    clearInterval(countdownRef.current);
    setPendingCall(null);
  }, []);

  // Countdown effect
  useEffect(() => {
    if (!pendingCall) return;
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          const c = pendingCall;
          setPendingCall(null);
          makeCall(c);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [pendingCall, makeCall]);

  /* ── Hooks ── */
  const { listening, lastHeard, voiceSupported, toggle: toggleVoice } = useVoiceRecognition(
    contacts, handleVoiceMatch, voiceEnabled
  );
  useWakeLock(voiceEnabled);

  /* ── Photo upload ── */
  const handlePhotoUpload = useCallback(async (file: File, contactId: string) => {
    try {
      const dataUrl = await resizeImage(file);
      const updated = contacts.map(c =>
        c.id === contactId ? { ...c, photo: dataUrl } : c
      );
      saveContacts(updated);
      if (editContact && editContact.id === contactId) {
        setEditContact({ ...editContact, photo: dataUrl });
      }
      toast({ title: 'Foto guardada', description: 'La foto se guardo correctamente.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar la foto.', variant: 'destructive' });
    }
  }, [contacts, saveContacts, editContact, toast]);

  const openCamera = useCallback((contactId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) await handlePhotoUpload(file, contactId);
    };
    input.click();
  }, [handlePhotoUpload]);

  const openGallery = useCallback((contactId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) await handlePhotoUpload(file, contactId);
    };
    input.click();
  }, [handlePhotoUpload]);

  /* ── Contact CRUD ── */
  const handleSaveContact = useCallback(() => {
    if (!editContact) return;
    const updated = contacts.map(c =>
      c.id === editContact.id ? editContact : c
    );
    saveContacts(updated);
    setEditContact(null);
    toast({ title: 'Guardado', description: `Datos de ${editContact.name} actualizados.` });
  }, [editContact, contacts, saveContacts, toast]);

  const handleAddContact = useCallback(() => {
    if (contacts.length >= 5) {
      toast({ title: 'Maximo 5', description: 'Solo puedes tener 5 contactos.', variant: 'destructive' });
      return;
    }
    const nc: Contact = { id: Date.now().toString(), name: 'Nuevo', phone: '', relation: '', photo: '' };
    saveContacts([...contacts, nc]);
    setEditContact(nc);
  }, [contacts, saveContacts, toast]);

  const handleDeleteContact = useCallback((id: string) => {
    if (contacts.length <= 1) {
      toast({ title: 'No puedes', description: 'Necesitas al menos 1 contacto.', variant: 'destructive' });
      return;
    }
    saveContacts(contacts.filter(c => c.id !== id));
    setEditContact(null);
    toast({ title: 'Eliminado' });
  }, [contacts, saveContacts, toast]);

  const configuredCount = contacts.filter(c => c.phone).length;

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  return (
    <main className="flex-1 flex flex-col items-center px-3 py-4 pb-24 max-w-lg mx-auto w-full select-none">

      {/* ── Voice Call Confirmation Overlay ── */}
      {pendingCall && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={cancelVoiceCall}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Photo */}
            <div className="mx-auto w-32 h-32 rounded-3xl overflow-hidden bg-orange-50 mb-4">
              {pendingCall.photo ? (
                <img src={pendingCall.photo} alt={pendingCall.name} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${getAvatarColor(pendingCall.id)}`}>
                  <span className="text-white text-6xl font-bold">{getInitial(pendingCall.name)}</span>
                </div>
              )}
            </div>
            <p className="text-2xl font-bold text-[#431407] mb-1">Voy a llamar a</p>
            <p className="text-3xl font-bold text-orange-500 mb-4">{pendingCall.name}</p>
            {/* Countdown circle */}
            <div className="mx-auto w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center mb-4 animate-pulse">
              <span className="text-white text-4xl font-bold">{countdown}</span>
            </div>
            <p className="text-sm text-gray-500 mb-4">Se llama automaticamente...</p>
            <div className="flex gap-3">
              <button
                onClick={cancelVoiceCall}
                className="flex-1 h-14 rounded-2xl bg-gray-200 text-gray-700 font-bold text-lg active:scale-95 transition-transform"
              >
                Cancelar
              </button>
              <button
                onClick={() => { clearInterval(countdownRef.current); makeCall(pendingCall); setPendingCall(null); }}
                className="flex-1 h-14 rounded-2xl bg-emerald-500 text-white font-bold text-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <Phone className="h-6 w-6" />
                Llamar ya
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="w-full flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#9A3412]">Mis Queridos</h1>
          <p className="text-sm text-[#9A3412]/50">
            {voiceEnabled && listening ? 'Escuchando... di un nombre' : 'Toca para llamar'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Voice toggle */}
          {voiceSupported && (
            <button
              onClick={toggleVoice}
              className={`h-14 w-14 rounded-full flex items-center justify-center shadow-sm border transition-all ${
                voiceEnabled && listening
                  ? 'bg-emerald-100 border-emerald-300 animate-pulse'
                  : 'bg-white/60 border-gray-200'
              }`}
              aria-label={listening ? 'Apagar voz' : 'Activar voz'}
            >
              {voiceEnabled && listening ? (
                <Mic className="h-7 w-7 text-emerald-600" />
              ) : (
                <MicOff className="h-7 w-7 text-gray-400" />
              )}
            </button>
          )}
          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="h-14 w-14 rounded-full bg-white/60 hover:bg-white shadow-sm border border-orange-200 flex items-center justify-center"
            aria-label="Configuracion"
          >
            <Settings className="h-7 w-7 text-[#9A3412]" />
          </button>
        </div>
      </header>

      {/* ── Listening indicator ── */}
      {voiceEnabled && listening && lastHeard && (
        <div className="w-full bg-white/80 rounded-2xl px-4 py-2 mb-3 flex items-center gap-2 border border-emerald-200">
          <Volume2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <p className="text-sm text-gray-600 truncate">
            Escuche: <span className="font-medium text-[#431407]">{lastHeard}</span>
          </p>
        </div>
      )}

      {/* ── Voice instruction ── */}
      {voiceEnabled && listening && (
        <div className="w-full text-center mb-4">
          <p className="text-xs text-[#9A3412]/40">
            Di el nombre de la persona para llamar. Ejemplo: &quot;Maria&quot; o &quot;Llamar a Carlos&quot;
          </p>
        </div>
      )}

      {/* ── Contacts Grid ── */}
      <section className="w-full grid grid-cols-2 gap-4 flex-1" aria-label="Contactos">
        {contacts.map((contact) => (
          <button
            key={contact.id}
            onClick={() => makeCall(contact)}
            className="flex flex-col items-center gap-2 p-3 rounded-3xl bg-white shadow-md border border-orange-100 hover:shadow-xl active:scale-[0.97] transition-all duration-150 cursor-pointer"
          >
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-orange-50">
              {contact.photo ? (
                <img src={contact.photo} alt={`Foto de ${contact.name}`} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${getAvatarColor(contact.id)}`}>
                  <span className="text-white text-7xl font-bold">{getInitial(contact.name)}</span>
                </div>
              )}
              {/* Phone icon - always visible */}
              <div className="absolute bottom-2 right-2 h-12 w-12 rounded-full bg-white shadow-lg flex items-center justify-center">
                <Phone className="h-6 w-6 text-emerald-600" />
              </div>
              {!contact.phone && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <span className="text-white text-sm font-semibold bg-black/40 px-3 py-1.5 rounded-full">Configurar</span>
                </div>
              )}
            </div>
            <div className="text-center min-h-[2.5rem] flex items-center justify-center">
              <p className="text-xl font-bold text-[#431407]">{contact.name}</p>
            </div>
          </button>
        ))}

        {contacts.length < 5 && (
          <button
            onClick={handleAddContact}
            className="flex flex-col items-center gap-2 p-3 rounded-3xl bg-white/50 shadow-sm border-2 border-dashed border-orange-200 hover:border-orange-400 hover:bg-orange-50 active:scale-[0.97] transition-all cursor-pointer"
          >
            <div className="w-full aspect-square rounded-2xl bg-orange-50 flex items-center justify-center">
              <Plus className="h-16 w-16 text-orange-300" />
            </div>
            <div className="text-center min-h-[2.5rem] flex items-center justify-center">
              <p className="text-lg font-semibold text-[#9A3412]/40">Agregar</p>
            </div>
          </button>
        )}
      </section>

      <div className="mt-4 text-center">
        <p className="text-xs text-[#9A3412]/40">
          {configuredCount} de {contacts.length} listos para llamar
        </p>
      </div>

      {/* ═══ Settings Dialog ═══ */}
      <Dialog open={showSettings && !editContact} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Configurar</DialogTitle>
          </DialogHeader>

          {/* Voice toggle */}
          {voiceSupported && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-200 mb-2">
              <div>
                <p className="font-bold text-[#431407]">Activar Voz</p>
                <p className="text-sm text-gray-500">Di el nombre para llamar</p>
              </div>
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`w-16 h-10 rounded-full transition-colors relative ${
                  voiceEnabled ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              >
                <div className={`absolute top-1 w-8 h-8 rounded-full bg-white shadow transition-transform ${
                  voiceEnabled ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>
          )}

          <p className="text-sm text-muted-foreground mb-2">
            Toca un contacto para editar. Cambia foto, nombre o numero.
          </p>

          <div className="flex flex-col gap-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => { setEditContact({ ...contact }); setShowSettings(false); }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer"
              >
                <div className="relative">
                  {contact.photo ? (
                    <img src={contact.photo} alt={contact.name} className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${getAvatarColor(contact.id)}`}>
                      <span className="text-white text-xl font-bold">{getInitial(contact.name)}</span>
                    </div>
                  )}
                  <button
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center shadow"
                    onClick={(e) => { e.stopPropagation(); openCamera(contact.id); }}
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-lg font-semibold">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {contact.phone ? contact.phone : contact.relation ? `${contact.relation} - Sin numero` : 'Sin configurar'}
                  </p>
                </div>
                <User className="h-5 w-5 text-orange-400" />
              </div>
            ))}
            {contacts.length < 5 && (
              <Button
                variant="outline"
                className="w-full rounded-2xl h-16 text-lg border-dashed border-orange-300"
                onClick={() => { setShowSettings(false); handleAddContact(); }}
              >
                <Plus className="h-6 w-6 mr-2" /> Agregar Contacto
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Contact Dialog ═══ */}
      <Dialog open={!!editContact} onOpenChange={(open) => !open && setEditContact(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Editar Contacto</DialogTitle>
          </DialogHeader>
          {editContact && (
            <div className="flex flex-col gap-5">
              {/* Photo - BIG with Camera + Gallery buttons */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-36 h-36 rounded-3xl overflow-hidden bg-orange-50 shadow-md">
                  {editContact.photo ? (
                    <img src={editContact.photo} alt={editContact.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${getAvatarColor(editContact.id)}`}>
                      <span className="text-white text-5xl font-bold">{getInitial(editContact.name)}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 w-full max-w-xs">
                  <Button
                    variant="outline"
                    className="flex-1 h-14 text-base rounded-2xl gap-2"
                    onClick={() => openCamera(editContact.id)}
                  >
                    <Camera className="h-5 w-5" /> Camara
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-14 text-base rounded-2xl gap-2"
                    onClick={() => openGallery(editContact.id)}
                  >
                    <ImagePlus className="h-5 w-5" /> Galeria
                  </Button>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-base font-semibold text-[#9A3412]">Nombre</label>
                <Input
                  value={editContact.name}
                  onChange={(e) => setEditContact({ ...editContact, name: e.target.value })}
                  placeholder="Nombre de la persona"
                  className="h-16 text-xl rounded-2xl"
                />
              </div>

              {/* Relation */}
              <div className="space-y-2">
                <label className="text-base font-semibold text-[#9A3412]">Relacion (opcional)</label>
                <Input
                  value={editContact.relation}
                  onChange={(e) => setEditContact({ ...editContact, relation: e.target.value })}
                  placeholder="Ej: Hija, Hijo, Nieto..."
                  className="h-16 text-xl rounded-2xl"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-base font-semibold text-[#9A3412]">Numero de telefono</label>
                <Input
                  type="tel"
                  value={editContact.phone}
                  onChange={(e) => setEditContact({ ...editContact, phone: e.target.value })}
                  placeholder="+1 555 123 4567"
                  className="h-16 text-xl rounded-2xl"
                  inputMode="tel"
                />
                <p className="text-sm text-muted-foreground">Incluye el codigo de pais si es internacional</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                {contacts.length > 1 && (
                  <Button variant="destructive" className="h-16 text-base rounded-2xl px-6" onClick={() => handleDeleteContact(editContact.id)}>
                    <Trash2 className="h-5 w-5 mr-2" /> Eliminar
                  </Button>
                )}
                <Button
                  className="flex-1 h-16 text-xl rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold"
                  onClick={handleSaveContact}
                >
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
