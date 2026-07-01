import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MdBadge, MdSearch, MdRefresh, MdCameraAlt,
  MdPrint, MdLock, MdClose,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import { getTeachers, getStaff, getSchools } from '../../utils/apiCall';
import { useAuth } from '../../context/AuthContext';
import './IdCards.css';

// ── Photo key — shared with Profile.jsx ───────────────────────────────────────
const PHOTO_KEY = (type, numId) => `tsms_photo_${type}_${numId}`;
const getPhoto  = (type, numId) => localStorage.getItem(PHOTO_KEY(type, numId));
const savePhoto = (type, numId, b64) => localStorage.setItem(PHOTO_KEY(type, numId), b64);

// ── Helpers ───────────────────────────────────────────────────────────────────
const initials = (name = '') =>
  name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

const QR_PATTERN = [
  1,1,1,0,1,1,1,
  1,0,1,0,1,0,1,
  1,1,1,0,0,1,0,
  0,0,0,1,0,0,1,
  1,0,1,1,1,0,1,
  0,1,0,0,0,0,1,
  1,1,1,0,1,1,1,
];

const statusCls = (s) => {
  if (!s) return 'id-card-status-inactive';
  const v = s.toLowerCase();
  if (v === 'active')   return 'id-card-status-active';
  if (v === 'on leave') return 'id-card-status-onleave';
  return 'id-card-status-inactive';
};

