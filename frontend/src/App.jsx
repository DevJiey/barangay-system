import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

const publicPages = ['Home', 'Services', 'Announcements', 'Officials', 'Contact'];
const residentPages = ['Dashboard', 'Profile', 'Requests', 'Incidents'];
const adminPages = [
  'Dashboard',
  'Residents',
  'Households',
  'Doc Requests',
  'Incidents',
  'Announcements',
  'Officials',
  'Reports',
];

function App() {
  const [portal, setPortal] = useState('public');
  const [publicPage, setPublicPage] = useState('Home');
  const [residentPage, setResidentPage] = useState('Dashboard');
  const [adminPage, setAdminPage] = useState('Dashboard');
  const [authMode, setAuthMode] = useState('login');
  const [user, setUser] = useState(() => readStoredUser());
  const [data, setData] = useState(emptyData);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    refreshPublicData().catch(() => setNotice('Backend is not reachable yet.'));
  }, []);

  useEffect(() => {
    if (!user) return;

    if (user.role === 'admin') {
      refreshAdminData().catch(() => setNotice('Unable to load admin records.'));
    } else {
      refreshResidentData(user).catch(() => setNotice('Unable to load resident records.'));
    }
  }, [user]);

  async function refreshPublicData() {
    const [announcements, officials, residents, requests, incidents, households] = await Promise.all([
      apiGet('/announcements'),
      apiGet('/officials'),
      apiGet('/residents'),
      apiGet('/document-requests'),
      apiGet('/incident-reports'),
      apiGet('/households').catch(() => []),
    ]);

    setData((current) => ({
      ...current,
      announcements,
      officials,
      residents,
      requests,
      incidents,
      households,
    }));
  }

  async function refreshAdminData() {
    await refreshPublicData();
  }

  async function refreshResidentData(currentUser = user) {
    const residentId = currentUser?.resident?.id;
    const query = residentId ? `?resident_id=${residentId}` : '';
    const [requests, incidents, announcements, officials] = await Promise.all([
      apiGet(`/document-requests${query}`),
      apiGet(`/incident-reports${query}`),
      apiGet('/announcements'),
      apiGet('/officials'),
    ]);

    setData((current) => ({
      ...current,
      requests,
      incidents,
      announcements,
      officials,
    }));
  }

  async function handleLogin(credentials) {
    const loggedInUser = await apiPost('/login', credentials);
    setUser(loggedInUser);
    localStorage.setItem('barangay_user', JSON.stringify(loggedInUser));
    setPortal(loggedInUser.role === 'admin' ? 'admin' : 'resident');
    setNotice('');
  }

  async function handleRegister(payload) {
    const registeredUser = await apiPost('/register', payload);
    setUser(registeredUser);
    localStorage.setItem('barangay_user', JSON.stringify(registeredUser));
    setPortal('resident');
    setNotice('');
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('barangay_user');
    setPortal('public');
  }

  return (
    <div>
      {portal === 'public' && (
        <PublicPortal
          activePage={publicPage}
          data={data}
          openLogin={() => {
            setAuthMode('login');
            setPortal('auth');
          }}
          openRegister={() => {
            setAuthMode('register');
            setPortal('auth');
          }}
          setActivePage={setPublicPage}
        />
      )}

      {portal === 'auth' && (
        <AuthPage
          mode={authMode}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onBack={() => setPortal('public')}
          setMode={setAuthMode}
          target="account"
        />
      )}

      {portal === 'resident' && isResident(user) && (
        <ResidentPortal
          activePage={residentPage}
          data={data}
          onIncidentCreated={() => refreshResidentData()}
          onRequestCreated={() => refreshResidentData()}
          setActivePage={setResidentPage}
          user={user}
          logout={logout}
        />
      )}

      {portal === 'admin' && !isAdmin(user) && (
        <AuthPage mode="login" onBack={() => setPortal('public')} onLogin={handleLogin} setMode={setAuthMode} target="account" />
      )}

      {portal === 'admin' && isAdmin(user) && (
        <AdminPortal
          activePage={adminPage}
          data={data}
          logout={logout}
          refreshData={refreshAdminData}
          setActivePage={setAdminPage}
          user={user}
        />
      )}

      {notice && <div className="toast-lite">{notice}</div>}
    </div>
  );
}

