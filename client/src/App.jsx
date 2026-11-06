import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, ChevronRight, Clock3, ExternalLink, GraduationCap, LogOut, Menu, PlayCircle, ShieldCheck, Sparkles, Users, Video, X, Zap } from 'lucide-react'
import './App.css'
import Dashboard from './pages/Dashboard.jsx'
import { BlurFade } from './components/magicui/blur-fade.jsx'
import { ShimmerButton } from './components/magicui/shimmer-button.jsx'
import { AnimatedGridPattern } from './components/magicui/animated-grid-pattern.jsx'

const API_ROOT = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '' : window.location.origin)
const API_URL = API_ROOT.endsWith('/api') ? API_ROOT : `${API_ROOT}/api`
const SERVER_ROOT = API_URL.replace(/\/api\/?$/, '')
const publicAssetUrl = url => !url ? '/teacher-profile.jpeg' : url.startsWith('/uploads/') ? `${SERVER_ROOT}${url}` : url

function StudentLogin() {
  const isAdminLogin = window.location.pathname.startsWith('/admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to sign in. Please try again.')
      if (isAdminLogin && data.user.role !== 'admin') {
        await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
        throw new Error('This account does not have administrator access.')
      }
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('studentToken', data.token)
      localStorage.setItem('auth', JSON.stringify(data.user))
      window.location.assign(data.user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard')
    } catch (err) {
      setError(err.message || 'Unable to connect to the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="auth-page">
    <a className="auth-brand" href="/">OSHAN MENDIS <b>ICT</b></a>
    <section className="auth-card">
      <div className="auth-icon"><GraduationCap size={27}/></div>
      <span className="auth-kicker">{isAdminLogin ? 'ADMIN PORTAL' : 'STUDENT PORTAL'}</span>
      <h1>Welcome back</h1>
      <p>Sign in to continue to your {isAdminLogin ? 'admin' : 'learning'} dashboard.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="student-email">Email address</label>
        <input id="student-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} required />
        <label htmlFor="student-password">Password</label>
        <input id="student-password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} required />
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'} <ArrowRight size={18}/></button>
      </form>
      <a className="auth-home" href="/">← Back to home</a>
    </section>
  </main>
}

function AdminDashboard() {
  const [admin, setAdmin] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('studentToken')
    if (!token) { window.location.replace('/admin/login'); return }
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch(`${API_URL}/auth/me`, { headers, credentials: 'include' }),
      fetch(`${API_URL}/admin/dashboard`, { headers, credentials: 'include' }),
    ]).then(async ([profileResponse, metricsResponse]) => {
      const profile = await profileResponse.json()
      if (!profileResponse.ok || profile.role !== 'admin') throw new Error('Administrator sign in required.')
      const data = await metricsResponse.json()
      if (!metricsResponse.ok) throw new Error(data.message || 'Could not load the admin dashboard.')
      setAdmin(profile)
      setMetrics(data)
    }).catch(err => {
      localStorage.removeItem('studentToken')
      setError(err.message)
      window.setTimeout(() => window.location.replace('/admin/login'), 1300)
    })
  }, [])

  async function logout() {
    const token = localStorage.getItem('studentToken')
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' }).catch(() => {})
    localStorage.removeItem('studentToken')
    window.location.assign('/admin/login')
  }

  const tiles = metrics ? [
    ['Students', metrics.students], ['Active batches', metrics.activeBatches], ['Paid payments', metrics.paid],
    ['Pending payments', metrics.pending], ['Upcoming classes', metrics.upcoming], ['Published lessons', metrics.published],
  ] : []

  return <main className="admin-page">
    <header className="admin-header"><a className="auth-brand" href="/">OSHAN MENDIS <b>ICT</b></a>{admin && <button className="admin-logout" onClick={logout}>Sign out <LogOut size={16}/></button>}</header>
    <section className="admin-content"><span className="auth-kicker">ADMIN PORTAL</span><h1>{admin ? `Welcome, ${admin.name}` : error || 'Loading dashboard…'}</h1><p>Manage your learning platform at a glance.</p>
      {metrics && <div className="admin-metrics">{tiles.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>}
      {error && <a className="admin-back" href="/admin/login">Go to admin sign in</a>}
    </section>
  </main>
}

