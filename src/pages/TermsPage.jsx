import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getLearnedTerms } from '../services/dbService';
import { Link } from 'react-router-dom';

export default function TermsPage() {
  const { user } = useAuth();
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState(null);

  useEffect(() => {
    if (user?.uid) {
      loadTerms();
    }
  }, [user]);

  const loadTerms = async () => {
    try {
      const data = await getLearnedTerms(user.uid);
      setTerms(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '40px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <Link to="/student/dashboard" style={{ color: 'var(--accent-primary)', textDecoration: 'none', marginBottom: '10px', display: 'inline-block' }}>
              &larr; Back to Dashboard
            </Link>
            <h1 className="premium-gradient-text" style={{ margin: 0, fontSize: '3rem' }}>My Learned Terms</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Review the professional jargon you learned from the AI.</p>
          </div>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--accent-primary)', padding: '15px 30px', borderRadius: '30px', textAlign: 'center' }}>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{terms.length}</span>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Terms Mastered</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
        ) : terms.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '60px' }}>
            <span style={{ fontSize: '4rem' }}>📚</span>
            <h2>No terms learned yet!</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Join a collaborative group and start talking with SmartPeer to learn new jargon.</p>
          </div>
        ) : (
          <div>
            <h3 style={{ marginBottom: '20px', color: '#e2e8f0' }}>Flashcards (Click to flip)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
              {terms.map((t, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setActiveCard(activeCard === idx ? null : idx)}
                  style={{ 
                    height: '200px',
                    perspective: '1000px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    width: '100%',
                    height: '100%',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    transformStyle: 'preserve-3d',
                    transform: activeCard === idx ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    position: 'relative'
                  }}>
                    {/* FRONT OF CARD (TERM) */}
                    <div className="glass-panel" style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      backfaceVisibility: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(0,0,0,0.3))',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                    }}>
                      <h2 style={{ color: '#fff', fontSize: '1.5rem', textAlign: 'center', padding: '20px' }}>{t.term}</h2>
                    </div>

                    {/* BACK OF CARD (MEANING) */}
                    <div className="glass-panel" style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(0,0,0,0.3))',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      padding: '20px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.8rem', color: '#6ee7b7', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '1px' }}>Definition</div>
                      <p style={{ margin: 0, color: '#e2e8f0', fontSize: '1.1rem', lineHeight: '1.5' }}>{t.meaning}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
