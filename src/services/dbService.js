import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, arrayUnion, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

// UNIVERSAL CHAT LOGIC (Discord style rooms)
export const listenToGroupMessages = (groupId, callback) => {
  const q = query(collection(db, `Groups/${groupId}/messages`), orderBy('timestamp', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(messages);
  });
};

export const sendGroupMessage = async (groupId, sender, text, isAI = false, base64Audio = null) => {
  const docRef = await addDoc(collection(db, `Groups/${groupId}/messages`), {
    sender,
    text,
    isAI,
    audio: base64Audio,
    timestamp: serverTimestamp()
  });
  return docRef.id;
};

export const updateGroupMessage = async (groupId, msgId, updateData) => {
  const docRef = doc(db, `Groups/${groupId}/messages`, msgId);
  await updateDoc(docRef, updateData);
};

// Helper to get all students from the general 'users' collection
export const getStudents = async () => {
  const q = query(collection(db, 'users'), where('role', '==', 'student'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Teacher creates a new group based on the new schema
export const createGroup = async (teacherId, groupName, studentIds) => {
  const groupId = groupName.replace(/\s+/g, '_'); 
  
  const groupRef = doc(db, 'Groups', groupId);
  await setDoc(groupRef, {
    students: studentIds, 
    name: groupName 
  });

  const teacherRef = doc(db, 'Teachers', teacherId);
  const teacherSnap = await getDoc(teacherRef);
  
  if (teacherSnap.exists()) {
    await updateDoc(teacherRef, {
      managed_groups: arrayUnion(groupId)
    });
  } else {
    await setDoc(teacherRef, {
      managed_groups: [groupId]
    });
  }

  return { id: groupId, name: groupName, students: studentIds };
};

export const getTeacherGroups = async (teacherId) => {
  const teacherRef = doc(db, 'Teachers', teacherId);
  const teacherSnap = await getDoc(teacherRef);
  
  if (!teacherSnap.exists()) return [];

  const managedGroups = teacherSnap.data().managed_groups || [];
  
  const groupDetails = await Promise.all(
    managedGroups.map(async (groupId) => {
      const gRef = doc(db, 'Groups', groupId);
      const gSnap = await getDoc(gRef);
      if (gSnap.exists()) {
        return { id: groupId, ...gSnap.data() };
      }
      return null;
    })
  );

  return groupDetails.filter(g => g !== null);
};

export const getStudentGroups = async (studentId) => {
  const q = query(collection(db, 'Groups'), where('students', 'array-contains', studentId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const createBlankReport = async (studentId) => {
  const reportRef = doc(db, 'Reports', studentId); 
  await setDoc(reportRef, {
    Measurable_Skills: {
      Teamwork: 0,
      Communication_Skills: 0,
      Resilience: 0
    },
    Future_Skills: {
      Problem_Solving: "COMING SOON",
      Independent_Learning: "COMING SOON",
      Leadership: "COMING SOON"
    }
  });
};

export const getStudentReport = async (studentId) => {
  const reportRef = doc(db, 'Reports', studentId);
  const snap = await getDoc(reportRef);
  if (snap.exists()) return snap.data();
  return null;
};

// Update multiple student reports from the AI's end-of-session JSON analysis
export const saveAIGroupReport = async (classmates, aiReportArray) => {
  if (!aiReportArray || !Array.isArray(aiReportArray)) return;

  await Promise.all(classmates.map(async (student) => {
    // Find the report for this student
    const studentName = student.name || student.email;
    const aiData = aiReportArray.find(r => r.studentName === studentName);
    
    if (aiData) {
      const reportRef = doc(db, 'Reports', student.id);
      const snap = await getDoc(reportRef);
      
      let history = [];
      if (snap.exists() && snap.data().history) {
        history = snap.data().history;
      }
      
      const newSession = {
        date: new Date().toISOString(),
        Measurable_Skills: aiData.Measurable_Skills || {
          Teamwork: 0,
          Communication_Skills: 0,
          Resilience: 0
        },
        Future_Skills: aiData.Future_Skills || {
          Problem_Solving: "COMING SOON",
          Independent_Learning: "COMING SOON",
          Leadership: "COMING SOON"
        }
      };
      
      history.push(newSession);

      await setDoc(reportRef, {
        ...newSession, // Keep latest fields at top level for easy access
        history: history // Save the entire historical array!
      });
    }
  }));
};

export const updateUserProfile = async (uid, newName) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { name: newName });
};

// --- NEW REAL DATA FETCHERS ---

// Fetch terms a student has learned
export const getLearnedTerms = async (studentId) => {
  const userRef = doc(db, 'users', studentId);
  const snap = await getDoc(userRef);
  if (snap.exists() && snap.data().learnedTerms) {
    return snap.data().learnedTerms;
  }
  return []; // Return empty array if no terms learned yet
};

// Mock the AI adding a learned term (can be called later when the AI detects a term)
export const addLearnedTerm = async (studentId, term, meaning) => {
  const userRef = doc(db, 'users', studentId);
  await updateDoc(userRef, {
    learnedTerms: arrayUnion({ id: Date.now(), term, meaning })
  });
};

// Fetch "Friends" (other students who share a group with this student)
export const getStudentFriends = async (studentId) => {
  const groups = await getStudentGroups(studentId);
  const friendIds = new Set();
  
  groups.forEach(g => {
    if (g.students) {
      g.students.forEach(id => {
        if (id !== studentId) friendIds.add(id);
      });
    }
  });

  // Fetch profiles for these friends
  const friendProfiles = await Promise.all(
    Array.from(friendIds).map(async (fId) => {
      const uSnap = await getDoc(doc(db, 'users', fId));
      if (uSnap.exists()) return { id: fId, ...uSnap.data() };
      return null;
    })
  );

  return friendProfiles.filter(f => f !== null);
};

// Fetch all members of a specific group (for the room)
export const getGroupMembers = async (groupId) => {
  const gRef = doc(db, 'Groups', groupId);
  const gSnap = await getDoc(gRef);
  if (!gSnap.exists()) return [];

  const studentIds = gSnap.data().students || [];
  
  const profiles = await Promise.all(
    studentIds.map(async (id) => {
      const uSnap = await getDoc(doc(db, 'users', id));
      if (uSnap.exists()) return { id, ...uSnap.data() };
      return null;
    })
  );

  return profiles.filter(p => p !== null);
};
