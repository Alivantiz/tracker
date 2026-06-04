import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function SettingsView() {
  const [shops, setShops]                 = useState([])
  const [categories, setCategories]       = useState([])
  const [materials, setMaterials]         = useState([])
  const [expTemplates, setExpTemplates]   = useState([])
  const [newShop, setNewShop]             = useState('')
  const [newCat, setNewCat]               = useState('')
  const [editShop, setEditShop]           = useState(null)
  const [editMat, setEditMat]             = useState(null)
  const [editTpl, setEditTpl]             = useState(null)
  const [newMat, setNewMat]               = useState({ name:'', unit:'шт', price_per_unit:'' })
  const [newTpl, setNewTpl]               = useState({ name:'', amount:'', category:'Расходы' })
  const [loading, setLoading]             = useState(true)
  const [toast, setToast]                 = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: sh }, { data: cats }, { data: mats }, { data: tpls }] = await Promise.all([
        supabase.from('shops').select('*').order('sort_order'),
        supabase.from('expense_categories').select('*').order('name'),
        supabase.from('materials').select('*').order('sort_order'),
        supabase.from('expense_templates').select('*').order('sort_order'),
      ])
      setShops(sh || [])
      setCategories(cats || [])
      setMaterials(mats || [])
      setExpTemplates(tpls || [])
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

  // ── Categories ──
  async function addCat() {
    const name = newCat.trim()
    if (!name || categories.find(c => c.name === name)) return
    const { data } = await supabase.from('expense_categories').insert({ name }).select().single()
    if (data) { setCategories(prev => [...prev, data]); setNewCat(''); showToast('Категория добавлена') }
  }
  async function deleteCat(id) {
    const cat = categories.find(c => c.id === id)
    if (cat?.is_default && !confirm('Стандартная категория. Удалить?')) return
    await supabase.from('expense_categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id)); showToast('Удалено')
  }

  // ── Materials ──
  async function addMaterial() {
    const name = newMat.name.trim()
    if (!name) return
    const maxOrder = materials.reduce((a, m) => Math.max(a, m.sort_order || 0), 0)
    const { data } = await supabase.from('materials').insert({
      name, unit: newMat.unit || 'шт',
      price_per_unit: parseFloat(newMat.price_per_unit) || 0,
      sort_order: maxOrder + 1
    }).select().single()
    if (data) { setMaterials(prev => [...prev, data]); setNewMat({ name:'', unit:'шт', price_per_unit:'' }); showToast('Материал добавлен') }
  }
  async function saveMatEdit() {
    if (!editMat?.name.trim()) return
    await supabase.from('materials').update({ name: editMat.name, unit: editMat.unit, price_per_unit: parseFloat(editMat.price_per_unit) || 0 }).eq('id', editMat.id)
    setMaterials(prev => prev.map(m => m.id === editMat.id ? { ...m, ...editMat, price_per_unit: parseFloat(editMat.price_per_unit) || 0 } : m))
    setEditMat(null); showToast('Сохранено')
  }
  async function deleteMaterial(id) {
    await supabase.from('materials').delete().eq('id', id)
    setMaterials(prev => prev.filter(m => m.id !== id)); showToast('Удалено')
  }

  // ── Expense templates ──
  async function addTemplate() {
    const name = newTpl.name.trim()
    if (!name) return
    const maxOrder = expTemplates.reduce((a, t) => Math.max(a, t.sort_order || 0), 0)
    const { data } = await supabase.from('expense_templates').insert({
      name, amount: parseFloat(newTpl.amount) || 0,
      category: newTpl.category || 'Расходы',
      sort_order: maxOrder + 1
    }).select().single()
    if (data) { setExpTemplates(prev => [...prev, data]); setNewTpl({ name:'', amount:'', category:'Расходы' }); showToast('Шаблон добавлен') }
  }
  async function saveTplEdit() {
    if (!editTpl?.name.trim()) return
    await supabase.from('expense_templates').update({
      name: editTpl.name, amount: parseFloat(editTpl.amount) || 0, category: editTpl.category
    }).eq('id', editTpl.id)
    setExpTemplates(prev => prev.map(t => t.id === editTpl.id ? { ...t, ...editTpl, amount: parseFloat(editTpl.amount) || 0 } : t))
    setEditTpl(null); showToast('Сохранено')
  }
  async function deleteTemplate(id) {
    await supabase.from('expense_templates').delete().eq('id', id)
    setExpTemplates(prev => prev.filter(t => t.id !== id)); showToast('Удалено')
  }

  const CAT_OPTIONS = ['Расходы', 'Зарплата', 'Закупы']
  const CAT_COLOR = { 'Расходы': 'var(--orange)', 'Зарплата': 'var(--blue)', 'Закупы': 'var(--purple)' }

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

        {/* ── Шаблоны расходов ── */}
        <STitle style={{ marginTop:24 }}>💸 Шаблоны расходов</STitle>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10 }}>
          Сохрани типовые расходы — в день одним нажатием добавляются с нужной суммой
        </div>
        {expTemplates.map(t => (
          <div className="card" key={t.id}>
            {editTpl?.id === t.id ? (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
                  <div><Lbl>Название</Lbl>
                    <input className="input" value={editTpl.name}
                      onChange={e => setEditTpl({ ...editTpl, name: e.target.value })} autoFocus />
                  </div>
                  <div><Lbl>Сумма (₸)</Lbl>
                    <input className="input" type="number" inputMode="decimal"
                      value={editTpl.amount || ''}
                      onChange={e => setEditTpl({ ...editTpl, amount: e.target.value })} />
                  </div>
                  <div><Lbl>Раздел</Lbl>
                    <select className="select" value={editTpl.category}
                      onChange={e => setEditTpl({ ...editTpl, category: e.target.value })}>
                      {CAT_OPTIONS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <Row2><Btn color="var(--green)" onClick={saveTplEdit}>Сохранить</Btn><Btn onClick={() => setEditTpl(null)}>Отмена</Btn></Row2>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ fontSize:14, fontWeight:700 }}>{t.name}</div>
                    <div style={{ fontSize:10, color: CAT_COLOR[t.category] || 'var(--muted)', background: `${CAT_COLOR[t.category]}20`, padding:'2px 7px', borderRadius:10, fontWeight:700 }}>
                      {t.category}
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>
                    <span style={{ color:'var(--accent)', fontWeight:700 }}>{t.amount} ₸</span>
                  </div>
                </div>
                <button onClick={() => setEditTpl({ ...t })} style={ib('var(--accent)')}>✏️</button>
                <button onClick={() => deleteTemplate(t.id)} style={ib('var(--red)')}>🗑</button>
              </div>
            )}
          </div>
        ))}
        <div className="card" style={{ border:'1px dashed var(--border)', marginBottom:4 }}>
          <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700, marginBottom:8 }}>Добавить шаблон</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
            <div><Lbl>Название</Lbl>
              <input className="input" value={newTpl.name} placeholder="ЗП рабочему"
                onChange={e => setNewTpl(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div><Lbl>Сумма (₸)</Lbl>
              <input className="input" type="number" inputMode="decimal" value={newTpl.amount} placeholder="5000"
                onChange={e => setNewTpl(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div><Lbl>Раздел</Lbl>
              <select className="select" value={newTpl.category}
                onChange={e => setNewTpl(p => ({ ...p, category: e.target.value }))}>
                {CAT_OPTIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary" onClick={addTemplate} style={{ width:'100%' }}>+ Добавить</button>
        </div>

        {/* ── Справочник материалов ── */}
        <STitle style={{ marginTop:24 }}>📦 Справочник материалов</STitle>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10 }}>
          Укажи цену за единицу — при добавлении закупа просто выбираешь и вводишь количество
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
                  <div><Lbl>Цена (₸)</Lbl>
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
                    1 {m.unit} = <span style={{ color:'var(--accent)', fontWeight:700 }}>{m.price_per_unit} ₸</span>
                  </div>
                </div>
                <button onClick={() => setEditMat({ ...m })} style={ib('var(--accent)')}>✏️</button>
                <button onClick={() => deleteMaterial(m.id)} style={ib('var(--red)')}>🗑</button>
              </div>
            )}
          </div>
        ))}
        <div className="card" style={{ border:'1px dashed var(--border)', marginBottom:4 }}>
          <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700, marginBottom:8 }}>Добавить материал</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
            <div><Lbl>Название</Lbl>
              <input className="input" value={newMat.name} placeholder="Мука"
                onChange={e => setNewMat(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div><Lbl>Ед. изм.</Lbl>
              <input className="input" value={newMat.unit} placeholder="мешок"
                onChange={e => setNewMat(p => ({ ...p, unit: e.target.value }))} />
            </div>
            <div><Lbl>Цена (₸)</Lbl>
              <input className="input" type="number" inputMode="decimal" value={newMat.price_per_unit} placeholder="8500"
                onChange={e => setNewMat(p => ({ ...p, price_per_unit: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary" onClick={addMaterial} style={{ width:'100%' }}>+ Добавить</button>
        </div>

        {/* ── Категории расходов ── */}
        <STitle style={{ marginTop:24 }}>🏷️ Категории расходов</STitle>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          {categories.map(c => (
            <div key={c.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:20, padding:'6px 12px', fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
              <span>{c.name}</span>
              {!c.is_default
                ? <button onClick={() => deleteCat(c.id)} style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:15, lineHeight:1, padding:0 }}>×</button>
                : <span style={{ fontSize:9, color:'var(--muted)' }}>●</span>
              }
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:28 }}>
          <input className="input" value={newCat} onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => e.key==='Enter' && addCat()} placeholder="Новая категория расхода" style={{ flex:1 }} />
          <button className="btn btn-primary" onClick={addCat} style={{ padding:'0 18px' }}>+</button>
        </div>

        {/* ── О приложении ── */}
        <STitle>ℹ️ О приложении</STitle>
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', fontSize:13, color:'var(--muted)', lineHeight:1.6, marginBottom:16 }}>
          <div style={{ marginBottom:4, color:'var(--text)', fontWeight:700 }}>🫓 Лепёшки — трекер</div>
          Данные хранятся в облаке (Supabase).<br />
          Доступно с любого устройства через браузер.<br />
          <span style={{ fontSize:11 }}>v3.3.0</span>
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
