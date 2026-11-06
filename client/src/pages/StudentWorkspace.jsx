import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  ArrowUpRight, BookOpen, CalendarDays, Camera, Check, ChevronRight, CircleDollarSign,
  ClipboardList, Clock3, ExternalLink, FileText, GraduationCap, LayoutDashboard,
  LockKeyhole, LogOut, Menu, Megaphone, RefreshCw, Save,
  Settings, ShieldCheck, Upload, UserRound, Video, X,
} from 'lucide-react'
import './StudentWorkspace.css'

const API_ROOT = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '' : window.location.origin)
const API = API_ROOT.endsWith('/api') ? API_ROOT : `${API_ROOT}/api`
const NAV = [
  ['home', 'Dashboard Home', LayoutDashboard], ['profile', 'My Profile', UserRound],
  ['batches', 'My Batches', GraduationCap], ['resources', 'Learning Resources', BookOpen],
  ['videos', 'Video Lessons', Video], ['notes', 'Notes & Documents', FileText], ['papers', 'My Papers', FileText], ['tute-submissions', 'Tute Papers Submission', ClipboardList],
  ['assignments', 'Assignments', ClipboardList], ['announcements', 'Announcements', Megaphone],
  ['payments', 'Payment History', CircleDollarSign], ['settings', 'Settings', Settings],
]
const authHeaders = token => ({ Authorization: `Bearer ${token}` })
const getTitle = item => item?.title?.en || item?.title?.si || 'Learning material'
const formatDate = value => value ? new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeZone: 'Asia/Colombo' }).format(new Date(value)) : 'â€”'
const formatMoney = value => `LKR ${Number(value || 0).toLocaleString('en-LK')}`
const formatDateTime = value => value ? new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(value)) : 'â€”'
const formatPaymentMonth = value => {
  if (!/^\d{4}-\d{2}$/.test(value || '')) return ''
  return new Intl.DateTimeFormat('en-LK', { month: 'long', year: 'numeric', timeZone: 'Asia/Colombo' }).format(new Date(`${value}-01T00:00:00+05:30`))
}
const initials = name => String(name || 'Student').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()

function Status({ value, language = 'en' }) {
  const status = String(value || 'pending').toLowerCase()
  const label = ({ paid: 'Approved', pending: 'Pending Verification', active: 'Active', refunded: 'Refunded', rejected: 'Rejected', locked: 'Locked', suspended: 'Suspended', revoked: 'Revoked', expired: 'Expired', submitted: 'Submitted', reviewed: 'Reviewed' })[status] || 'Pending Verification'
  const siLabel = ({ submitted: '\u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dbb\u0db1 \u0dbd\u0daf\u0dd3', reviewed: '\u0dc3\u0db8\u0dcf\u0dbd\u0ddd\u0da0\u0db1\u0dba \u0d9a\u0dc5\u0dcf' })[status]
  return <span className={`student-status is-${status}`}>{language === 'si' && siLabel ? siLabel : label}</span>
}

function Empty({ title, description }) {
  return <div className="student-empty"><span><BookOpen size={19}/></span><b>{title}</b><p>{description}</p></div>
}

