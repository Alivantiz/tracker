import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function SettingsView() {
  const [shops, setShops]       = useState([])
  const [materials, setMaterials] = useState([])
  const [newShop, setNewShop]   = useState('')
  const [editShop, setEditShop] = useState(null)
  const [editMat, setEditMat]   = useState(null)
  const [newMat, setNewMat]     = useState({ name:'', unit:'шт', price_per_unit:'' })
  const [loading, setLoading]   = useState(true)
  const [toast, setToast]       = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: sh }, { data: mats }] = await Promise.all([
        supabase.from('shops').select('*').order('sort_order'),
        supabase.from('materials').select('*').order('sort_order'),
      ])
      setShops(sh || [])
      setMaterials(mats || [])
      setLoading(false)
    }
    load()
  }, [])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2000) }

  // ── Shops ──
  async function addShop() {
    const name = newShop.trim()
    if (!name) return
    const maxOrder = shops.reduce((a, s) => Math.max(a, s.sort_order || 0), 0)
    const { data } = await supabase.from('shops').insert({ name, default_price: 0, sort_order: maxOrder + 1 }).select().single()
    if (data) { setShops(prev => [...prev, data]); setNewShop(''); showToast('Магазин добавлен') }
  }
  async function saveShopEdit() {
    if (!editShop?.name.trim()) return
    await supabase.from('shops').update({ name: editShop.name, default_price: parseFloat(editShop.default_price) || 0 }).eq('id', editShop.id)
    setShops(prev => prev.map(s => s.id === editShop.id ? { ...s, name: editShop.name, default_price: parseFloat(editShop.default_price) || 0 } : s))
    setEditShop(null); showToast('Сохранено')
  }
  async function deleteShop(id) {
    if (!confirm('Удалить магазин? Данные сохранятся в истории.')) return
    await supabase.from('shops').delete().eq('id', id)
    setShops(prev => prev.filter(s => s.id !== id)); showToast('Удалено')
  }

  // ── Materials (справочник расходов) ──
  async function addMaterial() {
    const name = newMat.name.trim()
    if (!name) return
    const maxOrder = materials.reduce((a, m) => Math.max(a, m.sort_order || 0), 0)
    const { data } = await supabase.from('materials').insert({
      name, unit: newMat.unit || 'шт',
      price_per_unit: parseFloat(newMat.price_per_unit) || 0,
      sort_order: maxOrder + 1
    }).select().single()
    if (data) { setMaterials(prev => [...prev, data]); setNewMat({ name:'', unit:'шт', price_per_unit:'' }); showToast('Добавлено') }
  }
  async function saveMatEdit() {
    if (!editMat?.name.trim()) return
    await supabase.from('materials').update({
      name: editMat.name,
      unit: editMat.unit,
      price_per_unit: parseFloat(editMat.price_per_unit) || 0
    }).eq('id', editMat.id)
    setMaterials(prev => prev.map(m => m.id === editMat.id ? { ...m, ...editMat, price_per_unit: parseFloat(editMat.price_per_unit) || 0 } : m))
    setEditMat(null); showToast('Сохранено')
  }
  async function deleteMaterial(id) {
    await supabase.from('materials').delete().eq('id', id)
    setMaterials(prev => prev.filter(m => m.id !== id)); showToast('Удалено')
  }

  if (loading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page fade-in">
      {toast && (
        <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', background:'#22543d', color:'#fff', padding:'8px 20px', borderRadius:20, fontSize:13, fontWeight:600, zIndex:200, whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}
      <div className="header"><div style={{ fontSize:20, fontWeight:800 }}>Настройки</div></div>

      <div style={{ padding:'16px 16px 0' }}>

        {/* ── Магазины ── */}
        <STitle>🏪 Магазины</STitle>
        {shops.map(s => (
          <div className="card" key={s.id}>
            {editShop?.id === s.id ? (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                  <div><Lbl>Название</Lbl>
                    <input className="input" value={editShop.name}
                      onChange={e => setEditShop({ ...editShop, name: e.target.value })}
                      onKeyDown={e => e.key==='Enter' && saveShopEdit()} autoFocus />
                  </div>
                  <div><Lbl>Цена по умолч. (₸)</Lbl>
                    <input className="input" type="number" inputMode="decimal"
                      value={editShop.default_price || ''} placeholder="350"
                      onChange={e => setEditShop({ ...editShop, default_price: e.target.value })} />
                  </div>
                </div>
                <Row2><Btn color="var(--green)" onClick={saveShopEdit}>Сохранить</Btn><Btn onClick={() => setEditShop(null)}>Отмена</Btn></Row2>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700 }}>{s.name}</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>
                    Цена: <span style={{ color: s.default_price ? 'var(--accent)' : 'var(--muted)', fontWeight:700 }}>
                      {s.default_price ? s.default_price + ' ₸' : 'не задана'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setEditShop({ id:s.id, name:s.name, default_price: s.default_price || '' })} style={ib('var(--accent)')}>✏️</button>
                <button onClick={() => deleteShop(s.id)} style={ib('var(--red)')}>🗑</button>
              </div>
            )}
          </div>
        ))}
        <div style={{ display:'flex', gap:8, marginBottom:4 }}>
          <input className="input" value={newShop} onChange={e => setNewShop(e.target.value)}
            onKeyDown={e => e.key==='Enter' && addShop()} placeholder="Название нового магазина" style={{ flex:1 }} />
          <button className="btn btn-primary" onClick={addShop} style={{ padding:'0 18px' }}>+</button>
        </div>

        {/* ── Справочник расходов ── */}
        <STitle style={{ marginTop:24 }}>📦 Справочник расходов</STitle>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10 }}>
          Задай название, единицу и цену — в день выбираешь и вводишь количество стрелками
        </div>
        {materials.map(m => (
          <div className="card" key={m.id}>
            {editMat?.id === m.id ? (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
                  <div><Lbl>Название</Lbl>
                    <input className="input" value={editMat.name}
                      onChange={e => setEditMat({ ...editMat, name: e.target.value })} autoFocus />
                  </div>
                  <div><Lbl>Ед. изм.</Lbl>
                    <input className="input" value={editMat.unit}
                      onChange={e => setEditMat({ ...editMat, unit: e.target.value })} placeholder="мешок" />
                  </div>
                  <div><Lbl>Цена за ед. (₸)</Lbl>
                    <input className="input" type="number" inputMode="decimal"
                      value={editMat.price_per_unit || ''}
                      onChange={e => setEditMat({ ...editMat, price_per_unit: e.target.value })} />
                  </div>
                </div>
                <Row2><Btn color="var(--green)" onClick={saveMatEdit}>Сохранить</Btn><Btn onClick={() => setEditMat(null)}>Отмена</Btn></Row2>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700 }}>{m.name}</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>
                    {m.price_per_unit > 0
                      ? <>1 {m.unit} = <span style={{ color:'var(--accent)', fontWeight:700 }}>{m.price_per_unit} ₸</span></>
                      : <span style={{ color:'var(--muted)' }}>цена не задана</span>
                    }
                  </div>
                </div>
                <button onClick={() => setEditMat({ ...m })} style={ib('var(--accent)')}>✏️</button>
                <button onClick={() => deleteMaterial(m.id)} style={ib('var(--red)')}>🗑</button>
              </div>
            )}
          </div>
        ))}

        <div className="card" style={{ border:'1px dashed var(--border)', marginBottom:16 }}>
          <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700, marginBottom:8 }}>Добавить в справочник</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
            <div><Lbl>Название</Lbl>
              <input className="input" value={newMat.name} placeholder="Мука"
                onChange={e => setNewMat(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key==='Enter' && addMaterial()} />
            </div>
            <div><Lbl>Ед. изм.</Lbl>
              <input className="input" value={newMat.unit} placeholder="мешок"
                onChange={e => setNewMat(p => ({ ...p, unit: e.target.value }))} />
            </div>
            <div><Lbl>Цена за ед. (₸)</Lbl>
              <input className="input" type="number" inputMode="decimal" value={newMat.price_per_unit} placeholder="8500"
                onChange={e => setNewMat(p => ({ ...p, price_per_unit: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary" onClick={addMaterial} style={{ width:'100%' }}>+ Добавить</button>
        </div>

      </div>
    </div>
  )
}

function STitle({ children, style }) {
  return <div className="section-title" style={style}><span>{children}</span></div>
}
function Lbl({ children }) {
  return <div style={{ fontSize:9, color:'var(--label)', textTransform:'uppercase', letterSpacing:.8, fontWeight:700, marginBottom:3 }}>{children}</div>
}
function Btn({ children, onClick, color }) {
  return (
    <button onClick={onClick} style={{ flex:1, background: color || 'var(--bg2)', border: color ? 'none' : '1px solid var(--border)', borderRadius:8, color: color ? '#000' : 'var(--muted)', padding:9, fontWeight:700, cursor:'pointer' }}>
      {children}
    </button>
  )
}
function Row2({ children }) {
  return <div style={{ display:'flex', gap:8 }}>{children}</div>
}
function ib(color) {
  return { background:'none', border:'none', color, cursor:'pointer', fontSize:17, padding:'2px 5px', lineHeight:1 }
}
