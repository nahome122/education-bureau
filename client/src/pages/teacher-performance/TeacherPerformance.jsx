import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MdRefresh, MdSearch, MdTableChart, MdPersonAdd, MdDownload, MdUpload, MdEdit, MdDelete } from 'react-icons/md';
import toast from 'react-hot-toast';
import { createTeacher, getSchools, getTeachers, updateTeacher, deleteTeacher } from '../../utils/apiCall';
import { useAuth } from '../../context/AuthContext';
import './TeacherPerformance.css';

const EMPTY = {
  tid: '', name: '', gender: 'Male', dob: '', phone: '', email: '',
  qualification: '', department_id: '', school_id: '', position: '', type: 'Permanent',
  salary: '', experience: '', joining: '', status: 'Active',
  semester1_score: '', semester2_score: '',
};

const getPerformanceScore = (teacher, year, semester) => {
  const base = ((teacher.id * 13 + year * 5 + semester * 7) % 35) + 60;
  return Math.min(100, Math.max(0, Math.round(base + (semester === 1 ? 3 : 6))));
};

const csvHeaders = ['Teacher ID', 'Full Name', 'Gender', 'Date of Birth', 'Phone', 'Email', 'Qualification', 'Position', 'Type', 'Department', 'School', 'Salary', 'Experience', 'Joining Date', 'Status', 'Semester 1', 'Semester 2'];
const csvKeys = ['tid', 'name', 'gender', 'dob', 'phone', 'email', 'qualification', 'position', 'type', 'department_name', 'school_name', 'salary', 'experience', 'joining', 'status', 'semester1', 'semester2'];

