'use client'
import { useState, useEffect, useRef } from 'react'
import type { Persona } from '@/lib/storage'
import { inputStyle, primaryBtn, ghostBtn } from '@/components/ui'

// ── Persona Dropdown ──────────────────────────────────
export function PersonaDropdown({ personas, currentId, onSwitch, onAdd, onClose }: { personas: Persona[]; currentId: string; onSwitch: (id: string) => void; onAdd: (name: string) => void; onClose: () => void }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} style={{ position: 'absolute', top: '110%', right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 8, minWidth: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', zIndex: 100 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', padding: '4px 8px 8px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>SWITCH PROFILE</div>
      {personas.map(p => (
        <button key={p.id} onClick={() => onSwitch(p.id)} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: p.id === currentId ? 'var(--surface2)' : 'transparent',
          border: 'none', borderRadius: 6, padding: '8px 10px', cursor: 'pointer', color: 'var(--text)', fontSize: 13, fontFamily: 'DM Sans, sans-serif',
        }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: p.id === currentId ? 'var(--accent)' : 'var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: p.id === currentId ? '#fff' : 'var(--muted)', fontSize: 11, fontWeight: 700 }}>{p.name[0]?.toUpperCase()}</span>
          {p.name}
          {p.id === currentId && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--accent)' }}>✓</span>}
        </button>
      ))}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
        {adding ? (
          <div style={{ padding: '4px 8px' }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Profile name" autoFocus style={{ ...inputStyle, fontSize: 13, padding: '7px 10px', marginBottom: 8 }} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onAdd(name.trim()); setAdding(false); setName('') } }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { if (name.trim()) { onAdd(name.trim()); setAdding(false); setName('') } }} style={{ ...primaryBtn, flex: 1, padding: '7px 0', fontSize: 12 }}>Create</button>
              <button onClick={() => { setAdding(false); setName('') }} style={{ ...ghostBtn, padding: '7px 12px', fontSize: 12 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'transparent', border: 'none', borderRadius: 6, padding: '8px 10px', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>+ Add Profile</button>
        )}
      </div>
    </div>
  )
}