function PublicPortal({ activePage, data, openLogin, openRegister, setActivePage }) {
  return (
    <div className="portal">
      <TopNav
        actions={
          <>
            <button className="btn-outline-white" onClick={openLogin} type="button">Login</button>
            <button className="btn-white" onClick={openRegister} type="button">Register</button>
          </>
        }
        activePage={activePage}
        brandSub="Official Website"
        pages={publicPages}
        setActivePage={setActivePage}
      />

      {activePage === 'Home' && <PublicHome data={data} openLogin={openLogin} />}
      {activePage === 'Services' && <ServicesPage openLogin={openLogin} />}
      {activePage === 'Announcements' && <AnnouncementsPage announcements={data.announcements} />}
      {activePage === 'Officials' && <OfficialsPage officials={data.officials} />}
      {activePage === 'Contact' && <ContactPage />}
    </div>
  );
}

function PublicHome({ data, openLogin }) {
  return (
    <>
      <section className="hero-section">
        <div className="hero-inner">
          <div className="hero-eyebrow"><i className="ti ti-map-pin" /> Barangay Digital Services</div>
          <h1 className="hero-h1">Barangay Management System</h1>
          <p className="hero-sub">
            Request certificates, check announcements, contact barangay offices, and track your documents online.
          </p>
          <div className="hero-btns">
            <button className="hero-btn-primary" onClick={openLogin} type="button">Open Resident Portal</button>
            <button className="hero-btn-outline" type="button">View Services</button>
          </div>
          <div className="hero-stats">
            <Stat value={data.residents.length} label="Residents" />
            <Stat value={data.households.length} label="Households" />
            <Stat value={data.requests.length} label="Requests" />
          </div>
        </div>
      </section>
      <main className="public-page-body">
        <SectionHeader title="Latest Announcements" text="Important barangay updates and community advisories." />
        <AnnouncementGrid announcements={data.announcements} />
      </main>
    </>
  );
}

function ServicesPage({ openLogin }) {
  const services = [
    ['ti ti-file-certificate', 'Barangay Clearance', 'Request clearance for employment, school, or legal requirements.'],
    ['ti ti-home-check', 'Certificate of Residency', 'Get proof of residency for official transactions.'],
    ['ti ti-heart-handshake', 'Certificate of Indigency', 'Submit an application for assistance-related documents.'],
    ['ti ti-alert-triangle', 'Incident Report', 'Report local concerns or incidents for barangay action.'],
  ];

  return (
    <main className="public-page-body">
      <SectionHeader title="Online Services" text="Choose a service and continue through the resident portal." />
      <div className="grid-4">
        {services.map(([icon, title, text]) => (
          <article className="card service-card" key={title}>
            <i className={icon} />
            <h3>{title}</h3>
            <p>{text}</p>
            <button className="btn btn-primary" onClick={openLogin} type="button">Request</button>
          </article>
        ))}
      </div>
    </main>
  );
}

function AnnouncementsPage({ announcements }) {
  return (
    <main className="public-page-body">
      <SectionHeader title="Announcements" text="News, programs, schedules, and emergency advisories." />
      <AnnouncementGrid announcements={announcements} />
    </main>
  );
}

function OfficialsPage({ officials }) {
  return (
    <main className="public-page-body">
      <SectionHeader title="Barangay Officials" text="Current barangay leadership and office roles." />
      <OfficialsGrid officials={officials} />
    </main>
  );
}

