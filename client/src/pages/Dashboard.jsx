import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bell, BookOpen, CalendarDays, CalendarPlus,
  Check, ChevronDown, ChevronRight, CircleDollarSign, ClipboardList, FileText, GraduationCap,
  LayoutDashboard, LogOut, Menu, Plus, Search, Settings, ShieldCheck, Users, Video,
  X, LockKeyhole,
} from 'lucide-react'
import './Dashboard.css'
import './DashboardExtras.css'
import './AdminPolish.css'
import StudentWorkspace from './StudentWorkspace.jsx'

const API_ROOT = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '' : window.location.origin)
const API = API_ROOT.endsWith('/api') ? API_ROOT : `${API_ROOT}/api`
function apiErrorMessage(error, fallback) {
  const status = error?.response?.status
  if (status === 413) return 'This PDF is larger than the 30 MB upload limit. Choose a smaller file.'
  if (status === 401) return 'Your admin session has expired. Sign in again and retry the upload.'
  if (status === 403) return error.response?.data?.message || 'Your account is not authorized to upload papers for this student.'
  if ([502, 503, 504].includes(status)) return 'The API or database is temporarily unavailable. Your selected file is still available; retry when the server is healthy.'
  if (!error?.response) return 'Cannot reach the API server. Check that the backend is running on port 5000. Your selected file is still available.'
  return error.response?.data?.message || error.message || fallback
}
const CURRENT_YEAR = new Date().getFullYear()
const NAV = [
  ['dashboard', 'Dashboard', LayoutDashboard], ['classes', 'My Classes', GraduationCap],
  ['students', 'My Students', Users], ['attendance', 'Attendance', Check],
  ['lessons', 'Lessons & Videos', Video], ['resources', 'Tutorials & Notes', FileText],
  ['zoom', 'Zoom Classes', Video], ['payments', 'Payments', CircleDollarSign],
  ['individual-papers', 'My Papers', FileText],
  ['tute-submissions', 'Tute Submissions', ClipboardList],
  ['announcements', 'Announcements', Bell], ['reports', 'Reports', Activity],
  ['calendar', 'Calendar', CalendarDays], ['settings', 'Settings', Settings],
]
const SINHALA = {
  Dashboard: 'පාලක පුවරුව', 'My Classes': 'මගේ පන්ති', 'My Students': 'මගේ සිසුන්',
  Attendance: 'පැමිණීම', 'Lessons & Videos': 'පාඩම් සහ වීඩියෝ', 'Tutorials & Notes': 'නිබන්ධන සහ සටහන්',
  'Zoom Classes': 'Zoom පන්ති', Payments: 'ගෙවීම්', Announcements: 'නිවේදන', Reports: 'වාර්තා',
  Calendar: 'දින දර්ශනය', Settings: 'සැකසුම්', 'Welcome Back, Admin': 'ආයුබෝවන්, පරිපාලක',
  "Here's what's happening with your ICT classes today.": 'අද ඔබගේ ICT පන්තිවල තොරතුරු මෙන්න.',
  'Total Students': 'මුළු සිසුන්', 'Active Batches': 'සක්‍රිය කණ්ඩායම්',
  'Published Lessons': 'ප්‍රකාශිත පාඩම්', 'Pending Payments': 'අපේක්ෂිත ගෙවීම්',
  'Schedule a Class': 'පන්තියක් සැලසුම් කරන්න', 'Add New Lesson': 'නව පාඩමක් එක් කරන්න',
  'Upload Material': 'ඉගෙනුම් ද්‍රව්‍ය එක් කරන්න', 'Recent Activity': 'මෑත ක්‍රියාකාරකම්',
  'Upcoming Classes': 'ඉදිරි පන්ති', 'View All': 'සියල්ල බලන්න', 'View Calendar': 'දින දර්ශනය බලන්න',
}
const SI_REPLACEMENTS = {
  Dashboard: 'පාලක පුවරුව', 'My Classes': 'මගේ පන්ති', 'My Students': 'සිසුන්', Attendance: 'පැමිණීම',
  'Lessons & Videos': 'පාඩම් සහ වීඩියෝ', 'Tutorials & Notes': 'අධ්‍යයන සටහන්', 'Zoom Classes': 'Zoom පන්ති',
  Payments: 'ගෙවීම්', Announcements: 'නිවේදන', Reports: 'වාර්තා', Calendar: 'දින දර්ශනය', Settings: 'සැකසීම්',
  'Welcome Back, Admin': 'ආයුබෝවන්, පරිපාලක', "Here's what's happening with your ICT classes today.": 'අද ඔබගේ ICT පන්තිවල තොරතුරු මෙන්න.',
  'Total Students': 'මුළු සිසුන්', 'Active Batches': 'සක්‍රිය කණ්ඩායම්', 'Published Lessons': 'ප්‍රකාශිත පාඩම්',
  'Pending Payments': 'තහවුරු කිරීමට ඇති ගෙවීම්', 'Active Paid Enrollments': 'සක්‍රිය ගෙවූ ලියාපදිංචි කිරීම්',
  'Upcoming Classes': 'ඉදිරි පන්ති', 'Schedule a Class': 'පන්තියක් සැලසුම් කරන්න', 'Add New Lesson': 'නව පාඩමක් එක් කරන්න',
  'Upload Material': 'අධ්‍යයන ද්‍රව්‍ය එක් කරන්න', 'Recent Activity': 'මෑත ක්‍රියාකාරකම්', 'View All': 'සියල්ල බලන්න', 'View Calendar': 'දින දර්ශනය බලන්න',
}
const tr = (value, language) => language === 'si' ? (SI_REPLACEMENTS[value] || SINHALA[value] || value) : value
SI_REPLACEMENTS['Tute Submissions'] = '\u0dc3\u0dd2\u0dc3\u0dd4\u0db1\u0dca\u0d9c\u0dda Tute \u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dd2\u0dbb\u0dd3\u0db8\u0dca'
const formatDate = value => value ? new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeZone: 'Asia/Colombo' }).format(new Date(value)) : '—'
const formatDateTime = value => value ? new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(value)) : '—'
const dateInputValue = value => value ? new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Colombo' }).format(new Date(value)) : ''
const getPath = (source, path) => path.split('.').reduce((value, key) => value?.[key], source)
function setPath(source, path, value) {
  const keys = path.split('.')
  const target = { ...source }
  let cursor = target
  for (let i = 0; i < keys.length - 1; i += 1) { cursor[keys[i]] = { ...(cursor[keys[i]] || {}) }; cursor = cursor[keys[i]] }
  cursor[keys.at(-1)] = value
  return target
}
const headersFor = token => ({ Authorization: `Bearer ${token}` })

const CONFIG = {
  classes: { title: 'My Classes', endpoint: '/batches', fields: [
    { name: 'name.en', label: 'Batch name', required: true }, { name: 'name.si', label: 'Batch name (Sinhala)' },
    { name: 'description.en', label: 'Description', type: 'textarea' }, { name: 'year', label: 'Academic year', type: 'academicYear', required: true },
    { name: 'subject', label: 'Subject', required: true }, { name: 'city', label: 'City', required: true }, { name: 'className', label: 'Class / schedule name' }, { name: 'fee', label: 'Class fee (LKR)', type: 'number' },
    { name: 'status', label: 'Status', type: 'select', options: ['draft', 'active', 'archived'] },
    { name: 'enrollmentOpen', label: 'Enrollment open', type: 'checkbox' },
  ] },
  academicYears: { title: 'Academic Years', endpoint: '/academic-years', fields: [
    { name: 'year', label: 'Academic year', type: 'number', required: true }, { name: 'active', label: 'Active', type: 'checkbox' },
  ] },
  lessons: { title: 'Lessons & Videos', endpoint: '/lessons', fields: [
    { name: 'title.en', label: 'Lesson title', required: true }, { name: 'title.si', label: 'Title (Sinhala)' },
    { name: 'description.en', label: 'Description', type: 'textarea' }, { name: 'description.si', label: 'Description (Sinhala)', type: 'textarea' }, { name: 'unit', label: 'Unit' }, { name: 'topic', label: 'Topic' },
    { name: 'batch', label: 'Batches', type: 'batches' }, { name: 'access', label: 'Access', type: 'select', options: ['free', 'restricted'] }, { name: 'published', label: 'Published', type: 'checkbox' }, { name: 'order', label: 'Display order', type: 'number' },
  ] },
  videos: { title: 'YouTube Videos', endpoint: '/videos', fields: [
    { name: 'title.en', label: 'Video title', required: true }, { name: 'title.si', label: 'Title (Sinhala)' },
    { name: 'description.en', label: 'Description', type: 'textarea' }, { name: 'description.si', label: 'Description (Sinhala)', type: 'textarea' }, { name: 'url', label: 'YouTube URL', required: true },
    { name: 'topic', label: 'Topic' }, { name: 'lessonDate', label: 'Class date', type: 'date' }, { name: 'lesson', label: 'Related lesson', type: 'lesson' }, { name: 'class', label: 'Related Zoom class', type: 'class' }, { name: 'batch', label: 'Batches', type: 'batches' },
    { name: 'access', label: 'Access', type: 'select', options: ['free', 'restricted'] }, { name: 'published', label: 'Published', type: 'checkbox' },
  ] },
  recordings: { title: 'Recorded Lessons', endpoint: '/recordings', fields: [
    { name: 'title.en', label: 'Recording title', required: true }, { name: 'title.si', label: 'Title (Sinhala)' },
    { name: 'description.en', label: 'Description', type: 'textarea' }, { name: 'description.si', label: 'Description (Sinhala)', type: 'textarea' },
    { name: 'url', label: 'Hosted recording URL', required: true }, { name: 'topic', label: 'Topic' }, { name: 'lessonDate', label: 'Class date', type: 'date' }, { name: 'lesson', label: 'Related lesson', type: 'lesson' }, { name: 'class', label: 'Related Zoom class', type: 'class' }, { name: 'batch', label: 'Batches', type: 'batches' },
    { name: 'access', label: 'Access', type: 'select', options: ['free', 'restricted'] }, { name: 'published', label: 'Published', type: 'checkbox' },
  ] },
  resources: { title: 'Tutorials & Notes', endpoint: '/resources', fields: [
    { name: 'title.en', label: 'Material title', required: true }, { name: 'title.si', label: 'Title (Sinhala)' },
    { name: 'description.en', label: 'Description', type: 'textarea' }, { name: 'description.si', label: 'Description (Sinhala)', type: 'textarea' }, { name: 'topic', label: 'Topic' }, { name: 'lesson', label: 'Related lesson', type: 'lesson' }, { name: 'class', label: 'Related Zoom class', type: 'class' }, { name: 'type', label: 'Type', type: 'select', options: ['pdf', 'powerpoint', 'past-paper', 'assignment', 'tutorial', 'note', 'question'], required: true },
    { name: 'upload', label: 'Upload PDF or PowerPoint (maximum 50 MB)', type: 'file', required: true }, { name: 'batch', label: 'Batches', type: 'batches' },
    { name: 'access', label: 'Access', type: 'select', options: ['free', 'restricted'] }, { name: 'published', label: 'Published', type: 'checkbox' },
  ] },
  zoom: { title: 'Zoom Classes', endpoint: '/zoom-classes', fields: [
    { name: 'title.en', label: 'Class title', required: true }, { name: 'title.si', label: 'Title (Sinhala)' },
    { name: 'description.en', label: 'Description', type: 'textarea' }, { name: 'description.si', label: 'Description (Sinhala)', type: 'textarea' }, { name: 'batch', label: 'Batch', type: 'batch', required: true },
    { name: 'startsAt', label: 'Starts at', type: 'datetime', required: true }, { name: 'endsAt', label: 'Ends at', type: 'datetime' },
    { name: 'meetingUrl', label: 'Zoom meeting URL' }, { name: 'meetingId', label: 'Meeting ID' }, { name: 'passcode', label: 'Passcode' },
    { name: 'access', label: 'Meeting access', type: 'select', options: ['free', 'restricted'] }, { name: 'status', label: 'Status', type: 'select', options: ['upcoming', 'completed', 'cancelled'] }, { name: 'published', label: 'Published', type: 'checkbox' },
  ] },
  payments: { title: 'Payments', endpoint: '/payments', fields: [
    { name: 'student', label: 'Student', type: 'student', required: true }, { name: 'batch', label: 'Batch', type: 'batch', required: true },
    { name: 'amount', label: 'Amount (LKR)', type: 'number', required: true }, { name: 'date', label: 'Payment date', type: 'date' },
    { name: 'reference', label: 'Payment reference' }, { name: 'status', label: 'Status', type: 'select', options: ['pending', 'paid', 'rejected'] }, { name: 'rejectionReason', label: 'Rejection reason', type: 'textarea' },
  ] },
  announcements: { title: 'Announcements', endpoint: '/announcements', fields: [
    { name: 'title.en', label: 'Announcement title', required: true }, { name: 'title.si', label: 'Title (Sinhala)' },
    { name: 'body.en', label: 'Message', type: 'textarea', required: true }, { name: 'body.si', label: 'Message (Sinhala)', type: 'textarea' },
    { name: 'batch', label: 'Batches (all if empty)', type: 'batches' }, { name: 'published', label: 'Published', type: 'checkbox' },
  ] },
  attendance: { title: 'Attendance', endpoint: '/attendance', fields: [
    { name: 'class', label: 'Class', type: 'class', required: true }, { name: 'student', label: 'Student', type: 'student', required: true },
    { name: 'status', label: 'Attendance', type: 'select', options: ['present', 'absent'], required: true }, { name: 'date', label: 'Date', type: 'date' },
  ] },
}