// ══════════════════════════════════════════════════════════════
// FRONT FACE
// ══════════════════════════════════════════════════════════════
const CardFront = ({ emp, photo, onPhotoUpload, canUpload }) => (
  <div className="id-card-front">
    <div className="id-card-side-strip" />
    <div className="id-card-header">
      <span className="id-card-bureau">WACHALE WOREDA</span>
      <span className="id-card-bureau-sub">Education Bureau</span>
    </div>
    <div className="id-card-body">
      <div className="id-card-photo-wrap">
        <div className="id-card-photo">
          {photo
            ? <img src={photo} alt={emp.name} />
            : <span className="id-card-photo-initials">{initials(emp.name)}</span>
          }
        </div>
        {canUpload ? (
          <label className="id-card-upload-btn" htmlFor={`photo-upload-${emp.emp_type}-${emp.id}`} title="Upload your photo">
            <MdCameraAlt /> Upload
            <input id={`photo-upload-${emp.emp_type}-${emp.id}`} type="file" accept="image/*" onChange={onPhotoUpload} hidden />
          </label>
        ) : (
          <span className="id-card-upload-btn id-card-upload-locked" title="Only the employee can upload their own photo">
            <MdLock /> Photo
          </span>
        )}
      </div>
      <div className="id-card-info">
        <div className="id-card-name">{emp.name || '—'}</div>
        <div className="id-card-empid">{emp.tid || emp.sid || '—'}</div>
        {emp.position        && <div className="id-card-row"><span>Position:</span><span>{emp.position}</span></div>}
        {emp.school_name     && <div className="id-card-row"><span>School:</span><span>{emp.school_name}</span></div>}
        {emp.department_name && <div className="id-card-row"><span>Dept:</span><span>{emp.department_name}</span></div>}
        {emp.phone           && <div className="id-card-row"><span>Phone:</span><span>{emp.phone}</span></div>}
        {emp.email           && <div className="id-card-row"><span>Email:</span><span>{emp.email}</span></div>}
        <span className={`id-card-status-badge ${statusCls(emp.status)}`}>{emp.status || 'Unknown'}</span>
      </div>
    </div>
    <div className="id-card-footer">
      <span className="id-card-footer-text">Valid Employee ID Card</span>
      <span className="id-card-footer-year">{new Date().getFullYear()}</span>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// BACK FACE
// ══════════════════════════════════════════════════════════════
const CardBack = ({ emp }) => {
  const empId       = emp.tid || emp.sid || '—';
  const isTeacher   = emp.emp_type === 'teacher';
  const typeLabel   = isTeacher ? 'Teacher' : 'Staff';
  const typeCls     = isTeacher ? 'back-type-teacher' : 'back-type-staff';
  const joiningDate = emp.joining
    ? new Date(emp.joining).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' })
    : '—';
  return (
    <div className="id-card-back">
      <div className="id-card-side-strip" />
      <div className="id-card-back-header">
        <div>
          <div className="id-card-back-logo-text">Wachale Woreda</div>
          <div className="id-card-back-subtitle">Education Bureau — Staff ID</div>
        </div>
        <div className="id-card-back-logo-text" style={{ fontSize: 10 }}>{empId}</div>
      </div>
      <div className="id-card-back-body">
        <div className="id-card-qr">
          <div className="id-card-qr-grid">
            {QR_PATTERN.map((cell, i) => (
              <div key={i} className={`id-card-qr-cell${cell === 0 ? ' light' : ''}`} />
            ))}
          </div>
          <div className="id-card-qr-corner tl" /><div className="id-card-qr-corner tr" /><div className="id-card-qr-corner bl" />
          <div className="id-card-qr-inner tl"  /><div className="id-card-qr-inner tr"  /><div className="id-card-qr-inner bl"  />
        </div>
        <div className="id-card-back-info">
          <div className="id-card-back-section-title">Employee Details</div>
          <div className="id-card-back-row"><span>Name:</span><span>{emp.name || '—'}</span></div>
          <div className="id-card-back-row"><span>ID:</span><span>{empId}</span></div>
          {emp.school_name && <div className="id-card-back-row"><span>School:</span><span>{emp.school_name}</span></div>}
          <div className="id-card-back-row"><span>Joined:</span><span>{joiningDate}</span></div>
          <span className={`id-card-back-type-badge ${typeCls}`}>{typeLabel}</span>
        </div>
      </div>
      <div className="id-card-back-footer">
        <span className="id-card-back-footer-text">If found, return to nearest school office</span>
        <span className="id-card-back-hotline">Hotline: +251-XXX-XXXX</span>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// INLINE CARD DISPLAY — shows front + back side by side on page
// Used for employee self-view AND admin selected card view
// ══════════════════════════════════════════════════════════════
const InlineCardDisplay = ({ emp, photo, onPhotoUpload, canUpload, onClose, showClose }) => (
  <div className="inline-card-display animate-slide-up">
    {showClose && (
      <div className="inline-card-close">
        <button className="btn btn-ghost btn-icon" onClick={onClose} title="Close"><MdClose /></button>
      </div>
    )}
    <div className="inline-card-label">
      <span className="inline-card-label-text">Front</span>
    </div>
    <div className="inline-cards-row">
      {/* Front */}
      <div className="inline-card-wrap">
        <div className="inline-card-tag">Front</div>
        <div className="id-card-scene-static">
          <CardFront emp={emp} photo={photo} onPhotoUpload={onPhotoUpload} canUpload={canUpload} />
        </div>
      </div>
      {/* Back */}
      <div className="inline-card-wrap">
        <div className="inline-card-tag">Back</div>
        <div className="id-card-scene-static">
          <CardBack emp={emp} />
        </div>
      </div>
    </div>
    <div className="inline-card-actions">
      <button className="btn-print" onClick={() => window.print()}>
        <MdPrint /> Print ID Card
      </button>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
const IdCards = () => {
  const { user, isAdmin, isSchoolManager, isEmployee, isOwnRecord } = useAuth();

  const [employees,    setEmployees]    = useState([]);
  const [schools,      setSchools]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [page,         setPage]         = useState(1);
  const [selectedEmp,  setSelectedEmp]  = useState(null);
  const [photos,       setPhotos]       = useState({});
  const LIMIT = 15;
  const printRef = useRef(null);

  // ── Fetch ──────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (isEmployee) {
        const empType = user.emp_type;
        const empCode = user.emp_code;
        const params  = { limit: 10000, _emp_code: empCode };
        if (empType === 'teacher') {
          const tRes = await getTeachers(params);
          const tList = (tRes.data?.success ? tRes.data.data : []).map(t => ({ ...t, emp_type: 'teacher' }));
          setEmployees(tList);
          // Auto-open own card
          if (tList.length > 0) {
            const saved = getPhoto('teacher', tList[0].id);
            if (saved) setPhotos(p => ({ ...p, [`teacher-${tList[0].id}`]: saved }));
            setSelectedEmp(tList[0]);
          }
        } else {
          const sRes = await getStaff(params);
          const sList = (sRes.data?.success ? sRes.data.data : []).map(s => ({ ...s, emp_type: 'staff' }));
          setEmployees(sList);
          if (sList.length > 0) {
            const saved = getPhoto('staff', sList[0].id);
            if (saved) setPhotos(p => ({ ...p, [`staff-${sList[0].id}`]: saved }));
            setSelectedEmp(sList[0]);
          }
        }
      } else {
        const [tRes, sRes] = await Promise.all([
          getTeachers({ limit: 10000 }),
          getStaff({ limit: 10000 }),
        ]);
        const tList = (tRes.data?.success ? tRes.data.data : []).map(t => ({ ...t, emp_type: 'teacher' }));
        const sList = (sRes.data?.success ? sRes.data.data : []).map(s => ({ ...s, emp_type: 'staff' }));
        setEmployees([...tList, ...sList]);
      }
    } catch {
      toast.error('Failed to load employees.');
    }
    setLoading(false);
  }, [isEmployee, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!isEmployee) {
      getSchools({ limit: 200 }).then(({ data }) => { if (data.success) setSchools(data.data); }).catch(() => {});
    }
  }, [isEmployee]);

  // ── Filter + paginate ──────────────────────────────────────
  const filtered = employees.filter(emp => {
    const q = search.toLowerCase();
    const matchSearch = !q || [emp.name, emp.tid, emp.sid, emp.email].some(v => String(v || '').toLowerCase().includes(q));
    const matchType   = !filterType   || emp.emp_type === filterType;
    const matchSchool = !filterSchool || String(emp.school_id) === String(filterSchool);
    return matchSearch && matchType && matchSchool;
  });

  const totalPages = Math.ceil(filtered.length / LIMIT);
  const paginated  = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  useEffect(() => { setPage(1); }, [search, filterType, filterSchool]);

  const canUploadFor = (emp) => {
    if (isAdmin || isSchoolManager) return true;
    return isOwnRecord(emp.emp_type, emp.tid || emp.sid);
  };

  const openCard = (emp) => {
    const saved = getPhoto(emp.emp_type, emp.id);
    if (saved) setPhotos(p => ({ ...p, [`${emp.emp_type}-${emp.id}`]: saved }));
    setSelectedEmp(emp);
    // Scroll to card display
    setTimeout(() => document.getElementById('inline-card-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handlePhotoUpload = (emp) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      savePhoto(emp.emp_type, emp.id, base64);
      setPhotos(p => ({ ...p, [`${emp.emp_type}-${emp.id}`]: base64 }));
      toast.success('Photo saved. It will also appear on your profile.');
    };
    reader.readAsDataURL(file);
  };

  const currentPhoto = selectedEmp ? photos[`${selectedEmp.emp_type}-${selectedEmp.id}`] || null : null;

  // ── Employee self-view: show cards directly, no table ─────
  if (isEmployee) {
    return (
      <div className="idcards-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">My ID Card</h1>
            <p className="page-subtitle">Your official employee identification card</p>
          </div>
          <button className="btn btn-ghost" onClick={fetchData}><MdRefresh /> Refresh</button>
        </div>

        {loading ? (
          <div className="card" style={{ padding: '3rem' }}>
            <div className="inline-cards-row">
              <div className="inline-card-wrap"><div className="skeleton" style={{ width: 340, height: 214, borderRadius: 14 }} /></div>
              <div className="inline-card-wrap"><div className="skeleton" style={{ width: 340, height: 214, borderRadius: 14 }} /></div>
            </div>
          </div>
        ) : !selectedEmp ? (
          <div className="card"><div className="empty-state" style={{ padding: '3rem' }}>
            <div className="empty-state-icon">🪪</div>
            <p className="empty-state-title">ID card not found</p>
          </div></div>
        ) : (
          <div className="card">
            <InlineCardDisplay
              emp={selectedEmp}
              photo={currentPhoto}
              onPhotoUpload={handlePhotoUpload(selectedEmp)}
              canUpload={true}
              showClose={false}
            />
          </div>
        )}

        {/* Printable */}
        {selectedEmp && (
          <div className="id-card-printable" ref={printRef} aria-hidden="true">
            <div className="id-card-print-both">
              <div className="id-card-print-card">
                <CardFront emp={selectedEmp} photo={currentPhoto} onPhotoUpload={() => {}} canUpload={false} />
              </div>
              <div className="id-card-print-card">
                <CardBack emp={selectedEmp} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Admin/Manager/Officer view: table + inline card display ─
  return (
    <div className="idcards-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">ID Cards</h1>
          <p className="page-subtitle">View and print employee ID cards</p>
        </div>
        <button className="btn btn-ghost" onClick={fetchData}><MdRefresh /> Refresh</button>
      </div>

      {/* Filters */}
      <div className="card mb-lg">
        <div className="filters-row">
          <div className="search-input-wrap">
            <MdSearch className="search-icon" />
            <input className="search-input" placeholder="Search by name, ID, email…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-control" style={{ maxWidth: 150 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            <option value="teacher">Teacher</option>
            <option value="staff">Staff</option>
          </select>
          <select className="form-control" style={{ maxWidth: 200 }} value={filterSchool} onChange={e => setFilterSchool(e.target.value)}>
            <option value="">All Schools</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn btn-ghost btn-icon" onClick={fetchData}><MdRefresh /></button>
        </div>
      </div>

      {/* Inline card display — shown when a row is selected */}
      {selectedEmp && (
        <div id="inline-card-anchor" className="card mb-lg">
          <div className="inline-card-header">
            <div>
              <span className="font-medium">{selectedEmp.name}</span>
              <span className="text-muted" style={{ marginLeft: 8, fontSize: 12 }}>{selectedEmp.tid || selectedEmp.sid}</span>
              {isOwnRecord(selectedEmp.emp_type, selectedEmp.tid || selectedEmp.sid) && (
                <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 700, fontSize: 12 }}>· Your Card</span>
              )}
            </div>
          </div>
          <InlineCardDisplay
            emp={selectedEmp}
            photo={currentPhoto}
            onPhotoUpload={handlePhotoUpload(selectedEmp)}
            canUpload={canUploadFor(selectedEmp)}
            showClose={true}
            onClose={() => setSelectedEmp(null)}
          />
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>ID</th><th>Name</th><th>Type</th>
                <th>School</th><th>Position</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(8)].map((_, i) => (
                    <tr key={i}>{[...Array(8)].map((_, j) => <td key={j}><div className="skeleton skeleton-text" /></td>)}</tr>
                  ))
                : paginated.length === 0
                  ? <tr><td colSpan={8}><div className="empty-state">
                      <div className="empty-state-icon" style={{ fontSize: 36 }}>🪪</div>
                      <p className="empty-state-title">No employees found</p>
                    </div></td></tr>
                  : paginated.map((emp, i) => {
                      const empId   = emp.tid || emp.sid || '—';
                      const isTeach = emp.emp_type === 'teacher';
                      const ownRow  = isOwnRecord(emp.emp_type, emp.tid || emp.sid);
                      const isSelected = selectedEmp?.id === emp.id && selectedEmp?.emp_type === emp.emp_type;
                      return (
                        <tr key={`${emp.emp_type}-${emp.id}`}
                          className={[ownRow ? 'own-row-highlight' : '', isSelected ? 'row-selected' : ''].join(' ').trim()}>
                          <td className="text-muted">{(page - 1) * LIMIT + i + 1}</td>
                          <td><code className="id-code">{empId}</code></td>
                          <td>
                            <div className="user-cell">
                              <div className="avatar">{initials(emp.name)}</div>
                              <div>
                                <div className="font-medium">
                                  {emp.name}
                                  {ownRow && <span className="own-row-badge">You</span>}
                                </div>
                                <div className="text-muted text-xs">{emp.email || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td><span className={`badge ${isTeach ? 'badge-teacher' : 'badge-staff-type'}`}>{isTeach ? 'Teacher' : 'Staff'}</span></td>
                          <td>{emp.school_name || '—'}</td>
                          <td>{emp.position || '—'}</td>
                          <td>
                            <span className={`badge ${emp.status === 'Active' ? 'badge-success' : emp.status === 'On Leave' ? 'badge-warning' : 'badge-danger'}`}>
                              <span className="badge-dot" />{emp.status || '—'}
                            </span>
                          </td>
                          <td>
                            <button
                              className={`btn-id-card ${isSelected ? 'btn-id-card-active' : ''}`}
                              onClick={() => isSelected ? setSelectedEmp(null) : openCard(emp)}
                            >
                              <MdBadge /> {isSelected ? 'Hide Card' : ownRow ? 'My ID Card' : 'View ID Card'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
              }
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {[...Array(Math.min(totalPages, 8))].map((_, i) => (
              <button key={i + 1} className={`pagination-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
            ))}
            <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        )}

        {!loading && (
          <div className="idcards-summary">
            Showing {paginated.length} of {filtered.length} &nbsp;·&nbsp;
            {employees.filter(e => e.emp_type === 'teacher').length} teachers,&nbsp;
            {employees.filter(e => e.emp_type === 'staff').length} staff
          </div>
        )}
      </div>

      {/* Printable area */}
      {selectedEmp && (
        <div className="id-card-printable" ref={printRef} aria-hidden="true">
          <div className="id-card-print-both">
            <div className="id-card-print-card">
              <CardFront emp={selectedEmp} photo={currentPhoto} onPhotoUpload={() => {}} canUpload={false} />
            </div>
            <div className="id-card-print-card">
              <CardBack emp={selectedEmp} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IdCards;
