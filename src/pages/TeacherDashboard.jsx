import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStudents, getTeacherGroups, createGroup, getStudentReport, updateUserProfile } from '../services/dbService';

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Profile Edit
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');

  // Group Form
  const [showForm, setShowForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);

  // Student Details Panel
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState(null);
  const [studentReport, setStudentReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [sData, gData] = await Promise.all([
        getStudents(),
        getTeacherGroups(user.uid)
      ]);
      setStudents(sData);
      setGroups(gData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    await updateUserProfile(user.uid, editName);
    user.name = editName; // Optimistic update
    setIsEditing(false);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || selectedStudents.length === 0) return;

    try {
      await createGroup(user.uid, newGroupName, selectedStudents);
      setNewGroupName('');
      setSelectedStudents([]);
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleStudentClick = async (student) => {
    setSelectedStudentForDetails(student);
    setLoadingReport(true);
    const report = await getStudentReport(student.id);
    setStudentReport(report);
    setLoadingReport(false);
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Teacher Dashboard...</div>;

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>

      {/* HEADER ROW */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(99, 102, 241, 0.1))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'T'}
          </div>
          <div>
            {isEditing ? (
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
                <button onClick={handleSaveProfile} style={{ background: 'var(--success)', color: 'white', padding: '8px 16px', borderRadius: '4px' }}>Save</button>
              </div>
            ) : (
              <>
                <h2 style={{ margin: 0 }}>{user?.name}</h2>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => setIsEditing(true)}>✎ Edit Profile</p>
              </>
            )}
          </div>
        </div>
        <button onClick={logout} style={{ padding: '10px 20px', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--error)', borderRadius: '8px', fontWeight: 'bold', transition: '0.2s' }}>
          Logout
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '30px', alignItems: 'start' }}>

        {/* GROUPS COLUMN */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>📚 Your Groups</h3>
            <button
              onClick={() => setShowForm(!showForm)}
              style={{ background: 'var(--accent-primary)', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '0.9rem' }}
            >
              {showForm ? 'Cancel' : '+ New'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreateGroup} style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <input
                type="text"
                placeholder="Group Name (e.g. Science_101)"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white' }}
                required
              />
              <p style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Select Students:</p>
              <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {students.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', cursor: 'pointer', padding: '4px' }}>
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(s.id)}
                      onChange={() => toggleStudentSelection(s.id)}
                      style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
                    />
                    {s.name || s.email}
                  </label>
                ))}
              </div>
              <button type="submit" style={{ width: '100%', padding: '10px', background: 'var(--success)', color: 'white', borderRadius: '8px', fontWeight: 'bold' }}>
                Save Group
              </button>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {groups.length === 0 && !showForm ? <p style={{ color: 'var(--text-secondary)' }}>No groups created yet.</p> : null}
            {groups.map(g => (
              <div key={g.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ marginBottom: '4px', fontSize: '1.1rem' }}>{g.name}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Students: {g.students?.length || 0}</p>
              </div>
            ))}
          </div>
        </div>

        {/* STUDENT DIRECTORY COLUMN */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ margin: 0 }}>👥 Student Directory</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '-10px 0 10px 0' }}>Click a student to view details.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto', paddingRight: '5px' }}>
            {students.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No students registered.</p> : null}
            {students.map(s => (
              <div
                key={s.id}
                onClick={() => handleStudentClick(s)}
                style={{
                  background: selectedStudentForDetails?.id === s.id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.03)',
                  padding: '16px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: selectedStudentForDetails?.id === s.id ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {(s.name || s.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0' }}>{s.name || 'Unnamed Student'}</h4>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{s.email}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* STUDENT DETAILS / REPORT COLUMN */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(0,0,0,0.2))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>📈 AI Performance Report</h3>
          </div>

          {!selectedStudentForDetails ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '10px' }}>📊</span>
              Select a student from the directory<br />to view their AI-generated statistics.
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'linear-gradient(135deg, #fbbf24, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(217, 119, 6, 0.4)' }}>
                  {(selectedStudentForDetails.name || selectedStudentForDetails.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.4rem' }}>{selectedStudentForDetails.name || selectedStudentForDetails.email}</h2>
                  <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>AI Scanned Profile</span>
                </div>
              </div>

              {loadingReport ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                  <div style={{ animation: 'spin 1s linear infinite', fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
                  Fetching AI Report...
                </div>
              ) : !studentReport ? (
                <div style={{ padding: '30px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', textAlign: 'center' }}>
                  No AI evaluation report generated for this student yet. Start a group session first!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--accent-primary)', padding: '15px', borderRadius: '12px', marginBottom: '10px' }}>
                    <h4 style={{ margin: '0 0 5px 0', color: 'var(--accent-primary)' }}>📅 Session Timeline</h4>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>
                      This student has participated in <strong>{studentReport.history?.length || 1}</strong> AI-analyzed sessions.
                      {studentReport.history?.length > 1 && " Showing growth from previous session."}
                    </p>
                  </div>
                  {Object.entries(studentReport).filter(([key]) => key === 'Measurable_Skills' || key === 'Future_Skills').map(([category, scores]) => (
                    <div key={category} style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }}></span>
                        {category.replace(/_/g, ' ')}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {Object.entries(scores).map(([skill, val]) => {
                          const isComingSoon = typeof val === 'string';
                          
                          // Calculate diff from previous session!
                          let diffLabel = null;
                          if (!isComingSoon && studentReport.history && studentReport.history.length > 1) {
                             const prevSession = studentReport.history[studentReport.history.length - 2];
                             const prevVal = prevSession[category]?.[skill];
                             if (typeof prevVal === 'number') {
                               const diff = val - prevVal;
                               if (diff > 0) diffLabel = <span style={{ color: '#34d399', fontSize: '0.8rem', marginLeft: '8px' }}>↑ {diff}% (Great Progress!)</span>;
                               else if (diff < 0) diffLabel = <span style={{ color: '#f87171', fontSize: '0.8rem', marginLeft: '8px' }}>↓ {Math.abs(diff)}% (Needs Focus)</span>;
                               else diffLabel = <span style={{ color: '#9ca3af', fontSize: '0.8rem', marginLeft: '8px' }}>— Consistent</span>;
                             }
                          }

                          return (
                            <div key={skill} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: isComingSoon ? '#6b7280' : '#e2e8f0' }}>
                                <span>{skill.replace(/_/g, ' ')} {diffLabel}</span>
                                <strong style={{ color: isComingSoon ? '#6b7280' : val >= 80 ? '#34d399' : val >= 60 ? '#fbbf24' : '#f87171' }}>
                                  {isComingSoon ? val : `${val}%`}
                                </strong>
                              </div>
                              <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                  width: isComingSoon ? '100%' : `${Math.min(100, Math.max(0, val))}%`, 
                                  height: '100%', 
                                  background: isComingSoon ? 'rgba(255,255,255,0.05)' : val >= 80 ? 'linear-gradient(90deg, #10b981, #34d399)' : val >= 60 ? 'linear-gradient(90deg, #d97706, #fbbf24)' : 'linear-gradient(90deg, #dc2626, #f87171)',
                                  borderRadius: '4px',
                                  transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