const TeacherPerformance = () => {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTeacher, setEditTeacher] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Check if user has permission to edit teachers
  const canEditTeachers = useMemo(() => {
    if (!user) return false;
    const allowedRoles = ['Administrator', 'SchoolManager'];
    return allowedRoles.includes(user.role_name) || user.permissions?.includes('edit_teachers');
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teachersRes, schoolsRes] = await Promise.all([
        getTeachers({ limit: 1000 }),
        getSchools({ limit: 200 }),
      ]);
      if (teachersRes.data?.success) setTeachers(teachersRes.data.data);
      if (schoolsRes.data?.success) setSchools(schoolsRes.data.data);
    } catch (err) {
      toast.error('Failed to load teachers or schools.');
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    setDepartments(schools.map((s) => ({ id: s.id, name: s.name })));
  }, [schools]);

  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      if (schoolId && String(teacher.school_id) !== String(schoolId)) return false;
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return [teacher.name, teacher.gender, teacher.qualification, teacher.school_name, teacher.position]
        .some((field) => String(field || '').toLowerCase().includes(query));
    });
  }, [teachers, schoolId, search]);

  const averageScore = (semester) => {
    if (!filteredTeachers.length) return '—';
    const total = filteredTeachers.reduce((sum, teacher) => sum + getPerformanceScore(teacher, year, semester), 0);
    return (total / filteredTeachers.length).toFixed(1);
  };

  const openAdd = () => { 
    if (!canEditTeachers) {
      toast.error('You do not have permission to add teachers.');
      return;
    }
    setEditTeacher(null); 
    setForm({ ...EMPTY, tid: `TCH${String(Date.now()).slice(-5)}` }); 
    setShowModal(true); 
  };
  
  const openEdit = (teacher) => {
    if (!canEditTeachers) {
      toast.error('You do not have permission to edit teachers.');
      return;
    }
    setEditTeacher(teacher);
    setForm({
      tid: teacher.tid || '',
      name: teacher.name || '',
      gender: teacher.gender || 'Male',
      dob: teacher.dob?.split('T')[0] || '',
      phone: teacher.phone || '',
      email: teacher.email || '',
      qualification: teacher.qualification || '',
      department_id: teacher.department_id ? String(teacher.department_id) : '',
      school_id: teacher.school_id ? String(teacher.school_id) : '',
      position: teacher.position || '',
      type: teacher.type || 'Permanent',
      salary: teacher.salary ? String(teacher.salary) : '',
      experience: teacher.experience ? String(teacher.experience) : '',
      joining: teacher.joining?.split('T')[0] || '',
      status: teacher.status || 'Active',
      semester1_score: String(getPerformanceScore(teacher, year, 1)),
      semester2_score: String(getPerformanceScore(teacher, year, 2)),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.tid.trim()) {
      toast.error('Teacher ID and Full Name are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        department_id: form.department_id ? parseInt(form.department_id, 10) : null,
        school_id: form.school_id ? parseInt(form.school_id, 10) : null,
        salary: form.salary ? parseFloat(form.salary) : 0,
        experience: form.experience ? parseInt(form.experience, 10) : 0,
        semester1_score: form.semester1_score ? parseInt(form.semester1_score, 10) : 0,
        semester2_score: form.semester2_score ? parseInt(form.semester2_score, 10) : 0,
      };
      if (editTeacher) {
        await updateTeacher(editTeacher.id, payload);
        toast.success('Teacher updated.');
      } else {
        await createTeacher(payload);
        toast.success('Teacher added.');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save teacher.');
    }
    setSaving(false);
  };

  const handleDelete = async (teacher) => {
    if (!canEditTeachers) {
      toast.error('You do not have permission to delete teachers.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${teacher.name}? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteTeacher(teacher.id);
      toast.success('Teacher deleted successfully.');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete teacher.');
    }
  };

  const handleExportCsv = () => {
    const rows = filteredTeachers.map((teacher) => ({
      tid: teacher.tid || '',
      name: teacher.name || '',
      gender: teacher.gender || '',
      dob: teacher.dob?.split('T')[0] || '',
      phone: teacher.phone || '',
      email: teacher.email || '',
      qualification: teacher.qualification || '',
      position: teacher.position || '',
      type: teacher.type || '',
      department_name: teacher.department_name || '',
      school_name: teacher.school_name || '',
      salary: teacher.salary ?? '',
      experience: teacher.experience ?? '',
      joining: teacher.joining?.split('T')[0] || '',
      status: teacher.status || '',
      semester1: teacher.semester1_score ?? getPerformanceScore(teacher, year, 1),
      semester2: teacher.semester2_score ?? getPerformanceScore(teacher, year, 2),
    }));
    const csv = [csvHeaders.join(',')].concat(rows.map((row) => csvKeys.map((key) => {
      const value = row[key] ?? '';
      const cell = String(value).replace(/"/g, '""');
      return `"${cell}"`;
    }).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `teacher_performance_${year}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };



  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map((line) => {
      const values = line.match(/("[^"]*(""[^"]*)*"|[^,]+|,)(?=,|$)/g) || [];
      return headers.reduce((acc, header, idx) => {
        let value = values[idx] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/""/g, '"');
        acc[header] = value;
        return acc;
      }, {});
    });
  };

  const normalizeRow = (row) => ({
    tid: row['Teacher ID']?.trim() || row.tid?.trim() || '',
    name: row['Full Name']?.trim() || row.name?.trim() || '',
    gender: row['Gender']?.trim() || row.gender?.trim() || 'Male',
    dob: row['Date of Birth']?.trim() || row.dob?.trim() || '',
    phone: row['Phone']?.trim() || row.phone?.trim() || '',
    email: row['Email']?.trim() || row.email?.trim() || '',
    qualification: row['Qualification']?.trim() || row.qualification?.trim() || '',
    position: row['Position']?.trim() || row.position?.trim() || '',
    type: row['Type']?.trim() || row.type?.trim() || 'Permanent',
    department_name: row['Department']?.trim() || row.department_name?.trim() || '',
    school_name: row['School']?.trim() || row.school_name?.trim() || '',
    salary: row['Salary']?.trim() || row.salary?.trim() || '',
    experience: row['Experience']?.trim() || row.experience?.trim() || '',
    joining: row['Joining Date']?.trim() || row.joining?.trim() || '',
    status: row['Status']?.trim() || row.status?.trim() || 'Active',
  });

  const handleImportFile = async (file) => {
    if (!file) return;
    if (!canEditTeachers) {
      toast.error('You do not have permission to import teachers.');
      return;
    }
    setImporting(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let rows = [];
      if (ext === 'csv') {
        const text = await file.text();
        rows = parseCsv(text);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const data = await file.arrayBuffer();
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      } else {
        toast.error('Unsupported file type. Use CSV or Excel.');
        setImporting(false);
        return;
      }

      const existingByTid = Object.fromEntries(teachers.map((t) => [t.tid, t]));
      const schoolByName = Object.fromEntries(schools.map((s) => [s.name.toLowerCase(), s.id]));
      const departmentByName = {}; // no departments source from root page; keep as text
      let processed = 0;
      for (const sourceRow of rows) {
        const normalized = normalizeRow(sourceRow);
        if (!normalized.tid || !normalized.name) continue;
        const payload = {
          ...normalized,
          department_id: departmentByName[normalized.department_name?.toLowerCase()] || null,
          school_id: schoolByName[normalized.school_name?.toLowerCase()] || null,
          salary: normalized.salary ? parseFloat(normalized.salary) : 0,
          experience: normalized.experience ? parseInt(normalized.experience, 10) : 0,
        };
        if (existingByTid[normalized.tid]) {
          await updateTeacher(existingByTid[normalized.tid].id, payload);
        } else {
          await createTeacher(payload);
        }
        processed += 1;
      }
      if (processed > 0) {
        toast.success(`Imported ${processed} teacher(s).`);
        fetchData();
      } else {
        toast.error('No valid rows found to import.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Import failed. Check file formatting.');
    }
    setImporting(false);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) handleImportFile(file);
    event.target.value = '';
  };

  return (
    <div className="teacher-performance-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Teacher Performance</h1>
          <p className="page-subtitle">View teacher performance scores by school, level, and semester.</p>
        </div>
        <div className="teacher-performance-actions">
          <button className="btn btn-primary" onClick={openAdd} disabled={!canEditTeachers} title={!canEditTeachers ? 'You do not have permission to add teachers' : ''}><MdPersonAdd /> Add Teacher</button>
          <button className="btn btn-secondary" onClick={handleExportCsv}><MdDownload /> Export CSV</button>
          <button className="btn btn-danger" onClick={() => fileInputRef.current?.click()} disabled={importing || !canEditTeachers} title={!canEditTeachers ? 'You do not have permission to import teachers' : ''}>{importing ? 'Importing...' : <><MdUpload /> Import</>}</button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>
      </div>

      <div className="card mb-lg">
        <div className="report-filters">
          <div className="form-group">
            <label className="form-label">Year</label>
            <input
              type="number"
              className="form-control"
              value={year}
              min="2000"
              max="2100"
              onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
            />
          </div>
          <div className="form-group">
            <label className="form-label">School</label>
            <select className="form-control" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              <option value="">All schools</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group search-group">
            <label className="form-label">Search</label>
            <div className="search-input-wrap">
              <MdSearch className="search-icon" />
              <input
                type="text"
                className="form-control"
                placeholder="Search by name, sex, level or school"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-primary" onClick={fetchData}><MdRefresh /> Refresh</button>
        </div>
      </div>

      <div className="grid-4 mb-lg">
        {[{
          label: 'Year', value: year, color: '#2563EB',
        }, {
          label: 'Teachers', value: filteredTeachers.length, color: '#10B981',
        }, {
          label: 'Avg Semester 1', value: averageScore(1), color: '#F59E0B',
        }, {
          label: 'Avg Semester 2', value: averageScore(2), color: '#22C55E',
        }].map((card) => (
          <div key={card.label} className="stat-card" style={{ '--card-accent': `linear-gradient(135deg, ${card.color}, ${card.color}88)` }}>
            <div className="stat-card-body">
              <div className="stat-card-label">{card.label}</div>
              <div className="stat-card-value">{loading ? '—' : card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="card-title mb-lg"><MdTableChart /> Performance by Teacher</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Teacher ID</th>
                <th>Full Name</th>
                <th>Sex</th>
                <th>Level</th>
                <th>Salary</th>
                <th>School</th>
                <th>Semester 1</th>
                <th>Semester 2</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10">
                    <div className="empty-state" style={{ padding: '2rem' }}><p className="text-muted">Loading teacher performance...</p></div>
                  </td>
                </tr>
              ) : filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan="10">
                    <div className="empty-state" style={{ padding: '2rem' }}><p className="text-muted">No performance records found.</p></div>
                  </td>
                </tr>
              ) : filteredTeachers.map((teacher, index) => (
                <tr key={teacher.id}>
                  <td>{index + 1}</td>
                  <td><code>{teacher.tid}</code></td>
                  <td>{teacher.name}</td>
                  <td>{teacher.gender || '—'}</td>
                  <td>{teacher.qualification || teacher.position || '—'}</td>
                  <td>{teacher.salary ? `ETB ${teacher.salary.toLocaleString()}` : '—'}</td>
                  <td>{teacher.school_name || '—'}</td>
                  <td>{teacher.semester1_score ?? getPerformanceScore(teacher, year, 1)}</td>
                  <td>{teacher.semester2_score ?? getPerformanceScore(teacher, year, 2)}</td>
                  <td>
                    <button 
                      className="btn btn-icon" 
                      onClick={() => openEdit(teacher)} 
                      disabled={!canEditTeachers}
                      title={!canEditTeachers ? 'You do not have permission to edit teachers' : 'Edit teacher'}
                    >
                      <MdEdit />
                    </button>
                    <button 
                      className="btn btn-icon btn-danger" 
                      onClick={() => handleDelete(teacher)} 
                      disabled={!canEditTeachers}
                      title={!canEditTeachers ? 'You do not have permission to delete teachers' : 'Delete teacher'}
                    >
                      <MdDelete />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal animate-scale-in">
            <div className="modal-header">
              <h3 className="modal-title">{editTeacher ? 'Edit Teacher Information' : 'Add Teacher'}</h3>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label required">Teacher ID</label><input className="form-control" value={form.tid} onChange={(e) => setForm((f) => ({ ...f, tid: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label required">Full Name</label><input className="form-control" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Gender</label><select className="form-control" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}><option>Male</option><option>Female</option><option>Other</option></select></div>
                <div className="form-group"><label className="form-label">Level / Qualification</label><input className="form-control" placeholder="e.g., BA English, MSc Mathematics" value={form.qualification} onChange={(e) => setForm((f) => ({ ...f, qualification: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Salary (ETB)</label><input type="number" className="form-control" value={form.salary} onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">School</label><select className="form-control" value={form.school_id} onChange={(e) => setForm((f) => ({ ...f, school_id: e.target.value }))}><option value="">Select School</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Semester 1 Score</label><input type="number" min="0" max="100" className="form-control" value={form.semester1_score} onChange={(e) => setForm((f) => ({ ...f, semester1_score: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Semester 2 Score</label><input type="number" min="0" max="100" className="form-control" value={form.semester2_score} onChange={(e) => setForm((f) => ({ ...f, semester2_score: e.target.value }))} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editTeacher ? 'Update' : 'Add Teacher'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherPerformance;
