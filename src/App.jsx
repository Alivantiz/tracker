import { useState } from 'react'
import DayView from './components/DayView'
import TotalsView from './components/TotalsView'
import HistoryView from './components/HistoryView'
import SettingsView from './components/SettingsView'

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || '1234'
const AUTH_KEY = 'bt_auth'

function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)

  function submit() {
    if (pw === APP_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, '1')
      onLogin()
    } else {
      setErr(true)
      setTimeout(() => setErr(false), 1500)
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:32, gap:24 }}>
      <div style={{ fontSize:52 }}>🫓</div>
      <div style={{ fontSize:24, fontWeight:800, color:'var(--accent)' }}>Лепёшки</div>
      <div style={{ width:'100%', maxWidth:320, display:'flex', flexDirection:'column', gap:12 }}>
        <input
          className="input"
          type="password"
          placeholder="Пароль"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{ textAlign:'center', fontSize:18, padding:'13px', border: err ? '1px solid var(--red)' : '1px solid var(--border)' }}
          autoFocus
        />
        <button className="btn btn-primary" onClick={submit} style={{ width:'100%', fontSize:16, padding:14 }}>Войти</button>
        {err && <div style={{ textAlign:'center', color:'var(--red)', fontSize:13 }}>Неверный пароль</div>}
      </div>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem(AUTH_KEY))
  const [tab, setTab] = useState('day')
  const [dayContext, setDayContext] = useState(null) // shared date between Day and Totals

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  const tabs = [
    { key:'day',      icon:'📋', label:'День' },
    { key:'totals',   icon:'📊', label:'Итоги' },
    { key:'history',  icon:'📅', label:'История' },
    { key:'settings', icon:'⚙️',  label:'Настройки' },
  ]

  return (
    <div style={{ maxWidth:480, margin:'0 auto', minHeight:'100vh' }}>
      {tab === 'day'      && <DayView onDateChange={setDayContext} />}
      {tab === 'totals'   && <TotalsView date={dayContext} />}
      {tab === 'history'  && <HistoryView />}
      {tab === 'settings' && <SettingsView />}

      <nav className="nav">
        {tabs.map(t => (
          <button key={t.key} className={`nav-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