export default function StudentWorkspace({ token }) {
  const [view, setView] = useState('home')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [data, setData] = useState(null)
  const [individualPapers, setIndividualPapers] = useState([])
  const [paperCategories, setPaperCategories] = useState([])
  const [selectedPaperCategory, setSelectedPaperCategory] = useState('')
  const [tuteSubmissions, setTuteSubmissions] = useState([])
  const [tuteBatches, setTuteBatches] = useState([])
  const [tuteForm, setTuteForm] = useState({ batchId: '', tuteNumber: '', tuteName: '' })
  const [tuteFile, setTuteFile] = useState(null)
  const [tuteReplacementFiles, setTuteReplacementFiles] = useState({})
  const [tuteUploading, setTuteUploading] = useState(false)
  const tuteUploadInProgress = useRef(false)
  const tuteFileInput = useRef(null)
  const tuteReplacementInputs = useRef({})
  const [paperPreview, setPaperPreview] = useState(null)
  const [resources, setResources] = useState({})
  const [classes, setClasses] = useState({})
  const [selectedBatch, setSelectedBatch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', city: '' })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'en')
  const client = useMemo(() => axios.create({ baseURL: `${API}/student`, headers: authHeaders(token), withCredentials: true }), [token])

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setBusy(true)
    try {
      const [{ data: profile }, { data: paperData }, { data: tuteData }] = await Promise.all([
        client.get('/profile'),
        client.get('/papers').catch(requestError => requestError.response?.status === 403 ? { data: { categories: [], items: [] } } : Promise.reject(requestError)),
        client.get('/tute-submissions'),
      ])
      setData(profile)
      setPaperCategories(paperData.categories || [])
      setIndividualPapers((paperData.items || []).filter(paper => !paper.category))
      setTuteSubmissions(tuteData.items || [])
      setTuteBatches(tuteData.batches || [])
      setTuteForm(current => ({ ...current, batchId: (tuteData.batches || []).some(batch => String(batch._id) === String(current.batchId)) ? current.batchId : tuteData.batches?.[0]?._id || '' }))
      setTuteReplacementFiles({})
      tuteReplacementInputs.current = {}
      setSelectedPaperCategory(current => (paperData.categories || []).some(category => String(category._id) === String(current)) ? current : '')
      setProfileForm({ name: profile.student?.name || '', phone: profile.student?.phone || '', city: profile.student?.city || '' })
      const enrollments = (profile.batches || []).filter(item => item.batch)
      const results = await Promise.all(enrollments.map(async item => {
        const id = item.batch._id
        const [content, schedule] = await Promise.all([
          client.get(`/resources/${id}`).catch(() => ({ data: {} })),
          client.get(`/classes/${id}`).catch(() => ({ data: [] })),
        ])
        return [id, content.data, schedule.data]
      }))
      setResources(Object.fromEntries(results.map(([id, content]) => [id, content])))
      setClasses(Object.fromEntries(results.map(([id, , schedule]) => [id, schedule])))
      setSelectedBatch(current => enrollments.some(item => String(item.batch._id) === String(current)) ? current : enrollments[0]?.batch?._id || '')
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not load your student workspace.')
      if ([401, 403].includes(requestError.response?.status)) {
        localStorage.removeItem('authToken')
        localStorage.removeItem('auth')
        window.location.replace('/student/login')
      }
    } finally {
      setBusy(false)
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    if (!token) { window.location.replace('/student/login'); return }
    // oxlint-disable-next-line react/set-state-in-effect -- load the authenticated student's workspace.
    load()
  }, [load, token])

  useEffect(() => {
    localStorage.setItem('language', language)
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    const handlePageShow = event => {
      if (event.persisted && !localStorage.getItem('authToken')) window.location.replace('/student/login')
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  useEffect(() => {
    let objectUrl = ''
    let cancelled = false
    if (data?.student?.profilePhoto) {
      client.get('/profile/photo', { responseType: 'blob' }).then(({ data: blob }) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setPhotoUrl(objectUrl)
      }).catch(() => setPhotoUrl(''))
    } else setPhotoUrl('')
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [client, data?.student?.profilePhoto])

  const logout = async () => {
    setData(null)
    try { await axios.post(`${API}/auth/logout`, {}, { headers: authHeaders(token), withCredentials: true }) } catch { /* clear local session even if the API is offline */ }
    localStorage.removeItem('authToken')
    localStorage.removeItem('auth')
    localStorage.removeItem('studentToken')
    window.location.replace('/student/login')
  }

  const chooseView = next => { setView(next); setMobileOpen(false); setNotice(''); setError('') }
  const current = data?.batches?.find(item => String(item.batch?._id) === String(selectedBatch))
  const content = resources[selectedBatch] || {}
  const allResources = [...(content.videos || []), ...(content.recordings || []), ...(content.resources || [])]
  const videos = [...(content.videos || []), ...(content.recordings || [])]
  const documents = allResources.filter(item => ['pdf', 'powerpoint', 'past-paper', 'tutorial', 'note', 'question'].includes(item.type))
  const assignments = allResources.filter(item => item.type === 'assignment')
  const schedule = classes[selectedBatch] || []
  const text = (en, si) => view === 'profile' ? en : language === 'si' ? si : en

  async function openIndividualPaper(paper, download = false) {
    try {
      const response = await client.get(`/papers/${paper._id}/file${download ? '?download=1' : ''}`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      if (download) {
        const link = document.createElement('a'); link.href = url; link.download = paper.pdfName || `${paper.title}.pdf`; link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else setPaperPreview({ url, title: paper.title })
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not open this paper.') }
  }

  function tuteUploadError(requestError) {
    const status = requestError?.response?.status
    if (status === 413) return text('The PDF exceeds the 30 MB upload limit.', '\u0db8\u0dda PDF \u0d9c\u0dd9\u0db1\u0dd4\u0db8 30 MB \u0d85\u0dad\u0dd2\u0d9a\u0dbb\u0dba\u0dd2.')
    if (status === 401) return text('Your session expired. Sign in again and retry.', '\u0d94\u0db6\u0d9c\u0dda \u0dc3\u0dd9\u0dc3\u0dca\u0dc3\u0db1\u0dca \u0d9a\u0dcf\u0dbd\u0dba \u0d89\u0d9a\u0dca\u0db8\u0dc0\u0dd3 \u0d87\u0dad. \u0db1\u0dd0\u0dc0\u0dad \u0db4\u0dd2\u0dc5\u0dd2\u0d9c\u0db1\u0dca\u0db1.')
    if ([502, 503, 504].includes(status) || !requestError?.response) return text('The server is unavailable. Your selected PDF is still here; please retry shortly.', '\u0dc3\u0dda\u0dc0\u0dcf\u0daf\u0dcf\u0dba\u0d9a\u0dba \u0dad\u0dcf\u0dc0\u0d9a\u0dcf\u0dbd\u0dd2\u0d9a\u0dc0 \u0d85\u0dbd\u0dd2\u0dba\u0dd2. \u0dad\u0ddd\u0dbb\u0dcf\u0d9c\u0dad\u0dca PDF \u0d91\u0d9a \u0dad\u0dc0\u0db8\u0dad\u0dca \u0d87\u0dad; \u0d9a\u0dbb\u0dd4\u0dab\u0dcf\u0d9a\u0dbb \u0db4\u0dc3\u0dd4\u0dc0 \u0db1\u0dd0\u0dc0\u0dad \u0d8b\u0dad\u0dca\u0dc3\u0dcf\u0dc4 \u0d9a\u0dbb\u0db1\u0dca\u0db1.')
    return requestError.response?.data?.message || requestError.message || text('Could not submit this Tute PDF.', '\u0db8\u0dda Tute PDF \u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dc5 \u0db1\u0ddc\u0dc4\u0dd0\u0d9a.')
  }

  async function submitTute(event) {
    event.preventDefault()
    if (!tuteFile || !tuteForm.batchId || tuteUploadInProgress.current) return
    const form = new FormData()
    form.set('batchId', tuteForm.batchId)
    form.set('tuteNumber', tuteForm.tuteNumber)
    form.set('tuteName', tuteForm.tuteName)
    form.set('pdf', tuteFile)
    tuteUploadInProgress.current = true
    setTuteUploading(true); setError(''); setNotice('')
    try {
      await client.post('/tute-submissions', form)
      setTuteFile(null)
      if (tuteFileInput.current) tuteFileInput.current.value = ''
      setTuteForm(current => ({ ...current, tuteNumber: '', tuteName: '' }))
      setNotice(text('Tute paper submitted successfully.', '\u0d94\u0db6\u0dda Tute \u0db4\u0dad\u0dca\u200d\u0dbb\u0dd2\u0d9a\u0dcf\u0dc0 \u0dc3\u0dcf\u0dbb\u0dca\u0dae\u0d9a\u0dc0 \u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dbb\u0db1 \u0dbd\u0daf\u0dd3.'))
      await load({ quiet: true })
    } catch (requestError) { setError(tuteUploadError(requestError)) }
    finally { tuteUploadInProgress.current = false; setTuteUploading(false) }
  }

  async function replaceTuteSubmission(submission) {
    const replacement = tuteReplacementFiles[submission._id]
    if (!replacement || tuteUploadInProgress.current) return
    const form = new FormData(); form.set('pdf', replacement)
    tuteUploadInProgress.current = true
    setTuteUploading(true); setError(''); setNotice('')
    try {
      await client.post(`/tute-submissions/${submission._id}/replace`, form)
      setTuteReplacementFiles(current => { const next = { ...current }; delete next[submission._id]; return next })
      const input = tuteReplacementInputs.current[submission._id]
      if (input?.isConnected) input.value = ''
      setNotice(text('Tute submission replaced successfully.', '\u0d94\u0db6\u0dda Tute \u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dc5 \u0db4\u0dad\u0dca\u200d\u0dbb\u0dd2\u0d9a\u0dcf\u0dc0 \u0dc3\u0dcf\u0dbb\u0dca\u0dae\u0d9a\u0dc0 \u0db4\u0dca\u200d\u0dbb\u0dad\u0dd2\u0dc3\u0dca\u0dae\u0dcf\u0db4\u0db1\u0dba \u0d9a\u0dbb\u0db1 \u0dbd\u0daf\u0dd3.'))
      await load({ quiet: true })
    } catch (requestError) { setError(tuteUploadError(requestError)) }
    finally { tuteUploadInProgress.current = false; setTuteUploading(false) }
  }

  async function openTuteSubmission(submission, download = false) {
    try {
      const response = await client.get(`/tute-submissions/${submission._id}/file${download ? '?download=1' : ''}`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      if (download) {
        const link = document.createElement('a'); link.href = url; link.download = submission.pdfName; link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else setPaperPreview({ url, title: `${submission.tuteNumber} - ${submission.tuteName}` })
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not open this Tute submission.') }
  }

  async function toggleLesson(lesson) {
    try {
      await client.put(`/progress/${lesson._id}`, { completed: !lesson.progress?.completed, progress: lesson.progress?.completed ? 0 : 100 })
      await load({ quiet: true })
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not save lesson progress.') }
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError('')
    setNotice('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPEG, PNG, or WebP image.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('The profile photo must be 5 MB or smaller.'); return }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  async function uploadPhoto(event) {
    event.preventDefault()
    if (!photoFile) return
    const form = new FormData()
    form.append('photo', photoFile)
    setBusy(true)
    setError('')
    try {
      const { data: result } = await client.post('/profile/photo', form)
      setData(previous => ({ ...previous, student: { ...previous.student, profilePhoto: result.profilePhoto } }))
      setPhotoPreview('')
      setPhotoFile(null)
      setNotice('Profile photo updated.')
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not upload the profile photo.') }
    finally { setBusy(false) }
  }

  async function saveProfile(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { data: result } = await client.patch('/profile', profileForm)
      setData(previous => ({ ...previous, student: result.student }))
      setNotice('Profile details saved.')
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not save your profile.') }
    finally { setBusy(false) }
  }

  async function changePassword(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setError('The new passwords do not match.'); return }
    setBusy(true)
    try {
      await client.put('/settings/password', { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setNotice('Password updated successfully.')
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not update your password.') }
    finally { setBusy(false) }
  }

  const resourceLink = item => item.fileUrl?.startsWith('/') ? `${API}${item.fileUrl}` : item.fileUrl || item.url || (item.videoId ? `https://www.youtube.com/watch?v=${item.videoId}` : '')
  const renderResources = (items, emptyTitle, emptyDescription) => items.length ? <div className="student-resource-list">{items.map(item => <article key={item._id}>
    <span className={`student-resource-icon ${item.locked ? 'locked' : ''}`}>{item.locked ? <LockKeyhole size={17}/> : item.type === 'assignment' ? <ClipboardList size={17}/> : item.url || item.videoId ? <Video size={17}/> : <FileText size={17}/>}</span>
    <div className="student-resource-copy"><b>{getTitle(item)}</b><small>{item.type || (item.url ? 'Recorded lesson' : 'Learning material')} Â· {item.access === 'free' ? 'Free' : item.locked ? 'Locked until payment approval' : 'Available'}</small></div>
    {item.locked ? <Status value="locked"/> : item.type === 'lesson' ? <button className="student-lesson-button" onClick={() => toggleLesson(item)}>{item.progress?.completed ? 'Completed' : 'Mark complete'} <Check size={14}/></button> : resourceLink(item) ? <a href={resourceLink(item)} target="_blank" rel="noreferrer">Open <ExternalLink size={14}/></a> : <span className="student-status is-pending">Details unavailable</span>}
  </article>)}</div> : <Empty title={emptyTitle} description={emptyDescription}/>

  if (loading) return <div className="student-loading"><div className="student-loading-mark">OM</div><span>Loading your learning workspaceâ€¦</span></div>

  return <div className={`student-workspace ${mobileOpen ? 'student-drawer-open' : ''}`}>
    <button className="student-drawer-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>
    <aside className="student-sidebar">
      <a className="student-brand" href="/"><span className="student-brand-mark">OM</span><span><b>OSHAN MENDIS ICT</b><small>Student learning portal</small></span><button className="student-close" aria-label="Close menu" onClick={event => { event.preventDefault(); setMobileOpen(false) }}><X size={19}/></button></a>
      <div className="student-side-profile"><span className="student-avatar">{(photoUrl || photoPreview) ? <img src={photoPreview || photoUrl} alt=""/> : initials(data?.student?.name)}</span><div><b>{data?.student?.name || 'Student'}</b><small>{data?.student?.studentId || 'Student account'}</small></div></div>
      <span className="student-nav-label">LEARNING SPACE</span>
      <nav className="student-nav">{NAV.map(([key, label, Icon]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => chooseView(key)}><Icon size={18}/><span>{label}</span>{view === key && <ChevronRight className="student-nav-current" size={15}/>}</button>)}</nav>
      <div className="student-sidebar-bottom"><div className="student-secure-note"><ShieldCheck size={17}/><span><b>Private student account</b><small>Your batch resources stay protected</small></span></div><button className="student-logout" onClick={logout}><LogOut size={18}/><span>Sign out</span></button></div>
    </aside>

    <main className="student-main">
      <header className="student-header"><button className="student-menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={21}/></button><div className="student-breadcrumb">Student portal <ChevronRight size={14}/><b>{NAV.find(item => item[0] === view)?.[1]}</b></div><div className="student-header-actions"><button className="student-header-button" onClick={() => setLanguage(language === 'en' ? 'si' : 'en')} aria-label="Change language">{language === 'en' ? '\u0dc3\u0dd2\u0d82' : 'EN'}</button><button className="student-header-button" onClick={() => load()} disabled={busy}><RefreshCw size={16}/><span>Refresh</span></button><button className="student-header-button" type="button" aria-label="Logout" onClick={logout}><LogOut size={16}/><span>Logout</span></button><span className="student-header-user">{data?.student?.name}</span></div></header>
      <div className="student-page">
        {error && <div className="student-alert error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
        {notice && <div className="student-alert success" role="status"><Check size={16}/>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={16}/></button></div>}

        {view === 'home' && <>
          <section className="student-page-heading"><div><span className="student-eyebrow">YOUR LEARNING OVERVIEW</span><h1>{text(`Welcome back, ${data?.student?.name || '\u0dc1\u0dd2\u0dc2\u0dca\u200d\u0dba\u0dcf'}`, `à¶†à¶ºà·”à¶¶à·à·€à¶±à·Š, ${data?.student?.name || 'à·à·’à·‚à·Šâ€à¶ºà·'}`)}</h1><p>Keep track of your batches, payments, and new learning materials.</p></div><div className="student-heading-id"><small>STUDENT ID</small><b>{data?.student?.studentId || 'Ã¢â‚¬â€'}</b></div></section>
          <section className="student-stat-grid">
            <article><span className="student-stat-icon purple"><GraduationCap size={19}/></span><div><small>Registered batches</small><b>{data?.batches?.length || 0}</b><span>Current enrollments</span></div></article>
            <article><span className="student-stat-icon green"><ShieldCheck size={19}/></span><div><small>Paid enrollments</small><b>{data?.batches?.filter(item => item.paid).length || 0}</b><span>Protected access enabled</span></div></article>
            <article><span className="student-stat-icon amber"><CircleDollarSign size={19}/></span><div><small>Pending payments</small><b>{data?.payments?.filter(item => item.status === 'pending').length || 0}</b><span>Awaiting admin review</span></div></article>
            <article><span className="student-stat-icon blue"><BookOpen size={19}/></span><div><small>Learning progress</small><b>{current?.progress?.percent || 0}%</b><span>{current?.progress?.completed || 0} lessons completed</span></div></article>
          </section>
          <section className="student-home-grid">
            <section className="student-panel"><div className="student-panel-heading"><div><span>YOUR ENROLLMENTS</span><h2>Registered batches</h2></div><button onClick={() => chooseView('batches')}>View all <ChevronRight size={15}/></button></div>
              {data?.batches?.length ? <div className="student-batch-list">{data.batches.slice(0, 4).map(item => <button className="student-batch-row" key={item.enrollment._id} onClick={() => { setSelectedBatch(item.batch?._id || ''); chooseView('resources') }}><span className="student-batch-icon"><GraduationCap size={18}/></span><span className="student-batch-copy"><b>{item.batch?.name?.en || `${item.batch?.year?.year || ''} ${item.batch?.subject || 'A/L ICT'}`}</b><small>{[item.batch?.subject, item.batch?.city].filter(Boolean).join(' Ã‚Â· ')}</small></span><Status value={item.payment?.status || 'pending'}/><ChevronRight size={16}/></button>)}</div> : <Empty title="No batches registered" description="Your academic enrollments will appear here."/>}
            </section>
            <section className="student-panel"><div className="student-panel-heading"><div><span>CLASS UPDATES</span><h2>Recent announcements</h2></div><button onClick={() => chooseView('announcements')}>View all <ChevronRight size={15}/></button></div>
              {data?.announcements?.length ? <div className="student-announcement-list">{data.announcements.slice(0, 3).map(item => <article key={item._id}><b>{getTitle(item)}</b><p>{item.body?.en || item.body?.si}</p><small>{formatDate(item.createdAt)}</small></article>)}</div> : <Empty title="No announcements yet" description="New class notices will appear here."/>}
            </section>
          </section>
          <section className="student-panel student-schedule-panel"><div className="student-panel-heading"><div><span>UP NEXT</span><h2>Upcoming classes</h2></div></div>{schedule.length ? <div className="student-schedule-list">{schedule.slice(0, 4).map(item => <article key={item._id}><span className="student-schedule-icon"><CalendarDays size={18}/></span><div><b>{getTitle(item)}</b><small><Clock3 size={13}/> {formatDate(item.startsAt)}</small></div>{item.locked ? <Status value="locked"/> : item.meetingUrl ? <a href={item.meetingUrl} target="_blank" rel="noreferrer">Join class <ExternalLink size={14}/></a> : <span className="student-status is-paid">Available</span>}</article>)}</div> : <Empty title="No upcoming classes" description="Scheduled classes for your selected batch will appear here."/>}</section>
        </>}

        {view === 'profile' && <>
          <section className="student-page-heading"><div><span className="student-eyebrow">STUDENT ACCOUNT</span><h1>My Profile</h1><p>Manage your photo and personal details.</p></div></section>
          <section className="student-panel student-profile-panel"><div className="student-panel-heading"><div><span>PROFILE PHOTO</span><h2>Photo and identity</h2></div></div><form className="student-photo-form" onSubmit={uploadPhoto}><div className="student-photo-wrap"><span className="student-profile-photo">{(photoPreview || photoUrl) ? <img src={photoPreview || photoUrl} alt="Student profile"/> : initials(data?.student?.name)}<label htmlFor="student-photo-input" className="student-photo-camera" title="Choose photo"><Camera size={17}/></label></span></div><div className="student-photo-fields"><b>{data?.student?.name}</b><span>JPEG, PNG, or WebP Â· Maximum 5 MB</span><input id="student-photo-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto}/>{photoFile && <small>Selected: {photoFile.name}</small>}</div><button className="student-primary-button" type="submit" disabled={!photoFile || busy}><Upload size={16}/>{busy ? 'SavingÃ¢â‚¬Â¦' : 'Save photo'}</button></form></section>
          <section className="student-panel student-profile-panel"><div className="student-panel-heading"><div><span>PERSONAL DETAILS</span><h2>Contact information</h2></div></div><form className="student-form-grid" onSubmit={saveProfile}><label>Full name<input required maxLength={120} value={profileForm.name} onChange={event => setProfileForm({ ...profileForm, name: event.target.value })}/></label><label>Email address<input value={data?.student?.email || ''} readOnly/><small>Email changes are managed by the administrator.</small></label><label>Phone number<input maxLength={30} value={profileForm.phone} onChange={event => setProfileForm({ ...profileForm, phone: event.target.value })} placeholder="Add phone number"/></label><label>City<input maxLength={100} value={profileForm.city} onChange={event => setProfileForm({ ...profileForm, city: event.target.value })} placeholder="Add city"/></label><div className="student-form-actions"><button className="student-primary-button" disabled={busy}><Save size={16}/>Save profile</button></div></form></section>
          <section className="student-panel"><div className="student-panel-heading"><div><span>ACCOUNT INFORMATION</span><h2>Account details</h2></div></div><div className="student-account-details"><div><small>Student ID</small><b>{data?.student?.studentId || '—'}</b></div><div><small>Email address</small><b>{data?.student?.email || '—'}</b></div><div><small>Account created</small><b>{formatDate(data?.student?.createdAt)}</b></div></div><div className="student-panel-heading student-batch-heading"><div><span>ENROLLMENT</span><h2>Registered batches</h2></div></div>{data?.batches?.length ? <div className="student-batch-list">{data.batches.map(item => <div className="student-batch-row static" key={item.enrollment._id}><span className="student-batch-icon"><GraduationCap size={18}/></span><span className="student-batch-copy"><b>{item.batch?.name?.en || 'Academic batch'}</b><small>{item.batch?.year?.year || ''} · {item.batch?.city || data.student?.city || 'City not listed'}</small></span><Status value={item.enrollment?.status}/></div>)}</div> : <Empty title="No registered batches" description="Your assigned batches will appear here."/>}</section>
        </>}

        {view === 'batches' && <><section className="student-page-heading"><div><span className="student-eyebrow">YOUR ENROLLMENTS</span><h1>My Batches</h1><p>View batch details, enrollment status, and payment access.</p></div></section>{data?.batches?.length ? <section className="student-batch-cards">{data.batches.map(item => <article key={item.enrollment._id}><div className="student-batch-card-top"><span className="student-batch-icon"><GraduationCap size={19}/></span><Status value={item.payment?.status || 'pending'}/></div><h2>{item.batch?.name?.en || `${item.batch?.year?.year || ''} ${item.batch?.subject || 'A/L ICT'}`}</h2><p>{[item.batch?.subject, item.batch?.city, item.batch?.className].filter(Boolean).join(' Ã‚Â· ') || 'Academic batch'}</p><div className="student-batch-card-meta"><span>Enrollment <b>{item.enrollment?.status || 'pending'}</b></span><span>Class fee <b>{formatMoney(item.batch?.fee)}</b></span><span>Learning progress <b>{item.progress?.percent || 0}%</b></span></div><button onClick={() => { setSelectedBatch(item.batch?._id || ''); chooseView('resources') }}>Open learning resources <ArrowUpRight size={16}/></button></article>)}</section> : <Empty title="No batches registered" description="Your enrollments will appear here when you join a class."/>}</>}

        {view === 'resources' && <><section className="student-page-heading"><div><span className="student-eyebrow">BATCH MATERIALS</span><h1>Learning Resources</h1><p>Published learning resources available to your enrolled batch.</p></div>{data?.batches?.length > 1 && <label className="student-batch-picker">Batch<select value={selectedBatch} onChange={event => setSelectedBatch(event.target.value)}>{data.batches.map(item => <option key={item.enrollment._id} value={item.batch?._id}>{item.batch?.name?.en || `${item.batch?.year?.year || ''} ${item.batch?.subject || 'A/L ICT'}`}</option>)}</select></label>}</section><section className="student-panel"><div className="student-panel-heading"><div><span>{current?.batch?.name?.en || 'SELECTED BATCH'}</span><h2>Lessons and materials</h2></div><Status value={current?.payment?.status || 'pending'}/></div>{renderResources([...(content.lessons || []).map(lesson => ({ ...lesson, type: 'lesson', locked: lesson.locked, fileUrl: '', access: lesson.access })), ...allResources], 'No published resources', 'Published resources for this batch will appear here when available.')}</section></>}

        {view === 'videos' && <><section className="student-page-heading"><div><span className="student-eyebrow">VIDEO LIBRARY</span><h1>Video Lessons</h1><p>Browse published video lessons and class recordings.</p></div>{data?.batches?.length > 1 && <label className="student-batch-picker">Batch<select value={selectedBatch} onChange={event => setSelectedBatch(event.target.value)}>{data.batches.map(item => <option key={item.enrollment._id} value={item.batch?._id}>{item.batch?.name?.en || 'Academic batch'}</option>)}</select></label>}</section><section className="student-panel">{renderResources(videos, 'No video lessons yet', 'Videos and class recordings published for this batch will appear here.')}</section></>}

        {view === 'notes' && <><section className="student-page-heading"><div><span className="student-eyebrow">STUDY MATERIAL</span><h1>Notes & Documents</h1><p>Download notes, tutorials, and past papers for your batch.</p></div>{data?.batches?.length > 1 && <label className="student-batch-picker">Batch<select value={selectedBatch} onChange={event => setSelectedBatch(event.target.value)}>{data.batches.map(item => <option key={item.enrollment._id} value={item.batch?._id}>{item.batch?.name?.en || 'Academic batch'}</option>)}</select></label>}</section><section className="student-panel">{renderResources(documents, 'No notes or documents yet', 'PDF notes, tutorials, and past papers will appear here when published.')}</section></>}

        {view === 'papers' && <><section className="student-page-heading"><div><span className="student-eyebrow">PRIVATE STUDY MATERIAL</span><h1>My Papers</h1><p>Paper categories and PDFs assigned specifically to your account.</p></div></section><section className="student-panel"><div className="student-panel-heading"><div><span>ASSIGNED TO YOU</span><h2>{selectedPaperCategory ? paperCategories.find(category => String(category._id) === String(selectedPaperCategory))?.name || (selectedPaperCategory === 'legacy' ? 'Other assigned papers' : 'Papers') : 'Paper categories'}</h2></div>{selectedPaperCategory && <button type="button" className="row-action" onClick={() => setSelectedPaperCategory('')}>All categories</button>}</div>
          {selectedPaperCategory ? (() => { const category = paperCategories.find(item => String(item._id) === String(selectedPaperCategory)); const categoryPapers = selectedPaperCategory === 'legacy' ? individualPapers : category?.papers || []; return categoryPapers.length ? <div className="student-resource-list">{categoryPapers.map(paper => <article key={paper._id}><span className="student-resource-icon"><FileText size={18}/></span><div className="student-resource-copy"><b>{paper.pdfName || paper.title}</b><small>{paper.subject || category.name} Â· Uploaded {formatDate(paper.uploadDate)}</small>{paper.description && <p>{paper.description}</p>}</div><button type="button" className="row-action" onClick={() => openIndividualPaper(paper)}>View PDF</button><button type="button" className="row-action" onClick={() => openIndividualPaper(paper, true)}>Download</button></article>)}</div> : <Empty title="No papers in this category yet" description="Your assigned PDFs will appear here."/> })() : <div className="student-paper-category-grid">{paperCategories.map(category => <button type="button" className="student-paper-category-card" key={category._id} onClick={() => setSelectedPaperCategory(String(category._id))}><span className="student-resource-icon"><FileText size={19}/></span><b>{category.name}</b><small>{category.papers?.length || 0} PDF{category.papers?.length === 1 ? '' : 's'}</small><ChevronRight size={17}/></button>)}{individualPapers.length > 0 && <button type="button" className="student-paper-category-card" onClick={() => setSelectedPaperCategory('legacy')}><span className="student-resource-icon"><FileText size={19}/></span><b>Other assigned papers</b><small>{individualPapers.length} PDF{individualPapers.length === 1 ? '' : 's'}</small><ChevronRight size={17}/></button>}{selectedPaperCategory === 'legacy' && individualPapers.map(paper => <article key={paper._id}><div className="student-resource-copy"><b>{paper.title}</b><small>{paper.subject} Â· Uploaded {formatDate(paper.uploadDate)}</small>{paper.description && <p>{paper.description}</p>}</div><button type="button" className="row-action" onClick={() => openIndividualPaper(paper)}>View PDF</button><button type="button" className="row-action" onClick={() => openIndividualPaper(paper, true)}>Download</button></article>)}{!paperCategories.length && !individualPapers.length && <Empty title="No papers have been assigned to you yet" description="Papers assigned to your account will appear here."/>}</div>}
        </section></>}

        {view === 'tute-submissions' && <>
          <section className="student-page-heading"><div><span className="student-eyebrow">{text('UPLOAD YOUR WORK', '\u0d94\u0db6\u0dda \u0dc0\u0dd0\u0da9 \u0d85\u0db4\u0dca\u0dbd\u0ddd\u0da9\u0dca \u0d9a\u0dbb\u0db1\u0dca\u0db1')}</span><h1>{text('Tute Papers Submission', '\u0da7\u0dd2\u0dba\u0dd4\u0da7\u0dca \u0db4\u0dad\u0dca\u200d\u0dbb\u0dd2\u0d9a\u0dcf \u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dd2\u0dbb\u0dd3\u0db8')}</h1><p>{text('Upload completed Tute PDFs and track your submission status.', '\u0db4\u0dd2\u0dbb\u0dd2\u0db4\u0dd4\u0db1\u0dca Tute PDF \u0d85\u0db4\u0dca\u0dbd\u0ddd\u0da9\u0dca \u0d9a\u0dbb \u0d94\u0db6\u0dda \u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0dad\u0dad\u0dca\u0dad\u0dca\u0dc0\u0dba \u0db4\u0dbb\u0dd2\u0d9a\u0dca\u0dc2\u0dcf \u0d9a\u0dbb\u0db1\u0dca\u0db1.')}</p></div></section>
          <section className="student-panel"><div className="student-panel-heading"><div><span>{text('NEW SUBMISSION', '\u0db1\u0dc0 \u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dd2\u0dbb\u0dd3\u0db8')}</span><h2>{text('Upload a Tute PDF', '\u0da7\u0dd2\u0dba\u0dd4\u0da7\u0dca PDF \u0d91\u0d9a\u0d9a\u0dca \u0d85\u0db4\u0dca\u0dbd\u0ddd\u0da9\u0dca \u0d9a\u0dbb\u0db1\u0dca\u0db1')}</h2></div></div>
            <form className="student-form-grid tute-submission-form" onSubmit={submitTute}>
              <label>{text('Batch', '\u0d9a\u0dab\u0dca\u0da9\u0dcf\u0dba\u0db8')}<select required value={tuteForm.batchId} onChange={event => setTuteForm(current => ({ ...current, batchId: event.target.value }))}><option value="">{text('Select your batch', '\u0d94\u0db6\u0dda \u0d9a\u0dab\u0dca\u0da9\u0dcf\u0dba\u0db8 \u0dad\u0ddd\u0dbb\u0db1\u0dca\u0db1')}</option>{tuteBatches.map(batch => <option key={batch._id} value={batch._id}>{batch.name?.en || `${batch.year?.year || ''} ${batch.subject || 'Class'}`}</option>)}</select></label>
              <label>{text('Tute number', '\u0da7\u0dd2\u0dba\u0dd4\u0da7\u0dca \u0d85\u0d82\u0d9a\u0dba')}<input required maxLength={40} placeholder="Tute 01" value={tuteForm.tuteNumber} onChange={event => setTuteForm(current => ({ ...current, tuteNumber: event.target.value }))}/></label>
              <label>{text('Tute name or category', '\u0da7\u0dd2\u0dba\u0dd4\u0da7\u0dca \u0db1\u0dcf\u0db8\u0dba \u0dc4\u0ddd \u0d9a\u0dcf\u0dab\u0dca\u0da9\u0dba')}<input required list="student-tute-category-options" maxLength={160} placeholder="Select or enter a Tute name" value={tuteForm.tuteName} onChange={event => setTuteForm(current => ({ ...current, tuteName: event.target.value }))}/><datalist id="student-tute-category-options"><option value="Class Tute"/><option value="Revision Tute"/><option value="Practice Tute"/></datalist></label>
              <label>{text('Completed PDF (maximum 30 MB)', '\u0db4\u0dd2\u0dbb\u0dd2\u0db4\u0dd4\u0db1\u0dca PDF (\u0db8\u0dcf\u0dbb\u0dca\u0d9c\u0ddc\u0db4\u0dbb\u0dd2\u0db8\u0dba 30 MB)')}<input ref={tuteFileInput} required type="file" accept="application/pdf,.pdf" disabled={tuteUploading} onChange={event => { setTuteFile(event.currentTarget.files?.[0] || null); setError('') }}/>{tuteFile && <small className="tute-selected-file">{tuteFile.name}</small>}</label>
              <div className="student-form-actions"><button className="student-primary-button" type="submit" disabled={tuteUploading || !tuteFile || !tuteForm.batchId}><Upload size={16}/>{tuteUploading ? text('Uploading...', '\u0d85\u0db4\u0dca\u0dbd\u0ddd\u0da9\u0dca \u0dc0\u0dd9\u0db8\u0dd2\u0db1\u0dca') : text('Submit Tute PDF', '\u0da7\u0dd2\u0dba\u0dd4\u0da7\u0dca PDF \u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dbb\u0db1\u0dca\u0db1')}</button></div>
            </form>
          </section>
          <section className="student-panel"><div className="student-panel-heading"><div><span>{text('YOUR HISTORY', '\u0d94\u0db6\u0dda \u0d89\u0dad\u0dd2\u0dc4\u0dcf\u0dc3\u0dba')}</span><h2>{text('Previous submissions', '\u0db4\u0dd9\u0dbb \u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dd2\u0dbb\u0dd3\u0db8\u0dca')}</h2></div></div>
            {tuteSubmissions.length ? <div className="student-resource-list student-tute-list">{tuteSubmissions.map(submission => <article key={submission._id}><span className="student-resource-icon"><FileText size={18}/></span><div className="student-resource-copy"><b>{submission.tuteNumber} - {submission.tuteName}</b><small>{submission.batch?.name?.en || submission.batch?.year?.year || ''} ? {formatDateTime(submission.submittedAt)}</small><small>{submission.pdfName}</small></div><Status value={submission.status} language={language}/><div className="student-tute-actions"><button type="button" className="row-action" onClick={() => openTuteSubmission(submission)}>{text('View', '\u0db6\u0dbd\u0db1\u0dca\u0db1')}</button><button type="button" className="row-action" onClick={() => openTuteSubmission(submission, true)}>{text('Download', '\u0db6\u0dcf\u0d9c\u0dad \u0d9a\u0dbb\u0db1\u0dca\u0db1')}</button><label className="row-action">{text('Choose replacement PDF', '\u0dc0\u0dd9\u0db1\u0dad\u0dca PDF \u0d91\u0d9a\u0d9a\u0dca \u0dad\u0ddd\u0dbb\u0db1\u0dca\u0db1')}<input hidden type="file" accept="application/pdf,.pdf" disabled={tuteUploading} ref={input => { tuteReplacementInputs.current[submission._id] = input }} onChange={event => { const input = event.currentTarget; const replacement = input.files?.[0] || null; setTuteReplacementFiles(current => ({ ...current, [submission._id]: replacement })); tuteReplacementInputs.current[submission._id] = input }}/></label>{tuteReplacementFiles[submission._id] && <><small>{tuteReplacementFiles[submission._id].name}</small><button type="button" className="row-action" disabled={tuteUploading} onClick={() => replaceTuteSubmission(submission)}>{text('Replace submission', '\u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dd2\u0dbb\u0dd3\u0db8 \u0db4\u0dca\u200d\u0dbb\u0dad\u0dd2\u0dc3\u0dca\u0dae\u0dcf\u0db4\u0db1\u0dba \u0d9a\u0dbb\u0db1\u0dca\u0db1')}</button></>}</div></article>)}</div> : <Empty title={text('No Tute papers submitted yet', '\u0d91\u0d9a\u0daf\u0dd4 Tute \u0db4\u0dad\u0dca\u200d\u0dbb\u0dd2\u0d9a\u0dcf\u0dc0\u0d9a\u0dca \u0d89\u0daf\u0dd2\u0dbb\u0dd2\u0db4\u0dad\u0dca \u0d9a\u0dbb \u0db1\u0dd0\u0dad')} description={text('Your uploaded Tute PDFs and review status will appear here.', '\u0d94\u0db6 \u0d85\u0db4\u0dca\u0dbd\u0ddd\u0da9\u0dca \u0d9a\u0dbb\u0db1 Tute PDF \u0dc3\u0dc4 \u0dc3\u0db8\u0dcf\u0dbd\u0ddd\u0da0\u0db1 \u0dad\u0dad\u0dca\u0dad\u0dca\u0dc0\u0dba \u0db8\u0dd9\u0dc4\u0dd2 \u0daf\u0dd0\u0d9a\u0dd2\u0dba \u0dc4\u0dd0\u0d9a.')}/>}
          </section>
        </>}

        {view === 'assignments' && <><section className="student-page-heading"><div><span className="student-eyebrow">PRACTICE AND COURSEWORK</span><h1>Assignments</h1><p>Review assignment files published for your selected batch.</p></div>{data?.batches?.length > 1 && <label className="student-batch-picker">Batch<select value={selectedBatch} onChange={event => setSelectedBatch(event.target.value)}>{data.batches.map(item => <option key={item.enrollment._id} value={item.batch?._id}>{item.batch?.name?.en || 'Academic batch'}</option>)}</select></label>}</section><section className="student-panel">{renderResources(assignments, 'No assignments published', 'New assignment instructions will appear here. Assignment submission is not available in this LMS yet.')}</section></>}

        {view === 'announcements' && <><section className="student-page-heading"><div><span className="student-eyebrow">CLASS UPDATES</span><h1>Announcements</h1><p>Notices for your active batches and the whole platform.</p></div></section><section className="student-panel">{data?.announcements?.length ? <div className="student-announcement-list full">{data.announcements.map(item => <article key={item._id}><b>{getTitle(item)}</b><p>{item.body?.en || item.body?.si}</p><small>{formatDate(item.createdAt)}</small></article>)}</div> : <Empty title="No announcements yet" description="Class updates will appear here."/>}</section></>}

        {view === 'payments' && <>
          <section className="student-page-heading"><div><span className="student-eyebrow">ACCOUNT BILLING</span><h1>Payment History</h1><p>View your payment status, month, date, and amount.</p></div></section>
          <section className="student-panel"><div className="student-panel-heading"><div><span>PAYMENT RECORDS</span><h2>Payment details</h2></div></div>
            {data?.payments?.length ? <div className="student-payment-list">{data.payments.map(payment => <article key={payment._id}>
              <span className={`student-stat-icon ${payment.status === 'paid' ? 'green' : 'amber'}`}><CircleDollarSign size={19}/></span>
              <div className="student-payment-copy"><b>{payment.batch?.name?.en || `${payment.batch?.year?.year || ''} ${payment.batch?.subject || 'Academic batch'}`}</b>
                <small>{payment.paymentMonth ? `${formatPaymentMonth(payment.paymentMonth)} ? ` : ''}Payment date: {formatDate(payment.date)}</small>
              </div><strong>{formatMoney(payment.amount)}</strong><Status value={payment.status === 'paid' ? 'paid' : 'pending'}/>
            </article>)}</div> : <Empty title="No payment records yet" description="Your payment details will appear here when recorded by the administrator."/>}
          </section>
        </>}

        {view === 'settings' && <><section className="student-page-heading"><div><span className="student-eyebrow">ACCOUNT PREFERENCES</span><h1>Settings</h1><p>Update your permitted personal details and account password.</p></div></section><section className="student-panel"><div className="student-panel-heading"><div><span>PERSONAL INFORMATION</span><h2>Profile settings</h2></div></div><form className="student-form-grid" onSubmit={saveProfile}><label>Full name<input required maxLength={120} value={profileForm.name} onChange={event => setProfileForm({ ...profileForm, name: event.target.value })}/></label><label>Email address<input value={data?.student?.email || ''} readOnly/><small>Contact an administrator to change your email.</small></label><label>Phone number<input maxLength={30} value={profileForm.phone} onChange={event => setProfileForm({ ...profileForm, phone: event.target.value })}/></label><label>City<input maxLength={100} value={profileForm.city} onChange={event => setProfileForm({ ...profileForm, city: event.target.value })}/></label><div className="student-form-actions"><button className="student-primary-button" disabled={busy}><Save size={16}/>Save profile settings</button></div></form></section><section className="student-panel"><div className="student-panel-heading"><div><span>SECURITY</span><h2>Change password</h2></div></div><form className="student-form-grid password-grid" onSubmit={changePassword}><label>Current password<input type="password" required autoComplete="current-password" value={passwordForm.currentPassword} onChange={event => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}/></label><label>New password<input type="password" required minLength={8} autoComplete="new-password" value={passwordForm.newPassword} onChange={event => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}/></label><label>Confirm new password<input type="password" required minLength={8} autoComplete="new-password" value={passwordForm.confirmPassword} onChange={event => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}/></label><div className="student-form-actions"><button className="student-primary-button" disabled={busy}><Save size={16}/>Update password</button></div></form></section></>}
      </div>
      {paperPreview && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) { URL.revokeObjectURL(paperPreview.url); setPaperPreview(null) } }}><section className="entity-modal"><header><h2>{paperPreview.title}</h2><button aria-label="Close" onClick={() => { URL.revokeObjectURL(paperPreview.url); setPaperPreview(null) }}><X size={19}/></button></header><div style={{ width: 'min(84vw, 1000px)', height: 'min(78vh, 800px)' }}><iframe title={paperPreview.title} src={paperPreview.url} style={{ width: '100%', height: '100%', border: 0 }}/></div></section></div>}
      <footer className="student-footer">Ã‚Â© {new Date().getFullYear()} OSHAN MENDIS ICT <span>Student learning portal</span></footer>
    </main>
  </div>
}



