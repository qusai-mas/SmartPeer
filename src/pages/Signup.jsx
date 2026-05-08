import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from '../styles/Auth.module.css';

export default function Signup() {
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await signup(email, password, role, otp);
      if (user.role === 'teacher') {
        navigate('/teacher/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.formCard} glass-panel`}>
        <div>
          <h1 className={`${styles.title} premium-gradient-text`}>Create Account</h1>
          <p className={styles.subtitle}>Join as a student or teacher</p>
        </div>

        <div className={styles.toggleContainer}>
          <button 
            className={`${styles.toggleBtn} ${role === 'student' ? styles.active : ''}`}
            onClick={() => { setRole('student'); setError(''); }}
            type="button"
          >
            Student
          </button>
          <button 
            className={`${styles.toggleBtn} ${role === 'teacher' ? styles.active : ''}`}
            onClick={() => { setRole('teacher'); setError(''); }}
            type="button"
          >
            Teacher
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Email</label>
            <input 
              type="email" 
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
              placeholder="you@example.com"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label className={styles.label}>Password</label>
            <input 
              type="password" 
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              placeholder="••••••••"
            />
          </div>

          {role === 'teacher' && (
            <div className={styles.inputGroup}>
              <label className={styles.label}>Teacher Secret Code (OTP)</label>
              <input 
                type="text" 
                className={styles.input}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required 
                placeholder="Enter secret code"
              />
            </div>
          )}

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className={styles.linkText}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
