import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStudentGroups, updateUserProfile, getLearnedTerms, getStudentFriends } from '../services/dbService';

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [terms, setTerms] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');

  useEffect(() => {
    if (user?.uid) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [gData, tData, fData] = await Promise.all([
        getStudentGroups(user.uid),
        getLearnedTerms(user.uid),
        getStudentFriends(user.uid)
      ]);
      setGroups(gData);
      setTerms(tData);
      setFriends(fData);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = (groupId) => {
    navigate(`/student/group/${groupId}`);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    await updateUserProfile(user.uid, editName);
    user.name = editName; // Optimistic update
    setIsEditing(false);
  };

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', fontSize: '1.5rem' }}>Loading your vibrant world...</div>;

  return (
    <div style={{ padding: '50px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '40px' }}>
      
      {/* HEADER ROW */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(90deg, rgba(244, 63, 94, 0.4), rgba(139, 92, 246, 0.4))', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #fce7f3, #fbcfe8)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: '900', boxShadow: '0 0 30px rgba(244, 63, 94, 0.5)' }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'S'}
          </div>
          <div>
            {isEditing ? (
              <div style={{ display: 'flex', gap: '15px' }}>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  style={{ padding: '12px 20px', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '1.4rem', fontWeight: 'bold' }}
                />
                <button onClick={handleSaveProfile} style={{ background: 'var(--success)', color: 'white', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold' }}>Save</button>
              </div>
            ) : (
              <>
                <h1 style={{ margin: 0, color: '#fff', textShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>{user?.name}</h1>
                <p style={{ color: '#fed7aa', margin: '8px 0 0 0', fontSize: '1.2rem', cursor: 'pointer', fontWeight: '600' }} onClick={() => setIsEditing(true)}>✎ Edit Profile</p>
              </>
            )}
          </div>
        </div>
        <button onClick={logout} style={{ padding: '12px 30px', background: 'rgba(255, 255, 255, 0.2)', color: '#fff', borderRadius: '12px', fontWeight: '800', fontSize: '1.2rem', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.4)' }}>
          Logout
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '40px' }}>
        
        {/* GROUPS COLUMN */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '30px', background: 'rgba(255, 255, 255, 0.15)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '2px solid rgba(255,255,255,0.2)', paddingBottom: '20px' }}>
            <span style={{ fontSize: '2.5rem' }}>🚀</span> My Active Groups
          </h2>
          
          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#fef08a', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', fontSize: '1.3rem', fontWeight: '500' }}>
              You haven't been added to any groups yet.<br/><br/>Wait for your teacher to invite you!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {groups.map(g => (
                <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.3)', transition: 'transform 0.3s, box-shadow 0.3s', cursor: 'pointer', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.3)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)' }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', color: '#fff' }}>{g.name}</h3>
                    <p style={{ color: '#e0e7ff', fontSize: '1.1rem', margin: 0, fontWeight: '500' }}>Session is Live</p>
                  </div>
                  <button 
                    onClick={() => handleJoin(g.id)}
                    style={{ background: 'var(--accent-primary)', color: 'white', padding: '14px 28px', borderRadius: '12px', fontWeight: '800', fontSize: '1.2rem', boxShadow: '0 4px 15px rgba(244, 63, 94, 0.5)' }}
                  >
                    Enter Room
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SIDEBAR: FRIENDS & TERMS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          
          <div className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <span style={{ fontSize: '4rem', marginBottom: '10px' }}>📚</span>
            <h2 style={{ margin: '0 0 10px 0' }}>Learned Terms</h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '20px' }}>Review the professional jargon you picked up from SmartPeer.</p>
            <button 
              onClick={() => navigate('/student/terms')}
              style={{ background: '#34d399', color: 'var(--bg-primary)', padding: '12px 24px', borderRadius: '30px', fontWeight: 'bold', fontSize: '1.2rem', width: '100%', border: 'none', cursor: 'pointer' }}
            >
              Study Flashcards ({terms.length})
            </button>
          </div>

          <div className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2))' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '24px' }}>
              <span style={{ fontSize: '2.5rem' }}>👋</span> My Friends
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {friends.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.7)' }}>No friends found in your groups.</p>
              ) : (
                friends.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.1)', padding: '12px 20px', borderRadius: '12px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399' }} />
                    <span style={{ fontSize: '1.3rem', fontWeight: '600' }}>{f.name || f.email}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
