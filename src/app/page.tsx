'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Phone, Settings, Plus, Trash2, User, ImagePlus, Camera, MessageCircle, Share2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

/* ═══ TYPES ═══ */
interface Contact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  photo: string;
}

const DEFAULT_CONTACTS: Contact[] = [
  { id: '1', name: 'Maria', phone: '', relation: 'Hija', photo: '' },
  { id: '2', name: 'Carlos', phone: '', relation: 'Hijo', photo: '' },
  { id: '3', name: 'Ana', phone: '', relation: 'Nieta', photo: '' },
];

const AVATAR_COLORS = [
  'bg-orange-400', 'bg-emerald-500', 'bg-sky-500',
  'bg-violet-500', 'bg-rose-500', 'bg-amber-500',
];

/* ═══ QUICK MESSAGES ═══ */
const DEFAULT_MESSAGES = [
  { text: 'PUEDES VENIR', emoji: '🏠', color: 'bg-blue-500' },
  { text: 'TENGO HAMBRE', emoji: '🍽', color: 'bg-orange-500' },
  { text: 'POR FAVOR LLAMAME', emoji: '📞', color: 'bg-red-500' },
];

function loadMessages() {
  if (typeof window === 'undefined') return DEFAULT_MESSAGES;
  try {
    const saved = localStorage.getItem('mis-queridos-messages');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === 3) return parsed;
    }
  } catch { /* */ }
  return DEFAULT_MESSAGES;
}

/* ═══ HELPERS ═══ */
function loadContacts(): Contact[] {
  if (typeof window === 'undefined') return DEFAULT_CONTACTS;
  try {
    const saved = localStorage.getItem('mis-queridos-contacts');
    if (saved) return JSON.parse(saved);
  } catch { /* */ }
  return DEFAULT_CONTACTS;
}

function loadMyNumber(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('mis-queridos-my-number') || '';
  } catch { return ''; }
}

function saveToStorage(contacts: Contact[]) {
  try {
    localStorage.setItem('mis-queridos-contacts', JSON.stringify(contacts));
    return true;
  } catch {
    try {
      const light = contacts.map(c => ({ ...c, photo: '' }));
      localStorage.setItem('mis-queridos-contacts', JSON.stringify(light));
    } catch { /* */ }
    return false;
  }
}

function getAvatarColor(id: string) { return AVATAR_COLORS[parseInt(id) % AVATAR_COLORS.length]; }
function getInitial(name: string) { return name.charAt(0).toUpperCase(); }
function cleanPhone(phone: string): string { return phone.replace(/[^\d+]/g, ''); }