function ContactPage() {
  return (
    <main className="public-page-body">
      <SectionHeader title="Contact and Hotlines" text="Reach the barangay office for urgent or regular concerns." />
      <div className="grid-3">
        <Hotline icon="ti ti-phone-call" name="Barangay Hall" number="(02) 8123-4567" />
        <Hotline icon="ti ti-ambulance" name="Emergency Response" number="0917-000-1122" />
        <Hotline icon="ti ti-shield" name="Barangay Tanod" number="0918-000-3344" />
      </div>
    </main>
  );
}

function AuthPage({ mode, onBack, onLogin, onRegister, setMode, target }) {
  const [form, setForm] = useState({
    firstname: '',
    lastname: '',
    username: '',
    email: '',
    password: '',
    house_no: '',
    street: '',
    birthdate: '',
    gender: 'Male',
    contact_no: '',
    occupation: '',
    civil_status: 'Single',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isRegister = mode === 'register' && target !== 'admin';

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isRegister) await onRegister(form);
      else await onLogin({ identifier: form.email, password: form.password });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-hero">
          <button className="auth-back" onClick={onBack} type="button">
            <i className="ti ti-arrow-left" />
            Back to website
          </button>
          <div className="auth-mark"><i className="ti ti-building-community" /></div>
          <p className="auth-kicker">Barangay Management System</p>
          <h1>{isRegister ? 'Create your resident account' : 'Welcome back'}</h1>
          <p>
            {isRegister
              ? 'Register as a resident to request documents and report incidents online.'
              : 'Login once and the system will open the correct portal based on your account role.'}
          </p>
        </div>
        <div className="auth-panel">
          <div className="auth-panel-title">
            <i className={isRegister ? 'ti ti-user-plus' : 'ti ti-login-2'} />
            <span>{isRegister ? 'Resident Registration' : 'Account Login'}</span>
          </div>
          <div className="form-grid">
          {isRegister && (
            <>
              <FormLabel label="First Name"><input required value={form.firstname} onChange={(e) => setForm({ ...form, firstname: e.target.value })} /></FormLabel>
              <FormLabel label="Last Name"><input required value={form.lastname} onChange={(e) => setForm({ ...form, lastname: e.target.value })} /></FormLabel>
              <FormLabel label="Username"><input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></FormLabel>
            </>
          )}
          <FormLabel label={isRegister ? 'Email' : 'Email or username'}>
            <input required type={isRegister ? 'email' : 'text'} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FormLabel>
          <FormLabel label="Password"><input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></FormLabel>
          {isRegister && (
            <>
              <FormLabel label="House No."><input value={form.house_no} onChange={(e) => setForm({ ...form, house_no: e.target.value })} /></FormLabel>
              <FormLabel label="Street / Purok"><input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></FormLabel>
              <FormLabel label="Birthdate"><input type="date" value={form.birthdate} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} /></FormLabel>
              <FormLabel label="Gender"><select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option>Male</option><option>Female</option></select></FormLabel>
              <FormLabel label="Contact No."><input value={form.contact_no} onChange={(e) => setForm({ ...form, contact_no: e.target.value })} /></FormLabel>
              <FormLabel label="Civil Status"><select value={form.civil_status} onChange={(e) => setForm({ ...form, civil_status: e.target.value })}><option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option></select></FormLabel>
              <FormLabel label="Occupation"><input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} /></FormLabel>
            </>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="auth-actions">
            <button className="btn btn-primary" disabled={saving} type="submit">
              {saving ? 'Please wait...' : isRegister ? 'Create Account' : 'Login'}
            </button>
            {target !== 'admin' && (
              <button className="btn btn-secondary" onClick={() => setMode(isRegister ? 'login' : 'register')} type="button">
                {isRegister ? 'I already have an account' : 'Create resident account'}
              </button>
            )}
          </div>
          </div>
        </div>
      </form>
    </main>
  );
}

