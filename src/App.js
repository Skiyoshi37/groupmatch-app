import { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPhoneNumber, 
  RecaptchaVerifier, 
  PhoneAuthProvider,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  onSnapshot,
  limit
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  Heart, 
  Users, 
  MessageCircle, 
  Settings, 
  User, 
  ChevronLeft, 
  X, 
  Check,
  Camera,
  Plus,
  Clock,
  Vote,
  MapPin,
  Phone
} from 'lucide-react';
import './App.css';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDVAC0Y3ShrpNyu1WYOdxa34AJuA3jCY5w",
  authDomain: "groupmatch-55bda.firebaseapp.com",
  projectId: "groupmatch-55bda",
  storageBucket: "groupmatch-55bda.firebasestorage.app",
  messagingSenderId: "49208632571",
  appId: "1:49208632571:web:4a5a3432b6abaa5eaafc5e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

function App() {
  // Auth & User State
  const [user, setUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('auth');
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Teams State
  const [userTeams, setUserTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);
  
  // Voting State
  const [pendingVotes, setPendingVotes] = useState([]);
  const [matches, setMatches] = useState([]);

  // Load user data
  const loadUserData = useCallback(async (userId) => {
    try {
      // Load user profile
      const profileDoc = await getDoc(doc(db, 'users', userId));
      if (profileDoc.exists()) {
        const profile = { id: profileDoc.id, ...profileDoc.data() };
        setUserProfile(profile);
        
        // Load user's teams
        await loadUserTeams(userId);
        
        // Load pending votes
        await loadPendingVotes(userId);
        
        // Load matches
        await loadMatches(userId);
        
        setCurrentScreen(profile.profileComplete ? 'home' : 'profile-setup');
      } else {
        setCurrentScreen('profile-setup');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await loadUserData(user.uid);
      } else {
        setUser(null);
        setCurrentScreen('auth');
        setUserProfile(null);
        setUserTeams([]);
        setActiveTeam(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadUserData]);

  // Load user's teams
  const loadUserTeams = async (userId) => {
    try {
      const q = query(
        collection(db, 'teams'),
        where('members', 'array-contains', userId),
        where('active', '==', true)
      );
      const querySnapshot = await getDocs(q);
      const teams = [];
      querySnapshot.forEach((doc) => {
        teams.push({ id: doc.id, ...doc.data() });
      });
      setUserTeams(teams);
      
      // Set first team as active if none selected
      if (teams.length > 0 && !activeTeam) {
        setActiveTeam(teams[0]);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  // Load pending votes for user
  const loadPendingVotes = async (userId) => {
    try {
      const q = query(
        collection(db, 'votes'),
        where('targetTeamMembers', 'array-contains', userId),
        where('status', '==', 'pending'),
        where('expiresAt', '>', new Date())
      );
      const querySnapshot = await getDocs(q);
      const votes = [];
      querySnapshot.forEach((doc) => {
        votes.push({ id: doc.id, ...doc.data() });
      });
      setPendingVotes(votes);
    } catch (error) {
      console.error('Error loading pending votes:', error);
    }
  };

  // Load matches
  const loadMatches = async (userId) => {
    try {
      const q = query(
        collection(db, 'matches'),
        where('allMembers', 'array-contains', userId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const matchList = [];
      querySnapshot.forEach((doc) => {
        matchList.push({ id: doc.id, ...doc.data() });
      });
      setMatches(matchList);
    } catch (error) {
      console.error('Error loading matches:', error);
    }
  };

  // Auth Components
  const PhoneAuthScreen = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [step, setStep] = useState('phone'); // 'phone' or 'verify'
    const [isLoading, setIsLoading] = useState(false);

    const setupRecaptcha = () => {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            console.log('reCAPTCHA solved');
          }
        });
      }
    };

    const sendVerificationCode = async () => {
      if (!phoneNumber) return;
      
      // Format phone number to ensure it starts with +
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber.replace(/^\+/, '');
      
      // For development/testing purposes, check if this is a test number FIRST
      if (formattedPhone === '+15005550001' || formattedPhone === '+15005550006') {
        console.log('Using test phone number, simulating verification');
        setIsLoading(true);
        // Simulate loading delay
        setTimeout(() => {
          setVerificationId('test-verification-id');
          setStep('verify');
          setIsLoading(false);
        }, 1000);
        return;
      }
      
      setIsLoading(true);
      try {
        // Clean up any existing recaptcha
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        }
        
        setupRecaptcha();
        const appVerifier = window.recaptchaVerifier;
        
        console.log('Attempting to send verification to:', formattedPhone);
        console.log('Firebase Auth instance:', auth);
        console.log('ReCAPTCHA verifier:', appVerifier);
        
        const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
        console.log('Verification sent successfully:', confirmationResult);
        setVerificationId(confirmationResult.verificationId);
        setStep('verify');
      } catch (error) {
        console.error('Detailed error sending verification code:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        let errorMessage = 'Error sending verification code. ';
        
        if (error.code === 'auth/invalid-phone-number') {
          errorMessage += 'Please enter a valid phone number with country code (e.g., +1234567890).';
        } else if (error.code === 'auth/too-many-requests') {
          errorMessage += 'Too many requests. Please try again later.';
        } else if (error.code === 'auth/quota-exceeded') {
          errorMessage += 'SMS quota exceeded. Please try again later.';
        } else if (error.code === 'auth/operation-not-allowed') {
          errorMessage += 'Phone authentication is not enabled. For testing, try +15005550001';
        } else if (error.code === 'auth/captcha-check-failed') {
          errorMessage += 'ReCAPTCHA verification failed. Please try again.';
        } else {
          errorMessage += `Please check your phone number and try again. (Error: ${error.code})`;
        }
        
        alert(errorMessage);
      }
      setIsLoading(false);
    };

    const verifyCode = async () => {
      if (!verificationCode) return;
      
      setIsLoading(true);
      try {
        // Handle test verification
        if (verificationId === 'test-verification-id') {
          if (verificationCode === '123456' || verificationCode === '654321') {
            console.log('Test verification successful');
            setStep('phone'); // Reset for next time
            setIsLoading(false);
            setPhoneNumber('');
            setVerificationCode('');
            alert('Test verification successful! (In a real app, you would now be signed in)');
            return;
          } else {
            throw new Error('Invalid test code. Use 123456 or 654321 for testing.');
          }
        }
        
        const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
        await auth.signInWithCredential(credential);
        console.log('Real verification successful');
        setStep('phone'); // Reset for next time
      } catch (error) {
        console.error('Error verifying code:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        let errorMessage = 'Invalid verification code. ';
        if (error.code === 'auth/invalid-verification-code') {
          errorMessage += 'Please check the code and try again.';
        } else if (error.code === 'auth/code-expired') {
          errorMessage += 'The code has expired. Please request a new one.';
        } else if (error.message.includes('test code')) {
          errorMessage = error.message;
        } else {
          errorMessage += 'Please try again.';
        }
        
        alert(errorMessage);
      }
      setIsLoading(false);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-32 h-32 bg-white bg-opacity-10 rounded-full blur-xl"></div>
          <div className="absolute bottom-32 right-8 w-24 h-24 bg-white bg-opacity-10 rounded-full blur-lg"></div>
          <div className="absolute top-1/2 left-1/3 w-16 h-16 bg-white bg-opacity-5 rounded-full blur-md"></div>
        </div>
        <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-3xl border border-white border-opacity-20 p-8 w-full max-w-md relative z-10 shadow-2xl">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
              <Heart size={36} className="text-white" fill="currentColor" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Welcome to TeamUp</h1>
            <p className="text-white text-opacity-90 leading-relaxed mb-2">Connect your friend groups with other<br/>friend groups for amazing experiences</p>
            <div className="bg-white bg-opacity-10 rounded-lg p-3 text-xs text-white text-opacity-80">
              <p className="font-medium mb-1">🧪 Testing Mode</p>
              <p>Use <code className="bg-white bg-opacity-20 px-1 rounded">+15005550001</code> or <code className="bg-white bg-opacity-20 px-1 rounded">+15005550006</code></p>
              <p>Verification code: <code className="bg-white bg-opacity-20 px-1 rounded">123456</code></p>
            </div>
          </div>

          {step === 'phone' ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white text-opacity-90 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-opacity-60" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full pl-12 pr-4 py-4 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-2xl focus:ring-2 focus:ring-white focus:ring-opacity-50 focus:border-transparent text-white placeholder-white placeholder-opacity-60 text-lg"
                  />
                </div>
              </div>

              <button
                onClick={sendVerificationCode}
                disabled={isLoading || !phoneNumber}
                className="w-full bg-white bg-opacity-20 backdrop-blur-sm text-white py-4 rounded-2xl font-semibold hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-lg border border-white border-opacity-30 btn-press"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-opacity-30 border-t-white rounded-full animate-spin"></div>
                    <span>Sending...</span>
                  </div>
                ) : 'Send Verification Code'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white text-opacity-90 mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="123456"
                  className="w-full px-4 py-4 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-2xl focus:ring-2 focus:ring-white focus:ring-opacity-50 focus:border-transparent text-white placeholder-white placeholder-opacity-60 text-center text-lg tracking-widest"
                  maxLength={6}
                />
              </div>

              <button
                onClick={verifyCode}
                disabled={isLoading || !verificationCode}
                className="w-full bg-white bg-opacity-20 backdrop-blur-sm text-white py-4 rounded-2xl font-semibold hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-lg border border-white border-opacity-30 btn-press"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-opacity-30 border-t-white rounded-full animate-spin"></div>
                    <span>Verifying...</span>
                  </div>
                ) : 'Verify & Continue'}
              </button>

              <button
                onClick={() => setStep('phone')}
                className="w-full text-white text-opacity-80 py-3 text-center hover:text-opacity-100 font-medium transition-all duration-200"
              >
                ← Back to Phone Number
              </button>
            </div>
          )}

          <div id="recaptcha-container" className="mt-4"></div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Users size={32} className="text-white" />
          </div>
          <p className="text-gray-600">Loading TeamUp...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <PhoneAuthScreen />;
  }

  // Profile Setup Screen
  const ProfileSetupScreen = () => {
    const [step, setStep] = useState(1); // 1: basic info, 2: photos, 3: prompts
    const [formData, setFormData] = useState({
      firstName: '',
      age: '',
      bio: '',
      location: '',
      photos: [],
      prompts: [
        { question: "A perfect day for me is...", answer: '' },
        { question: "I'm looking for...", answer: '' },
        { question: "My ideal night out is...", answer: '' }
      ]
    });
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const availablePrompts = [
      "A perfect day for me is...",
      "I'm looking for...",
      "My ideal night out is...",
      "The way to my heart is...",
      "I'm overly competitive about...",
      "My greatest strength is...",
      "A random fact I love is...",
      "My simple pleasures...",
      "The dorkiest thing about me is...",
      "I want someone who...",
      "Together we could...",
      "I'm convinced that...",
      "Green flags I look for...",
      "Red flags for me are..."
    ];

    const handlePhotoUpload = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      if (formData.photos.length >= 6) {
        alert('Maximum 6 photos allowed');
        return;
      }

      setUploading(true);
      try {
        const storageRef = ref(storage, `profiles/${user.uid}/${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        setFormData(prev => ({
          ...prev,
          photos: [...prev.photos, downloadURL]
        }));
      } catch (error) {
        console.error('Error uploading photo:', error);
        alert('Error uploading photo');
      }
      setUploading(false);
    };

    const removePhoto = (index) => {
      setFormData(prev => ({
        ...prev,
        photos: prev.photos.filter((_, i) => i !== index)
      }));
    };

    const updatePrompt = (index, answer) => {
      setFormData(prev => ({
        ...prev,
        prompts: prev.prompts.map((prompt, i) => 
          i === index ? { ...prompt, answer } : prompt
        )
      }));
    };

    const changePromptQuestion = (index, question) => {
      setFormData(prev => ({
        ...prev,
        prompts: prev.prompts.map((prompt, i) => 
          i === index ? { question, answer: '' } : prompt
        )
      }));
    };

    const saveProfile = async () => {
      setSaving(true);
      try {
        const profileData = {
          ...formData,
          userId: user.uid,
          phone: user.phoneNumber,
          profileComplete: true,
          createdAt: serverTimestamp(),
          active: true,
          verified: false
        };

        await setDoc(doc(db, 'users', user.uid), profileData);
        setUserProfile({ id: user.uid, ...profileData });
        setCurrentScreen('home');
      } catch (error) {
        console.error('Error saving profile:', error);
        alert('Error saving profile');
      }
      setSaving(false);
    };

    const canProceedToNextStep = () => {
      if (step === 1) {
        return formData.firstName && formData.age && formData.location;
      }
      if (step === 2) {
        return formData.photos.length >= 3; // Minimum 3 photos required
      }
      if (step === 3) {
        return formData.prompts.every(p => p.answer.trim().length > 0);
      }
      return false;
    };

    const canSaveProfile = () => {
      return (
        formData.firstName &&
        formData.age &&
        formData.location &&
        formData.photos.length >= 3 &&
        formData.prompts.every(p => p.answer.trim().length > 0)
      );
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <h1 className="text-xl font-bold text-gray-900">Complete Profile</h1>
            <div className="flex space-x-2">
              {[1, 2, 3].map((s) => (
                <div 
                  key={s}
                  className={`w-3 h-3 rounded-full ${
                    s <= step ? 'bg-purple-600' : 'bg-gray-300'
                  }`} 
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="max-w-md mx-auto">
            {step === 1 && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h2 className="text-lg font-semibold mb-4">Tell us about yourself</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Your first name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Age
                      </label>
                      <input
                        type="number"
                        min="18"
                        max="99"
                        value={formData.age}
                        onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Your age"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location
                      </label>
                      <div className="relative">
                        <MapPin size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={formData.location}
                          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Chicago, IL"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bio (Optional)
                      </label>
                      <textarea
                        value={formData.bio}
                        onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent h-24 resize-none"
                        placeholder="Tell people a bit about yourself..."
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!canProceedToNextStep()}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next: Add Photos
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h2 className="text-lg font-semibold mb-4">Add Your Photos</h2>
                  <p className="text-gray-600 mb-6">Add 3-6 photos that show your personality. First photo will be your main photo.</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {[...Array(6)].map((_, index) => (
                      <div key={index} className="aspect-square">
                        {formData.photos[index] ? (
                          <div className="relative w-full h-full">
                            <img 
                              src={formData.photos[index]} 
                              alt="Profile"
                              className="w-full h-full object-cover rounded-lg"
                            />
                            <button
                              onClick={() => removePhoto(index)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                            >
                              ×
                            </button>
                            {index === 0 && (
                              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                                Main
                              </div>
                            )}
                          </div>
                        ) : (
                          <label className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-300 transition-colors">
                            <Camera size={24} className="text-gray-400 mb-2" />
                            <span className="text-sm text-gray-500">Add Photo</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              className="hidden"
                              disabled={uploading}
                            />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>

                  {uploading && (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                      <p className="text-gray-600 mt-2">Uploading photo...</p>
                    </div>
                  )}

                  <p className="text-sm text-gray-500 text-center">
                    {formData.photos.length} of 6 photos • Minimum 3 required
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 bg-gray-200 text-gray-800 py-4 rounded-xl font-semibold"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!canProceedToNextStep()}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next: Prompts
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h2 className="text-lg font-semibold mb-4">Answer Some Prompts</h2>
                  <p className="text-gray-600 mb-6">Help others get to know you better with thoughtful answers.</p>
                  
                  <div className="space-y-6">
                    {formData.prompts.map((prompt, index) => (
                      <div key={index} className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Prompt {index + 1}
                          </label>
                          <select
                            value={prompt.question}
                            onChange={(e) => changePromptQuestion(index, e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            {availablePrompts.map((q) => (
                              <option key={q} value={q}>{q}</option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          value={prompt.answer}
                          onChange={(e) => updatePrompt(index, e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent h-20 resize-none"
                          placeholder="Your answer here..."
                          maxLength={150}
                        />
                        <div className="text-right text-xs text-gray-400">
                          {prompt.answer.length}/150
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 bg-gray-200 text-gray-800 py-4 rounded-xl font-semibold"
                  >
                    Back
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={!canSaveProfile() || saving}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Creating Profile...' : 'Complete Profile'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Team Creation Screen
  const CreateTeamScreen = () => {
    const [teamName, setTeamName] = useState('');
    const [lookingFor, setLookingFor] = useState('2-3'); // Size preference
    const [interests, setInterests] = useState([]);
    const [invites, setInvites] = useState([{ value: '', type: 'phone' }]); // phone, email, username
    const [creating, setCreating] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [createdTeamId, setCreatedTeamId] = useState(null);

    const availableInterests = [
      'Nightlife', 'Bars & Drinks', 'Dining Out', 'Live Music', 'Dancing',
      'Sports Events', 'Outdoor Activities', 'Beach Day', 'Movies', 'Theater',
      'Art & Culture', 'Shopping', 'Coffee Dates', 'Game Night', 'Karaoke',
      'Food Tours', 'Festivals', 'House Parties', 'Wine Tasting', 'Comedy Shows'
    ];

    const addInvite = () => {
      setInvites([...invites, { value: '', type: 'phone' }]);
    };

    const removeInvite = (index) => {
      setInvites(invites.filter((_, i) => i !== index));
    };

    const updateInvite = (index, field, value) => {
      setInvites(invites.map((invite, i) => 
        i === index ? { ...invite, [field]: value } : invite
      ));
    };

    const toggleInterest = (interest) => {
      setInterests(prev => 
        prev.includes(interest) 
          ? prev.filter(i => i !== interest)
          : [...prev, interest]
      );
    };

    const createTeam = async () => {
      if (!teamName.trim() || !lookingFor) return;

      setCreating(true);
      try {
        const validInvites = invites.filter(invite => invite.value.trim());
        
        const teamData = {
          name: teamName,
          creator: user.uid,
          members: [user.uid], // Creator is always a member
          pendingInvites: validInvites,
          lookingFor,
          interests,
          active: true,
          preferences: {
            ageRange: { min: 18, max: 35 }, // Default, can be customized later
            distance: 25 // Default distance in miles
          },
          createdAt: serverTimestamp(),
          teamPhotos: [] // Optional team photos
        };

        const docRef = await addDoc(collection(db, 'teams'), teamData);
        
        // Send invitations (we'll implement this later with notifications)
        for (const invite of validInvites) {
          await addDoc(collection(db, 'invitations'), {
            teamId: docRef.id,
            teamName,
            inviterName: userProfile?.firstName || 'Someone',
            inviterPhone: user.phoneNumber,
            inviteeValue: invite.value,
            inviteeType: invite.type,
            status: 'pending',
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          });
        }

        // Reload user teams
        await loadUserTeams(user.uid);
        
        // Show success and share options
        setCreatedTeamId(docRef.id);
        setShowShareModal(true);
      } catch (error) {
        console.error('Error creating team:', error);
        alert('Error creating team');
      }
      setCreating(false);
    };

    const canCreateTeam = () => {
      return teamName.trim() && lookingFor;
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button
              onClick={() => setCurrentScreen('home')}
              className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Create Team</h1>
            <div className="w-8 h-8"></div> {/* Spacer */}
          </div>
        </div>

        <div className="p-4">
          <div className="max-w-md mx-auto space-y-6">
            {/* Team Name */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Team Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team Name
                  </label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="The Squad, Weekend Warriors, etc."
                    maxLength={50}
                  />
                  <p className="text-xs text-gray-500 mt-1">{teamName.length}/50 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Looking For
                  </label>
                  <select
                    value={lookingFor}
                    onChange={(e) => setLookingFor(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select group size</option>
                    <option value="1">1 person</option>
                    <option value="2">2 people</option>
                    <option value="2-3">2-3 people</option>
                    <option value="3-4">3-4 people</option>
                    <option value="4-5">4-5 people</option>
                    <option value="5+">5+ people</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Interests */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">What are you into?</h2>
              <p className="text-gray-600 mb-4">Select activities your team enjoys</p>
              
              <div className="flex flex-wrap gap-2">
                {availableInterests.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-2 rounded-full text-sm transition-colors ${
                      interests.includes(interest)
                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            {/* Invite Friends */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Invite Friends</h2>
              <p className="text-gray-600 mb-4">Add your friends to this team</p>
              
              <div className="space-y-3">
                {invites.map((invite, index) => (
                  <div key={index} className="flex space-x-2">
                    <select
                      value={invite.type}
                      onChange={(e) => updateInvite(index, 'type', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="phone">📱 Phone</option>
                      <option value="email">✉️ Email</option>
                      <option value="username">👤 Username</option>
                    </select>
                    <input
                      type={invite.type === 'email' ? 'email' : 'text'}
                      value={invite.value}
                      onChange={(e) => updateInvite(index, 'value', e.target.value)}
                      placeholder={
                        invite.type === 'phone' ? '+1 (555) 123-4567' :
                        invite.type === 'email' ? 'friend@email.com' :
                        '@username'
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    {invites.length > 1 && (
                      <button
                        onClick={() => removeInvite(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                
                <button
                  onClick={addInvite}
                  className="flex items-center space-x-2 text-purple-600 hover:text-purple-700"
                >
                  <Plus size={16} />
                  <span>Add another friend</span>
                </button>
              </div>
            </div>

            {/* Team Photo (Optional) */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Team Photo (Optional)</h2>
              <p className="text-gray-600 mb-4">Add a fun group photo to represent your team</p>
              
              <label className="block w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-300 transition-colors">
                <Camera size={32} className="text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Tap to add team photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  // We'll implement photo upload for teams later
                />
              </label>
            </div>

            {/* Create Button */}
            <button
              onClick={createTeam}
              disabled={!canCreateTeam() || creating}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating Team...' : 'Create Team & Send Invites'}
            </button>

            <p className="text-xs text-gray-500 text-center px-4">
              Your friends will receive an invitation to join your team. They'll need to download TeamUp and accept your invitation.
            </p>

            {/* Success Modal with Share Options */}
            {showShareModal && createdTeamId && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check size={32} className="text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Team Created!</h2>
                    <p className="text-gray-600">"{teamName}" is ready to start discovering other teams.</p>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => setCurrentScreen('home')}
                      className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold"
                    >
                      Start Discovering Teams
                    </button>
                    
                    <button
                      onClick={() => setShowShareModal(false)}
                      className="w-full bg-purple-50 text-purple-600 py-3 rounded-lg font-semibold"
                    >
                      Invite More Friends Later
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const HomeScreen = () => (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
              <Users size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">TeamUp</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            {pendingVotes.length > 0 && (
              <button 
                onClick={() => setCurrentScreen('voting')}
                className="relative p-2 text-purple-600 hover:bg-purple-50 rounded-full"
              >
                <Vote size={20} />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingVotes.length}
                </span>
              </button>
            )}
            
            <button 
              onClick={() => setCurrentScreen('settings')}
              className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="p-4">
        <div className="max-w-md mx-auto space-y-6">
          {/* Team Selector */}
          {userTeams.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-3">Your Teams</h2>
              <div className="space-y-2">
                {userTeams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => setActiveTeam(team)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      activeTeam?.id === team.id 
                        ? 'bg-purple-50 border-2 border-purple-200' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{team.name}</p>
                        <p className="text-sm text-gray-600">{team.members.length} members</p>
                      </div>
                      <Users size={16} className="text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setCurrentScreen('discover')}
              disabled={!activeTeam}
              className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-6 rounded-xl text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Heart size={32} className="mx-auto mb-2" />
              <p className="font-semibold">Discover Teams</p>
            </button>

            <button
              onClick={() => setCurrentScreen('create-team')}
              className="bg-white border-2 border-dashed border-gray-300 text-gray-600 p-6 rounded-xl text-center hover:border-purple-300 hover:text-purple-600 transition-colors"
            >
              <Plus size={32} className="mx-auto mb-2" />
              <p className="font-semibold">Create Team</p>
            </button>
          </div>

          {/* Recent Matches */}
          {matches.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-3">Recent Matches</h2>
              <div className="space-y-3">
                {matches.slice(0, 3).map((match) => (
                  <button
                    key={match.id}
                    onClick={() => setCurrentScreen('chat')}
                    className="w-full p-3 bg-green-50 rounded-lg text-left hover:bg-green-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">New Match!</p>
                        <p className="text-sm text-gray-600">Tap to start chatting</p>
                      </div>
                      <MessageCircle size={16} className="text-green-600" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Team Discovery Screen
  const TeamDiscoveryScreen = () => {
    const [discoverableTeams, setDiscoverableTeams] = useState([]);
    const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    const loadDiscoverableTeams = useCallback(async () => {
      if (!activeTeam) return;

      setLoading(true);
      try {
        // Get user preferences for filtering
        let userPreferences = { ageRange: { min: 18, max: 35 }, distance: 25 };
        if (userProfile?.preferences) {
          userPreferences = { ...userPreferences, ...userProfile.preferences };
        }

        // Query teams that match basic preferences
        const q = query(
          collection(db, 'teams'),
          where('active', '==', true),
          limit(50) // Get more teams for better filtering
        );
        
        const querySnapshot = await getDocs(q);
        const teams = [];
        
        for (const docSnapshot of querySnapshot.docs) {
          const teamData = { id: docSnapshot.id, ...docSnapshot.data() };
          
          // Exclude our own team
          if (teamData.id !== activeTeam.id) {
            const memberProfiles = [];
            let teamPassesFilters = true;
            
            // Get member profiles and apply filters
            for (const memberId of teamData.members) {
              const memberDoc = await getDoc(doc(db, 'users', memberId));
              if (memberDoc.exists()) {
                const memberData = { id: memberId, ...memberDoc.data() };
                memberProfiles.push(memberData);
                
                // Age filter
                const age = parseInt(memberData.age);
                if (age < userPreferences.ageRange.min || age > userPreferences.ageRange.max) {
                  teamPassesFilters = false;
                }
                
                // Location/distance filter (if both users have location data)
                if (userProfile?.location && memberData.location && userPreferences.distance) {
                  const distance = calculateDistance(
                    userProfile.location.latitude,
                    userProfile.location.longitude,
                    memberData.location.latitude,
                    memberData.location.longitude
                  );
                  
                  if (distance > userPreferences.distance) {
                    teamPassesFilters = false;
                  }
                }
              }
            }
            
            // Group size compatibility
            const isCompatibleSize = isGroupSizeCompatible(activeTeam.lookingFor, teamData.lookingFor);
            
            if (teamPassesFilters && isCompatibleSize && memberProfiles.length > 0) {
              teams.push({ ...teamData, memberProfiles });
            }
          }
        }
        
        // Shuffle teams for variety
        const shuffledTeams = teams.sort(() => Math.random() - 0.5);
        setDiscoverableTeams(shuffledTeams);
      } catch (error) {
        console.error('Error loading teams:', error);
      }
      setLoading(false);
    }, [activeTeam, userProfile]);

    // Helper function to calculate distance between two coordinates
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 3959; // Radius of the Earth in miles
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c; // Distance in miles
    };

    // Helper function to check group size compatibility
    const isGroupSizeCompatible = (lookingFor1, lookingFor2) => {
      // Simple compatibility check - you could make this more sophisticated
      const sizes1 = parseSizeRange(lookingFor1);
      const sizes2 = parseSizeRange(lookingFor2);
      
      // Check if there's overlap in acceptable ranges
      return sizes1.some(size => sizes2.includes(size));
    };

    const parseSizeRange = (sizeString) => {
      switch(sizeString) {
        case '1': return [1];
        case '2': return [2];
        case '2-3': return [2, 3];
        case '3-4': return [3, 4];
        case '4-5': return [4, 5];
        case '5+': return [5, 6, 7, 8];
        default: return [2, 3]; // Default fallback
      }
    };

    useEffect(() => {
      loadDiscoverableTeams();
    }, [loadDiscoverableTeams]);

    const handleSwipe = async (action) => {
      const currentTeam = discoverableTeams[currentTeamIndex];
      if (!currentTeam || !activeTeam) return;

      if (action === 'like') {
        try {
          // Create a "like" record
          await addDoc(collection(db, 'likes'), {
            fromTeamId: activeTeam.id,
            toTeamId: currentTeam.id,
            fromTeamMembers: activeTeam.members,
            toTeamMembers: currentTeam.members,
            createdAt: serverTimestamp()
          });

          // Check if they also liked us (mutual like)
          const mutualLikeQuery = query(
            collection(db, 'likes'),
            where('fromTeamId', '==', currentTeam.id),
            where('toTeamId', '==', activeTeam.id)
          );
          
          const mutualLikes = await getDocs(mutualLikeQuery);
          
          if (!mutualLikes.empty) {
            // It's a mutual like! Start the voting process
            await createVotingSession(activeTeam, currentTeam);
            alert('🎉 Mutual interest! Starting 24-hour voting period for both teams.');
          }
        } catch (error) {
          console.error('Error handling like:', error);
        }
      }

      // Move to next team
      if (currentTeamIndex < discoverableTeams.length - 1) {
        setCurrentTeamIndex(prev => prev + 1);
      } else {
        // No more teams, reload
        setCurrentTeamIndex(0);
        loadDiscoverableTeams();
      }
    };

    const createVotingSession = async (team1, team2) => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Create vote for team1
      await addDoc(collection(db, 'votes'), {
        teamId: team1.id,
        targetTeamId: team2.id,
        targetTeamMembers: team2.members,
        teamMembers: team1.members,
        votes: {}, // Will store userId: 'yes'|'no'
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt
      });

      // Create vote for team2
      await addDoc(collection(db, 'votes'), {
        teamId: team2.id,
        targetTeamId: team1.id,
        targetTeamMembers: team1.members,
        teamMembers: team2.members,
        votes: {},
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt
      });
    };

    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Finding teams for you...</p>
          </div>
        </div>
      );
    }

    const currentTeam = discoverableTeams[currentTeamIndex];

    if (!currentTeam) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
          <div className="bg-white border-b border-gray-200 px-4 py-4">
            <div className="flex items-center justify-between max-w-md mx-auto">
              <button
                onClick={() => setCurrentScreen('home')}
                className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"
              >
                <ChevronLeft size={20} />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Discover Teams</h1>
              <div className="w-8 h-8"></div>
            </div>
          </div>
          
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Heart size={48} className="mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">No more teams!</h2>
              <p className="text-gray-600 mb-6">Check back later for more teams to discover.</p>
              <button
                onClick={() => setCurrentScreen('home')}
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button
              onClick={() => setCurrentScreen('home')}
              className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900">Discover Teams</h1>
              <p className="text-xs text-gray-500">{currentTeamIndex + 1} of {discoverableTeams.length}</p>
            </div>
            <button
              onClick={() => setCurrentScreen('filters')}
              className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"
              title="Filters"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="max-w-md mx-auto">
            {/* Team Card */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
              {/* Team Header */}
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 text-center">
                <h2 className="text-2xl font-bold mb-2">{currentTeam.name}</h2>
                <p className="text-purple-100">Looking for {currentTeam.lookingFor} people</p>
                {currentTeam.interests.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    {currentTeam.interests.slice(0, 3).map((interest) => (
                      <span
                        key={interest}
                        className="bg-white bg-opacity-20 text-white text-xs px-2 py-1 rounded-full"
                      >
                        {interest}
                      </span>
                    ))}
                    {currentTeam.interests.length > 3 && (
                      <span className="bg-white bg-opacity-20 text-white text-xs px-2 py-1 rounded-full">
                        +{currentTeam.interests.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Team Members */}
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Team Members</h3>
                <div className="space-y-4">
                  {currentTeam.memberProfiles.map((member) => (
                    <div key={member.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200">
                        {member.photos?.[0] ? (
                          <img 
                            src={member.photos[0]} 
                            alt={member.firstName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User size={24} className="text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{member.firstName}, {member.age}</h4>
                        <p className="text-sm text-gray-600">{member.location}</p>
                        {member.prompts?.[0]?.answer && (
                          <p className="text-sm text-gray-700 mt-1 italic">"{member.prompts[0].answer}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center space-x-8">
              <button
                onClick={() => handleSwipe('pass')}
                className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
              
              <button
                onClick={() => handleSwipe('like')}
                className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center hover:from-pink-600 hover:to-purple-700 transition-colors shadow-lg"
              >
                <Heart size={24} className="text-white" />
              </button>
            </div>

            <p className="text-center text-sm text-gray-500 mt-4">
              Tap ❤️ to like or ✗ to pass
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Voting Screen
  const VotingScreen = () => {
    const [votes, setVotes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      loadVotes();
    }, []);

    const loadVotes = async () => {
      if (!user) return;

      try {
        const q = query(
          collection(db, 'votes'),
          where('teamMembers', 'array-contains', user.uid),
          where('status', '==', 'pending'),
          orderBy('expiresAt', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        const votesList = [];
        
        for (const docSnapshot of querySnapshot.docs) {
          const voteData = { id: docSnapshot.id, ...docSnapshot.data() };
          
          // Get target team details
          const targetTeamDoc = await getDoc(doc(db, 'teams', voteData.targetTeamId));
          if (targetTeamDoc.exists()) {
            const targetTeam = { id: targetTeamDoc.id, ...targetTeamDoc.data() };
            
            // Get target team member profiles
            const memberProfiles = [];
            for (const memberId of voteData.targetTeamMembers) {
              const memberDoc = await getDoc(doc(db, 'users', memberId));
              if (memberDoc.exists()) {
                memberProfiles.push({ id: memberId, ...memberDoc.data() });
              }
            }
            
            votesList.push({
              ...voteData,
              targetTeam: { ...targetTeam, memberProfiles }
            });
          }
        }
        
        setVotes(votesList);
      } catch (error) {
        console.error('Error loading votes:', error);
      }
      setLoading(false);
    };

    const castVote = async (voteId, decision) => {
      try {
        const voteRef = doc(db, 'votes', voteId);
        const voteDoc = await getDoc(voteRef);
        
        if (voteDoc.exists()) {
          const voteData = voteDoc.data();
          const updatedVotes = { ...voteData.votes, [user.uid]: decision };
          
          await updateDoc(voteRef, {
            votes: updatedVotes
          });

          // Check if all team members have voted
          const allVoted = voteData.teamMembers.every(memberId => 
            updatedVotes[memberId] !== undefined
          );

          if (allVoted) {
            // Calculate result
            const yesVotes = Object.values(updatedVotes).filter(v => v === 'yes').length;
            const totalVotes = Object.values(updatedVotes).length;
            const approved = yesVotes > totalVotes / 2; // Majority rule

            await updateDoc(voteRef, {
              status: approved ? 'approved' : 'rejected',
              finalResult: approved ? 'approved' : 'rejected',
              completedAt: serverTimestamp()
            });

            // If approved, check if the other team also approved
            if (approved) {
              await checkForMatch(voteData);
            }
          }

          // Reload votes
          loadVotes();
        }
      } catch (error) {
        console.error('Error casting vote:', error);
        alert('Error submitting vote');
      }
    };

    const checkForMatch = async (voteData) => {
      try {
        // Find the corresponding vote from the other team
        const otherVoteQuery = query(
          collection(db, 'votes'),
          where('teamId', '==', voteData.targetTeamId),
          where('targetTeamId', '==', voteData.teamId)
        );
        
        const otherVoteSnapshot = await getDocs(otherVoteQuery);
        
        if (!otherVoteSnapshot.empty) {
          const otherVote = otherVoteSnapshot.docs[0].data();
          
          if (otherVote.status === 'approved') {
            // Both teams approved! Create a match
            await createMatch(voteData.teamId, voteData.targetTeamId);
          }
        }
      } catch (error) {
        console.error('Error checking for match:', error);
      }
    };

    const createMatch = async (teamId1, teamId2) => {
      try {
        // Get both teams
        const team1Doc = await getDoc(doc(db, 'teams', teamId1));
        const team2Doc = await getDoc(doc(db, 'teams', teamId2));
        
        if (team1Doc.exists() && team2Doc.exists()) {
          const team1Data = team1Doc.data();
          const team2Data = team2Doc.data();
          
          const matchData = {
            team1Id: teamId1,
            team2Id: teamId2,
            team1Name: team1Data.name,
            team2Name: team2Data.name,
            team1Members: team1Data.members,
            team2Members: team2Data.members,
            allMembers: [...team1Data.members, ...team2Data.members],
            status: 'active',
            createdAt: serverTimestamp(),
            lastActivity: serverTimestamp()
          };

          await addDoc(collection(db, 'matches'), matchData);
          
          // Update matches for current user
          await loadMatches(user.uid);
          
          alert('🎉 IT\'S A MATCH! Both teams voted yes. You can now start chatting!');
        }
      } catch (error) {
        console.error('Error creating match:', error);
      }
    };

    const getTimeRemaining = (expiresAt) => {
      const now = new Date();
      const expires = expiresAt.toDate();
      const diff = expires.getTime() - now.getTime();
      
      if (diff <= 0) return 'Expired';
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      return `${hours}h ${minutes}m left`;
    };

    const getVoteStatus = (vote) => {
      const userVote = vote.votes[user.uid];
      const totalMembers = vote.teamMembers.length;
      const votedCount = Object.keys(vote.votes).length;
      
      return {
        userVoted: userVote !== undefined,
        userVote,
        votedCount,
        totalMembers,
        allVoted: votedCount === totalMembers
      };
    };

    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading votes...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button
              onClick={() => setCurrentScreen('home')}
              className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Team Votes</h1>
            <div className="w-8 h-8"></div>
          </div>
        </div>

        <div className="p-4">
          <div className="max-w-md mx-auto space-y-6">
            {votes.length === 0 ? (
              <div className="text-center py-12">
                <Vote size={48} className="mx-auto mb-4 text-gray-400" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">No votes pending</h2>
                <p className="text-gray-600">When your team gets mutual likes, you'll vote here!</p>
                <button
                  onClick={() => setCurrentScreen('home')}
                  className="mt-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Back to Home
                </button>
              </div>
            ) : (
              votes.map((vote) => {
                const status = getVoteStatus(vote);
                const timeLeft = getTimeRemaining(vote.expiresAt);
                
                return (
                  <div key={vote.id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold">Team Vote</h3>
                          <p className="text-orange-100">Match with {vote.targetTeam.name}?</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center text-orange-100">
                            <Clock size={16} className="mr-1" />
                            <span className="text-sm">{timeLeft}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vote Status */}
                    <div className="p-4 bg-gray-50 border-b">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          Votes: {status.votedCount}/{status.totalMembers}
                        </span>
                        <div className="flex space-x-1">
                          {vote.teamMembers.map((memberId) => (
                            <div
                              key={memberId}
                              className={`w-3 h-3 rounded-full ${
                                vote.votes[memberId] === 'yes' ? 'bg-green-500' :
                                vote.votes[memberId] === 'no' ? 'bg-red-500' :
                                'bg-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Target Team */}
                    <div className="p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">
                        {vote.targetTeam.name} ({vote.targetTeam.lookingFor} people)
                      </h4>
                      
                      <div className="space-y-3 mb-4">
                        {vote.targetTeam.memberProfiles.map((member) => (
                          <div key={member.id} className="flex items-center space-x-3">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
                              {member.photos?.[0] ? (
                                <img 
                                  src={member.photos[0]} 
                                  alt={member.firstName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <User size={16} className="text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{member.firstName}, {member.age}</p>
                              <p className="text-sm text-gray-600">{member.location}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Voting Buttons */}
                      {!status.userVoted && timeLeft !== 'Expired' ? (
                        <div className="flex space-x-4">
                          <button
                            onClick={() => castVote(vote.id, 'no')}
                            className="flex-1 bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors"
                          >
                            Vote No
                          </button>
                          <button
                            onClick={() => castVote(vote.id, 'yes')}
                            className="flex-1 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors"
                          >
                            Vote Yes
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          {status.userVoted && (
                            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
                              status.userVote === 'yes' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              <Check size={16} className="mr-1" />
                              You voted {status.userVote === 'yes' ? 'Yes' : 'No'}
                            </div>
                          )}
                          {timeLeft === 'Expired' && (
                            <div className="text-red-600 font-semibold">Vote expired</div>
                          )}
                        </div>
                      )}

                      {status.allVoted && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg text-center">
                          <p className="text-blue-800 font-semibold">
                            All team members have voted! Waiting for the other team...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  // Basic Group Chat Screen
  const GroupChatScreen = () => {
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      loadMatches(user.uid);
      setLoading(false);
    }, []);

    useEffect(() => {
      if (selectedMatch) {
        loadMessages(selectedMatch.id);
        
        // Set up real-time listener for messages
        const messagesRef = collection(db, 'matches', selectedMatch.id, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const messages = [];
          snapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...doc.data() });
          });
          setChatMessages(messages.reverse()); // Show oldest first
        });

        return () => unsubscribe();
      }
    }, [selectedMatch]);

    const loadMessages = async (matchId) => {
      try {
        const messagesRef = collection(db, 'matches', matchId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        
        const messages = [];
        snapshot.forEach((doc) => {
          messages.push({ id: doc.id, ...doc.data() });
        });
        
        setChatMessages(messages.reverse());
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    const sendMessage = async () => {
      if (!newMessage.trim() || !selectedMatch) return;

      try {
        const messagesRef = collection(db, 'matches', selectedMatch.id, 'messages');
        await addDoc(messagesRef, {
          text: newMessage.trim(),
          senderId: user.uid,
          senderName: userProfile?.firstName || 'Anonymous',
          createdAt: serverTimestamp()
        });

        // Update match last activity
        await updateDoc(doc(db, 'matches', selectedMatch.id), {
          lastActivity: serverTimestamp(),
          lastMessage: newMessage.trim(),
          lastMessageSender: user.uid
        });

        setNewMessage('');
      } catch (error) {
        console.error('Error sending message:', error);
      }
    };

    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading chats...</p>
          </div>
        </div>
      );
    }

    if (!selectedMatch) {
      return (
        <div className="min-h-screen bg-gray-50">
          <div className="bg-white border-b border-gray-200 px-4 py-4">
            <div className="flex items-center justify-between max-w-md mx-auto">
              <button
                onClick={() => setCurrentScreen('home')}
                className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"
              >
                <ChevronLeft size={20} />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Group Chats</h1>
              <div className="w-8 h-8"></div>
            </div>
          </div>

          <div className="p-4">
            <div className="max-w-md mx-auto space-y-4">
              {matches.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle size={48} className="mx-auto mb-4 text-gray-400" />
                  <h2 className="text-xl font-bold text-gray-900 mb-2">No matches yet</h2>
                  <p className="text-gray-600 mb-6">Start swiping to find your first team match!</p>
                  <button
                    onClick={() => setCurrentScreen('discover')}
                    className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold"
                  >
                    Discover Teams
                  </button>
                </div>
              ) : (
                matches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => setSelectedMatch(match)}
                    className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {match.team1Name} × {match.team2Name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {match.team1Members.length + match.team2Members.length} members
                        </p>
                        {match.lastMessage && (
                          <p className="text-sm text-gray-500 mt-2 truncate">
                            {match.lastMessage}
                          </p>
                        )}
                      </div>
                      <MessageCircle size={20} className="text-green-600" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="flex items-center max-w-md mx-auto">
            <button
              onClick={() => setSelectedMatch(null)}
              className="p-2 text-gray-600 hover:bg-gray-50 rounded-full mr-2"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">
                {selectedMatch.team1Name} × {selectedMatch.team2Name}
              </h1>
              <p className="text-sm text-gray-600">
                {selectedMatch.allMembers.length} members
              </p>
            </div>
            <button className="p-2 text-gray-600 hover:bg-gray-50 rounded-full">
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-md mx-auto space-y-4">
            {/* Match announcement */}
            <div className="text-center py-4">
              <div className="bg-green-100 text-green-800 rounded-full px-4 py-2 text-sm font-semibold inline-block">
                🎉 You matched! Say hello and start planning your meetup
              </div>
            </div>

            {/* Messages */}
            {chatMessages.map((message) => {
              const isOwn = message.senderId === user.uid;
              return (
                <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                    isOwn 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}>
                    {!isOwn && (
                      <p className="text-xs text-gray-500 mb-1">{message.senderName}</p>
                    )}
                    <p className="text-sm">{message.text}</p>
                    <p className={`text-xs mt-1 ${isOwn ? 'text-purple-200' : 'text-gray-400'}`}>
                      {message.createdAt && new Date(message.createdAt.seconds * 1000).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Message Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="max-w-md mx-auto">
            <div className="flex space-x-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageCircle size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Settings Screen
  const SettingsScreen = () => {
    const [preferences, setPreferences] = useState({
      ageRange: { min: 18, max: 35 },
      distance: 25,
      showMe: 'everyone', // everyone, teams-only
      interests: [],
      notifications: {
        matches: true,
        votes: true,
        messages: true
      }
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      loadPreferences();
    }, []);

    const loadPreferences = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.preferences) {
            setPreferences({ ...preferences, ...userData.preferences });
          }
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };

    const savePreferences = async () => {
      if (!user) return;

      setSaving(true);
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          preferences,
          updatedAt: serverTimestamp()
        });
        
        alert('Settings saved successfully!');
      } catch (error) {
        console.error('Error saving preferences:', error);
        alert('Error saving settings');
      }
      setSaving(false);
    };

    const handleLogout = async () => {
      if (window.confirm('Are you sure you want to log out?')) {
        try {
          await auth.signOut();
        } catch (error) {
          console.error('Error signing out:', error);
        }
      }
    };

    const requestLocationPermission = async () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            // Reverse geocoding to get city name (you'd typically use a service like Google Maps API)
            try {
              await updateDoc(doc(db, 'users', user.uid), {
                location: {
                  latitude,
                  longitude,
                  updatedAt: new Date()
                }
              });
              alert('Location updated successfully!');
            } catch (error) {
              console.error('Error updating location:', error);
            }
          },
          (error) => {
            alert('Location access denied. Please enable location services.');
          }
        );
      } else {
        alert('Geolocation is not supported by this browser.');
      }
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button
              onClick={() => setCurrentScreen('home')}
              className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Settings</h1>
            <button
              onClick={savePreferences}
              disabled={saving}
              className="text-purple-600 font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="max-w-md mx-auto space-y-6">
            {/* Account Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Phone Number</p>
                    <p className="text-sm text-gray-600">{user?.phoneNumber}</p>
                  </div>
                  <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                    Verified
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Profile Status</p>
                    <p className="text-sm text-gray-600">
                      {userProfile?.profileComplete ? 'Complete' : 'Incomplete'}
                    </p>
                  </div>
                  <button
                    onClick={() => setCurrentScreen('profile-setup')}
                    className="text-purple-600 text-sm font-semibold"
                  >
                    Edit Profile
                  </button>
                </div>

                <button
                  onClick={requestLocationPermission}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-50 text-blue-700 py-3 rounded-lg font-semibold hover:bg-blue-100 transition-colors"
                >
                  <MapPin size={20} />
                  <span>Update Current Location</span>
                </button>
              </div>
            </div>

            {/* Discovery Preferences */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Discovery Preferences</h2>
              
              <div className="space-y-6">
                {/* Age Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Age Range: {preferences.ageRange.min} - {preferences.ageRange.max}
                  </label>
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <input
                        type="range"
                        min="18"
                        max="50"
                        value={preferences.ageRange.min}
                        onChange={(e) => setPreferences(prev => ({
                          ...prev,
                          ageRange: { ...prev.ageRange, min: parseInt(e.target.value) }
                        }))}
                        className="w-full accent-purple-600"
                      />
                      <div className="text-xs text-gray-500 mt-1">Min: {preferences.ageRange.min}</div>
                    </div>
                    <div className="flex-1">
                      <input
                        type="range"
                        min="18"
                        max="50"
                        value={preferences.ageRange.max}
                        onChange={(e) => setPreferences(prev => ({
                          ...prev,
                          ageRange: { ...prev.ageRange, max: parseInt(e.target.value) }
                        }))}
                        className="w-full accent-purple-600"
                      />
                      <div className="text-xs text-gray-500 mt-1">Max: {preferences.ageRange.max}</div>
                    </div>
                  </div>
                </div>

                {/* Distance */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Maximum Distance: {preferences.distance} miles
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={preferences.distance}
                    onChange={(e) => setPreferences(prev => ({
                      ...prev,
                      distance: parseInt(e.target.value)
                    }))}
                    className="w-full accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>5 mi</span>
                    <span>100 mi</span>
                  </div>
                </div>

                {/* Show Me */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Show Me
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="showMe"
                        value="everyone"
                        checked={preferences.showMe === 'everyone'}
                        onChange={(e) => setPreferences(prev => ({ ...prev, showMe: e.target.value }))}
                        className="text-purple-600"
                      />
                      <span className="ml-2 text-gray-900">Everyone</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="showMe"
                        value="teams-only"
                        checked={preferences.showMe === 'teams-only'}
                        onChange={(e) => setPreferences(prev => ({ ...prev, showMe: e.target.value }))}
                        className="text-purple-600"
                      />
                      <span className="ml-2 text-gray-900">Teams Only</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">New Matches</p>
                    <p className="text-sm text-gray-600">When teams vote to match with you</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.notifications.matches}
                    onChange={(e) => setPreferences(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, matches: e.target.checked }
                    }))}
                    className="toggle"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Vote Reminders</p>
                    <p className="text-sm text-gray-600">Reminders for pending team votes</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.notifications.votes}
                    onChange={(e) => setPreferences(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, votes: e.target.checked }
                    }))}
                    className="toggle"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Messages</p>
                    <p className="text-sm text-gray-600">New group chat messages</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.notifications.messages}
                    onChange={(e) => setPreferences(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, messages: e.target.checked }
                    }))}
                    className="toggle"
                  />
                </div>
              </div>
            </div>

            {/* Team Management */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Management</h2>
              
              <div className="space-y-3">
                <button
                  onClick={() => setCurrentScreen('my-teams')}
                  className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <p className="font-medium text-gray-900">My Teams</p>
                  <p className="text-sm text-gray-600">Manage your teams and invitations</p>
                </button>

                <button
                  onClick={() => setCurrentScreen('create-team')}
                  className="w-full text-left p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <p className="font-medium text-purple-900">Create New Team</p>
                  <p className="text-sm text-purple-600">Start a new team with friends</p>
                </button>
              </div>
            </div>

            {/* Support & Legal */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Support & Legal</h2>
              
              <div className="space-y-3">
                <button className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <p className="font-medium text-gray-900">Help & Support</p>
                  <p className="text-sm text-gray-600">Get help using TeamUp</p>
                </button>

                <button className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <p className="font-medium text-gray-900">Privacy Policy</p>
                  <p className="text-sm text-gray-600">How we protect your data</p>
                </button>

                <button className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <p className="font-medium text-gray-900">Terms of Service</p>
                  <p className="text-sm text-gray-600">Terms and conditions</p>
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-red-200">
              <h2 className="text-lg font-semibold text-red-600 mb-4">Account Actions</h2>
              
              <div className="space-y-3">
                <button
                  onClick={handleLogout}
                  className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors"
                >
                  Log Out
                </button>

                <button className="w-full text-red-600 py-2 text-sm font-medium hover:bg-red-50 rounded-lg transition-colors">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Social Sharing Component
  const ShareTeamInvite = ({ teamName, teamId, onClose }) => {
    const [inviteLink, setInviteLink] = useState('');

    useEffect(() => {
      generateInviteLink();
    }, [teamId]);

    const generateInviteLink = () => {
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/invite/${teamId}`;
      setInviteLink(link);
    };

    const shareViaWebAPI = async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Join ${teamName} on TeamUp!`,
            text: `You've been invited to join ${teamName}. Let's find some awesome people to hang out with!`,
            url: inviteLink
          });
        } catch (error) {
          console.log('Error sharing:', error);
        }
      } else {
        // Fallback to clipboard copy
        navigator.clipboard.writeText(inviteLink);
        alert('Invite link copied to clipboard!');
      }
    };

    const shareToSnapchat = () => {
      const snapchatUrl = `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(inviteLink)}`;
      window.open(snapchatUrl, '_blank');
    };

    const shareToInstagram = () => {
      const text = encodeURIComponent(`Join ${teamName} on TeamUp! ${inviteLink}`);
      const instagramUrl = `https://www.instagram.com/`;
      window.open(instagramUrl, '_blank');
    };

    const copyLink = () => {
      navigator.clipboard.writeText(inviteLink);
      alert('Link copied to clipboard!');
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
        <div className="bg-white w-full rounded-t-2xl p-6 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Invite Friends to {teamName}</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Invite Link</p>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm"
                />
                <button
                  onClick={copyLink}
                  className="px-4 py-2 bg-purple-600 text-white rounded font-semibold text-sm"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={shareViaWebAPI}
                className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mb-2">
                  <span className="text-white font-bold">📱</span>
                </div>
                <span className="text-sm font-semibold text-blue-700">Share</span>
              </button>

              <button
                onClick={shareToSnapchat}
                className="flex flex-col items-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
              >
                <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center mb-2">
                  <span className="text-white font-bold">👻</span>
                </div>
                <span className="text-sm font-semibold text-yellow-700">Snapchat</span>
              </button>

              <button
                onClick={shareToInstagram}
                className="flex flex-col items-center p-4 bg-pink-50 rounded-lg hover:bg-pink-100 transition-colors"
              >
                <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center mb-2">
                  <span className="text-white font-bold">📷</span>
                </div>
                <span className="text-sm font-semibold text-pink-700">Instagram</span>
              </button>

              <button
                onClick={() => {
                  const text = encodeURIComponent(`Join ${teamName} on TeamUp! ${inviteLink}`);
                  window.open(`sms:?body=${text}`, '_blank');
                }}
                className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
              >
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-2">
                  <span className="text-white font-bold">💬</span>
                </div>
                <span className="text-sm font-semibold text-green-700">SMS</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Screen Router
  const renderScreen = () => {
    switch (currentScreen) {
      case 'auth':
        return <PhoneAuthScreen />;
      case 'profile-setup':
        return <ProfileSetupScreen />;
      case 'home':
        return <HomeScreen />;
      case 'create-team':
        return <CreateTeamScreen />;
      case 'discover':
        return <TeamDiscoveryScreen />;
      case 'voting':
        return <VotingScreen />;
      case 'chat':
        return <GroupChatScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return <div className="App">{renderScreen()}</div>;
}

export default App;