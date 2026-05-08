import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { createBlankReport } from './dbService';

const TEACHER_OTP = import.meta.env.VITE_TEACHER_OTP || "hackathon123";

// Helper to fetch custom user data from Firestore
const fetchUserProfile = async (uid) => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { uid, ...docSnap.data() };
  }
  return null;
};

// Returns a promise that resolves with the current logged-in user profile
export const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe();
      if (firebaseUser) {
        try {
          const profile = await fetchUserProfile(firebaseUser.uid);
          resolve(profile);
        } catch (error) {
          reject(error);
        }
      } else {
        resolve(null);
      }
    }, reject);
  });
};

export const loginWithEmail = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await fetchUserProfile(userCredential.user.uid);
  
  if (!profile) {
    throw new Error("User profile not found in database.");
  }
  
  return profile;
};

export const signupUser = async (email, password, role, otp) => {
  if (role === 'teacher' && otp !== TEACHER_OTP) {
    throw new Error("Invalid Teacher OTP.");
  }

  // 1. Create the user in Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // 2. Create the user profile in Firestore
  const userProfile = {
    email: user.email,
    role: role,
    name: email.split('@')[0], // Default name
    createdAt: new Date().toISOString()
  };

  await setDoc(doc(db, 'users', user.uid), userProfile);

  // 3. Initialize a blank report if it's a student
  if (role === 'student') {
    await createBlankReport(user.uid);
  }

  return { uid: user.uid, ...userProfile };
};

export const logoutUser = async () => {
  await signOut(auth);
};
