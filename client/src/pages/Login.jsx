import { useEffect, useState } from 'react'
import axios from 'axios'
import { GraduationCap, LockKeyhole, UserRound } from 'lucide-react'
import './Login.css'

const API_ROOT = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '' : window.location.origin)
const API = API_ROOT.endsWith('/api') ? API_ROOT : `${API_ROOT}/api`

export default function Login({ mode = 'student' }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', batch: new URLSearchParams(window.location.search).get('batch') || '', city: '', address: '', phone: '' })
  const [registering, setRegistering] = useState(new URLSearchParams(window.location.search).get('register') === '1')
  const [batches, setBatches] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const admin = mode === 'admin'

  useEffect(() => {
    if (admin || !registering) return
    axios.get(`${API}/auth/batches`).then(({ data }) => setBatches(data)).catch(() => setError('Could not load open academic batches.'))
  }, [admin, registering])

  async function submit(event) {
    event.preventDefault()
    setError(''); setLoading(true)
    try {
      const endpoint = admin ? '/auth/admin/login' : registering ? '/auth/register' : '/auth/login'
      const credentials = admin
        ? { identifier: form.email.trim().toLowerCase(), password: form.password }
        : { ...form, email: form.email.trim().toLowerCase() }
      const { data } = await axios.post(`${API}${endpoint}`, credentials, { withCredentials: true })
      if (admin && data.user.role !== 'admin') throw new Error('This account does not have administrator access.')
      if (!admin && data.user.role !== 'student') throw new Error('Please use the administrator sign in page for this account.')
      localStorage.setItem('auth', JSON.stringify(data.user))
      localStorage.setItem('authToken', data.token)
      window.location.assign(admin ? '/admin/dashboard' : '/student/dashboard')
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to continue')
    } finally { setLoading(false) }
  }

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  return <main className="login-page"><section className="login-panel">
    <a className="login-brand" href="/"><span>OM</span> OSHAN MENDIS <b>ICT</b></a>
    <div className="login-icon"><GraduationCap /></div><h1>{admin ? 'Admin portal' : registering ? 'Create student account' : 'Student portal'}</h1>
    <p>{admin ? 'Sign in to manage the learning platform.' : registering ? 'Register to join an academic batch.' : 'Sign in to continue your learning journey.'}</p>
    <form onSubmit={submit}>
      {registering && <>
        <label>Full name<div className="input-wrap"><UserRound /><input required autoComplete="name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" /></div></label>
        <label>Academic batch<select className="login-select" required value={form.batch} onChange={e => set('batch', e.target.value)}><option value="">Choose a batch</option>{batches.map(batch => <option key={batch.id} value={batch.id}>{batch.name?.en || `${batch.year} ${batch.subject || 'A/L ICT'}`}{batch.city ? ` · ${batch.city}` : ''}</option>)}</select></label>
        <label>City<div className="input-wrap"><input required value={form.city} onChange={e => set('city', e.target.value)} placeholder="Your city" /></div></label>
        <label>Home address<div className="address-wrap"><textarea required rows={3} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Your full home address" /></div></label>
        <label>Contact number (optional)<div className="input-wrap"><input type="tel" autoComplete="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Contact number" /></div></label>
      </>}
      <label>{admin ? 'Username or email' : 'Email address'}<div className="input-wrap"><UserRound /><input type={admin ? 'text' : 'email'} required autoComplete={admin ? 'username' : 'email'} value={form.email} onChange={e => set('email', e.target.value)} placeholder={admin ? 'Username or email address' : 'you@example.com'} /></div></label>
      <label>Password<div className="input-wrap"><LockKeyhole /><input type="password" required autoComplete={registering ? 'new-password' : 'current-password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="At least 8 characters" minLength={registering ? 8 : undefined} /></div></label>
      {registering && <label>Confirm password<div className="input-wrap"><LockKeyhole /><input type="password" required autoComplete="new-password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="Confirm your password" /></div></label>}
      {error && <div className="login-error" role="alert">{error}</div>}
      <button className="login-submit" disabled={loading}>{loading ? 'Please wait...' : registering ? 'Create account' : 'Sign in'}</button>
    </form>
    {!admin && <button className="login-toggle" onClick={() => { setRegistering(!registering); setError('') }}>{registering ? 'Already registered? Sign in' : 'New student? Create an account'}</button>}
    <a className="login-back" href="/">Back to website</a>
  </section></main>
}