function dashboardApi(token) { return axios.create({ baseURL: `${API}/admin`, headers: headersFor(token), withCredentials: true }) }

export default function Dashboard({ mode = 'student' }) {
  const [view, setView] = useState(mode === 'admin' ? 'dashboard' : 'student-home')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'en')
  const [token] = useState(localStorage.getItem('authToken') || localStorage.getItem('studentToken') || '')
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [globalSearch, setGlobalSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const api = useMemo(() => dashboardApi(token), [token])

  const loadDashboard = useCallback(async () => {
    try {
      const [identity, overview] = await Promise.all([
        axios.get(`${API}/auth/me`, { headers: headersFor(token), withCredentials: true }),
        api.get('/dashboard'),
      ])
      if (identity.data.role !== 'admin') throw new Error('Administrator sign in required.')
      setProfile(identity.data)
      setStats(overview.data)
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not load dashboard data.')
      if (requestError.response?.status === 401 || requestError.response?.status === 403) {
        localStorage.removeItem('authToken'); localStorage.removeItem('auth'); window.location.replace('/admin/login')
      }
    } finally { setBusy(false) }
  }, [api, token])

  useEffect(() => { localStorage.setItem('language', language); document.documentElement.lang = language }, [language])

  useEffect(() => {
    if (mode !== 'admin') return
    if (!token) { window.location.replace('/admin/login'); return }
    // oxlint-disable-next-line react/set-state-in-effect -- fetch dashboard data after authentication.
    loadDashboard()
  }, [mode, token, loadDashboard])

  const logout = async () => {
    try { await axios.post(`${API}/auth/logout`, {}, { headers: headersFor(token), withCredentials: true }) } catch { /* continue local sign out */ }
    localStorage.removeItem('authToken'); localStorage.removeItem('auth'); localStorage.removeItem('studentToken')
    window.location.assign('/admin/login')
  }

  const chooseView = next => { setView(next); setMobileOpen(false); setSearchOpen(false); if (next === 'dashboard') loadDashboard() }
  const visibleSearchItems = useMemo(() => {
    if (!globalSearch.trim() || !stats) return []
    const query = globalSearch.toLowerCase()
    return [...(stats.activity || []).map(item => ({ ...item, view: item.kind === 'student' ? 'students' : item.kind === 'class' ? 'zoom' : item.kind === 'payment' ? 'payments' : item.kind === 'resource' ? 'resources' : 'lessons' })), ...(stats.upcomingClasses || []).map(item => ({ detail: item.title?.en, label: 'Upcoming class', at: item.startsAt, view: 'calendar' }))]
      .filter(item => `${item.detail || ''} ${item.label || ''} ${item.email || ''}`.toLowerCase().includes(query)).slice(0, 6)
  }, [globalSearch, stats])

  if (mode !== 'admin') return <StudentWorkspace token={token} />

  return <div className={`admin-shell ${mobileOpen ? 'drawer-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <button className="drawer-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
    <aside className="admin-sidebar">
      <a href="/" className="sidebar-brand"><span className="brand-emblem">OM</span><span><strong>OSHAN MENDIS ICT</strong><small>Admin Dashboard</small></span><button className="drawer-close" aria-label="Close menu" onClick={event => { event.preventDefault(); setMobileOpen(false) }}><X size={18}/></button></a>
      <div className="sidebar-label">MAIN MENU</div>
      <nav className="sidebar-nav">{NAV.map(([key, label, Icon]) => <button key={key} title={tr(label, language)} aria-label={tr(label, language)} className={view === key ? 'active' : ''} onClick={() => chooseView(key)}><Icon size={18}/><span>{tr(label, language)}</span>{view === key && <ChevronRight className="nav-current" size={15}/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-support"><ShieldCheck size={17}/><span><b>Secure admin</b><small>Single administrator account</small></span></div><button className="sidebar-logout" onClick={logout}><LogOut size={18}/><span>Logout</span></button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><button className="admin-collapse" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setSidebarCollapsed(value => !value)}><ChevronRight size={17}/></button><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu/></button><div className="breadcrumb">Admin <ChevronRight size={14}/><strong>{tr(NAV.find(item => item[0] === view)?.[1] || 'Dashboard', language)}</strong></div>
        <div className="topbar-actions"><div className={`admin-search ${searchOpen ? 'search-active' : ''}`}><Search size={17}/><input aria-label="Search dashboard data" placeholder="Search students, lessons, classes..." value={globalSearch} onFocus={() => setSearchOpen(true)} onChange={event => { setGlobalSearch(event.target.value); setSearchOpen(true) }} onKeyDown={event => { if (event.key === 'Escape') setSearchOpen(false) }}/>{globalSearch && <button aria-label="Clear search" onClick={() => setGlobalSearch('')}><X size={14}/></button>}{searchOpen && globalSearch && <div className="search-results">{visibleSearchItems.length ? visibleSearchItems.map((item, index) => <button key={`${item.kind}-${index}`} onClick={() => chooseView(item.view)}><span>{item.label}<b>{item.detail || item.email}</b></span><small>{formatDate(item.at)}</small></button>) : <p>No matching dashboard activity.</p>}</div>}</div>
          <button className="language-switch" onClick={() => setLanguage(language === 'en' ? 'si' : 'en')} aria-label="Switch language">{language === 'en' ? 'සිං' : 'EN'}</button><button className="topbar-settings" aria-label="Settings" onClick={() => chooseView('settings')}><Settings size={18}/></button>
          <button className="profile-menu" onClick={() => chooseView('settings')}><span className="profile-avatar">{profile?.name?.slice(0, 1)?.toUpperCase() || 'A'}</span><span className="profile-name"><b>{profile?.name || 'Admin'}</b><small>Administrator</small></span><ChevronDown size={15}/></button>
        </div>
      </header>
      <section className="admin-workspace">
        {error && <div className="dashboard-error" role="alert">{error}<button onClick={loadDashboard}>Retry</button></div>}
        {view === 'dashboard' && <Overview stats={stats} busy={busy} language={language} chooseView={chooseView} />}
        {view === 'students' && <StudentManager api={api} />}
        {view === 'payments' && <PaymentManager api={api} />}
        {view === 'individual-papers' && <IndividualPaperManager api={api} />}
        {view === 'tute-submissions' && <TuteSubmissionManager api={api} language={language} />}
        {['classes', 'lessons', 'resources', 'zoom', 'announcements', 'attendance'].includes(view) && <EntityManager key={view} view={view} api={api} profile={profile} />}
        {view === 'calendar' && <CalendarPage api={api} chooseView={chooseView} />}
        {view === 'reports' && <ReportsPage api={api} />}
        {view === 'settings' && <SettingsPage api={api} profile={profile} />}
      </section>
      <footer className="admin-footer">Â© {CURRENT_YEAR} OSHAN MENDIS ICT <span>Admin workspace</span></footer>
    </main>
  </div>
}

function Overview({ stats, busy, language, chooseView }) {
  const cards = [
    ['Total Students', stats?.students ?? 0, Users, 'violet'], ['Total Batches', stats?.totalBatches ?? stats?.activeBatches ?? 0, GraduationCap, 'blue'],
    ['Total Learning Resources', stats?.totalResources ?? 0, FileText, 'blue'],
    ['Active Paid Enrollments', stats?.activePaid ?? 0, ShieldCheck, 'mint'], ['Pending Payments', stats?.pending ?? 0, CircleDollarSign, 'amber'],
    ['Approved Payments', stats?.approvedPayments ?? 0, Check, 'mint'], ['Rejected Payments', stats?.rejectedPayments ?? 0, X, 'rose'],
    ['Published Lessons', stats?.published ?? 0, BookOpen, 'blue'], ['Upcoming Classes', stats?.upcoming ?? 0, CalendarDays, 'violet'],
  ]
  const quick = [
    ['Schedule a Class', 'zoom', CalendarPlus], ['Add New Lesson', 'lessons', Plus], ['Upload Material', 'resources', ArrowUpRight],
  ]
  return <>
    <div className="welcome-row"><div><span className="eyebrow">OSHAN MENDIS ICT <i/> LEARNING PLATFORM</span><h1>{tr('Welcome Back, Admin', language)}</h1><p>{tr("Here's what's happening with your ICT classes today.", language)}</p></div>
      <div className="quick-actions">{quick.map(([label, page, Icon]) => <button key={label} className={page === 'zoom' ? 'quick-primary' : ''} onClick={() => chooseView(page)}><Icon size={17}/>{tr(label, language)}</button>)}</div>
    </div>
    <div className="summary-grid">{cards.map(([label, value, Icon, color]) => <article className="summary-card" key={label}><div className={`summary-icon ${color}`}><Icon size={21}/></div><div className="summary-copy"><span>{tr(label, language)}</span><strong>{busy ? '—' : value}</strong><small>{label === 'Total Students' ? 'Registered accounts' : label === 'Total Batches' ? 'All academic batches' : label === 'Total Learning Resources' ? 'Published batch materials' : label === 'Active Paid Enrollments' ? 'Access currently enabled' : label === 'Pending Payments' ? 'Awaiting verification' : label === 'Approved Payments' ? 'Verified payments' : label === 'Rejected Payments' ? 'Payments declined' : label === 'Published Lessons' ? 'Lessons and videos' : label === 'Upcoming Classes' ? 'Scheduled online sessions' : ''}</small></div><span className="summary-corner"><ArrowUpRight size={16}/></span></article>)}</div>
    <section className="batch-summary panel"><div className="panel-heading"><div><span className="panel-kicker">ENROLLMENT OVERVIEW</span><h2>Students by academic batch</h2></div></div>{stats?.studentsByBatch?.length ? <div className="batch-summary-grid">{stats.studentsByBatch.map(item => <div key={item.batch}><span>{item.batch}</span><b>{item.count}</b></div>)}</div> : <p>No active enrollments recorded yet.</p>}</section>
    <section className="batch-summary panel"><div className="panel-heading"><div><span className="panel-kicker">BATCH CONTENT</span><h2>Resources by batch</h2></div><button onClick={() => chooseView('resources')}>Manage resources <ChevronRight size={15}/></button></div>{stats?.resourcesByBatch?.length ? <div className="batch-summary-grid">{stats.resourcesByBatch.map(item => <div key={item.id}><span>{item.name}{item.city ? ` · ${item.city}` : ''}</span><b>{item.count}</b></div>)}</div> : <p>No active batches yet.</p>}</section>
    <div className="overview-panels"><section className="panel activity-panel"><div className="panel-heading"><div><span className="panel-kicker">PLATFORM PULSE</span><h2>{tr('Recent Activity', language)}</h2></div><button onClick={() => chooseView('reports')}>{tr('View All', language)} <ChevronRight size={15}/></button></div>
      {busy ? <LoadingRows/> : stats?.activity?.length ? <div className="activity-list">{stats.activity.map((item, index) => {const Icon = item.kind === 'student' ? Users : item.kind === 'payment' ? CircleDollarSign : item.kind === 'class' ? Video : item.kind === 'resource' ? FileText : BookOpen; return <article className="activity-row" key={`${item.kind}-${item.at}-${index}`}><span className={`activity-icon ${item.kind}`}><Icon size={16}/></span><div className="activity-detail"><b>{item.label}</b><span>{item.detail}{item.email ? ` · ${item.email}` : ''}</span></div><time>{relativeTime(item.at)}</time></article>})}</div> : <EmptyState title="No activity yet" text="New student registrations, payments, and published content will appear here."/>}
      </section>
      <section className="panel upcoming-panel"><div className="panel-heading"><div><span className="panel-kicker">YOUR TEACHING SCHEDULE</span><h2>{tr('Upcoming Classes', language)}</h2></div><button onClick={() => chooseView('calendar')}>{tr('View Calendar', language)} <ChevronRight size={15}/></button></div>
        {busy ? <LoadingRows/> : stats?.upcomingClasses?.length ? <div className="upcoming-list">{stats.upcomingClasses.map(item => <article className="upcoming-item" key={item._id}><div className="class-date"><b>{new Intl.DateTimeFormat('en-LK', { day: '2-digit', timeZone: 'Asia/Colombo' }).format(new Date(item.startsAt))}</b><span>{new Intl.DateTimeFormat('en-LK', { month: 'short', timeZone: 'Asia/Colombo' }).format(new Date(item.startsAt))}</span></div><div className="class-copy"><b>{item.title?.en || item.title?.si || 'ICT Class'}</b><span>{item.batch?.year?.year ? `${item.batch.year.year} A/L ICT` : item.batch?.name?.en || 'Batch'} Â· {formatDateTime(item.startsAt)}</span></div><span className="class-status">Upcoming</span></article>)}</div> : <EmptyState title="No upcoming classes" text="Schedule a Zoom class and it will show here." action={<button onClick={() => chooseView('zoom')}><Plus size={15}/> Schedule class</button>}/>} 
      </section></div>
  </>
}

function relativeTime(value) {
  return formatDate(value)
}
function EmptyState({ title, text, action }) { return <div className="empty-state"><span><ArrowDownLeft size={18}/></span><b>{title}</b><p>{text}</p>{action}</div> }
function LoadingRows() { return <div className="loading-rows"><i/><i/><i/></div> }

function PageHeading({ kicker, title, description, action }) { return <div className="page-heading"><div><span className="panel-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p></div>{action}</div> }

function StudentManager({ api }) {
  const [students, setStudents] = useState([])
  const [batches, setBatches] = useState([])
  const [query, setQuery] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [enrollmentFilter, setEnrollmentFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState(null)
  const [edit, setEdit] = useState(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [newStudent, setNewStudent] = useState({ name: '', email: '', password: '', city: '', address: '', phone: '', batches: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const reload = useCallback(async () => {
    setLoading(true)
    try { const [people, groups] = await Promise.all([api.get('/students', { params: { search: query || undefined, city: cityFilter || undefined, batch: batchFilter || undefined, payment: paymentFilter || undefined, enrollment: enrollmentFilter || undefined, page, limit: 25 } }), api.get('/batches')]); setStudents(people.data.items || []); setPages(people.data.pages || 1); setTotal(people.data.total || 0); setBatches(groups.data.items || []); setError('') }
    catch (e) { setError(e.response?.data?.message || 'Could not load students.') } finally { setLoading(false) }
  }, [api, query, cityFilter, batchFilter, paymentFilter, enrollmentFilter, page])
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- load student records from the admin API.
    reload()
  }, [reload])
  const rows = students
  async function saveStudent(event) {
    event.preventDefault(); setError('')
    try { await api.put(`/students/${edit.id}`, { name: edit.name, email: edit.email, city: edit.city, address: edit.address, phone: edit.phone, active: edit.active, batches: edit.batches }); setEdit(null); setSaved(true); await reload(); window.setTimeout(() => setSaved(false), 2500) }
    catch (e) { setError(e.response?.data?.message || 'Could not update this student.') }
  }
  async function createStudent(event) {
    event.preventDefault(); setError('')
    try { await api.post('/students', newStudent); setCreating(false); setNewStudent({ name: '', email: '', password: '', city: '', address: '', phone: '', batches: [] }); setPage(1); await reload(); setSaved(true); window.setTimeout(() => setSaved(false), 2500) }
    catch (e) { setError(e.response?.data?.message || 'Could not create student.') }
  }
  async function deleteStudent() {
    if (!deleting) return
    setDeleteBusy(true)
    setError('')
    try {
      await api.delete(`/students/${deleting.id}`)
      setStudents(current => current.filter(person => person.id !== deleting.id))
      setTotal(current => Math.max(current - 1, 0))
      setDeleting(null)
      setDeleted(true)
      window.setTimeout(() => setDeleted(false), 2500)
    } catch (e) {
      setError(e.response?.data?.message || 'Could not delete this student.')
    } finally {
      setDeleteBusy(false)
    }
  }
  return <>
    <PageHeading kicker="STUDENT MANAGEMENT" title="My Students" description={`${total} registered student account${total === 1 ? '' : 's'}. Student passwords are never shown.`} action={<button className="primary-action" onClick={() => setCreating(true)}><Plus size={16}/> Add student</button>}/>
    {error && <div className="form-error">{error}</div>}{saved && <div className="form-success"><Check size={16}/> Student saved successfully.</div>}{deleted && <div className="form-success"><Check size={16}/> Student deleted successfully.</div>}
    <section className="panel management-panel"><div className="filter-bar"><label className="table-search"><Search size={17}/><input placeholder="Search name, email, or student ID" value={query} onChange={e => { setPage(1); setQuery(e.target.value) }}/></label><input aria-label="Filter by city" placeholder="City" value={cityFilter} onChange={e => { setPage(1); setCityFilter(e.target.value) }}/><select value={batchFilter} onChange={e => { setPage(1); setBatchFilter(e.target.value) }}><option value="">All batches</option>{batches.map(batch => <option key={batch._id} value={batch._id}>{batch.year?.year || ''} {batch.name?.en}</option>)}</select><select value={paymentFilter} onChange={e => { setPage(1); setPaymentFilter(e.target.value) }}><option value="">All payment statuses</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="rejected">Rejected</option><option value="refunded">Refunded</option><option value="none">No payment</option></select><select value={enrollmentFilter} onChange={e => { setPage(1); setEnrollmentFilter(e.target.value) }}><option value="">All enrollment statuses</option>{['active','suspended','revoked','expired'].map(value => <option key={value}>{value}</option>)}</select></div>
      {loading ? <LoadingRows/> : rows.length ? <><div className="table-wrap"><table><thead><tr><th>Student Name</th><th>Email</th><th>City</th><th>Batch</th><th>Status</th><th>Registered</th><th>Actions</th></tr></thead><tbody>{rows.map(person => {const payment = person.payments?.[0]; const enrollment = person.enrollments?.find(item => item.status === 'active') || person.enrollments?.[0]; const paidAccess = Boolean(person.active && person.enrollments?.some(enrollmentItem => enrollmentItem.status === 'active' && enrollmentItem.paymentStatus === 'paid')); return <tr key={person.id}><td><button className="student-cell" onClick={() => setSelected(selected === person.id ? null : person.id)}><span className="student-avatar">{person.name?.slice(0,1)?.toUpperCase() || '?'}</span><span><b>{person.name} <small>{person.studentId}</small></b></span></button>{selected === person.id && <div className="student-expanded"><b>Payment history</b>{person.payments?.length ? person.payments.map(paymentItem => <span key={paymentItem._id}>{paymentItem.status} Â· LKR {paymentItem.amount} Â· {formatDate(paymentItem.date)}</span>) : <span>No payment record.</span>}      <b>Home address</b><span>{person.address || 'Not provided'}</span><b>Enrollment status</b>{person.enrollments?.length ? person.enrollments.map(item => <EnrollmentStatus key={item._id} item={item} api={api} onSaved={reload}/>) : <span>No enrollment record.</span>}</div>}</td><td>{person.email}</td><td>{person.city || '—'}</td><td>{person.profile?.batches?.length ? person.profile.batches.map(item => <span className="tag" key={item._id}>{item.year?.year || item.name?.en}</span>) : <span className="muted">Unassigned</span>}</td><td><StatusPill value={person.active ? (paidAccess ? 'active' : 'inactive') : 'inactive'}/></td><td>{formatDate(person.createdAt)}</td><td><div className="entity-actions"><button className="row-action" onClick={() => setEdit({ id: person.id, name: person.name, email: person.email,       city: person.city || '', address: person.address || '', phone: person.phone || '', active: person.active, batches: person.profile?.batches?.map(item => item._id) || [] })}>Edit</button><button className="row-action danger" onClick={() => setDeleting({ id: person.id, name: person.name })}>Delete</button></div></td></tr>})}</tbody></table></div><div className="pagination-controls"><span>{total ? `Showing ${(page - 1) * 25 + 1}–${Math.min(page * 25, total)} of ${total}` : 'No students'}</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><b>Page {page} of {pages}</b><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div></> : <EmptyState title="No students found" text="Students who register will appear here."/>}
    </section>
    {creating && <Modal title="Add student" onClose={() => setCreating(false)}><form className="entity-form" onSubmit={createStudent}><p>Set a temporary password and share it with the student securely.</p><Field label="Full name"><input required value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}/></Field><Field label="Email"><input type="email" required value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })}/></Field><Field label="Temporary password (minimum 8 characters)"><input type="password" minLength={8} required value={newStudent.password} onChange={e => setNewStudent({ ...newStudent, password: e.target.value })}/></Field>    <Field label="City"><input required value={newStudent.city} onChange={e => setNewStudent({ ...newStudent, city: e.target.value })}/></Field><Field label="Home address"><textarea required rows={3} value={newStudent.address} onChange={e => setNewStudent({ ...newStudent, address: e.target.value })}/></Field><Field label="Contact number"><input value={newStudent.phone} onChange={e => setNewStudent({ ...newStudent, phone: e.target.value })}/></Field><Field label="Academic batches"><select multiple value={newStudent.batches} onChange={e => setNewStudent({ ...newStudent, batches: Array.from(e.target.selectedOptions, item => item.value) })}>{batches.map(item => <option key={item._id} value={item._id}>{item.year?.year} {item.name?.en}</option>)}</select></Field><button className="primary-action">Create student account</button></form></Modal>}
    {edit && <Modal title="Edit student" onClose={() => setEdit(null)}><form className="entity-form" onSubmit={saveStudent}><Field label="Name"><input required value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })}/></Field><Field label="Email"><input type="email" required value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })}/></Field>    <Field label="City"><input value={edit.city} onChange={e => setEdit({ ...edit, city: e.target.value })}/></Field><Field label="Home address"><textarea required rows={3} value={edit.address} onChange={e => setEdit({ ...edit, address: e.target.value })}/></Field><Field label="Contact number"><input value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })}/></Field><Field label="Assigned batches"><select multiple value={edit.batches} onChange={e => setEdit({ ...edit, batches: Array.from(e.target.selectedOptions, item => item.value) })}>{batches.map(batch => <option key={batch._id} value={batch._id}>{batch.year?.year} {batch.name?.en}</option>)}</select></Field><label className="checkbox-field"><input type="checkbox" checked={edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked })}/> Account active</label><button className="primary-action">Save student</button></form></Modal>}
    {deleting && <Modal title="Delete student" onClose={() => !deleteBusy && setDeleting(null)}><div className="delete-confirmation"><p>Are you sure you want to delete this student?</p><p className="muted"><strong>{deleting.name}</strong> will be permanently removed.</p><div className="confirmation-actions"><button type="button" className="secondary-action" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className="danger-action" disabled={deleteBusy} onClick={deleteStudent}>{deleteBusy ? 'Deleting…' : 'Delete'}</button></div></div></Modal>}
  </>
}

function PaymentManager({ api }) {
  const [items, setItems] = useState([])
  const [students, setStudents] = useState([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [batch, setBatch] = useState('')
  const [city, setCity] = useState('')
  const [paymentMonth, setPaymentMonth] = useState('')
  const [paymentYear, setPaymentYear] = useState('')
  const [batches, setBatches] = useState([])
  const [creating, setCreating] = useState(false)
  const [newPayment, setNewPayment] = useState({ student: '', batch: '', amount: '', date: '', paymentMonth: '' })
  const [drafts, setDrafts] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [payments, groups, people] = await Promise.all([
        api.get('/payments', { params: { search: query || undefined, city: city || undefined, status: status || undefined, batch: batch || undefined, month: paymentMonth || undefined, year: paymentYear || undefined, limit: 100 } }),
        api.get('/batches'), api.get('/students', { params: { limit: 100 } }),
      ])
      const rows = payments.data.items || []
      setItems(rows); setBatches(groups.data.items || []); setStudents(people.data.items || [])
      setDrafts(Object.fromEntries(rows.map(item => [item._id, { amount: String(item.amount ?? ''), date: dateInputValue(item.date), paymentMonth: item.paymentMonth || '', status: item.status === 'paid' ? 'paid' : 'pending' }])))
      setError('')
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not load payment records.') }
    finally { setLoading(false) }
  }, [api, query, city, status, batch, paymentMonth, paymentYear])

  useEffect(() => { const timer = window.setTimeout(reload, 250); return () => window.clearTimeout(timer) }, [reload])

  function changeDraft(id, key, value) { setDrafts(current => ({ ...current, [id]: { ...current[id], [key]: value } })) }

  async function savePayment(item) {
    const draft = drafts[item._id]
    if (!draft) return
    setBusyId(item._id); setError('')
    try {
      await api.patch(`/payments/${item._id}`, { amount: Number(draft.amount), date: draft.date, paymentMonth: draft.paymentMonth, status: draft.status })
      await reload()
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not update this payment.') }
    finally { setBusyId('') }
  }

  async function createPayment(event) {
    event.preventDefault(); setError('')
    try {
      const date = newPayment.date ? new Date(`${newPayment.date}T00:00:00+05:30`).toISOString() : undefined
      await api.post('/payments', { ...newPayment, amount: Number(newPayment.amount), date: date || undefined, paymentMonth: newPayment.paymentMonth || undefined })
      setCreating(false); setNewPayment({ student: '', batch: '', amount: '', date: '', paymentMonth: '' }); await reload()
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not record payment.') }
  }

  return <>
    <PageHeading kicker="PAYMENT RECORDS" title="Payments" description="View payment dates, months, amounts, and update each student's Paid or Pending status." action={<button className="primary-action" onClick={() => setCreating(true)}><Plus size={16}/> Record payment</button>}/>
    {error && <div className="form-error" role="alert">{error}</div>}
    <section className="panel management-panel"><div className="filter-bar"><label className="table-search"><Search size={17}/><input placeholder="Search student, email, or student ID" value={query} onChange={e => setQuery(e.target.value)}/></label><input aria-label="Filter payments by city" placeholder="City" value={city} onChange={e => setCity(e.target.value)}/><select value={batch} onChange={e => setBatch(e.target.value)}><option value="">All batches</option>{batches.map(item => <option key={item._id} value={item._id}>{item.year?.year} {item.name?.en}</option>)}</select><label>Month<input type="month" value={paymentMonth} onChange={e => setPaymentMonth(e.target.value)}/></label><label>Year<input type="number" min="2000" max="2100" placeholder="Year" value={paymentYear} onChange={e => setPaymentYear(e.target.value)}/></label><select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="paid">Paid</option><option value="pending">Pending</option></select></div>
    {loading ? <LoadingRows/> : items.length ? <div className="table-wrap"><table><thead><tr><th>Student</th><th>Batch</th><th>Payment month</th><th>Amount (LKR)</th><th>Payment date</th><th>Status</th><th>Update</th></tr></thead><tbody>{items.map(item => { const draft = drafts[item._id] || {}; return <tr key={item._id}><td><b>{item.student?.name || 'Student'}</b><small className="table-subline">{item.student?.email}</small><small className="table-subline">Account ID: {item.student?._id || 'Unavailable'}</small></td><td>{item.batch?.name?.en || item.batch?.year?.year || 'Batch'}</td><td><input aria-label="Payment month" type="month" value={draft.paymentMonth || ''} onChange={event => changeDraft(item._id, 'paymentMonth', event.target.value)}/></td><td><input aria-label="Payment amount" type="number" min="0.01" step="0.01" value={draft.amount ?? ''} onChange={event => changeDraft(item._id, 'amount', event.target.value)}/></td><td><input aria-label="Payment date" type="date" value={draft.date || ''} onChange={event => changeDraft(item._id, 'date', event.target.value)}/></td><td><select aria-label="Payment status" value={draft.status || 'pending'} onChange={event => changeDraft(item._id, 'status', event.target.value)}><option value="paid">Paid</option><option value="pending">Pending</option></select></td><td><button className="row-action" disabled={busyId === item._id} onClick={() => savePayment(item)}>{busyId === item._id ? 'Saving?' : 'Save'}</button></td></tr> })}</tbody></table></div> : <EmptyState title="No payments found" text="Record a payment for an enrolled student to begin."/>}
    </section>
    {creating && <Modal title="Record payment" onClose={() => setCreating(false)}><form className="entity-form" onSubmit={createPayment}><p>Create a payment record for a registered student. New records start as Pending.</p><Field label="Student"><select required value={newPayment.student} onChange={e => setNewPayment({ ...newPayment, student: e.target.value, batch: '' })}><option value="">Choose student</option>{students.map(person => <option key={person.id} value={person.id}>{person.studentId} ? {person.name} ? {person.email}</option>)}</select></Field><Field label="Batch"><select required value={newPayment.batch} onChange={e => setNewPayment({ ...newPayment, batch: e.target.value })}><option value="">Choose batch</option>{batches.filter(group => students.find(person => person.id === newPayment.student)?.enrollments?.some(enrollment => enrollment.batch?._id === group._id)).map(group => <option key={group._id} value={group._id}>{group.year?.year} {group.name?.en}</option>)}</select></Field><Field label="Payment month"><input type="month" value={newPayment.paymentMonth} onChange={e => setNewPayment({ ...newPayment, paymentMonth: e.target.value })}/></Field><Field label="Amount (LKR)"><input type="number" min="0.01" step="0.01" required value={newPayment.amount} onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })}/></Field><Field label="Payment date"><input type="date" value={newPayment.date} onChange={e => setNewPayment({ ...newPayment, date: e.target.value })}/></Field><button className="primary-action">Save Pending Payment</button></form></Modal>}
  </>
}

function IndividualPaperManager({ api }) {
  const [students, setStudents] = useState([])
  const [studentId, setStudentId] = useState('')
  const [papers, setPapers] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryName, setCategoryName] = useState('')
  const [studentInfo, setStudentInfo] = useState(null)
  const [form, setForm] = useState({ title: '', subject: '', description: '', uploadDate: new Date().toISOString().slice(0, 10) })
  const [file, setFile] = useState(null)
  const [categoryFiles, setCategoryFiles] = useState({})
  const [replacementFiles, setReplacementFiles] = useState({})
  const [preview, setPreview] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const uploadInProgress = useRef(false)
  const categoryFileInputs = useRef({})
  const replacementFileInputs = useRef({})

  useEffect(() => {
    setCategoryFiles({})
    setReplacementFiles({})
    setError('')
    setNotice('')
    categoryFileInputs.current = {}
    replacementFileInputs.current = {}
  }, [studentId])

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/individual-papers/students', { params: { search: search || undefined } })
      setStudents(data.items || [])
      if (!data.items?.some(student => student.id === studentId)) setStudentId('')
      setError('')
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not load students.') }
    finally { setLoading(false) }
  }, [api, search, studentId])

  const loadPapers = useCallback(async () => {
    if (!studentId) { setPapers([]); setStudentInfo(null); return }
    try {
      const { data } = await api.get(`/individual-papers/student/${studentId}`)
      setPapers((data.items || []).filter(item => !item.category))
      setCategories(data.categories || [])
      setStudentInfo(data.student)
      setError('')
    } catch (requestError) { setPapers([]); setError(requestError.response?.data?.message || requestError.message || 'Could not load this student’s papers.') }
  }, [api, studentId])

  useEffect(() => { loadStudents() }, [loadStudents])
  useEffect(() => { loadPapers() }, [loadPapers])

  async function submit(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    if (!studentId || !file || uploadInProgress.current) return
    const body = new FormData()
    body.set('studentId', studentId)
    body.set('title', form.title)
    body.set('subject', form.subject)
    body.set('description', form.description)
    body.set('uploadDate', form.uploadDate)
    body.set('pdf', file)
    uploadInProgress.current = true
    setSaving(true); setError(''); setNotice('')
    try {
      await api.post('/individual-papers/upload', body)
      setForm({ title: '', subject: '', description: '', uploadDate: new Date().toISOString().slice(0, 10) })
      setFile(null)
      if (formElement?.isConnected) formElement.reset()
      setNotice('Paper uploaded successfully and assigned to this student.')
      await loadPapers()
    } catch (requestError) { setError(apiErrorMessage(requestError, 'Could not upload the paper.')) }
    finally { uploadInProgress.current = false; setSaving(false) }
  }

  async function retrieve(paper, download = false) {
    try {
      const { data } = await api.get(`/individual-papers/${paper._id}/file${download ? '?download=1' : ''}`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      if (download) {
        const link = document.createElement('a'); link.href = url; link.download = paper.pdfName || `${paper.title}.pdf`; link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else setPreview({ url, name: paper.title })
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not retrieve the paper.') }
  }

  function chooseReplacement(paper, replacement, input) {
    replacementFileInputs.current[paper._id] = input
    setReplacementFiles(current => ({ ...current, [paper._id]: replacement }))
  }

  async function replace(paper) {
    const replacement = replacementFiles[paper._id]
    if (!replacement || uploadInProgress.current) return
    const body = new FormData(); body.set('pdf', replacement)
    uploadInProgress.current = true
    setSaving(true); setError(''); setNotice('')
    try {
      await api.post(`/individual-papers/${paper._id}/replace`, body)
      setReplacementFiles(current => { const next = { ...current }; delete next[paper._id]; return next })
      const input = replacementFileInputs.current[paper._id]
      if (input?.isConnected) input.value = ''
      setNotice('Paper replaced successfully.')
      await loadPapers()
    } catch (requestError) { setError(apiErrorMessage(requestError, 'Could not replace the paper.')) }
    finally { uploadInProgress.current = false; setSaving(false) }
  }

  async function remove(paper) {
    if (!window.confirm(`Delete “${paper.title}” for ${studentInfo?.name}?`)) return
    setError('')
    try { await api.delete(`/individual-papers/${paper._id}`); await loadPapers() }
    catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not delete the paper.') }
  }

  async function createCategory(event) {
    event.preventDefault()
    if (!studentId || !categoryName.trim()) return
    setSaving(true); setError('')
    try { await api.post('/individual-papers/categories', { studentId, name: categoryName.trim() }); setCategoryName(''); await loadPapers() }
    catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not create the category.') }
    finally { setSaving(false) }
  }

  async function renameCategory(category) {
    const name = window.prompt('Category name', category.name)
    if (!name?.trim() || name.trim() === category.name) return
    setError('')
    try { await api.patch(`/individual-papers/categories/${category._id}`, { name: name.trim() }); await loadPapers() }
    catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not rename the category.') }
  }

  async function deleteCategory(category) {
    if (!window.confirm(`Delete “${category.name}” and all its PDFs?`)) return
    setError('')
    try { await api.delete(`/individual-papers/categories/${category._id}`); await loadPapers() }
    catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not delete the category.') }
  }

  async function uploadCategoryPapers(category) {
    const files = categoryFiles[category._id] || []
    if (!files.length || uploadInProgress.current) return
    if (files.length > 10) { setError('Upload no more than 10 PDF files at once.'); return }
    const body = new FormData(); Array.from(files).forEach(file => body.append('pdfs', file))
    uploadInProgress.current = true
    setSaving(true); setError(''); setNotice('')
    try {
      await api.post(`/individual-papers/categories/${category._id}/papers`, body)
      setCategoryFiles(current => { const next = { ...current }; delete next[category._id]; return next })
      const input = categoryFileInputs.current[category._id]
      if (input?.isConnected) input.value = ''
      setNotice(`${files.length} PDF${files.length === 1 ? '' : 's'} uploaded successfully to ${category.name}.`)
      await loadPapers()
    } catch (requestError) { setError(apiErrorMessage(requestError, 'Could not upload papers to this category.')) }
    finally { uploadInProgress.current = false; setSaving(false) }
  }

  const selectedStudent = students.find(student => student.id === studentId)
  return <>
    <PageHeading kicker="PRIVATE STUDY MATERIAL" title="My Papers" description="Manage private paper categories and PDFs for individual students."/>
    {error && <div className="form-error">{error}</div>}
    {notice && <div className="form-success"><Check size={16}/>{notice}</div>}
    <section className="panel management-panel">
      <div className="filter-bar"><label className="table-search"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search students by name, email, or ID"/></label></div>
      {loading ? <LoadingRows/> : students.length ? <div className="table-wrap"><table><thead><tr><th>Student</th><th>Email</th><th>Batch</th><th>Payment</th><th>Assignment</th></tr></thead><tbody>{students.map(student => <tr key={student.id}><td><b>{student.name}</b><small className="table-subline">{student.studentId || student.id}</small></td><td>{student.email}</td><td>{student.batches?.length ? student.batches.map(batch => <span className="tag" key={batch._id}>{batch.year?.year || batch.name?.en || 'Batch'}</span>) : 'Unassigned'}</td><td><StatusPill value={student.active ? student.paymentStatus : 'inactive'}/></td><td><button className="row-action" disabled={!student.eligible || saving} onClick={() => setStudentId(student.id)}>{studentId === student.id ? 'Selected' : student.eligible ? 'Select student' : student.paymentStatus === 'paid' ? 'Active paid enrollment required' : 'Payment approval required'}</button></td></tr>)}</tbody></table></div> : <EmptyState title="No students found" text="Registered students will appear here."/>}
    </section>
    {studentId && <>
      <PageHeading kicker="SELECTED STUDENT" title={studentInfo?.name || selectedStudent?.name || 'Student papers'} description={`${studentInfo?.email || selectedStudent?.email || ''} · ${selectedStudent?.batches?.map(batch => batch.name?.en || batch.year?.year).filter(Boolean).join(', ') || 'No batch listed'} · Approved payment`}/>
      <section className="panel management-panel"><div className="panel-heading"><div><span className="panel-kicker">STUDENT-WISE ORGANIZATION</span><h2>Paper categories</h2></div></div>
        <form className="paper-category-create" onSubmit={createCategory}><input aria-label="New category name" required maxLength={100} placeholder="Category name, for example Paper 1" value={categoryName} onChange={event => setCategoryName(event.target.value)}/><button className="primary-action" disabled={saving || !categoryName.trim()}><Plus size={16}/>Add category</button></form>
        {categories.length ? <div className="paper-category-grid">{categories.map(category => <article className="paper-category-card" key={category._id}>
          <header><div><span className="panel-kicker">PAPER CATEGORY</span><h3>{category.name}</h3></div><div className="entity-actions"><button className="row-action" onClick={() => renameCategory(category)}>Rename</button><button className="row-action danger" onClick={() => deleteCategory(category)}>Delete</button></div></header>
          <label className="paper-category-upload">Choose PDF files<input hidden type="file" accept="application/pdf,.pdf" multiple disabled={saving} ref={input => { categoryFileInputs.current[category._id] = input }} onChange={event => { const input = event.currentTarget; const files = Array.from(input.files || []); setCategoryFiles(current => ({ ...current, [category._id]: files })) }}/></label>{categoryFiles[category._id]?.length > 0 && <div className="paper-selected-files"><span>{categoryFiles[category._id].map(item => item.name).join(', ')}</span><button type="button" className="primary-action" disabled={saving} onClick={() => uploadCategoryPapers(category)}>{saving ? 'Uploading...' : `Upload ${categoryFiles[category._id].length} PDF${categoryFiles[category._id].length === 1 ? '' : 's'}`}</button></div>}
          {category.papers?.length ? <ul>{category.papers.map(paper => <li key={paper._id}><div><b>{paper.pdfName}</b><small>{paper.subject || category.name} · {formatDate(paper.uploadDate)}</small></div><div className="entity-actions"><button className="row-action" onClick={() => retrieve(paper)}>View</button><button className="row-action" onClick={() => retrieve(paper, true)}>Download</button><label className="row-action">Choose replacement<input hidden type="file" accept="application/pdf,.pdf" disabled={saving} ref={input => { replacementFileInputs.current[paper._id] = input }} onChange={event => chooseReplacement(paper, event.currentTarget.files?.[0] || null, event.currentTarget)}/></label>{replacementFiles[paper._id] && <><small>{replacementFiles[paper._id].name}</small><button type="button" className="row-action" disabled={saving} onClick={() => replace(paper)}>{saving ? 'Uploading...' : 'Upload replacement'}</button></>}<button className="row-action danger" onClick={() => remove(paper)}>Delete PDF</button></div></li>)}</ul> : <EmptyState title="No PDFs in this category" text="Upload one or more PDF files to this category."/>}
        </article>)}</div> : <EmptyState title="No paper categories yet" text="Create a category such as Paper 1 to organize this student's PDFs."/>}
      </section>
      <section className="panel management-panel"><h2>Upload a PDF paper</h2><form className="entity-form" onSubmit={submit}>
        <Field label="Paper title"><input required maxLength={180} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}/></Field>
        <Field label="Subject"><input required maxLength={120} value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })}/></Field>
        <Field label="Description"><textarea rows={3} maxLength={2000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })}/></Field>
        <Field label="Upload date"><input required type="date" value={form.uploadDate} onChange={event => setForm({ ...form, uploadDate: event.target.value })}/></Field>
        <Field label="PDF file (maximum 30 MB)"><input required type="file" accept="application/pdf,.pdf" onChange={event => setFile(event.target.files?.[0] || null)}/></Field>
        <button className="primary-action" disabled={saving || !file}>{saving ? 'Saving…' : 'Upload paper for this student'}</button>
      </form></section>
      <section className="panel management-panel"><div className="panel-heading"><div><span className="panel-kicker">PRIVATE TO THIS ACCOUNT</span><h2>Assigned papers</h2></div></div>
        {papers.length ? <div className="table-wrap"><table><thead><tr><th>Paper</th><th>Subject</th><th>Description</th><th>Upload date</th><th>Actions</th></tr></thead><tbody>{papers.map(paper => <tr key={paper._id}><td><b>{paper.title}</b></td><td>{paper.subject}</td><td>{paper.description || '—'}</td><td>{formatDate(paper.uploadDate)}</td><td><div className="entity-actions"><button className="row-action" onClick={() => retrieve(paper)}>View</button><button className="row-action" onClick={() => retrieve(paper, true)}>Download</button><label className="row-action">Choose replacement<input hidden type="file" accept="application/pdf,.pdf" disabled={saving} ref={input => { replacementFileInputs.current[paper._id] = input }} onChange={event => chooseReplacement(paper, event.currentTarget.files?.[0] || null, event.currentTarget)}/></label>{replacementFiles[paper._id] && <><small>{replacementFiles[paper._id].name}</small><button type="button" className="row-action" disabled={saving} onClick={() => replace(paper)}>{saving ? 'Uploading...' : 'Upload replacement'}</button></>}<button className="row-action danger" onClick={() => remove(paper)}>Delete</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No papers assigned" text="Upload a PDF above to assign the first paper to this student."/>}
      </section>
    </>}
    {preview && <Modal title={preview.name} onClose={() => { URL.revokeObjectURL(preview.url); setPreview(null) }}><div style={{ width: 'min(84vw, 1000px)', height: 'min(78vh, 800px)' }}><iframe title={preview.name} src={preview.url} style={{ width: '100%', height: '100%', border: 0 }}/></div><a className="row-action" href={preview.url} download={`${preview.name}.pdf`}>Download PDF</a></Modal>}
  </>
}

function TuteSubmissionManager({ api, language }) {
  const [items, setItems] = useState([])
  const [options, setOptions] = useState({ students: [], batches: [] })
  const [filters, setFilters] = useState({ search: '', studentId: '', batchId: '', tuteNumber: '', status: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState(null)
  const [busyId, setBusyId] = useState('')
  const t = (en, si) => language === 'si' ? si : en

  useEffect(() => {
    api.get('/tute-submissions/filters').then(({ data }) => setOptions({ students: data.students || [], batches: data.batches || [] })).catch(requestError => setError(requestError.response?.data?.message || requestError.message || 'Could not load submission filters.'))
  }, [api])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, page, limit: 25 }).filter(([, value]) => value !== ''))
      const { data } = await api.get('/tute-submissions', { params })
      setItems(data.items || []); setTotal(data.total || 0); setPages(data.pages || 1); setError('')
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not load Tute submissions.') }
    finally { setLoading(false) }
  }, [api, filters, page])

  useEffect(() => { load() }, [load])

  async function retrieve(item, download = false) {
    try {
      const { data } = await api.get(`/tute-submissions/${item._id}/file${download ? '?download=1' : ''}`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      if (download) {
        const link = document.createElement('a'); link.href = url; link.download = item.pdfName; link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else setPreview({ url, title: `${item.student?.name || item.studentName} · ${item.tuteNumber} · ${item.tuteName}` })
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not open this Tute PDF.') }
  }

  async function updateStatus(item, status) {
    setBusyId(item._id); setError(''); setNotice('')
    try { await api.patch(`/tute-submissions/${item._id}/status`, { status }); setNotice(t('Submission status updated.', '\u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0dad\u0dad\u0dca\u0dad\u0dca\u0dc0\u0dba \u0dba\u0dcf\u0dc0\u0dad\u0dca\u0d9a\u0dcf\u0dbd\u0dd3\u0db1 \u0d9a\u0dbb\u0db1 \u0dbd\u0daf\u0dd3.')); await load() }
    catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not update submission status.') }
    finally { setBusyId('') }
  }

  async function remove(item) {
    if (!window.confirm(t(`Delete ${item.tuteNumber} from ${item.student?.name || item.studentName}?`, '\u0db8\u0dda \u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dd2\u0dbb\u0dd3\u0db8 \u0db8\u0dd0\u0d9a\u0dd3\u0db8\u0da7 \u0d94\u0db6\u0da7 \u0dc1\u0dd4\u0dbb\u0dda\u0daf?'))) return
    setBusyId(item._id); setError(''); setNotice('')
    try { await api.delete(`/tute-submissions/${item._id}`); setNotice(t('Submission deleted.', '\u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dd2\u0dbb\u0dd3\u0db8 \u0db8\u0d9a\u0dcf \u0daf\u0db1 \u0dbd\u0daf\u0dd3.')); await load() }
    catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not delete this submission.') }
    finally { setBusyId('') }
  }

  function clearFilters() { setFilters({ search: '', studentId: '', batchId: '', tuteNumber: '', status: '', from: '', to: '' }); setPage(1) }
  return <div className="tute-submission-page">
    <PageHeading
      kicker={t('STUDENT WORK', '\u0dc1\u0dd2\u0dc2\u0dca\u0dba \u0dc0\u0dd0\u0da9')}
      title={t('Student Tute Submissions', '\u0dc1\u0dd2\u0dc3\u0dd4\u0db1\u0dca\u0d9c\u0dda Tute \u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dd2\u0dbb\u0dd3\u0db8\u0dca')}
      description={t('Review, filter, and manage student submitted Tute PDFs.', '\u0dc1\u0dd2\u0dc2\u0dca\u0dba\u0dba\u0dd2\u0db1\u0dca \u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dbb\u0db1 Tute PDF \u0db4\u0dbb\u0dd2\u0d9a\u0dca\u0dc2\u0dcf \u0d9a\u0dbb \u0d9a\u0dc5\u0db8\u0db1\u0dcf\u0d9a\u0dbb\u0dab\u0dba \u0d9a\u0dbb\u0db1\u0dca\u0db1.')}
    />
    {error && <div className="form-error" role="alert">{error}</div>}
    {notice && <div className="form-success"><Check size={16}/>{notice}</div>}
    <section className="panel management-panel">
      <div className="tute-filter-grid">
        <label>{t('Search student or Tute', '\u0dc1\u0dd2\u0dc2\u0dca\u0dba\u0dba\u0dcf \u0dc4\u0ddd Tute \u0dc3\u0ddc\u0dba\u0db1\u0dca\u0db1')}<input value={filters.search} onChange={event => { setPage(1); setFilters(current => ({ ...current, search: event.target.value })) }} placeholder="Name, ID, email, or filename"/></label>
        <label>{t('Student', '\u0dc1\u0dd2\u0dc2\u0dca\u0dba\u0dba\u0dcf')}<select value={filters.studentId} onChange={event => { setPage(1); setFilters(current => ({ ...current, studentId: event.target.value })) }}><option value="">{t('All students', '\u0dc3\u0dd2\u0dba\u0dc5\u0dd4 \u0dc1\u0dd2\u0dc2\u0dca\u0dba\u0dba\u0dd2\u0db1\u0dca')}</option>{options.students.map(student => <option key={student._id} value={student._id}>{student.name} ? {student.studentId}</option>)}</select></label>
        <label>{t('Batch', '\u0d9a\u0dab\u0dca\u0da9\u0dcf\u0dba\u0db8')}<select value={filters.batchId} onChange={event => { setPage(1); setFilters(current => ({ ...current, batchId: event.target.value })) }}><option value="">{t('All batches', '\u0dc3\u0dd2\u0dba\u0dc5\u0dd4 \u0d9a\u0dab\u0dca\u0da9\u0dcf\u0dba\u0db8')}</option>{options.batches.map(batch => <option key={batch._id} value={batch._id}>{batch.name?.en || batch.year?.year || batch.subject}</option>)}</select></label>
        <label>{t('Tute number', '\u0da7\u0dd2\u0dba\u0dd4\u0da7\u0dca \u0d85\u0d82\u0d9a\u0dba')}<input value={filters.tuteNumber} onChange={event => { setPage(1); setFilters(current => ({ ...current, tuteNumber: event.target.value })) }} placeholder="Tute 01"/></label>
        <label>{t('Status', '\u0dad\u0dad\u0dca\u0dad\u0dca\u0dc0\u0dba')}<select value={filters.status} onChange={event => { setPage(1); setFilters(current => ({ ...current, status: event.target.value })) }}><option value="">{t('All statuses', '\u0dc3\u0dd2\u0dba\u0dc5\u0dd4 \u0dad\u0dad\u0dca\u0dad\u0dca\u0dc0')}</option><option value="submitted">{t('Submitted', '\u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca')}</option><option value="reviewed">{t('Reviewed', '\u0dc3\u0db8\u0dcf\u0dbd\u0ddd\u0da0\u0db1\u0dba')}</option></select></label>
        <label>{t('From date', '\u0dc3\u0dd2\u0da7 \u0daf\u0dd2\u0db1\u0dba')}<input type="date" value={filters.from} onChange={event => { setPage(1); setFilters(current => ({ ...current, from: event.target.value })) }}/></label>
        <label>{t('To date', '\u0daf\u0d9a\u0dca\u0dc0\u0dcf \u0daf\u0dd2\u0db1\u0dba')}<input type="date" value={filters.to} onChange={event => { setPage(1); setFilters(current => ({ ...current, to: event.target.value })) }}/></label>
        <button type="button" className="row-action" onClick={clearFilters}>{t('Clear filters', '\u0db4\u0dda\u0dbb\u0dd4\u0db8\u0dca \u0d89\u0dc0\u0dad\u0dca \u0d9a\u0dbb\u0db1\u0dca\u0db1')}</button>
      </div>
      <div className="panel-heading tute-results-heading"><div><span className="panel-kicker">SUBMISSIONS</span><h2>{total} {t('submission records', '\u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0dc0\u0dcf\u0dbb\u0dca\u0dad\u0dcf')}</h2></div><button className="row-action" onClick={load} disabled={loading}>{t('Refresh', '\u0dba\u0dcf\u0dc0\u0dad\u0dca\u0d9a\u0dcf\u0dbd\u0dd3\u0db1 \u0d9a\u0dbb\u0db1\u0dca\u0db1')}</button></div>
      {loading ? <LoadingRows/> : items.length === 0 ? <EmptyState title={t('No Tute submissions found', '\u0da7\u0dd2\u0dba\u0dd4\u0da7\u0dca \u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dd2\u0dbb\u0dd3\u0db8\u0dca \u0dc4\u0db8\u0dd4\u0dc0\u0dd3 \u0db1\u0dd0\u0dad')} text={t('Student-uploaded Tute PDFs will appear here.', '\u0dc1\u0dd2\u0dc2\u0dca\u0dba\u0dba\u0dd2\u0db1\u0dca \u0d85\u0db4\u0dca\u0dbd\u0ddd\u0da9\u0dca \u0d9a\u0dbb\u0db1 Tute PDF \u0db8\u0dd9\u0dc4\u0dd2 \u0daf\u0dd0\u0d9a\u0dd2\u0dba \u0dc4\u0dd0\u0d9a.')}/> : (
        <>
          <div className="table-wrap"><table className="tute-submissions-table"><thead><tr><th>Student</th><th>Batch</th><th>Tute</th><th>PDF file</th><th>Submitted at</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{items.map(item => <tr key={item._id}>
              <td><b>{item.student?.name || item.studentName}</b><small className="table-subline">{item.student?.studentId || item.studentId} ? {item.student?.email || ''}</small></td>
              <td>{item.batch?.name?.en || `${item.batch?.year?.year || ''} ${item.batch?.subject || ''}`}</td>
              <td><b>{item.tuteNumber}</b><small className="table-subline">{item.tuteName}</small></td><td>{item.pdfName}</td><td>{formatDateTime(item.submittedAt)}</td>
              <td><select aria-label={`Status for ${item.tuteNumber}`} value={item.status} disabled={busyId === item._id} onChange={event => updateStatus(item, event.target.value)}><option value="submitted">Submitted</option><option value="reviewed">Reviewed</option></select></td>
              <td><div className="entity-actions"><button className="row-action" onClick={() => retrieve(item)}>{t('View', '\u0db6\u0dbd\u0db1\u0dca\u0db1')}</button><button className="row-action" onClick={() => retrieve(item, true)}>{t('Download', '\u0db6\u0dcf\u0d9c\u0dad \u0d9a\u0dbb\u0db1\u0dca\u0db1')}</button><button className="row-action danger" disabled={busyId === item._id} onClick={() => remove(item)}>{t('Delete', '\u0db8\u0d9a\u0db1\u0dca\u0db1')}</button></div></td>
            </tr>)}</tbody>
          </table></div>
          <div className="tute-pagination"><span>{t('Page', '\u0db4\u0dd2\u0da7\u0dd4\u0dc0')} {page} / {pages}</span><div><button className="row-action" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>{t('Previous', '\u0db4\u0dda\u0dbb')}</button><button className="row-action" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>{t('Next', '\u0db8\u0dd3\u0dc5\u0d9f')}</button></div></div>
        </>
      )}
    </section>
    {preview && <Modal title={preview.title} onClose={() => { URL.revokeObjectURL(preview.url); setPreview(null) }}><div style={{ width: 'min(84vw, 1000px)', height: 'min(78vh, 800px)' }}><iframe title={preview.title} src={preview.url} style={{ width: '100%', height: '100%', border: 0 }}/></div></Modal>}
  </div>
}

function StatusPill({ value, language = 'en' }) {
  const status = String(value || 'none').toLowerCase()
  const translated = { paid: 'ගෙවා ඇත', pending: 'අපේක්ෂිත', rejected: 'ප්‍රතික්ෂේපිත', refunded: 'ආපසු ගෙවා ඇත', active: 'සක්‍රිය', suspended: 'අත්හිටුවා ඇත', revoked: 'අවලංගු', expired: 'කල් ඉකුත්', authorized: 'අවසර ඇත', restricted: 'සීමිත', locked: 'අගුළු දමා ඇත', none: 'නැත', published: 'ප්‍රකාශිත', draft: 'කෙටුම්පත', upcoming: 'ඉදිරියේදී' }
  return <span className={`status-pill ${status}`}>{language === 'si' ? (translated[status] || value) : status}</span>
}

function EnrollmentStatus({ item, api, onSaved }) {
  const [status, setStatus] = useState(item.status)
  const [accessFrom, setAccessFrom] = useState(dateInputValue(item.accessFrom))
  const [accessUntil, setAccessUntil] = useState(dateInputValue(item.accessUntil))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    setSaving(true); setError('')
    try { await api.patch(`/enrollments/${item._id}/status`, { status, accessFrom: accessFrom ? new Date(`${accessFrom}T00:00:00+05:30`).toISOString() : null, accessUntil: accessUntil ? new Date(`${accessUntil}T23:59:59+05:30`).toISOString() : null }); await onSaved() }
    catch (e) { setError(e.response?.data?.message || 'Could not update enrollment.') }
    finally { setSaving(false) }
  }
  const dirty = status !== item.status || accessFrom !== dateInputValue(item.accessFrom) || accessUntil !== dateInputValue(item.accessUntil)
  return <span className="enrollment-control"><span>{item.batch?.year?.year} {item.batch?.name?.en}</span><select aria-label="Enrollment status" value={status} onChange={e => setStatus(e.target.value)}><option value="active">active</option><option value="suspended">suspended</option><option value="revoked">revoked</option><option value="expired">expired</option></select><label>Access from <input type="date" value={accessFrom} onChange={e => setAccessFrom(e.target.value)}/></label><label>Access until <input type="date" value={accessUntil} onChange={e => setAccessUntil(e.target.value)}/></label>{dirty && <button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>}{error && <small>{error}</small>}</span>
}

function EntityManager({ view, api, profile }) {
  const [tab, setTab] = useState(view === 'lessons' ? 'lessons' : view)
  const [batchScope, setBatchScope] = useState('')
  const config = CONFIG[tab] || CONFIG[view]
  const [records, setRecords] = useState([])
  const [batches, setBatches] = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [attendanceBatch, setAttendanceBatch] = useState('')
  const [attendanceFrom, setAttendanceFrom] = useState('')
  const [attendanceTo, setAttendanceTo] = useState('')
  const isLessonGroup = view === 'lessons'
  const isBatchResourceWorkspace = view === 'resources'

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [list, groups, years, people, zoom, lessonList] = await Promise.all([
        api.get(config.endpoint, { params: { ...(batchScope ? { batch: batchScope } : {}) } }), api.get('/batches'), api.get('/academic-years'), api.get('/students', { params: { limit: 100 } }), api.get('/zoom-classes'), api.get('/lessons'),
      ])
      setRecords(list.data.items || [])
      setBatches(groups.data.items || [])
      setAcademicYears(years.data.items || [])
      setStudents(people.data.items || [])
      setClasses(zoom.data.items || [])
      setLessons(lessonList.data.items || [])
      setError('')
    } catch (e) { setError(e.response?.data?.message || `Could not load ${config.title.toLowerCase()}.`) }
    finally { setLoading(false) }
  }, [api, batchScope, config.endpoint, config.title])
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- load the selected management records from the admin API.
    reload()
  }, [reload])

  function openCreate() { setForm({ title: { en: '' }, name: { en: '' }, description: { en: '' }, body: { en: '' }, batch: batchScope ? [batchScope] : [], published: tab === 'zoom', active: true, enrollmentOpen: true, status: 'active', access: 'restricted', type: 'note' }); setModal('create') }
  function openEdit(item) { setForm(item); setModal(item._id) }
  function getFormValue(field) {
    const raw = getPath(form, field.name)
    if (field.type === 'datetime' && raw) { const d = new Date(raw); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
    if (field.type === 'date' && raw) return new Date(raw).toISOString().slice(0, 10)
    return raw ?? (field.type === 'checkbox' ? false : field.type === 'batches' ? [] : '')
  }
  function updateField(field, value) { setForm(current => setPath(current, field.name, value)) }
  function renderInput(field) {
    const value = getFormValue(field)
    if (field.type === 'file') return <><input type="file" accept="application/pdf,.pdf,.ppt,.pptx" required={field.required && modal === 'create'} disabled={modal !== 'create'} onChange={e => updateField(field, e.target.files?.[0] || null)}/><small className="field-note">{modal === 'create' ? 'Files are stored privately and served after a batch enrollment and payment check.' : 'To replace the file, delete this material and create a new record.'}</small></>
    if (field.type === 'textarea') return <textarea value={value} required={field.required} onChange={e => updateField(field, e.target.value)} rows={3}/>
    if (field.type === 'checkbox') return <input type="checkbox" checked={Boolean(value)} onChange={e => updateField(field, e.target.checked)}/>
    if (field.type === 'batches') return <select multiple value={Array.isArray(value) ? value.map(item => typeof item === 'object' ? item._id : item) : []} onChange={e => updateField(field, Array.from(e.target.selectedOptions, item => item.value))}>{batches.map(batch => <option key={batch._id} value={batch._id}>{batch.year?.year} {batch.name?.en}{batch.city ? ` · ${batch.city}` : ''}</option>)}</select>
    if (field.type === 'batch' || field.type === 'academicYear' || field.type === 'student' || field.type === 'class' || field.type === 'lesson') {
      const items = field.type === 'batch' ? batches : field.type === 'academicYear' ? academicYears : field.type === 'student' ? students : field.type === 'class' ? classes : lessons
      return <select required={field.required} value={typeof value === 'object' ? value?._id || value?.id || '' : value} onChange={e => updateField(field, e.target.value)}><option value="">Select…</option>{items.map(item => <option key={item._id || item.id} value={item._id || item.id}>{field.type === 'student' ? `${item.studentId || ''} ${item.name} · ${item.email}` : field.type === 'class' || field.type === 'lesson' ? item.title?.en || item.title?.si || (field.type === 'class' ? 'Class' : 'Lesson') : field.type === 'academicYear' ? item.year : `${item.year?.year || ''} ${item.name?.en || ''}${item.city ? ` Â· ${item.city}` : ''}`}</option>)}</select>
    }
    if (field.type === 'select') return <select value={value} onChange={e => updateField(field, e.target.value)}>{field.options.map(option => <option key={option} value={option}>{option}</option>)}</select>
    return <input type={field.type || 'text'} required={field.required} value={value} onChange={e => updateField(field, field.type === 'number' ? Number(e.target.value) : e.target.value)}/>
  }
  async function saveRecord(event) {
    event.preventDefault(); setSaving(true); setError('')
    const payload = {}
    config.fields.forEach(field => {
      let value = getFormValue(field)
      if (field.type === 'file') return
      if (field.type === 'batches' && Array.isArray(value)) value = value.map(item => typeof item === 'object' ? item._id : item).filter(Boolean)
      if (['batch', 'student', 'academicYear', 'class', 'lesson'].includes(field.type) && value && typeof value === 'object') value = value._id || value.id
      if (field.type === 'datetime' || field.type === 'date') value = value ? new Date(value).toISOString() : undefined
      if (field.type === 'batch' || field.type === 'student' || field.type === 'academicYear' || field.type === 'class' || field.type === 'lesson') value = value || undefined
      payload[field.name] = value
    })
    const normalized = Object.entries(payload).reduce((result, [key, value]) => value === undefined ? result : setPath(result, key, value), {})
    if (tab === 'attendance' && modal === 'create') normalized.markedBy = profile?.id
    try {
      if (tab === 'resources' && modal === 'create') {
        const body = new FormData()
        body.append('data', JSON.stringify(normalized))
        body.append('file', form.upload)
        await api.post('/resources/upload', body, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else if (modal === 'create') await api.post(config.endpoint, normalized)
      else await api.patch(`${config.endpoint}/${modal}`, normalized)
      setModal(null); setSaved(true); await reload(); window.setTimeout(() => setSaved(false), 2400)
    } catch (e) { setError(e.response?.data?.message || 'Could not save this item.') }
    finally { setSaving(false) }
  }
  async function removeRecord(item) {
    if (!window.confirm('Delete this item? This cannot be undone.')) return
    try { await api.delete(`${config.endpoint}/${item._id}`); await reload() } catch (e) { setError(e.response?.data?.message || 'Could not delete this item.') }
  }
  function displayTitle(item) { return item.title?.en || item.name?.en || item.student?.name || (item.year ? `${item.year} A/L ICT` : '') || item.title || item.name || item.reference || item.type || 'Untitled item' }
  function displayMeta(item) {
    if (tab === 'academicYears') return item.active ? 'Active academic year' : 'Inactive academic year'
    if (tab === 'classes') return `${item.year?.year || 'Year not set'} · ${item.subject || 'A/L ICT'} · ${item.city || 'City not set'}${item.className ? ` Â· ${item.className}` : ''} · LKR ${Number(item.fee || 0).toLocaleString('en-LK')} · ${item.status || 'active'} · ${item.enrollmentOpen ? 'Enrollment open' : 'Enrollment closed'}`
    if (tab === 'zoom') return `${item.batch?.name?.en || 'Batch'} · ${formatDateTime(item.startsAt)} · ${item.status}`
    if (tab === 'payments') return `LKR ${item.amount ?? 0} · ${item.status} · ${formatDate(item.date)}`
    if (tab === 'attendance') return `${item.student?.name || 'Student'} · ${item.class?.title?.en || 'Class'} · ${item.status} · ${formatDate(item.date)}`
    return `${item.type || (item.url ? 'YouTube video' : 'Content')} · ${item.published ? 'Published' : 'Draft'} · ${item.access || ''}`
  }
  const title = isLessonGroup ? 'Lessons & Videos' : isBatchResourceWorkspace ? 'Batch Resource Library' : config.title
  const visibleRecords = tab === 'attendance' ? records.filter(item => {
    const batchId = item.class?.batch?._id || item.class?.batch
    const date = item.date ? new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Colombo' }).format(new Date(item.date)) : ''
    return (!attendanceBatch || String(batchId) === attendanceBatch) && (!attendanceFrom || date >= attendanceFrom) && (!attendanceTo || date <= attendanceTo)
  }) : records
  const action = <button className="primary-action" onClick={openCreate}><Plus size={17}/> Add {tab === 'zoom' ? 'class' : tab === 'resources' ? 'material' : tab === 'payments' ? 'payment' : tab === 'attendance' ? 'record' : tab === 'classes' ? 'batch' : tab === 'academicYears' ? 'year' : 'item'}</button>

  return <>
    <PageHeading kicker="CONTENT & OPERATIONS" title={title} description={view === 'resources' ? 'Choose a batch, then centrally manage its notes, past papers, assignments, lessons, videos, recordings, and announcements.' : 'Create, update, publish, and manage records in your learning platform.'} action={action}/>
    {isLessonGroup && <div className="content-tabs"><button className={tab === 'lessons' ? 'selected' : ''} onClick={() => setTab('lessons')}>Lessons</button><button className={tab === 'videos' ? 'selected' : ''} onClick={() => setTab('videos')}>YouTube videos</button><button className={tab === 'recordings' ? 'selected' : ''} onClick={() => setTab('recordings')}>Recordings</button></div>}
    {isBatchResourceWorkspace && <><div className="content-tabs"><button className={tab === 'resources' ? 'selected' : ''} onClick={() => setTab('resources')}>Files & notes</button><button className={tab === 'lessons' ? 'selected' : ''} onClick={() => setTab('lessons')}>Lessons</button><button className={tab === 'videos' ? 'selected' : ''} onClick={() => setTab('videos')}>YouTube videos</button><button className={tab === 'recordings' ? 'selected' : ''} onClick={() => setTab('recordings')}>Recorded lessons</button><button className={tab === 'announcements' ? 'selected' : ''} onClick={() => setTab('announcements')}>Announcements</button></div><div className="filter-bar batch-resource-filter"><label>Manage a batch<select value={batchScope} onChange={e => setBatchScope(e.target.value)}><option value="">All batches</option>{batches.map(batch => <option key={batch._id} value={batch._id}>{batch.year?.year} {batch.name?.en}{batch.city ? ` · ${batch.city}` : ''}</option>)}</select></label></div></>}
    {view === 'classes' && <div className="content-tabs"><button className={tab === 'classes' ? 'selected' : ''} onClick={() => setTab('classes')}>Batches</button><button className={tab === 'academicYears' ? 'selected' : ''} onClick={() => setTab('academicYears')}>Academic years</button></div>}
    {tab === 'attendance' && <div className="filter-bar attendance-filters"><select value={attendanceBatch} onChange={e => setAttendanceBatch(e.target.value)}><option value="">All batches</option>{batches.map(batch => <option key={batch._id} value={batch._id}>{batch.year?.year} {batch.name?.en}</option>)}</select><label>From <input type="date" value={attendanceFrom} onChange={e => setAttendanceFrom(e.target.value)}/></label><label>To <input type="date" value={attendanceTo} onChange={e => setAttendanceTo(e.target.value)}/></label></div>}
    {error && <div className="form-error">{error}</div>}{saved && <div className="form-success"><Check size={16}/> Changes saved.</div>}
    <section className="panel management-panel">{loading ? <LoadingRows/> : visibleRecords.length ? <div className="entity-list">{visibleRecords.map(item => <article className="entity-row" key={item._id}><span className="entity-icon">{tab === 'zoom' ? <Video/> : tab === 'payments' ? <CircleDollarSign/> : tab === 'resources' ? <FileText/> : tab === 'classes' ? <GraduationCap/> : tab === 'attendance' ? <Check/> : <BookOpen/>}</span><div className="entity-content"><b>{displayTitle(item)}</b><span>{displayMeta(item)}</span>{(item.description?.en || item.body?.en || item.rejectionReason) && <small>{item.description?.en || item.body?.en || item.rejectionReason}</small>}</div><StatusPill value={item.status || (item.published ? 'published' : 'draft')}/><div className="entity-actions"><button className="row-action" onClick={() => openEdit(item)}>Edit</button><button className="row-action danger" onClick={() => removeRecord(item)}>Delete</button></div></article>)}</div> : <EmptyState title={records.length ? 'No matching records' : `No ${title.toLowerCase()} yet`} text={records.length ? 'Change or clear the filters to see attendance records.' : 'Add your first record to start managing this section.'} action={records.length ? null : <button onClick={openCreate}><Plus size={15}/> Add first item</button>}/>}</section>
    {modal && <Modal title={modal === 'create' ? `Add ${tab === 'zoom' ? 'class' : tab === 'resources' ? 'material' : 'item'}` : `Edit ${displayTitle(form)}`} onClose={() => setModal(null)}><form className="entity-form" onSubmit={saveRecord}>{config.fields.map(field => <Field key={field.name} label={field.label} type={field.type}>{renderInput(field)}</Field>)}{tab === 'attendance' && <p className="field-note">Attendance changes are stored with this class and student record.</p>}{tab === 'resources' && <p className="field-note">PDFs are private at rest. Student downloads are checked against active enrollment and payment status each time.</p>}<button className="primary-action" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></form></Modal>}
  </>
}

function Field({ label, children }) { return <label className="form-field"><span>{label}</span>{children}</label> }
function Modal({ title, onClose, children }) { return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="entity-modal"><header><h2>{title}</h2><button aria-label="Close" onClick={onClose}><X size={19}/></button></header>{children}</section></div> }

function CalendarPage({ api, chooseView }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { api.get('/zoom-classes').then(({ data }) => setItems((data.items || []).filter(item => item.status === 'upcoming' && item.published).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)))).catch(e => setError(e.response?.data?.message || 'Could not load calendar.')).finally(() => setLoading(false)) }, [api])
  return <><PageHeading kicker="SCHEDULE" title="Class Calendar" description="Upcoming online classes shown in Sri Lanka time." action={<button className="primary-action" onClick={() => chooseView('zoom')}><Plus size={17}/> Schedule a class</button>}/>{error && <div className="form-error">{error}</div>}<section className="panel management-panel">{loading ? <LoadingRows/> : items.length ? <div className="calendar-list">{items.map(item => <article key={item._id}><div className="calendar-date"><CalendarDays size={20}/><span>{formatDate(item.startsAt)}</span></div><div><b>{item.title?.en || item.title?.si || 'ICT Class'}</b><span>{formatDateTime(item.startsAt)}{item.endsAt ? ` – ${formatDateTime(item.endsAt)}` : ''}</span></div><StatusPill value={item.status}/><button className="row-action" onClick={() => chooseView('zoom')}>View class</button></article>)}</div> : <EmptyState title="No upcoming classes" text="Your scheduled classes will be listed here." action={<button onClick={() => chooseView('zoom')}><Plus size={15}/> Schedule class</button>}/>}</section></>
}

function ReportsPage({ api }) {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/reports', { params: { ...(from ? { from } : {}), ...(to ? { to } : {}) } }).then(({ data }) => { setReport(data); setError('') }).catch(e => setError(e.response?.data?.message || 'Could not load reports.')).finally(() => setLoading(false)) }, [api, from, to])
  return <><PageHeading kicker="PLATFORM INSIGHTS" title="Reports" description="Summaries based on student, payment, lesson, and attendance records."/><div className="filter-bar report-filters"><label>From <input type="date" value={from} onChange={e => { setLoading(true); setFrom(e.target.value) }}/></label><label>To <input type="date" value={to} onChange={e => { setLoading(true); setTo(e.target.value) }}/><button onClick={() => { setLoading(true); setFrom(''); setTo('') }}>Clear dates</button></label></div>{error && <div className="form-error">{error}</div>}{loading ? <LoadingRows/> : report && <div className="report-grid"><ReportCard title="Students by batch">{report.studentsByBatch.length ? report.studentsByBatch.map(item => <div className="report-line" key={item._id}><span>{item.year || item.batch?.en || 'Unassigned batch'}</span><b>{item.count}</b></div>) : <p>No assigned batch records yet.</p>}</ReportCard><ReportCard title="Payment summary">{report.payments.length ? report.payments.map(item => <div className="report-line" key={item._id}><span>{item._id || 'Other'}</span><b>{item.count} Â· LKR {item.amount}</b></div>) : <p>No payments in this date range.</p>}</ReportCard><ReportCard title="Attendance">{report.attendance.length ? report.attendance.map(item => <div className="report-line" key={item._id}><span>{item._id}</span><b>{item.count}</b></div>) : <p>No attendance records in this date range.</p>}</ReportCard><ReportCard title="Published content"><div className="report-line"><span>Lessons</span><b>{report.publishedLessons}</b></div><div className="report-line"><span>Active batches</span><b>{report.activeBatches}</b></div></ReportCard></div>}</>
}
function ReportCard({ title, children }) { return <section className="panel report-card"><span className="panel-kicker">LIVE SUMMARY</span><h2>{title}</h2>{children}</section> }

function SettingsPage({ api, profile }) {
  const [settings, setSettings] = useState({ displayName: profile?.name || '', contactEmail: '', homepageTextEn: '', homepageTextSi: '' })
  const [teacherProfile, setTeacherProfile] = useState({ name: profile?.name || '', photoUrl: '', qualifications: '', experience: '', description: '' })
  const [photoFile, setPhotoFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { api.get('/settings').then(({ data }) => { const value = Object.fromEntries(data.map(item => [item.key, item.value])); setSettings(current => ({ ...current, ...value })); if (value.teacherProfile) setTeacherProfile(current => ({ ...current, ...value.teacherProfile })) }).catch(e => setError(e.response?.data?.message || 'Could not load settings.')).finally(() => setLoading(false)) }, [api])
  async function save(event) {
    event.preventDefault(); setError(''); setMessage('')
    try {
      await Promise.all(Object.entries(settings).filter(([key]) => key !== 'teacherProfile').map(([key, value]) => api.put(`/settings/${encodeURIComponent(key)}`, { value })))
      let photoUrl = teacherProfile.photoUrl
      if (photoFile) {
        const formData = new FormData()
        formData.append('photo', photoFile)
        const uploaded = await api.post('/teacher-profile/photo', formData)
        photoUrl = uploaded.data.photoUrl
      }
      const profile = { ...teacherProfile, photoUrl }
      await api.put('/teacher-profile', profile)
      setTeacherProfile(profile)
      setPhotoFile(null)
      setSettings(current => ({ ...current, displayName: profile.name }))
      setMessage('Teacher profile and website settings saved.')
    } catch (e) { setError(e.response?.data?.message || 'Could not save settings.') }
  }
  const preview = photoFile ? URL.createObjectURL(photoFile) : teacherProfile.photoUrl
  return <><PageHeading kicker="WEBSITE CONFIGURATION" title="Settings" description="Manage the public teacher profile and website copy from one central location."/>{loading ? <LoadingRows/> : <section className="panel settings-panel"><form className="entity-form settings-form" onSubmit={save}><h2>Teacher Profile</h2><div className="teacher-profile-editor">{preview && <img src={preview} alt="Teacher profile preview"/>}<Field label="Change profile photo"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setPhotoFile(e.target.files?.[0] || null)}/></Field></div><Field label="Teacher name"><input required value={teacherProfile.name} onChange={e => setTeacherProfile({ ...teacherProfile, name: e.target.value })}/></Field><Field label="Qualifications"><textarea rows={3} value={teacherProfile.qualifications} onChange={e => setTeacherProfile({ ...teacherProfile, qualifications: e.target.value })}/></Field><Field label="Experience"><input value={teacherProfile.experience} onChange={e => setTeacherProfile({ ...teacherProfile, experience: e.target.value })}/></Field><Field label="Teacher description"><textarea rows={5} value={teacherProfile.description} onChange={e => setTeacherProfile({ ...teacherProfile, description: e.target.value })}/></Field><h2>Website</h2><Field label="Teacher display name"><input value={settings.displayName} onChange={e => setSettings({ ...settings, displayName: e.target.value })}/></Field><Field label="Contact email"><input type="email" value={settings.contactEmail} onChange={e => setSettings({ ...settings, contactEmail: e.target.value })}/></Field><Field label="Homepage description (English)"><textarea rows={3} value={settings.homepageTextEn} onChange={e => setSettings({ ...settings, homepageTextEn: e.target.value })}/></Field><Field label="Homepage description (Sinhala)"><textarea rows={3} value={settings.homepageTextSi} onChange={e => setSettings({ ...settings, homepageTextSi: e.target.value })}/></Field>{message && <div className="form-success"><Check size={16}/>{message}</div>}  {error && <div className="form-error">{error}</div>}<button className="primary-action"><Check size={16}/> Save profile and settings</button></form></section>}</>
}