function StudentDashboard() {
  const [student, setStudent] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('studentToken')
    if (!token) { window.location.replace('/student/login'); return }
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Your session has expired. Please sign in again.')
        setStudent(data)
      })
      .catch(err => { localStorage.removeItem('studentToken'); setError(err.message); window.setTimeout(() => window.location.replace('/student/login'), 1200) })
  }, [])

  async function logout() {
    const token = localStorage.getItem('studentToken')
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' }).catch(() => {})
    localStorage.removeItem('studentToken')
    window.location.assign('/student/login')
  }

  return <main className="auth-page">
    <a className="auth-brand" href="/">OSHAN MENDIS <b>ICT</b></a>
    <section className="auth-card dashboard-card">
      <div className="auth-icon"><GraduationCap size={27}/></div>
      <span className="auth-kicker">STUDENT PORTAL</span>
      {student ? <><h1>Hi, {student.name}</h1><p>You’re signed in to your student account.</p><div className="student-details"><span>Email</span><strong>{student.email}</strong><span>Account type</span><strong>{student.role === 'student' ? 'Student' : student.role}</strong></div><button className="auth-submit" onClick={logout}>Sign out <LogOut size={17}/></button></> : <><h1>{error ? 'Please sign in again' : 'Loading your dashboard…'}</h1><p>{error || 'Checking your account.'}</p></>}
    </section>
  </main>
}

const copy = {
  en: {
    home: 'Home', about: 'About the Teacher', courses: 'Courses', resources: 'Learning Resources', contact: 'Contact', login: 'Student Login', admin: 'Admin',
    eyebrow: 'Advanced Level ICT • Sri Lanka', title: 'OSHAN MENDIS ICT', tagline: 'Come and learn ICT properly.',
    hero: 'Modern lessons, expert guidance, and focused preparation to help every A/L ICT student reach their full potential.', explore: 'Explore courses',
    results: 'Structured learning', students: 'Student-focused', years: 'A/L preparation',
    aboutTitle: 'A focused path to ICT excellence', aboutText: 'Building strong technical foundations through clear explanations, practical learning, and consistent revision.',
    bio: 'Teacher biography coming soon. This section will introduce experience, qualifications, teaching approach, and achievements.',
    coursesTitle: 'Choose your learning journey', coursesText: 'Purpose-built programmes for every Advanced Level ICT cohort.', viewAll: 'View course details',
    featuresTitle: 'Everything you need to learn, revise, and succeed', announcements: 'Latest updates', announcementTitle: '2027 A/L ICT Batch Admissions', announcementText: 'New enrolments and learning resources are now available.', contactTitle: 'Ready to begin your ICT journey?', contactText: 'Contact us for batch availability and course information.', getInTouch: 'Contact Oshan Mendis ICT', footer: 'A/L ICT learning, reimagined.', youtubeLessons: 'YouTube Lessons', onlineClasses: 'Online Classes', youtubeTitle: 'Learn with video lessons', youtubeDescription: 'Watch published ICT lessons and continue learning in your own time.', openLearningSpace: 'Open learning space', videoLessonsTitle: 'Video lessons are available in the student learning space', videoLessonsDescription: 'Sign in to see the YouTube lessons shared with your enrolled batches.', onlineTitle: 'Stay connected to your classes', onlineDescription: 'See upcoming Zoom sessions for your active batches and join class from here.', viewClasses: 'View my classes', manageClasses: 'Manage classes', signInForClasses: 'Sign in to view classes', joinClass: 'Join', paymentRequired: 'Payment required', dashboardAccess: 'Dashboard access', joinBatch: 'Join a class', contactWhatsApp: 'WhatsApp Oshan', watchVideo: 'Watch on YouTube'
  },
  si: {
    home: 'මුල් පිටුව', about: 'ගුරුවරයා ගැන', courses: 'පාඨමාලා', resources: 'ඉගෙනුම් සම්පත්', contact: 'සම්බන්ධ වන්න', login: 'සිසු පිවිසුම', admin: 'පරිපාලක',
    eyebrow: 'උසස් පෙළ ICT • ශ්‍රී ලංකාව', title: 'ඔෂාන් මෙන්ඩිස් ICT', tagline: 'පැහැදිලියෙන්, විශ්වාසයෙන් සහ ඉලක්කයකින් ICT ඉගෙන ගන්න.',
    hero: 'සෑම උසස් පෙළ ICT සිසුවෙකුටම තම උපරිමයක් ලබා ගැනීමට උපකාරී වන නවීන පාඩම්, විශේෂඥ මඟ පෙන්වීම සහ සාම්ප්‍රදායික සූදානම.', explore: 'පාඨමාලා බලන්න',
    results: 'වාර්ගීක ඉගැන්වීම', students: 'සිසු කේන්ද්‍රික', years: 'උසස් පෙළ සූදානම',
    aboutTitle: 'ICT විශිෂ්ටත්වය කරා නියමිත මාර්ගය', aboutText: 'පැහැදිලි පැහැදිලි කිරීම්, ප්‍රායෝගික ඉගෙනීම සහ නිරතුරුව පුනරීක්ෂණය කරමින් ශක්තිමත් තාක්ෂණික පදනම් ගොඩනඟයි.',
    bio: 'ගුරුවරයාගේ චරිතය සහ සුදුසුකම් ඉදිරියේදී මෙහි එක් කෙරේ. තොරතුරු ලබාදීමට ඉන්න.',
    coursesTitle: 'ඔබගේ ඉගෙනුම් ගමන තෝරන්න', coursesText: 'සෑම උසස් පෙළ ICT කණ්ඩායම සඳහාම විශේෂයෙන් නිර්මාණය කළ වැඩසටහන්.', viewAll: 'විස්තර බලන්න',
    featuresTitle: 'ඉගෙනීමට, පුනරීක්ෂණයට සහ ජයග්‍රහණයට අවශ්‍ය සියල්ල', announcements: 'නවතම යාවත්කාලීන', announcementTitle: '2027 උසස් පෙළ ICT කණ්ඩායම් බඳවා ගැනීම්', announcementText: 'නව බඳවා ගැනීම් සහ ඉගෙනුම් සම්පත් දැන් ලබා ගත හැක.', contactTitle: 'ඔබගේ ICT ගමන ආරම්භ කිරීමට தயாரද?', contactText: 'කණ්ඩායම් තිබීම සහ පාඨමාලා තොරතුරු සඳහා සම්බන්ධ වන්න.', getInTouch: 'සම්බන්ධ වන්න', footer: 'උසස් පෙළ ICT ඉගෙනීම නව ආකාරයකින්.'
  }
}

