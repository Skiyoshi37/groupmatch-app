import React, { useState, useEffect } from 'react'; 
import { initializeApp } from 'firebase/app'; 
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'; 
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, getDocs, updateDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore'; 
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'; 
import { Heart, Users, MessageCircle, Settings, User, ChevronLeft, Plus, X, Upload, Camera } from 'lucide-react'; 
import './App.css';

const firebaseConfig = {
  apiKey: "AIzaSyDVAC0Y3ShrpNyu1WYOdxa34AJuA3jCY5w",
  authDomain: "groupmatch-55bda.firebaseapp.com",
  projectId: "groupmatch-55bda",
  storageBucket: "groupmatch-55bda.firebasestorage.app",
  messagingSenderId: "49208632571",
  appId: "1:49208632571:web:4a5a3432b6abaa5eaafc5e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

function App() {
  const [user, setUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('auth');
  const [profile, setProfile] = useState(null);
  const [groups, setGroups] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await loadUserProfile(user.uid);
        setCurrentScreen('home');
      } else {
        setUser(null);
        setCurrentScreen('auth');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadUserProfile = async (userId) => {
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data());
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-purple-600">Loading GroupMatch...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100">
      {currentScreen === 'auth' && <AuthScreen setCurrentScreen={setCurrentScreen} />}
      {currentScreen === 'profile-setup' && <ProfileSetupScreen setCurrentScreen={setCurrentScreen} />}
      {currentScreen === 'home' && <HomeScreen setCurrentScreen={setCurrentScreen} profile={profile} />}
      {currentScreen === 'profile' && <ProfileScreen setCurrentScreen={setCurrentScreen} profile={profile} />}
      {currentScreen === 'create-group' && <CreateGroupScreen setCurrentScreen={setCurrentScreen} />}
      {currentScreen === 'swipe' && <SwipeScreen setCurrentScreen={setCurrentScreen} />}
      {currentScreen === 'chat' && <ChatScreen setCurrentScreen={setCurrentScreen} />}
    </div>
  );
}

// Authentication Screen
const AuthScreen = ({ setCurrentScreen }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        setCurrentScreen('profile-setup');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600">
            GroupMatch
          </h1>
          <p className="text-gray-600 mt-2">Connect friend groups, not just friends</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90"
          >
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-purple-600 hover:underline"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Profile Setup Screen
const ProfileSetupScreen = ({ setCurrentScreen }) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState([]);
  const [photos, setPhotos] = useState([]);

  const availableInterests = ['Hiking', 'Food', 'Music', 'Travel', 'Sports', 'Art', 'Books', 'Movies', 'Gaming', 'Fitness'];

  const toggleInterest = (interest) => {
    setInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const storageRef = ref(storage, `photos/${auth.currentUser.uid}/${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        setPhotos(prev => [...prev, downloadURL]);
      } catch (error) {
        console.error('Error uploading photo:', error);
      }
    }
  };

  const saveProfile = async () => {
    try {
      const profileData = {
        name,
        age: parseInt(age),
        bio,
        interests,
        photos,
        userId: auth.currentUser.uid,
        createdAt: new Date(),
        friends: [],
        groups: []
      };

      await setDoc(doc(db, 'users', auth.currentUser.uid), profileData);
      setCurrentScreen('home');
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center mb-6">Complete Your Profile</h2>
        
        <div className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <input
              type="number"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <textarea
              placeholder="Tell us about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 h-24"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Add Photos</label>
            <div className="w-full p-3 border-2 border-gray-300 rounded-lg bg-gray-100 text-gray-500 text-center">
              Photo uploads coming soon!
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Interests</label>
            <div className="grid grid-cols-2 gap-2">
              {availableInterests.map(interest => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`p-2 rounded-lg border text-sm ${
                    interests.includes(interest)
                      ? 'bg-purple-500 text-white border-purple-500'
                      : 'bg-white border-gray-300 hover:border-purple-300'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={saveProfile}
            disabled={!name || !age || !bio}
            className={`w-full py-3 rounded-lg font-semibold ${
              !name || !age || !bio
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90'
            }`}
          >
            Complete Profile
          </button>
        </div>
      </div>
    </div>
  );
};

// Home Screen Component
const HomeScreen = ({ setCurrentScreen, profile }) => {
  const [activeGroups, setActiveGroups] = useState([]);
  const [matches, setMatches] = useState([]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="max-w-sm mx-auto bg-white rounded-xl shadow-lg min-h-[600px] flex flex-col">
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-4 rounded-t-xl">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">GroupMatch</h1>
          <button 
            onClick={handleSignOut}
            className="text-sm hover:underline"
          >
            Sign Out
          </button>
        </div>
        <p className="text-sm text-center mt-1 opacity-90">Find Your Tribe</p>
      </div>
      
      <div className="flex-1 p-4 space-y-4">
        {profile && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Welcome back, {profile.name}!</h3>
            <p className="text-blue-600 text-sm mb-3">Ready to connect with new groups?</p>
            <button 
              onClick={() => setCurrentScreen('create-group')}
              className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600"
            >
              Create New Group
            </button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 pt-4 border-t">
          <button 
            onClick={() => setCurrentScreen('profile')}
            className="p-3 rounded-lg text-center hover:bg-gray-100"
          >
            <User size={20} className="mx-auto mb-1" />
            <span className="text-xs">Profile</span>
          </button>
          <button className="p-3 rounded-lg text-center bg-purple-100">
            <Users size={20} className="mx-auto mb-1" />
            <span className="text-xs">Groups</span>
          </button>
          <button 
            onClick={() => setCurrentScreen('chat')}
            className="p-3 rounded-lg text-center hover:bg-gray-100"
          >
            <MessageCircle size={20} className="mx-auto mb-1" />
            <span className="text-xs">Chats</span>
          </button>
          <button className="p-3 rounded-lg text-center hover:bg-gray-100">
            <Settings size={20} className="mx-auto mb-1" />
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Profile Screen Component
const ProfileScreen = ({ setCurrentScreen, profile }) => {
  return (
    <div className="max-w-sm mx-auto bg-white rounded-xl shadow-lg min-h-[600px] flex flex-col">
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-4 rounded-t-xl">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setCurrentScreen('home')}
            className="p-1 hover:bg-white/20 rounded"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-bold flex-1 text-center">Your Profile</h1>
          <div className="w-6"></div>
        </div>
      </div>
      
      <div className="flex-1 p-4">
        {profile && (
          <div className="space-y-4">
            <div className="text-center">
              {profile.photos && profile.photos.length > 0 ? (
                <img 
                  src={profile.photos[0]} 
                  alt="Profile" 
                  className="w-24 h-24 rounded-full mx-auto object-cover"
                />
              ) : (
                <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto flex items-center justify-center text-4xl">
                  👤
                </div>
              )}
              <h2 className="text-xl font-bold mt-2">{profile.name}, {profile.age}</h2>
              <p className="text-gray-600 text-sm mt-1">{profile.bio}</p>
            </div>

            {profile.interests && profile.interests.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map(interest => (
                    <span key={interest} className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Placeholder components for other screens
const CreateGroupScreen = ({ setCurrentScreen }) => (
  <div className="max-w-sm mx-auto bg-white rounded-xl shadow-lg min-h-[600px] flex items-center justify-center">
    <div className="text-center">
      <Users size={48} className="mx-auto mb-4 text-purple-500" />
      <h2 className="text-xl font-bold mb-2">Create Group</h2>
      <p className="text-gray-600 mb-4">Feature coming soon!</p>
      <button 
        onClick={() => setCurrentScreen('home')}
        className="bg-purple-500 text-white px-6 py-2 rounded-lg"
      >
        Back to Home
      </button>
    </div>
  </div>
);

const SwipeScreen = ({ setCurrentScreen }) => (
  <div className="max-w-sm mx-auto bg-white rounded-xl shadow-lg min-h-[600px] flex items-center justify-center">
    <div className="text-center">
      <Heart size={48} className="mx-auto mb-4 text-pink-500" />
      <h2 className="text-xl font-bold mb-2">Discover Groups</h2>
      <p className="text-gray-600 mb-4">Feature coming soon!</p>
      <button 
        onClick={() => setCurrentScreen('home')}
        className="bg-pink-500 text-white px-6 py-2 rounded-lg"
      >
        Back to Home
      </button>
    </div>
  </div>
);

const ChatScreen = ({ setCurrentScreen }) => (
  <div className="max-w-sm mx-auto bg-white rounded-xl shadow-lg min-h-[600px] flex items-center justify-center">
    <div className="text-center">
      <MessageCircle size={48} className="mx-auto mb-4 text-green-500" />
      <h2 className="text-xl font-bold mb-2">Group Chats</h2>
      <p className="text-gray-600 mb-4">Feature coming soon!</p>
      <button 
        onClick={() => setCurrentScreen('home')}
        className="bg-green-500 text-white px-6 py-2 rounded-lg"
      >
        Back to Home
      </button>
    </div>
  </div>
);

export default App;