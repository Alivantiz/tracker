import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function SettingsView() {
  const [shops, setShops] = useState([])
  const [categories, setCategories] = useState([])
  const [newShop, setNewShop] = useState('')
  const [newCat, setNewCat] = useState('')
  const [editShop, setEditShop] = useState(null) // { id, name }
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: sh }, { data: cats }] = await Promise.all([
        supabase.from('shops').select('*').order('sort_order'),
        supabase.from('expense_categories').select('*').order('name'),
      ])
      setShops(sh || [])
      setCategories(cats || [])
      setLoading(false)
    }
    load()
  }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  // ── Shops ────────────────────────────────────────────────────────────────────
  async function addShop() {
    const name = newShop.trim()
    if (!name) return
    const maxOrder = shops.reduce((a, s) => Math.max(a, s.sort_order || 0), 0)
    const { data } = await supabase.from('shops').insert({ name, sort_order: maxOrder + 1 }).select().single()
    if (data) { setShops(prev => [...prev, data]); setNewShop(''); showToast('Магазин добавлен') }
  }

  async function saveShopEdit() {
    if (!editShop?.name.trim()) return
    await supabase.from('shops').update({ name: editShop.name }).eq('id', editShop.id)
    setShops(prev => prev.map(s => s.id === editShop.id ? { ...s, name: editShop.name } : s))
    setEditShop(null)
    showToast('Сохранено')
  }

  async function deleteShop(id) {
    if (!confirm('Удалить магазин? Все данные по нему сохранятся в истории.')) return
    await supabase.from('shops').delete().eq('id', id)
    setShops(prev => prev.filter(s => s.id !== id))
    showToast('Удалено')
  }

  // ── Categories ───────────────────────────────────────────────────────────────
  async function addCat() {
    const name = newCat.trim()
    if (!name || categories.find(c => c.name === name)) return
    const { data } = await supabase.from('expense_categories').insert({ name }).select().single()
    if (data) { setCategories(prev => [...prev, data]); setNewCat(''); showToast('Категория добавлена') }
  }

  async function deleteCat(id) {
    const cat = categories.find(c => c.id === id)
    if (cat?.is_default && !confirm('Это стандартная категория. Удалить?')) return
    await supabase.from('expense_categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
    showToast('Удалено')
  }

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page fade-in">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#22543d', color: '#fff', padding: '8px 20px', borderRadius: 20,
          fontSize: 13, fontWeight: 600, zIndex: 200, whiteSpace: 'nowrap'
        }}>
          {toast}
        </div>
      )}

      <div className="header">
        <div style={{ fontSize: 20, fontWeight: 800 }}>Настройки</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* ── Shops ── */}
        <div className="section-title"><span>🏪</span> Магазины</div>

        {shops.map(s => (
          <div className="card" key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {editShop?.id === s.id ? (
              <>
                <input
                  className="input"
                  value={editShop.name}
                  onChange={e => setEditShop({ ...editShop, name: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && saveShopEdit()}
                  autoFocus
                  style={{ flex: 1 }}
                />
                <button onClick={saveShopEdit} style={iconBtn('var(--green)')}>✓</button>
                <button onClick={() => setEditShop(null)} style={iconBtn('var(--muted)')}>✗</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{s.name}</span>
                <button onClick={() => setEditShop({ id: s.id, name: s.name })} style={iconBtn('var(--accent)')}>✏️</button>
                <button onClick={() => deleteShop(s.id)} style={iconBtn('var(--red)')}>🗑</button>
              </>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <input
            className="input"
            value={newShop}
            onChange={e => setNewShop(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addShop()}
            placeholder="Название нового магазина"
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={addShop} style={{ padding: '0 18px' }}>+</button>
        </div>

        {/* ── Expense categories ── */}
        <div className="section-title"><span>🏷️</span> Категории расходов</div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {categories.map(c => (
            <div key={c.id} style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '6px 12px', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>{c.name}</span>
              {!c.is_default && (
                <button
                  onClick={() => deleteCat(c.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}
                >×</button>
              )}
              {c.is_default && <span style={{ fontSize: 9, color: 'var(--muted)' }}>●</span>}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          <input
            className="input"
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCat()}
            placeholder="Новая категория расхода"
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={addCat} style={{ padding: '0 18px' }}>+</button>
        </div>

        {/* ── About ── */}
        <div className="section-title"><span>ℹ️</span> О приложении</div>
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '14px 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6
        }}>
          <div style={{ marginBottom: 4, color: 'var(--text)', fontWeight: 700 }}>🫓 Лепёшки — трекер</div>
          Данные хранятся в облаке (Supabase).<br />
          Доступно с любого устройства через браузер.<br />
          <span style={{ fontSize: 11 }}>v1.0.0</span>
        </div>
      </div>
    </div>
  )
}

function iconBtn(color) {
  return {
    background: 'none', border: 'none', color,
    cursor: 'pointer', fontSize: 17, padding: '2px 5px', lineHeight: 1,
  }
}