const SINHALA_HOME = {
  home: 'මුල් පිටුව', about: 'ගුරුවරයා ගැන', courses: 'පාඨමාලා', resources: 'ඉගෙනුම් සම්පත්', contact: 'සම්බන්ධ වන්න', login: 'ශිෂ්‍ය පිවිසුම', admin: 'පරිපාලක',
  eyebrow: 'උසස් පෙළ ICT • ශ්‍රී ලංකාව', title: 'OSHAN MENDIS ICT', tagline: 'පැහැදිලිව, විශ්වාසයෙන් සහ අරමුණක් සහිතව ICT ඉගෙන ගන්න.',
  hero: 'සෑම උසස් පෙළ ICT සිසුවෙකුටම තම උපරිම හැකියාව ළඟා කරගැනීමට නවීන පාඩම්, විශේෂඥ මඟපෙන්වීම සහ ඉලක්කගත සූදානම.', explore: 'පාඨමාලා බලන්න',
  results: 'සැලසුම්ගත ඉගෙනුම', students: 'සිසුන්ට මුල් තැන', years: 'උසස් පෙළ සූදානම',
  aboutTitle: 'ICT විශිෂ්ටත්වය කරා පැහැදිලි මඟක්', aboutText: 'පැහැදිලි විස්තර, ප්‍රායෝගික ඉගෙනුම සහ නිරන්තර පුනරීක්ෂණය තුළින් ශක්තිමත් තාක්ෂණික පදනමක් ගොඩනඟමු.',
  bio: 'ගුරුවරයාගේ පළපුරුද්ද, සුදුසුකම් සහ ඉගැන්වීමේ ක්‍රමය පිළිබඳ තොරතුරු ඉදිරියේදී එක් කෙරේ.',
  coursesTitle: 'ඔබගේ ඉගෙනුම් ගමන තෝරන්න', coursesText: 'සෑම උසස් පෙළ ICT කණ්ඩායමක් සඳහාම සකස් කළ වැඩසටහන්.', viewAll: 'විස්තර බලන්න',
  featuresTitle: 'ඉගෙනීමට සහ සාර්ථක වීමට අවශ්‍ය සියල්ල', announcements: 'නවතම යාවත්කාලීන', announcementTitle: '2027 A/L ICT කණ්ඩායම් ලියාපදිංචිය', announcementText: 'නව ලියාපදිංචි කිරීම් සහ ඉගෙනුම් සම්පත් දැන් ලබා ගත හැක.',
  contactTitle: 'ඔබගේ ICT ඉගෙනුම් ගමන ආරම්භ කිරීමට සූදානම්ද?', contactText: 'කණ්ඩායම් සහ පාඨමාලා තොරතුරු සඳහා අප හා සම්බන්ධ වන්න.', getInTouch: 'OSHAN MENDIS ICT අමතන්න', footer: 'නව ආකාරයකින් උසස් පෙළ ICT ඉගෙනුම.'
}

