import { useState, useEffect } from 'react';

export default function SmileyFace({ isListening = false, isTalking = false }) {
  // We no longer mock it with an interval! We use the real isTalking prop.


  return (
    <div style={{
      width: '200px',
      height: '200px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: isTalking ? '0 0 40px rgba(99, 102, 241, 0.6)' : '0 0 10px rgba(0,0,0,0.5)',
      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
      transform: isTalking ? 'scale(1.05)' : 'scale(1)'
    }}>
      <div style={{ display: 'flex', gap: '30px', marginBottom: '20px' }}>
        {/* Eyes */}
        <div style={{ width: '24px', height: '30px', background: 'white', borderRadius: '50%' }} />
        <div style={{ width: '24px', height: '30px', background: 'white', borderRadius: '50%' }} />
      </div>
      {/* Mouth */}
      <div style={{
        width: '60px',
        height: isTalking ? '40px' : '10px',
        background: 'white',
        borderRadius: isTalking ? '50% 50% 50% 50%' : '10px',
        transition: 'height 0.1s ease, border-radius 0.1s ease'
      }} />
    </div>
  );
}