function resizeImage(file: File, maxPx = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('img'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxPx) { h = (h * maxPx) / w; w = maxPx; } }
        else { if (h > maxPx) { w = (w * maxPx) / h; h = maxPx; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/* ═══ MAIN ═══ */
export default function Home() {
  const [contacts, setContacts] = useState<Contact[]>(loadContacts);
  const [messages, setMessages] = useState(loadMessages);
  const [myNumber, setMyNumber] = useState(loadMyNumber);
  const [showSettings, setShowSettings] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [showMsgPicker, setShowMsgPicker] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState('');
  const [editMyNumber, setEditMyNumber] = useState(false);
  const [myNumberDraft, setMyNumberDraft] = useState('');
  const [editMessages, setEditMessages] = useState(false);
  const [msgDrafts, setMsgDrafts] = useState(DEFAULT_MESSAGES.map(m => m.text));
  const { toast } = useToast();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const photoTargetRef = useRef<string>('');

  /* Wake Lock */
  useEffect(() => {
    let wakeLock: any = null;
    try {
      if ('wakeLock' in navigator) {
        (navigator as any).wakeLock.request('screen').then((wl: any) => { wakeLock = wl; });
      }
    } catch { /* */ }
    return () => { wakeLock?.release?.(); };
  }, []);

  const saveContacts = useCallback((nc: Contact[]) => {
    setContacts(nc);
    if (!saveToStorage(nc)) {
      toast({ title: 'Memoria llena', description: 'Se guardaron datos sin fotos.', variant: 'destructive' });
    }
  }, [toast]);

  /* ── Photo upload ── */
  const processFile = useCallback(async (file: File) => {
    const cid = photoTargetRef.current;
    if (!cid) return;
    try {
      const dataUrl = await resizeImage(file);
      setContacts(prev => {
        const u = prev.map(c => c.id === cid ? { ...c, photo: dataUrl } : c);
        saveToStorage(u);
        return u;
      });
      setEditContact(prev => prev && prev.id === cid ? { ...prev, photo: dataUrl } : prev);
      toast({ title: 'Foto guardada' });
    } catch {
      toast({ title: 'Error al cargar foto', variant: 'destructive' });
    }
  }, [toast]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const triggerCamera = useCallback((cid: string) => { photoTargetRef.current = cid; cameraInputRef.current?.click(); }, []);
  const triggerGallery = useCallback((cid: string) => { photoTargetRef.current = cid; galleryInputRef.current?.click(); }, []);

  /* ── Messages - Single tap to send SMS ── */
  const handleMsgTap = useCallback((msg: string) => {
    const configured = contacts.filter(c => c.phone);
    if (configured.length === 0) {
      toast({ title: 'Sin contactos', description: 'Configura al menos un contacto con numero.', variant: 'destructive' });
      return;
    }
    if (configured.length === 1) {
      // Single contact - send SMS immediately with ONE TAP
      window.location.href = `sms:${cleanPhone(configured[0].phone)}?body=${encodeURIComponent(msg)}`;
      return;
    }
    setSelectedMsg(msg);
    setShowMsgPicker(true);
  }, [contacts, toast]);

  const sendMessageToContact = useCallback((phone: string) => {
    window.location.href = `sms:${cleanPhone(phone)}?body=${encodeURIComponent(selectedMsg)}`;
    setShowMsgPicker(false);
  }, [selectedMsg]);

  /* ── Share callback link ── */
  const shareCallbackLink = useCallback((msg: string) => {
    const base = window.location.origin;
    const name = encodeURIComponent('Tu Ser Querido');
    const phone = encodeURIComponent(cleanPhone(myNumber));
    const message = encodeURIComponent(msg);
    const link = `${base}/llamar?p=${phone}&n=${name}&m=${message}`;

    if (navigator.share) {
      navigator.share({
        title: 'Llamame por favor',
        text: `${msg} - Toca para llamarme:`,
        url: link,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(link).then(() => {
        toast({ title: 'Link copiado', description: 'Pegalo en un mensaje para tu ser querido.' });
      }).catch(() => {
        toast({ title: 'No se pudo copiar', variant: 'destructive' });
      });
    }
  }, [myNumber, toast]);

  /* ── Contact CRUD ── */
  const handleSaveContact = useCallback(() => {
    if (!editContact) return;
    saveContacts(contacts.map(c => c.id === editContact.id ? editContact : c));
    setEditContact(null);
    toast({ title: 'Guardado' });
  }, [editContact, contacts, saveContacts, toast]);

  const handleAddContact = useCallback(() => {
    if (contacts.length >= 5) { toast({ title: 'Maximo 5', variant: 'destructive' }); return; }
    const nc: Contact = { id: Date.now().toString(), name: 'Nuevo', phone: '', relation: '', photo: '' };
    saveContacts([...contacts, nc]);
    setEditContact(nc);
  }, [contacts, saveContacts, toast]);

  const handleDeleteContact = useCallback((id: string) => {
    if (contacts.length <= 1) { toast({ title: 'Necesitas al menos 1', variant: 'destructive' }); return; }
    saveContacts(contacts.filter(c => c.id !== id));
    setEditContact(null);
  }, [contacts, saveContacts, toast]);

  /* ── My Number ── */
  const handleSaveMyNumber = useCallback(() => {
    setMyNumber(myNumberDraft);
    localStorage.setItem('mis-queridos-my-number', myNumberDraft);
    setEditMyNumber(false);
    toast({ title: 'Numero guardado' });
  }, [myNumberDraft, toast]);

  const configuredCount = contacts.filter(c => c.phone).length;

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  return (
    <main className="flex-1 flex flex-col items-center px-4 py-4 pb-6 max-w-lg mx-auto w-full">

      {/* Hidden file inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {/* ═══ Header ═══ */}
      <header className="w-full flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-[#9A3412]">Mis Queridos</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="h-14 w-14 rounded-full bg-white/60 shadow-sm border border-orange-200 flex items-center justify-center"
          style={{ touchAction: 'manipulation' }}
        >
          <Settings className="h-7 w-7 text-[#9A3412]" />
        </button>
      </header>

      {/* ═══ QUICK MESSAGES - 3 big buttons ═══ */}
      <section className="w-full grid grid-cols-3 gap-3 mb-5" aria-label="Mensajes rapidos">
        {messages.map((msg, i) => (
          <button
            key={`msg-${i}`}
            onClick={() => handleMsgTap(msg.text)}
            className={`${msg.color} text-white rounded-2xl py-5 px-2 flex flex-col items-center justify-center gap-1 shadow-lg`}
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            <span className="text-3xl">{msg.emoji}</span>
            <span className="text-xs font-bold leading-tight text-center">{msg.text}</span>
          </button>
        ))}
      </section>

      {/* ═══ Share callback link (if my number is set) ═══ */}
      {myNumber && (
        <button
          onClick={() => shareCallbackLink('POR FAVOR LLAMAME')}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-700 font-semibold text-base mb-5"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <Share2 className="h-5 w-5" />
          Compartir Link de Llamada
        </button>
      )}

      {/* ═══ Contact Photos Grid ═══ */}
      <section className="w-full grid grid-cols-2 gap-4 flex-1" aria-label="Contactos">
        {contacts.map((contact) => {
          const hasPhone = !!contact.phone;

          if (hasPhone) {
            /* ── CONTACT WITH PHONE: Pure <a> link, ZERO JavaScript click handlers ── */
            return (
              <a
                key={contact.id}
                href={`tel:${cleanPhone(contact.phone)}`}
                className="flex flex-col items-center gap-2 p-3 rounded-3xl bg-white shadow-md border border-orange-100 no-underline"
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  textDecoration: 'none',
                }}
              >
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-orange-50">
                  {contact.photo ? (
                    <img src={contact.photo} alt={contact.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${getAvatarColor(contact.id)}`}>
                      <span className="text-white text-7xl font-bold">{getInitial(contact.name)}</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 h-12 w-12 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center">
                    <Phone className="h-6 w-6 text-white" />
                  </div>
                </div>
                <p className="text-xl font-bold text-[#431407] text-center">{contact.name}</p>
              </a>
            );
          }

          /* ── CONTACT WITHOUT PHONE: Button to configure ── */
          return (
            <button
              key={contact.id}
              onClick={() => setEditContact({ ...contact })}
              className="flex flex-col items-center gap-2 p-3 rounded-3xl bg-white shadow-md border border-orange-100"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-orange-50">
                {contact.photo ? (
                  <img src={contact.photo} alt={contact.name} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${getAvatarColor(contact.id)}`}>
                    <span className="text-white text-7xl font-bold">{getInitial(contact.name)}</span>
                  </div>
                )}
                <div className="absolute bottom-2 right-2 h-12 w-12 rounded-full bg-gray-300 shadow-lg flex items-center justify-center">
                  <Settings className="h-5 w-5 text-gray-600" />
                </div>
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <span className="text-white text-base font-semibold bg-black/40 px-4 py-2 rounded-full">Configurar</span>
                </div>
              </div>
              <p className="text-xl font-bold text-[#431407] text-center">{contact.name}</p>
            </button>
          );
        })}

        {contacts.length < 5 && (
          <button
            onClick={handleAddContact}
            className="flex flex-col items-center gap-2 p-3 rounded-3xl bg-white/50 shadow-sm border-2 border-dashed border-orange-200"
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            <div className="w-full aspect-square rounded-2xl bg-orange-50 flex items-center justify-center">
              <Plus className="h-16 w-16 text-orange-300" />
            </div>
            <p className="text-lg font-semibold text-[#9A3412]/40">Agregar</p>
          </button>
        )}
      </section>

      {/* ═══ Message Contact Picker Dialog ═══ */}
      <Dialog open={showMsgPicker} onOpenChange={setShowMsgPicker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Enviar: &quot;{selectedMsg}&quot;</DialogTitle>
          </DialogHeader>
          <p className="text-base text-muted-foreground">Toca a quien le quieres enviar el mensaje.</p>
          <div className="flex flex-col gap-3 mt-2">
            {contacts.filter(c => c.phone).map(contact => (
              <a
                key={contact.id}
                href={`sms:${cleanPhone(contact.phone)}?body=${encodeURIComponent(selectedMsg)}`}
                onClick={() => setShowMsgPicker(false)}
                className="flex items-center gap-3 p-4 rounded-2xl bg-orange-50 no-underline"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              >
                {contact.photo ? (
                  <img src={contact.photo} alt={contact.name} className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center ${getAvatarColor(contact.id)}`}>
                    <span className="text-white text-xl font-bold">{getInitial(contact.name)}</span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-lg font-bold text-[#431407]">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">{contact.relation || contact.phone}</p>
                </div>
                <MessageCircle className="h-6 w-6 text-orange-500" />
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Settings Dialog ═══ */}
      <Dialog open={showSettings && !editContact} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Configurar</DialogTitle>
          </DialogHeader>

          {/* Edit Messages Section */}
          <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-[#9A3412]">Mensajes Rapidos</p>
              <button
                onClick={() => { setMsgDrafts(messages.map(m => m.text)); setEditMessages(!editMessages); }}
                className="flex items-center gap-1 text-sm text-orange-600 font-semibold"
                style={{ touchAction: 'manipulation' }}
              >
                <Pencil className="h-3.5 w-3.5" /> {editMessages ? 'Cerrar' : 'Editar'}
              </button>
            </div>
            {editMessages ? (
              <div className="flex flex-col gap-2">
                {msgDrafts.map((draft, i) => (
                  <Input
                    key={i}
                    value={draft}
                    onChange={(e) => {
                      const nd = [...msgDrafts];
                      nd[i] = e.target.value;
                      setMsgDrafts(nd);
                    }}
                    placeholder={DEFAULT_MESSAGES[i].text}
                    className="h-14 text-base rounded-2xl"
                  />
                ))}
                <Button
                  className="w-full h-12 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold"
                  onClick={() => {
                    const saved = msgDrafts.map((text, i) => ({
                      ...DEFAULT_MESSAGES[i],
                      text: text.trim() || DEFAULT_MESSAGES[i].text,
                    }));
                    setMessages(saved);
                    localStorage.setItem('mis-queridos-messages', JSON.stringify(saved));
                    setEditMessages(false);
                    toast({ title: 'Mensajes guardados' });
                  }}
                >
                  Guardar Mensajes
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {messages.map((msg, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-lg">{msg.emoji}</span>
                    <p className="text-base font-semibold text-[#431407]">{msg.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Number Section */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 mb-3">
            <p className="text-sm font-semibold text-emerald-800 mb-2">Mi Numero (para que me llamen de vuelta)</p>
            {myNumber ? (
              <div className="flex items-center gap-3">
                <p className="text-xl font-bold text-emerald-700 flex-1">{myNumber}</p>
                <Button variant="outline" size="sm" onClick={() => { setMyNumberDraft(myNumber); setEditMyNumber(true); }}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-14 text-base rounded-2xl border-emerald-300"
                onClick={() => { setMyNumberDraft(''); setEditMyNumber(true); }}
              >
                <Phone className="h-5 w-5 mr-2" /> Agregar Mi Numero
              </Button>
            )}
          </div>

          {editMyNumber && (
            <div className="p-4 rounded-2xl bg-white border mb-3 flex flex-col gap-3">
              <Input
                type="tel"
                value={myNumberDraft}
                onChange={(e) => setMyNumberDraft(e.target.value)}
                placeholder="+1 555 123 4567"
                className="h-14 text-xl rounded-2xl"
                inputMode="tel"
              />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12 rounded-2xl" onClick={() => setEditMyNumber(false)}>Cancelar</Button>
                <Button className="flex-1 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold" onClick={handleSaveMyNumber}>Guardar</Button>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground mb-2">
            Toca un contacto para editar foto, nombre o numero.
          </p>
          <div className="flex flex-col gap-3">
            {contacts.map(contact => (
              <div
                key={contact.id}
                onClick={() => { setEditContact({ ...contact }); setShowSettings(false); }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-orange-50 cursor-pointer"
                style={{ touchAction: 'manipulation' }}
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
                    onClick={(e) => { e.stopPropagation(); triggerCamera(contact.id); }}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Camera className="h-3.5 w-3.5" />
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
              {/* Photo */}
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
                  <Button variant="outline" className="flex-1 h-14 text-base rounded-2xl gap-2" onClick={() => triggerCamera(editContact.id)}>
                    <Camera className="h-5 w-5" /> Camara
                  </Button>
                  <Button variant="outline" className="flex-1 h-14 text-base rounded-2xl gap-2" onClick={() => triggerGallery(editContact.id)}>
                    <ImagePlus className="h-5 w-5" /> Galeria
                  </Button>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-base font-semibold text-[#9A3412]">Nombre</label>
                <Input value={editContact.name} onChange={(e) => setEditContact({ ...editContact, name: e.target.value })} placeholder="Nombre" className="h-16 text-xl rounded-2xl" />
              </div>

              {/* Relation */}
              <div className="space-y-2">
                <label className="text-base font-semibold text-[#9A3412]">Relacion (opcional)</label>
                <Input value={editContact.relation} onChange={(e) => setEditContact({ ...editContact, relation: e.target.value })} placeholder="Hija, Hijo, Nieto..." className="h-16 text-xl rounded-2xl" />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-base font-semibold text-[#9A3412]">Numero de telefono</label>
                <Input type="tel" value={editContact.phone} onChange={(e) => setEditContact({ ...editContact, phone: e.target.value })} placeholder="+1 555 123 4567" className="h-16 text-xl rounded-2xl" inputMode="tel" />
                <p className="text-sm text-muted-foreground">Incluye codigo de pais si es internacional</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                {contacts.length > 1 && (
                  <Button variant="destructive" className="h-16 text-base rounded-2xl px-6" onClick={() => handleDeleteContact(editContact.id)}>
                    <Trash2 className="h-5 w-5 mr-2" /> Eliminar
                  </Button>
                )}
                <Button className="flex-1 h-16 text-xl rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold" onClick={handleSaveContact}>
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
