import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import SmileyFace from '../components/ai/SmileyFace';
import { useAuth } from '../context/AuthContext';
import { getLearnedTerms, getGroupMembers, addLearnedTerm, saveAIGroupReport, listenToGroupMessages, sendGroupMessage, updateGroupMessage } from '../services/dbService';
import { getAIResponse, resetAIHistory, generateSessionReport } from '../services/aiService';
import { transcribeAudioWithWhisper } from '../services/whisperService';

export default function StudentGroup() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [learnedTerms, setLearnedTerms] = useState([]);
  const [classmates, setClassmates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEndingSession, setIsEndingSession] = useState(false);

  // Audio / AI State
  const [isMicMuted, setIsMicMutedState] = useState(true);
  const isMicMutedRef = useRef(true);

  const setIsMicMuted = (val) => {
    isMicMutedRef.current = val;
    setIsMicMutedState(val);
  };

  const [isListening, setIsListening] = useState(false);
  const [aiStatusText, setAiStatusText] = useState("Click 'Connect Room Audio' below!");
  const [aiSubtitle, setAiSubtitle] = useState(""); 
  const [isAiSpeaking, setIsAiSpeaking] = useState(false); // REAL talking state
  const [chatLog, setChatLog] = useState([]); // NEW CHAT LOG STATE
  
  const synthRef = useRef(window.speechSynthesis);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isSpeakingRef = useRef(false);

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(1);

  const initialLoadDone = useRef(false);
  const processedMessageIds = useRef(new Set());

  useEffect(() => {
    let unsubscribe = () => {};
    if (user?.uid && groupId) {
      loadRoomData();
      
      const currentStudentName = user.name || user.email.split('@')[0];

      // Listen to universal group messages!
      unsubscribe = listenToGroupMessages(groupId, (messages) => {
        setChatLog(messages);
        
        if (!initialLoadDone.current) {
          // First load: just mark all existing history as processed so we don't read it all at once!
          messages.forEach(m => processedMessageIds.current.add(m.id));
          initialLoadDone.current = true;
          return;
        }

        // Live updates: Check for brand new messages
        messages.forEach(msg => {
          if (!processedMessageIds.current.has(msg.id)) {
            processedMessageIds.current.add(msg.id);
            
            // If someone ELSE spoke, or if the AI spoke, we want to hear it!
            if (msg.sender !== currentStudentName) {
               if (msg.isAI) {
                 speakText(msg.text);
               } else if (msg.audio) {
                 // It's a friend! Play their REAL recorded voice!
                 const audioClip = new Audio(msg.audio);
                 audioClip.play().catch(e => console.error("Could not play friend's audio", e));
               } else {
                 // Fallback if no audio
                 speakText(`${msg.sender} says: ${msg.text}`);
               }
            } else if (msg.isAI) {
               // Wait, the sender is 'SmartPeer', which is not currentStudentName.
               // So AI messages will always be spoken by the block above!
            }
          }
        });

      });
    }
    return () => {
      stopMic(); // Cleanup on unmount
      resetAIHistory(); 
      unsubscribe();
    };
  }, [user, groupId]);

  const loadRoomData = async () => {
    try {
      const [termsData, membersData] = await Promise.all([
        getLearnedTerms(user.uid),
        getGroupMembers(groupId)
      ]);
      setLearnedTerms(termsData);
      setClassmates(membersData);
    } catch (error) {
      console.error("Failed to load room data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (isEndingSession) return;
    setIsEndingSession(true);
    setAiStatusText("Generating Teacher Reports...");
    
    // Have Gemini generate the JSON analysis based on the chat history
    const reportJson = await generateSessionReport(classmates);
    
    // Save it to Firebase so the Teacher can see it
    if (reportJson) {
      await saveAIGroupReport(classmates, reportJson);
    }
    
    stopMic();
    navigate('/student/dashboard');
  };

  const speakText = (text) => {
    // Force TTS engine to wake up (fixes Chrome bug where it goes silent)
    window.speechSynthesis.resume();

    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }
    
    setAiSubtitle(text); // Show text on screen!
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceSpeed;
    utterance.pitch = 1.3; // Make the voice sound younger, friendlier, and more energetic (Gen-Z vibe)
    
    // Detect if text contains Hebrew
    const isHebrew = /[\u0590-\u05FF]/.test(text);
    const voices = synthRef.current.getVoices();
    
    if (isHebrew) {
       utterance.lang = "he-IL";
       const hebrewVoice = voices.find(v => v.lang === "he-IL" || v.lang.includes("he"));
       if (hebrewVoice) utterance.voice = hebrewVoice;
    } else {
       utterance.lang = "en-US";
       const englishVoice = voices.find(v => v.lang === "en-US" || v.name.includes("Google US English") || v.name.includes("Zira")) || voices.find(v => v.lang.startsWith("en"));
       if (englishVoice) utterance.voice = englishVoice;
    }

    utterance.onstart = () => { 
      isSpeakingRef.current = true; 
      setIsAiSpeaking(true);
    };
    
    // Prevent Chrome garbage collection bug where onend never fires!
    window.activeUtterances = window.activeUtterances || [];
    window.activeUtterances.push(utterance);

    utterance.onend = () => {
      isSpeakingRef.current = false;
      setIsAiSpeaking(false);
      setAiSubtitle(""); // Clear subtitle when done
      if (!isMicMuted) {
        setAiStatusText("Room Audio Live...");
      }
      window.activeUtterances = window.activeUtterances.filter(u => u !== utterance);
    };
    
    utterance.onerror = () => {
      isSpeakingRef.current = false;
      setIsAiSpeaking(false);
      setAiSubtitle("");
    };

    synthRef.current.speak(utterance);
  };

  const processAudioChunk = async (audioBlob) => {
    if (isSpeakingRef.current) return; // Ignore audio if AI is talking

    const studentName = user.name || user.email.split('@')[0];
    setAiStatusText("Syncing voice live...");

    // INSTANT AUDIO SYNC: Convert and upload before Whisper even starts!
    // This allows friends to hear you IMMEDIATELY.
    const base64Audio = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(audioBlob);
    });
    
    // Send message to Firebase with placeholder text but REAL audio.
    const msgId = await sendGroupMessage(groupId, studentName, "🎤 (Transcribing...)", false, base64Audio);

    setAiStatusText("Whisper is transcribing...");
    let transcript = await transcribeAudioWithWhisper(audioBlob);
    
    if (!transcript || transcript.trim() === "") {
      setAiStatusText("Room Audio Live...");
      await updateGroupMessage(groupId, msgId, { text: "(Mumbled something)" });
      return;
    }

    // Filter out common Whisper AI hallucinations that happen when the room is silent
    const hallucinations = ["thank you", "thanks for watching", "subscribe", "thank you.", "subscribe to my channel", "thanks."];
    const cleanTranscript = transcript.toLowerCase().trim();
    if (hallucinations.some(h => cleanTranscript.includes(h)) && cleanTranscript.length < 30) {
      setAiStatusText("Room Audio Live...");
      await updateGroupMessage(groupId, msgId, { text: "(Background noise)" });
      return;
    }

    console.log("Whisper Transcript:", transcript);
    setAiStatusText(`Heard: "${transcript}" (Thinking...)`);

    // Update the universal chat log with the actual transcribed text!
    await updateGroupMessage(groupId, msgId, { text: transcript });
    
    const aiResponse = await getAIResponse(`[Student ${studentName}]: ${transcript}`);

    // Obey the Silence Rule!
    if (aiResponse.includes("[SILENCE]")) {
      setAiStatusText("Room Audio Live...");
      return; // The AI has chosen not to interrupt the students!
    }

    // Parse for secret term tags [TERM: name | meaning]
    let spokenText = aiResponse;
    const termMatch = aiResponse.match(/\[TERM:\s*(.*?)\s*\|\s*(.*?)\]/);
    if (termMatch) {
      const term = termMatch[1].trim();
      const meaning = termMatch[2].trim();
      spokenText = aiResponse.replace(termMatch[0], '').trim(); 
      
      await addLearnedTerm(user.uid, term, meaning);
      loadRoomData(); 
    }
    
    // Add AI message to UNIVERSAL log
    await sendGroupMessage(groupId, 'SmartPeer', spokenText, true);

    setAiStatusText("Speaking...");
    // speakText(spokenText); // Handled dynamically by the Firebase listener so everyone hears it!
  };

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsMicMuted(false);
      setIsListening(true);
      setAiStatusText("Room Audio Live...");

      // Use the browser's built-in engine JUST as a Voice Activity Detector!
      // It perfectly detects when you stop speaking a sentence.
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const vad = new SpeechRecognition();
        vad.continuous = true;
        vad.interimResults = true;
        
        vad.onresult = (event) => {
          if (isMicMutedRef.current || isSpeakingRef.current) return;
          
          let interimTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
               // INCREASED DEBOUNCE: Wait a massive 5 seconds of total silence before cutting!
               if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
               
               // Let them know we heard the sentence but are waiting for them to continue
               setAiStatusText(`Hearing: "${event.results[i][0].transcript}" (Waiting for you to finish...)`);
               
               silenceTimerRef.current = setTimeout(() => {
                 if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                    mediaRecorderRef.current.stop(); 
                 }
               }, 5000); // 5 seconds of dead silence required!
            } else {
               interimTranscript += event.results[i][0].transcript;
               // If they start talking again, cancel the timer instantly!
               if (silenceTimerRef.current) {
                 clearTimeout(silenceTimerRef.current);
                 silenceTimerRef.current = null;
               }
            }
          }
          
          if (interimTranscript) {
             setAiStatusText(`Hearing: "${interimTranscript}..."`);
          }
        };

        vad.onerror = (e) => {
          console.error("VAD Error:", e.error);
        };

        // If the speech engine dies, instantly restart it!
        vad.onend = () => {
          if (!isMicMutedRef.current && streamRef.current) {
            try { vad.start(); } catch(e){}
          }
        };

        try { vad.start(); } catch(e){}
        audioContextRef.current = vad; // Store reference to stop it later
      }
      
      // FAILSAFE: Relaxed to 15 seconds. We only force a cut if they talk forever without pausing.
      setInterval(() => {
        if (!isMicMutedRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
      }, 15000);
      
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = []; 
        processAudioChunk(audioBlob);
        
        if (!isMicMutedRef.current && streamRef.current) {
          try { mediaRecorderRef.current.start(); } catch(e){}
        }
      };

      recorder.start();

    } catch (err) {
      console.error(err);
      alert("Microphone permission denied or unsupported format!");
    }
  };

  const stopMic = () => {
    setIsMicMuted(true);
    setIsListening(false);
    setAiStatusText("Microphone is off. (Emergency Mute)");
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    synthRef.current.cancel(); 
  };

  const toggleMic = () => {
    if (isMicMuted) startMic();
    else stopMic();
  };

  const handlePopOut = async () => {
    if ('documentPictureInPicture' in window) {
      try {
        const pipWindow = await window.documentPictureInPicture.requestWindow({ width: 350, height: 400 });
        const aiContainer = document.getElementById('ai-container');
        pipWindow.document.body.append(aiContainer);
        pipWindow.document.body.style.margin = "0";
        pipWindow.document.body.style.background = "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)";
        pipWindow.document.body.style.display = "flex";
        pipWindow.document.body.style.flexDirection = "column";
        pipWindow.document.body.style.justifyContent = "center";
        pipWindow.document.body.style.alignItems = "center";
        pipWindow.document.body.style.height = "100vh";
        pipWindow.document.body.style.overflow = "hidden";
        pipWindow.document.body.style.boxShadow = "inset 0 0 100px rgba(99, 102, 241, 0.2)";
        pipWindow.document.body.style.fontFamily = "'Inter', sans-serif";

        pipWindow.addEventListener("pagehide", () => {
          const originalContainer = document.getElementById('original-ai-wrapper');
          originalContainer.append(aiContainer);
        });
      } catch (err) {}
    } else {
      alert("Your browser does not support Document Picture-in-Picture.");
    }
  };

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', fontSize: '1.5rem' }}>Loading the AI Room...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      
      {/* Sidebar */}
      <div style={{ width: '400px', background: 'rgba(0,0,0,0.2)', padding: '30px', display: 'flex', flexDirection: 'column', gap: '30px', borderRight: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
        
        <div>
          <Link to="/student/dashboard" style={{ display: 'inline-block', marginBottom: '20px', fontSize: '1.1rem', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 'bold' }}>
            &larr; Back to Dashboard
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '2rem', color: '#fff' }}>Room: {groupId.replace(/_/g, ' ')}</h2>
            <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: 'white' }}>⚙️ Settings</button>
          </div>
        </div>

        <div className="glass-panel" style={{ flex: 1, overflowY: 'auto', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.1))', padding: '24px' }}>
          <h3 style={{ marginBottom: '20px', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>✨</span> Terms Detected
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {learnedTerms.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.6)' }}>Speak with the AI! It will detect terms you learn.</p>
            ) : (
              learnedTerms.map(t => (
                <div key={t.id} style={{ background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px' }}>
                  <strong style={{ color: '#fff', display: 'block', marginBottom: '8px', fontSize: '1.2rem' }}>{t.term}</strong>
                  <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{t.meaning}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))', padding: '24px' }}>
          <h3 style={{ marginBottom: '20px', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>👥</span> Classmates
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {classmates.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399' }} />
                <span style={{ fontSize: '1.1rem', fontWeight: '500' }}>{c.name || c.email} {c.id === user.uid ? '(You)' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
        
        {showSettings && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--bg-secondary)', padding: '40px', borderRadius: '16px', zIndex: 100, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', width: '400px' }}>
            <h2 style={{ marginBottom: '20px' }}>AI Settings</h2>
            
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>AI Voice Speed ({voiceSpeed}x)</label>
              <input type="range" min="0.5" max="1.5" step="0.1" value={voiceSpeed} onChange={e => setVoiceSpeed(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>

            <button onClick={() => setShowSettings(false)} style={{ width: '100%', padding: '12px', background: 'var(--accent-primary)', color: 'white', borderRadius: '8px', fontWeight: 'bold' }}>
              Save & Close
            </button>
          </div>
        )}
        
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 className="premium-gradient-text" style={{ fontSize: '4rem', marginBottom: '16px' }}>AI Companion</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.4rem', fontWeight: 'bold', height: '40px' }}>
            {aiStatusText}
          </p>
        </div>
        
        <div id="original-ai-wrapper" style={{ marginTop: '20px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div id="ai-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '600px', padding: '20px' }}>
            <SmileyFace isListening={isListening} isTalking={isAiSpeaking} />
            
            {/* Premium Subtitle Box (Now moves with PIP!) */}
            {aiSubtitle && (
              <div style={{ 
                marginTop: '40px', 
                background: 'rgba(255, 255, 255, 0.03)', 
                padding: '24px 40px', 
                borderRadius: '24px', 
                width: '100%',
                border: '1px solid rgba(255,255,255,0.1)',
                borderTop: '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 0 20px rgba(255,255,255,0.05)',
                animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
              }}>
                <p style={{ 
                  color: '#f8fafc', 
                  fontSize: '1.5rem', 
                  lineHeight: '1.6', 
                  textAlign: 'center', 
                  margin: 0,
                  fontWeight: '500',
                  textShadow: '0 2px 10px rgba(0,0,0,0.5)'
                }}>
                  "{aiSubtitle}"
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div style={{ marginTop: '60px', display: 'flex', gap: '20px' }}>
           {isMicMuted && (
             <button onClick={startMic} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', padding: '16px 32px', borderRadius: '30px', fontWeight: 'bold', fontSize: '1.2rem', border: '1px solid rgba(16, 185, 129, 0.5)', animation: 'pulse 2s infinite' }}>
               🎤 Click to Connect Room Audio
             </button>
           )}
           <button onClick={handlePopOut} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '16px 32px', borderRadius: '30px', fontWeight: 'bold', fontSize: '1.2rem', border: '1px solid rgba(255,255,255,0.2)' }}>
             ⛶ Pop Out Widget
           </button>
           <button 
             onClick={handleEndSession} 
             disabled={isEndingSession}
             style={{ 
               background: isEndingSession ? 'rgba(0,0,0,0.5)' : 'linear-gradient(135deg, #fbbf24, #d97706)', 
               color: 'white', 
               padding: '16px 32px', 
               borderRadius: '30px', 
               fontWeight: 'bold', 
               fontSize: '1.2rem', 
               border: 'none',
               cursor: isEndingSession ? 'wait' : 'pointer'
             }}>
             {isEndingSession ? 'Generating Report...' : '🛑 End Session & Grade'}
           </button>
        </div>
       </div>

       {/* Right Sidebar: Chat Log */}
       <div style={{ width: '400px', background: 'rgba(0,0,0,0.2)', padding: '30px', display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', overflowY: 'auto' }}>
         <h3 style={{ color: '#fff', fontSize: '1.4rem', borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginTop: 0 }}>💬 Live Transcript</h3>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
           {chatLog.length === 0 && <p style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>No messages yet. Start talking!</p>}
           
           {chatLog.map((msg, idx) => (
             <div key={idx} style={{ 
               display: 'flex', 
               flexDirection: 'column', 
               alignItems: msg.isAI ? 'flex-start' : 'flex-end' 
             }}>
               <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                 {msg.sender}
               </span>
               <div style={{
                 background: msg.isAI ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))' : 'rgba(255,255,255,0.1)',
                 border: msg.isAI ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.1)',
                 padding: '12px 16px',
                 borderRadius: msg.isAI ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                 maxWidth: '90%',
                 color: '#fff',
                 lineHeight: '1.4'
               }}>
                 {msg.text}
                 {msg.audio && (
                   <div style={{ marginTop: '10px' }}>
                     <audio controls src={msg.audio} style={{ width: '100%', height: '30px', outline: 'none' }} />
                   </div>
                 )}
               </div>
             </div>
           ))}
         </div>
       </div>

    </div>
  );
}
