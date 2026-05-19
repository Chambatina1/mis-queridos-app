'use client';

import { useSearchParams } from 'next/navigation';
import { Phone } from 'lucide-react';
import { Suspense } from 'react';

function LlamarContent() {
  const searchParams = useSearchParams();
  const phone = searchParams.get('p') || '';
  const name = decodeURIComponent(searchParams.get('n') || 'Alguien');
  const message = decodeURIComponent(searchParams.get('m') || 'Necesito que me llames');

  const cleanPhone = phone.replace(/[^\d+]/g, '');

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a0a0a',
      zIndex: 9999,
    }}>
      {/* Message */}
      <div style={{
        textAlign: 'center',
        marginBottom: '40px',
        padding: '0 24px',
      }}>
        <p style={{
          color: '#ffffff',
          fontSize: '20px',
          fontWeight: '600',
          marginBottom: '8px',
        }}>
          {name}
        </p>
        <p style={{
          color: '#fbbf24',
          fontSize: '28px',
          fontWeight: '800',
          textTransform: 'uppercase',
        }}>
          {message}
        </p>
      </div>

      {/* BIG BLINKING GREEN BUTTON */}
      <a
        href={`tel:${cleanPhone}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          backgroundColor: '#22c55e',
          color: '#ffffff',
          fontSize: '32px',
          fontWeight: '900',
          textDecoration: 'none',
          boxShadow: '0 0 60px rgba(34, 197, 94, 0.6), 0 0 120px rgba(34, 197, 94, 0.3)',
          animation: 'blink-green 1.5s ease-in-out infinite',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none',
          lineHeight: '1.2',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Phone size={64} strokeWidth={3} />
          <span>LLAMAR</span>
        </div>
      </a>

      <p style={{
        color: '#666666',
        fontSize: '14px',
        marginTop: '40px',
      }}>
        Toca el boton verde para llamar
      </p>
    </div>
  );
}

export default function LlamarPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        color: 'white',
        fontSize: '20px',
      }}>
        Cargando...
      </div>
    }>
      <LlamarContent />
    </Suspense>
  );
}