function ResidentPortal({ activePage, data, logout, onIncidentCreated, onRequestCreated, setActivePage, user }) {
  return (
    <div className="portal">
      <TopNav
        actions={<button className="btn-white" onClick={logout} type="button">Logout</button>}
        activePage={activePage}
        brandSub="Resident Portal"
        pages={residentPages}
        setActivePage={setActivePage}
      />
      <main className="public-page-body">
        {activePage === 'Dashboard' && <ResidentDashboard requests={data.requests} user={user} />}
        {activePage === 'Profile' && <ResidentProfile user={user} />}
        {activePage === 'Requests' && <ResidentRequests onCreated={onRequestCreated} requests={data.requests} user={user} />}
        {activePage === 'Incidents' && <IncidentForm onCreated={onIncidentCreated} user={user} />}
      </main>
    </div>
  );
}

function ResidentDashboard({ requests, user }) {
  const totalRequests = requests.length;
  const pendingRequests = requests.filter((request) => request.status === 'Pending').length;
  const releasedRequests = requests.filter((request) => request.status === 'Released').length;

  return (
    <>
      <div className="profile-header">
        <div className="profile-info">
          <div className="avatar avatar-xl avatar-green">{getInitials(fullName(user))}</div>
          <div>
            <h2 className="profile-name">{fullName(user)}</h2>
            <p className="profile-id">Resident ID: {user.resident?.id ? `RES-${String(user.resident.id).padStart(4, '0')}` : 'No resident profile yet'}</p>
            <div className="profile-tags">
              <span>{user.role}</span>
              {user.resident?.street && <span>{user.resident.street}</span>}
              {user.resident?.civil_status && <span>{user.resident.civil_status}</span>}
            </div>
          </div>
        </div>
      </div>
      <div className="grid-3 mt-4">
        <Metric value={totalRequests} label="Document Requests" icon="ti ti-file-description" />
        <Metric value={pendingRequests} label="Pending Review" icon="ti ti-clock" />
        <Metric value={releasedRequests} label="Released Documents" icon="ti ti-circle-check" />
      </div>
      <div className="card mt-4">
        <CardHeader title="Recent Requests" icon="ti ti-history" />
        <RequestTable requests={requests} />
      </div>
    </>
  );
}

function ResidentProfile({ user }) {
  const resident = user.resident ?? {};
  return (
    <div className="card">
      <CardHeader title="Resident Profile" icon="ti ti-user-circle" />
      <div className="card-body form-grid">
        <Field label="Full Name" value={fullName(user)} />
        <Field label="Email" value={user.email} />
        <Field label="Date of Birth" value={formatDate(resident.birthdate) || 'Not set'} />
        <Field label="Civil Status" value={resident.civil_status || 'Not set'} />
        <Field label="Address" value={[resident.house_no, resident.street].filter(Boolean).join(', ') || 'Not set'} />
        <Field label="Contact Number" value={resident.contact_no || 'Not set'} />
      </div>
    </div>
  );
}