Object.assign(SINHALA_HOME, {
  youtubeLessons: '\u0dba\u0dd6\u0da7\u0dd2\u0dba\u0dd4\u0db6\u0dca \u0db4\u0dcf\u0da9\u0db8\u0dca', onlineClasses: '\u0db8\u0dcf\u0dbb\u0dca\u0d9c\u0d9c\u0dad \u0db4\u0db1\u0dca\u0dad\u0dd2',
  youtubeTitle: '\u0dc0\u0dd3\u0da9\u0dd2\u0dba\u0ddd \u0db4\u0dcf\u0da9\u0db8\u0dca \u0dc3\u0db8\u0d9f \u0d89\u0d9c\u0dd9\u0db1 \u0d9c\u0db1\u0dca\u0db1',
  youtubeDescription: '\u0db4\u0dca\u200d\u0dbb\u0d9a\u0dcf\u0dc1\u0dd2\u0dad ICT \u0db4\u0dcf\u0da9\u0db8\u0dca \u0db1\u0dbb\u0db9\u0dcf \u0d94\u0db6\u0dda \u0dc0\u0dda\u0dbd\u0dcf\u0dc0\u0dd9\u0db1\u0dca \u0d89\u0d9c\u0dd9\u0db1 \u0d9c\u0db1\u0dca\u0db1.',
  openLearningSpace: '\u0d89\u0d9c\u0dd9\u0db1\u0dd4\u0db8\u0dca \u0d85\u0dc0\u0d9a\u0dcf\u0dc1\u0dba \u0dc0\u0dd2\u0dc0\u0dd8\u0dad \u0d9a\u0dbb\u0db1\u0dca\u0db1',
  videoLessonsTitle: '\u0dc1\u0dd2\u0dc2\u0dca\u200d\u0dba \u0d89\u0d9c\u0dd9\u0db1\u0dd4\u0db8\u0dca \u0d85\u0dc0\u0d9a\u0dcf\u0dc1\u0dba\u0dda \u0dc0\u0dd3\u0da9\u0dd2\u0dba\u0ddd \u0db4\u0dcf\u0da9\u0db8\u0dca \u0d87\u0dad.',
  videoLessonsDescription: '\u0d94\u0db6\u0d9c\u0dda \u0dbd\u0dd2\u0dba\u0dcf\u0db4\u0daf\u0dd2\u0d82\u0da0\u0dd2 \u0d9a\u0dab\u0dca\u0da9\u0dcf\u0dba\u0db8\u0dca \u0dc3\u0db3\u0dc4\u0dcf \u0db6\u0dd9\u0daf\u0dcf \u0d87\u0dad\u0dd2 YouTube \u0db4\u0dcf\u0da9\u0db8\u0dca \u0db6\u0dd0\u0dbd\u0dd3\u0db8\u0da7 \u0db4\u0dd2\u0dc0\u0dd2\u0dc3\u0dd9\u0db1\u0dca\u0db1.',
  onlineTitle: '\u0d94\u0db6\u0d9c\u0dda \u0db4\u0db1\u0dca\u0dad\u0dd2 \u0dc3\u0db8\u0d9f \u0dc3\u0db8\u0dca\u0db6\u0db1\u0dca\u0db0\u0dc0 \u0dc3\u0dd2\u0da7\u0dd2\u0db1\u0dca\u0db1',
  onlineDescription: '\u0d94\u0db6\u0d9c\u0dda \u0dc3\u0d9a\u0dca\u200d\u0dbb\u0dd2\u0dba \u0d9a\u0dab\u0dca\u0da9\u0dcf\u0dba\u0db8\u0dca\u0dc0\u0dbd \u0d89\u0daf\u0dd2\u0dbb\u0dd2 Zoom \u0db4\u0db1\u0dca\u0dad\u0dd2 \u0db6\u0dbd\u0dcf \u0db4\u0db1\u0dca\u0dad\u0dd2\u0dba\u0da7 \u0d91\u0d9a\u0dca\u0dc0\u0dbb \u0dc3\u0db8\u0dca\u0db6\u0db1\u0dca\u0db0 \u0dc0\u0db1\u0dca\u0db1.',
  viewClasses: '\u0db8\u0d9c\u0dda \u0db4\u0db1\u0dca\u0dad\u0dd2 \u0db6\u0dbd\u0db1\u0dca\u0db1', manageClasses: '\u0db4\u0db1\u0dca\u0dad\u0dd2 \u0d9a\u0dc5\u0db8\u0db1\u0dcf\u0d9a\u0dbb\u0dab\u0dba \u0d9a\u0dbb\u0db1\u0dca\u0db1', signInForClasses: '\u0db4\u0db1\u0dca\u0dad\u0dd2 \u0db6\u0dbd\u0dd3\u0db8\u0da7 \u0db4\u0dd2\u0dc0\u0dd2\u0dc3\u0dd9\u0db1\u0dca\u0db1', joinClass: '\u0dc3\u0db8\u0dca\u0db6\u0db1\u0dca\u0db0 \u0dc0\u0db1\u0dca\u0db1', paymentRequired: '\u0d9c\u0dd9\u0dc0\u0dd3\u0db8\u0dca \u0d85\u0dc0\u0dc1\u0dca\u200d\u0dba\u0dba\u0dd2', dashboardAccess: 'Dashboard \u0dc4\u0dbb\u0dc4\u0dcf \u0db6\u0dbd\u0db1\u0dca\u0db1', joinBatch: '\u0db4\u0db1\u0dca\u0dad\u0dd2\u0dba\u0d9a\u0da7 \u0d91\u0d9a\u0dca\u0dc0\u0db1\u0dca\u0db1', contactWhatsApp: 'WhatsApp Oshan', watchVideo: 'YouTube \u0dc4\u0dd2 \u0db1\u0dbb\u0db9\u0db1\u0dca\u0db1'
})

const currentYear = new Date().getFullYear()

export default function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  if (path === '/admin/login' || path === '/admin') return <StudentLogin />
  if (path === '/admin/dashboard') return <Dashboard mode="admin" />
  if (path === '/student/login') return <StudentLogin />
  if (path === '/student/dashboard') return <Dashboard mode="student" />
  return <SiteHome />
}

function SiteHome() {
  const [lang, setLang] = useState(localStorage.getItem('language') || 'en')
  const [menu, setMenu] = useState(false)
  const [openBatches, setOpenBatches] = useState([])
  const [siteSettings, setSiteSettings] = useState({})
  const [activeSection, setActiveSection] = useState('home')
  const [youtubeVideos, setYoutubeVideos] = useState([])
  const [onlineClasses, setOnlineClasses] = useState([])
  const authToken = localStorage.getItem('authToken') || localStorage.getItem('studentToken')
  let authRole = ''
  try { authRole = JSON.parse(localStorage.getItem('auth') || '{}').role || '' } catch { /* Default to the student sign-in route when cached identity is invalid. */ }
  const dashboardHref = authToken ? authRole === 'admin' ? '/admin/dashboard' : '/student/dashboard' : '/student/login'
  const dashboardLabel = authToken ? authRole === 'admin' ? 'Admin Dashboard' : 'Student Dashboard' : 'Student Login'
  const t = lang === 'si' ? { ...copy.en, ...SINHALA_HOME } : copy.en
  useEffect(() => { localStorage.setItem('language', lang); document.documentElement.lang = lang }, [lang])
  useEffect(() => { fetch(`${API_URL}/settings`).then(response => response.ok ? response.json() : {}).then(setSiteSettings).catch(() => {}) }, [])
  useEffect(() => { fetch(`${API_URL}/auth/batches`).then(response => response.ok ? response.json() : []).then(setOpenBatches).catch(() => {}) }, [])
  useEffect(() => {
    if (authToken && authRole === 'student') {
        const headers = { Authorization: `Bearer ${authToken}` }
        fetch(`${API_URL}/student/profile`, { headers, credentials: 'include' }).then(response => response.ok ? response.json() : null).then(async profile => {
          const batches = profile?.batches?.filter(item => item.enrollment?.status === 'active' && item.batch?._id) || []
          const content = await Promise.all(batches.map(async item => {
            const id = item.batch._id
            const [resources, classes] = await Promise.all([
              fetch(`${API_URL}/student/resources/${id}`, { headers, credentials: 'include' }).then(response => response.ok ? response.json() : {}).catch(() => ({})),
              fetch(`${API_URL}/student/classes/${id}`, { headers, credentials: 'include' }).then(response => response.ok ? response.json() : []).catch(() => []),
            ])
            return { videos: resources.videos || [], classes: Array.isArray(classes) ? classes : [] }
          }))
          setYoutubeVideos([...new Map(content.flatMap(item => item.videos).map(video => [video._id, video])).values()])
          setOnlineClasses([...new Map(content.flatMap(item => item.classes).map(item => [item._id, item])).values()].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)))
        }).catch(() => {})
    }
  }, [authToken, authRole])
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) setActiveSection(visible.target.id)
    }, { rootMargin: '-20% 0px -65% 0px', threshold: [0, .2, .5] })
    const sections = ['home', 'courses', 'youtube', 'online-classes', 'about', 'contact'].map(id => document.getElementById(id)).filter(Boolean)
    sections.forEach(section => observer.observe(section))
    return () => observer.disconnect()
  }, [])
  const scrollTo = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setMenu(false) }
  const whatsappUrl = 'https://wa.me/94740925552?text=Hello%20Oshan%20Mendis%20ICT%2C%20I%20would%20like%20to%20get%20more%20information%20about%20your%20classes'
  const visibleYoutubeVideos = youtubeVideos.filter(video => !video.locked && (video.url || video.videoUrl))

  return <div className="site">
    <header className="nav-wrap">
      <nav className="nav shell">
        <button className="brand" onClick={() => scrollTo('home')}><span className="brand-mark">OM</span><span>OSHAN MENDIS <b>ICT</b></span></button>
        <div className={`nav-links ${menu ? 'open' : ''}`}>
          <button className={activeSection === 'home' ? 'active' : ''} onClick={() => scrollTo('home')}>{t.home}</button><button className={activeSection === 'courses' ? 'active' : ''} onClick={() => scrollTo('courses')}>{t.courses}</button>
          <button className={activeSection === 'youtube' ? 'active' : ''} onClick={() => scrollTo('youtube')}>{t.youtubeLessons}</button><button className={activeSection === 'online-classes' ? 'active' : ''} onClick={() => scrollTo('online-classes')}>{t.onlineClasses}</button>
          <button className={activeSection === 'about' ? 'active' : ''} onClick={() => scrollTo('about')}>{t.about}</button><button className={activeSection === 'contact' ? 'active' : ''} onClick={() => scrollTo('contact')}>{t.contact}</button>
        </div>
        <div className="nav-actions">
          <div className="language"><button className={lang === 'si' ? 'active' : ''} onClick={() => setLang('si')}>සිං</button><button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button></div>
          <a className="admin-nav-link" href="/admin/login">{t.admin}</a><a className="login-btn" href={dashboardHref}>{dashboardLabel}</a><button className="menu-btn" aria-label="Menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
        </div>
      </nav>
    </header>

    <main>
      <section id="home" className="hero-section">
        <div className="hero-grid shell">
          <BlurFade as="div" className="hero-copy">
            <div className="eyebrow"><Sparkles size={16}/>{t.eyebrow}</div>
            <h1>{siteSettings.displayName ? `${siteSettings.displayName} ICT` : t.title}</h1><h2>{t.tagline}</h2><p>{(lang === 'si' ? siteSettings.homepageTextSi : siteSettings.homepageTextEn) || t.hero}</p>
            <div className="hero-buttons"><ShimmerButton className="primary" onClick={() => scrollTo('courses')}>{t.explore}<ArrowRight size={18}/></ShimmerButton><a className="secondary" href={dashboardHref}>{dashboardLabel}</a><a className="hero-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer"><span>{t.contactWhatsApp}</span><ExternalLink size={16}/></a></div>
            <div className="hero-proof"><div><strong>ICT</strong><span>{t.results}</span></div><div><strong>100%</strong><span>{t.students}</span></div><div><strong>A/L</strong><span>{t.years}</span></div></div>
          </BlurFade>
          <BlurFade as="div" className="hero-art" aria-label="ICT learning illustration">
            <AnimatedGridPattern/>
            <div className="orbit orbit-one"></div><div className="orbit orbit-two"></div>
            <div className="code-card"><div className="window-bar"><i/><i/><i/></div><code><span>01</span> class <b>Future</b> {'{'}</code><code><span>02</span>&nbsp; learn(<b>ICT</b>)</code><code><span>03</span>&nbsp; achieve(<em>dreams</em>)</code><code><span>04</span> {'}'}</code></div>
            <div className="float-card top"><PlayCircle/><span><b>Video lessons</b><small>Learn at your pace</small></span></div>
            <div className="float-card bottom"><GraduationCap/><span><b>Exam ready</b><small>Focused revision</small></span></div>
          </BlurFade>
        </div>
      </section>

      <section id="about" className="section shell">
        <div className="section-label">01 / TEACHER</div><div className="about-grid">
          <div className="portrait"><img className="teacher-photo" src={publicAssetUrl(siteSettings.teacherProfile?.photoUrl)} alt={`${siteSettings.teacherProfile?.name || 'Teacher'} profile`}/><div className="experience"><strong>{siteSettings.teacherProfile?.experience || 'Expert'}</strong><span>A/L ICT guidance</span></div></div>
          <div className="about-copy"><span className="kicker">MEET YOUR TEACHER</span><h2>{siteSettings.teacherProfile?.name || 'Oshan Mendis'}</h2>{siteSettings.teacherProfile?.qualifications && <p><strong>Qualifications:</strong> {siteSettings.teacherProfile.qualifications}</p>}<p>{siteSettings.teacherProfile?.description || t.bio}</p><p>{t.aboutText}</p><div className="mini-details"><div><ShieldCheck/><span><b>Concept clarity</b><small>Step-by-step teaching</small></span></div><div><Zap/><span><b>Exam focus</b><small>Targeted practice</small></span></div></div></div>
        </div>
      </section>

      <section id="courses" className="section courses-section"><div className="shell"><div className="section-label light">02 / COURSES</div><div className="section-heading"><div><h2>{t.coursesTitle}</h2><p>{t.coursesText}</p></div></div>
        <div className="course-grid">{openBatches.map((batch, i) => <article className="course-card" key={batch.id}><div className="course-top"><span>INTAKE</span><b>{batch.year}</b></div><div className="course-icon">{i === 0 ? <Sparkles/> : <GraduationCap/>}</div><h3>{batch.name?.en || `${batch.year} A/L ICT Batch`}</h3><p>{batch.description?.en || 'Structured Advanced Level ICT lessons and revision resources.'}</p><div className="course-meta"><span><Users/> Student cohort</span><span><CalendarDays/> Academic year</span></div><a href={`/student/login?register=1&batch=${batch.id}`}>{t.viewAll}<ChevronRight/></a></article>)}</div>
      </div></section>

      <section id="youtube" className="section shell home-video-section"><div className="section-label">03 / {t.youtubeLessons}</div><div className="section-heading"><div><h2>{t.youtubeTitle}</h2><p>{t.youtubeDescription}</p></div><a className="section-link" href={dashboardHref}>{t.openLearningSpace} <ArrowRight size={16}/></a></div>
        {visibleYoutubeVideos.length ? <div className="home-video-grid">{visibleYoutubeVideos.slice(0, 6).map(video => { const videoUrl = video.url || video.videoUrl; const videoId = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&/]+)/)?.[1]; const title = lang === 'si' ? video.title?.si || video.title?.en || (typeof video.title === 'string' ? video.title : 'ICT video lesson') : video.title?.en || video.title?.si || (typeof video.title === 'string' ? video.title : 'ICT video lesson'); return <article className="home-video-card" key={video._id || videoUrl}><a href={videoUrl} target="_blank" rel="noreferrer" className="home-video-thumb">{videoId ? <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt=""/> : <span><PlayCircle size={36}/></span>}<i><PlayCircle size={21}/></i></a><div><b>{title}</b><a href={videoUrl} target="_blank" rel="noreferrer">{t.watchVideo} <ExternalLink size={14}/></a></div></article>})}</div> : <div className="home-content-prompt"><span className="feature-icon"><Video/></span><div><b>{t.videoLessonsTitle}</b><p>{t.videoLessonsDescription}</p></div><a href={dashboardHref}>{dashboardLabel} <ArrowRight size={16}/></a></div>}
      </section>

      <section id="online-classes" className="home-online-section"><div className="shell home-online-inner"><span className="section-label light">04 / {t.onlineClasses}</span><div><div><h2>{t.onlineTitle}</h2><p>{t.onlineDescription}</p><a href={dashboardHref} className="primary">{dashboardHref === '/admin/dashboard' ? t.manageClasses : dashboardHref === '/student/dashboard' ? t.viewClasses : t.signInForClasses}<ArrowRight size={17}/></a></div>{onlineClasses.length ? <div className="home-class-list">{onlineClasses.slice(0, 3).map(item => <article key={item._id}><span><CalendarDays size={19}/></span><div><b>{item.title?.en || item.title?.si || t.onlineClasses}</b><small>{new Intl.DateTimeFormat(lang === 'si' ? 'si-LK' : 'en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(item.startsAt))}</small></div>{item.meetingUrl && !item.locked ? <a href={item.meetingUrl} target="_blank" rel="noreferrer">{t.joinClass} <ExternalLink size={14}/></a> : <span className="class-locked">{item.locked ? t.paymentRequired : t.dashboardAccess}</span>}</article>)}</div> : <div className="online-class-art"><span><Video size={25}/></span><span><CalendarDays size={25}/></span><span><Users size={25}/></span></div>}</div></div></section>

      <section id="resources" className="section shell"><div className="section-label">05 / LEARNING SUPPORT</div><div className="section-heading"><div><h2>{t.featuresTitle}</h2></div></div>
        <div className="feature-grid">
          {[['Recorded lessons', PlayCircle], ['YouTube library', Video], ['Live Zoom classes', Clock3], ['Notes & tutorials', BookOpen], ['Revision lessons', Zap], ['Model papers', GraduationCap]].map(([name, Icon]) => <article key={name}><div className="feature-icon"><Icon/></div><h3>{name}</h3><p>Organized, accessible learning resources designed for focused progress.</p><button aria-label={`Explore ${name}`}><ArrowRight/></button></article>)}
        </div>
      </section>

      <section className="announcement shell"><div><span>{t.announcements}</span><h2>{t.announcementTitle}</h2><p>{t.announcementText}</p></div><a href={dashboardHref}>{t.viewAll}<ArrowRight/></a></section>

      <section id="contact" className="contact-section"><div className="shell contact-card"><div><span>GET IN TOUCH</span><h2>{t.contactTitle}</h2><p>{t.contactText}</p></div><div className="contact-actions"><a className="contact-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">{t.getInTouch}<ArrowRight/></a><a className="contact-classes" href={dashboardHref}>{t.joinBatch}<ArrowRight/></a></div></div></section>
    </main>
    <footer><div className="shell footer-inner"><div className="brand"><span className="brand-mark">OM</span><span>OSHAN MENDIS <b>ICT</b></span></div><p>{t.footer}</p><small>© {currentYear} OSHAN MENDIS ICT</small></div></footer>
  </div>
}