function ResidentRequests({ onCreated, requests, user }) {
  const [form, setForm] = useState({ document_type: 'Barangay Clearance', purpose: '' });
  const [saving, setSaving] = useState(false);

  async function submitRequest() {
    setSaving(true);
    try {
      await apiPost('/document-requests', {
        ...form,
        resident_id: user.resident?.id,
      });
      setForm({ document_type: 'Barangay Clearance', purpose: '' });
      await onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid-2">
      <div className="card">
        <CardHeader title="Request Document" icon="ti ti-file-plus" />
        <div className="card-body">
          <FormLabel label="Document Type">
            <select onChange={(event) => setForm({ ...form, document_type: event.target.value })} value={form.document_type}>
              <option>Barangay Clearance</option>
              <option>Certificate of Residency</option>
              <option>Certificate of Indigency</option>
            </select>
          </FormLabel>
          <FormLabel label="Purpose">
            <textarea onChange={(event) => setForm({ ...form, purpose: event.target.value })} rows="4" value={form.purpose} />
          </FormLabel>
          <button className="btn btn-primary" disabled={saving} onClick={submitRequest} type="button">
            {saving ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
      <div className="card">
        <CardHeader title="My Requests" icon="ti ti-list-check" />
        <RequestTable requests={requests} />
      </div>
    </div>
  );
}

function IncidentForm({ onCreated, user }) {
  const [form, setForm] = useState({ incident_type: '', location: '', description: '' });
  const [saving, setSaving] = useState(false);

  async function submitIncident() {
    setSaving(true);
    try {
      await apiPost('/incident-reports', {
        ...form,
        resident_id: user.resident?.id,
      });
      setForm({ incident_type: '', location: '', description: '' });
      await onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <CardHeader title="Report an Incident" icon="ti ti-alert-circle" />
      <div className="card-body form-grid">
        <FormLabel label="Incident Type"><input onChange={(event) => setForm({ ...form, incident_type: event.target.value })} value={form.incident_type} /></FormLabel>
        <FormLabel label="Location"><input onChange={(event) => setForm({ ...form, location: event.target.value })} value={form.location} /></FormLabel>
        <FormLabel label="Description"><textarea onChange={(event) => setForm({ ...form, description: event.target.value })} rows="5" value={form.description} /></FormLabel>
        <button className="btn btn-primary" disabled={saving} onClick={submitIncident} type="button">
          {saving ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>
    </div>
  );
}

function AdminPortal({ activePage, data, logout, refreshData, setActivePage, user }) {
  return (
    <div className="admin-wrap">
      <aside className="admin-sidebar">
        <div className="sb-logo">
          <div className="sb-seal"><i className="ti ti-building-community" /></div>
          <div className="sb-brand">Barangay BMS<span>Admin Console</span></div>
        </div>
        <nav className="sb-nav">
          <p className="sb-section">Main Menu</p>
          {adminPages.map((page) => (
            <button className={activePage === page ? 'sb-item active' : 'sb-item'} key={page} onClick={() => setActivePage(page)} type="button">
              <i className={adminIcon(page)} />
              <span>{page}</span>
              {page === 'Doc Requests' && data.requests.length > 0 && <span className="sb-badge">{data.requests.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-avatar">{getInitials(fullName(user))}</div>
            <div><div className="sb-uname">{fullName(user)}</div><div className="sb-urole">Barangay Staff</div></div>
          </div>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <h1>{activePage}</h1>
          <div className="topbar-search"><i className="ti ti-search" /><input placeholder="Search records..." /></div>
          <button className="btn btn-secondary btn-sm" onClick={refreshData} type="button">Refresh</button>
          <button className="btn btn-primary btn-sm" onClick={logout} type="button">Logout</button>
        </header>
        <div className="page-body">
          {activePage === 'Dashboard' && <AdminDashboard data={data} />}
          {activePage === 'Residents' && <ResidentsAdmin residents={data.residents} />}
          {activePage === 'Households' && <SimpleAdmin rows={data.households} title="Households" icon="ti ti-home" />}
          {activePage === 'Doc Requests' && <DocRequestsAdmin requests={data.requests} />}
          {activePage === 'Incidents' && <IncidentsAdmin incidents={data.incidents} />}
          {activePage === 'Announcements' && <AnnouncementsAdmin announcements={data.announcements} />}
          {activePage === 'Officials' && <OfficialsGrid officials={data.officials} />}
          {activePage === 'Reports' && <ReportsAdmin data={data} />}
        </div>
      </main>
    </div>
  );
}

function AdminDashboard({ data }) {
  return (
    <>
      <div className="grid-4">
        <Metric value={data.residents.length} label="Registered Residents" icon="ti ti-users" />
        <Metric value={data.households.length} label="Households" icon="ti ti-home" />
        <Metric value={data.requests.length} label="Document Requests" icon="ti ti-file-description" />
        <Metric value={data.incidents.length} label="Incident Reports" icon="ti ti-alert-triangle" />
      </div>
      <div className="grid-2 mt-4">
        <div className="card"><CardHeader title="Document Requests" icon="ti ti-file-text" /><RequestTable requests={data.requests} /></div>
        <div className="card"><CardHeader title="Announcements" icon="ti ti-speakerphone" /><div className="card-body"><AnnouncementGrid announcements={data.announcements} compact /></div></div>
      </div>
    </>
  );
}

function ResidentsAdmin({ residents }) {
  return (
    <div className="card">
      <CardHeader title="Manage Residents" icon="ti ti-users" />
      <div className="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Address</th><th>Gender</th><th>Contact</th><th>Email</th></tr></thead>
          <tbody>
            {residents.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{[row.firstname, row.lastname].filter(Boolean).join(' ') || 'Unnamed Resident'}</td>
                <td>{[row.house_no, row.street].filter(Boolean).join(', ') || 'No address'}</td>
                <td>{row.gender || '-'}</td>
                <td>{row.contact_no || '-'}</td>
                <td>{row.email || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!residents.length && <EmptyState icon="ti ti-users" text="No residents in the database yet." />}
    </div>
  );
}

function DocRequestsAdmin({ requests }) {
  return <div className="card"><CardHeader title="Document Requests" icon="ti ti-file-description" /><RequestTable requests={requests} admin /></div>;
}

function IncidentsAdmin({ incidents }) {
  return (
    <div className="card">
      <CardHeader title="Incident Reports" icon="ti ti-alert-triangle" />
      <div className="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Type</th><th>Location</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>{incidents.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.incident_type}</td><td>{item.location || '-'}</td><td><Badge text={item.status || 'Pending'} /></td><td>{formatDate(item.created_at)}</td></tr>)}</tbody>
        </table>
      </div>
      {!incidents.length && <EmptyState icon="ti ti-alert-triangle" text="No incident reports yet." />}
    </div>
  );
}

function AnnouncementsAdmin({ announcements }) {
  return <div className="card"><CardHeader title="Manage Announcements" icon="ti ti-speakerphone" /><div className="card-body"><AnnouncementGrid announcements={announcements} compact /></div></div>;
}

function ReportsAdmin({ data }) {
  return (
    <div className="grid-3">
      <ReportCard title="Residents Report" count={data.residents.length} />
      <ReportCard title="Document Requests" count={data.requests.length} />
      <ReportCard title="Incident Reports" count={data.incidents.length} />
    </div>
  );
}

function ReportCard({ count, title }) {
  return <div className="card report-card"><i className="ti ti-download" /><h3>{title}</h3><p>{count} database records available.</p><button className="btn btn-primary" type="button">Export PDF</button></div>;
}

function SimpleAdmin({ icon, rows, title }) {
  return <div className="card"><CardHeader title={title} icon={icon} /><EmptyState icon={icon} text={`${rows.length} database records available.`} /></div>;
}

function TopNav({ activePage, actions, brandSub, pages, setActivePage }) {
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <button className="topnav-brand" onClick={() => setActivePage(pages[0])} type="button">
          <div className="topnav-seal"><i className="ti ti-building-community" /></div>
          <div className="topnav-title">Barangay System<span>{brandSub}</span></div>
        </button>
        <nav className="topnav-links">
          {pages.map((page) => (
            <button className={activePage === page ? 'topnav-link active' : 'topnav-link'} key={page} onClick={() => setActivePage(page)} type="button">{page}</button>
          ))}
        </nav>
        <div className="topnav-actions">{actions}</div>
      </div>
    </header>
  );
}

function AnnouncementGrid({ announcements, compact = false }) {
  if (!announcements.length) return <EmptyState icon="ti ti-speakerphone" text="No announcements in the database yet." />;

  return (
    <div className={compact ? 'stack-list' : 'grid-3'}>
      {announcements.map((announcement) => (
        <article className="ann-card" key={announcement.id}>
          {!compact && <div className="ann-card-img"><i className="ti ti-speakerphone" /></div>}
          <div className="ann-card-body">
            <span className="ann-tag">Update</span>
            <h3>{announcement.title}</h3>
            <p>{announcement.content || 'No content yet.'}</p>
            <div className="ann-meta"><i className="ti ti-calendar" /> {formatDate(announcement.created_at) || 'No date'}</div>
          </div>
        </article>
      ))}
    </div>
  );
}

function OfficialsGrid({ officials }) {
  if (!officials.length) return <EmptyState icon="ti ti-id-badge" text="No officials in the database yet." />;

  return (
    <div className="grid-4">
      {officials.map((official) => (
        <article className="official-card" key={official.id}>
          <div className="off-photo">{getInitials(official.name)}</div>
          <h3>{official.name}</h3>
          <p>{official.position}</p>
          <span>{[official.term_start, official.term_end].filter(Boolean).map(formatYear).join('-') || 'Current Term'}</span>
        </article>
      ))}
    </div>
  );
}

function RequestTable({ admin = false, requests = [] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Reference</th><th>Document</th><th>Status</th><th>Date</th>{admin && <th>Actions</th>}</tr></thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td>REQ-{String(request.id).padStart(4, '0')}</td>
              <td>{request.document_type}</td>
              <td><Badge text={request.status || 'Pending'} /></td>
              <td>{formatDate(request.created_at) || '-'}</td>
              {admin && <td><button className="btn btn-secondary btn-sm" type="button">Review</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!requests.length && <EmptyState icon="ti ti-file-description" text="No document requests yet." />}
    </div>
  );
}

function EmptyState({ icon, text }) {
  return <div className="empty-state"><i className={icon} /><p>{text}</p></div>;
}

function SectionHeader({ title, text }) {
  return <div className="section-header"><h2>{title}</h2><p>{text}</p></div>;
}

function CardHeader({ action, icon, title }) {
  return <div className="card-header"><div className="card-title"><i className={icon} /> {title}</div>{action}</div>;
}

function Metric({ icon, label, value }) {
  return <article className="metric-card"><div className="metric-icon"><i className={icon} /></div><div className="metric-val">{value}</div><div className="metric-lbl">{label}</div></article>;
}

function Stat({ label, value }) {
  return <div className="hero-stat"><div className="hs-val">{value}</div><div className="hs-lbl">{label}</div></div>;
}

function Badge({ text }) {
  return <span className={`badge badge-${String(text).toLowerCase().replaceAll(' ', '-')}`}>{text}</span>;
}

function Hotline({ icon, name, number }) {
  return <div className="hotline-card"><div className="hotline-icon"><i className={icon} /></div><div><h3>{name}</h3><strong>{number}</strong><p>Available during barangay office hours.</p></div></div>;
}

function Field({ label, value }) {
  return <div className="field"><span>{label}</span><strong>{value}</strong></div>;
}

function FormLabel({ children, label }) {
  return <label className="form-label">{label}{children}</label>;
}

function adminIcon(page) {
  const icons = {
    Dashboard: 'ti ti-layout-dashboard',
    Residents: 'ti ti-users',
    Households: 'ti ti-home',
    'Doc Requests': 'ti ti-file-description',
    Incidents: 'ti ti-alert-triangle',
    Announcements: 'ti ti-speakerphone',
    Officials: 'ti ti-id-badge',
    Reports: 'ti ti-chart-bar',
  };
  return icons[page] ?? 'ti ti-circle';
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

async function apiPost(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('barangay_user'));
  } catch {
    return null;
  }
}

function isAdmin(user) {
  return user?.role === 'admin';
}

function isResident(user) {
  return user && user.role !== 'admin';
}

function fullName(user) {
  return [user?.firstname, user?.lastname].filter(Boolean).join(' ') || 'User';
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(value));
}

function formatYear(value) {
  if (!value) return '';
  return new Date(value).getFullYear();
}

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

const emptyData = {
  announcements: [],
  officials: [],
  requests: [],
  residents: [],
  incidents: [],
  households: [],
};

export default App;
