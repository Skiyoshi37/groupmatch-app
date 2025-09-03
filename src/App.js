import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, getDocs, updateDoc, query, where, orderBy, onSnapshot, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Heart, Users, MessageCircle, Settings, User, ChevronLeft, Plus, X, Upload, Camera, Search, UserPlus, Check } from 'lucide-react';
import './App.css';

// Your Firebase config - keep your existing values
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
  const [user, setUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('auth');
  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await loadUserProfile(user.uid);
        await loadFriends(user.uid);
        await loadGroups(user.uid);
        setCurrentScreen('home');
      } else {
        setUser(null);
        setCurrentScreen('auth');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/invite/')) {
      const inviteCode = path.split('/invite/')[1];
      setCurrentScreen('invite-landing');
      window.inviteCode = inviteCode;
    }
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

  const loadFriends = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const friendIds = userData.friends || [];
        
        if (friendIds.length > 0) {
          const friendsData = [];
          for (const friendId of friendIds) {
            const friendDoc = await getDoc(doc(db, 'users', friendId));
            if (friendDoc.exists()) {
              friendsData.push({ id: friendId, ...friendDoc.data() });
            }
          }
          setFriends(friendsData);
        }
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const loadGroups = async (userId) => {
    try {
      const q = query(
        collection(db, 'groups'),
        where('memberIds', 'array-contains', userId)
      );
      const querySnapshot = await getDocs(q);
      const groupsData = [];
      querySnapshot.forEach((doc) => {
        groupsData.push({ id: doc.id, ...doc.data() });
      });
      setGroups(groupsData);
      
      // Set active group if exists
      const activeGroupData = groupsData.find(group => group.active);
      if (activeGroupData) {
        setActiveGroup(activeGroupData);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
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
      {currentScreen === 'home' && <HomeScreen setCurrentScreen={setCurrentScreen} profile={profile} activeGroup={activeGroup} />}
      {currentScreen === 'profile' && <ProfileScreen setCurrentScreen={setCurrentScreen} profile={profile} />}
      {currentScreen === 'friends' && <FriendsScreen setCurrentScreen={setCurrentScreen} friends={friends} setFriends={setFriends} />}
      {currentScreen === 'create-group' && <CreateGroupScreen setCurrentScreen={setCurrentScreen} friends={friends} setActiveGroup={setActiveGroup} setGroups={setGroups} />}
      {currentScreen === 'group-details' && <GroupDetailsScreen setCurrentScreen={setCurrentScreen} activeGroup={activeGroup} />}
      {currentScreen === 'swipe' && <SwipeScreen setCurrentScreen={setCurrentScreen} />}
      {currentScreen === 'chat' && <ChatScreen setCurrentScreen={setCurrentScreen} />}
      {currentScreen === 'invite-landing' && <InviteLandingScreen inviteCode={window.inviteCode} setCurrentScreen={setCurrentScreen} />}
    </div>
  );
}

// Authentication Screen (unchanged)
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

// Profile Setup Screen (unchanged)
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

// Updated Home Screen
const HomeScreen = ({ setCurrentScreen, profile, activeGroup }) => {
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
            
            {!activeGroup ? (
              <div>
                <p className="text-blue-600 text-sm mb-3">Ready to form a group and discover others?</p>
                <div className="space-y-2">
                  <button 
                    onClick={() => setCurrentScreen('friends')}
                    className="w-full bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600"
                  >
                    Manage Friends
                  </button>
                  <button 
                    onClick={() => setCurrentScreen('create-group')}
                    className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600"
                  >
                    Create Group
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-blue-600 text-sm mb-3">Your group is active! Ready to discover other groups?</p>
                <div className="space-y-2">
                  <button 
                    onClick={() => setCurrentScreen('group-details')}
                    className="w-full bg-purple-500 text-white py-2 rounded-lg font-semibold hover:bg-purple-600"
                  >
                    View Group ({activeGroup.members.length} members)
                  </button>
                  <button 
                    onClick={() => setCurrentScreen('swipe')}
                    className="w-full bg-pink-500 text-white py-2 rounded-lg font-semibold hover:bg-pink-600"
                  >
                    Discover Groups
                  </button>
                </div>
              </div>
            )}
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
          <button 
            onClick={() => setCurrentScreen('friends')}
            className="p-3 rounded-lg text-center hover:bg-gray-100"
          >
            <Users size={20} className="mx-auto mb-1" />
            <span className="text-xs">Friends</span>
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

// Friends Management Screen
// Add these new components to your existing App.js file
// Insert these after your existing screens, before the export default App;

// Enhanced Friends Screen with Invitation Features
const FriendsScreen = ({ setCurrentScreen, friends, setFriends }) => {
  const [activeTab, setActiveTab] = useState('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  // Generate unique invite link for the user
  useEffect(() => {
    if (auth.currentUser) {
      const baseUrl = window.location.origin;
      const userInviteCode = auth.currentUser.uid.slice(-8); // Use last 8 chars of user ID
      setInviteLink(`${baseUrl}/invite/${userInviteCode}`);
    }
  }, []);

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      // Search by name, email, or phone
      const q = query(
        collection(db, 'users'),
        where('userId', '!=', auth.currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const results = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        const query = searchQuery.toLowerCase();
        
        if (
          (userData.name && userData.name.toLowerCase().includes(query)) ||
          (userData.email && userData.email.toLowerCase().includes(query)) ||
          (userData.phone && userData.phone.includes(searchQuery))
        ) {
          results.push({ id: doc.id, ...userData });
        }
      });
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    }
    setLoading(false);
  };

  const addFriend = async (friendData) => {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        friends: arrayUnion(friendData.userId)
      });

      await updateDoc(doc(db, 'users', friendData.userId), {
        friends: arrayUnion(auth.currentUser.uid)
      });

      setFriends(prev => [...prev, friendData]);
      setSearchResults(prev => prev.filter(user => user.userId !== friendData.userId));
    } catch (error) {
      console.error('Error adding friend:', error);
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
    }
  };

  const shareViaApp = (platform) => {
    const message = encodeURIComponent(`Join me on GroupMatch - the app for friend groups to meet other friend groups! ${inviteLink}`);
    
    const urls = {
      messages: `sms:&body=${message}`,
      whatsapp: `https://wa.me/?text=${message}`,
      snapchat: `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(inviteLink)}`,
      instagram: `instagram://share?text=${message}`,
      twitter: `https://twitter.com/intent/tweet?text=${message}`,
      generic: inviteLink
    };

    if (navigator.share && platform === 'generic') {
      navigator.share({
        title: 'Join GroupMatch',
        text: 'Join me on GroupMatch - the app for friend groups!',
        url: inviteLink
      });
    } else {
      window.open(urls[platform] || urls.generic, '_blank');
    }
  };

  const sendInviteByContact = async (contactMethod) => {
    const contact = prompt(`Enter ${contactMethod}:`);
    if (!contact) return;

    try {
      // Store pending invitation in database
      await addDoc(collection(db, 'invitations'), {
        from: auth.currentUser.uid,
        to: contact,
        method: contactMethod,
        inviteCode: auth.currentUser.uid.slice(-8),
        createdAt: new Date(),
        status: 'pending'
      });

      alert(`Invitation sent to ${contact}! They'll be prompted to add you when they join.`);
    } catch (error) {
      console.error('Error sending invitation:', error);
    }
  };

  const isFriend = (userId) => {
    return friends.some(friend => friend.userId === userId);
  };

  return (
    <div className="max-w-sm mx-auto bg-white rounded-xl shadow-lg min-h-[600px] flex flex-col">
      <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white p-4 rounded-t-xl">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setCurrentScreen('home')}
            className="p-1 hover:bg-white/20 rounded"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-bold flex-1 text-center">Friends</h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 p-3 text-sm font-medium ${
            activeTab === 'friends' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500'
          }`}
        >
          My Friends ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab('invite')}
          className={`flex-1 p-3 text-sm font-medium ${
            activeTab === 'invite' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500'
          }`}
        >
          Invite Friends
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 p-3 text-sm font-medium ${
            activeTab === 'search' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500'
          }`}
        >
          Find Friends
        </button>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto">
        {/* My Friends Tab */}
        {activeTab === 'friends' && (
          <div>
            {friends.length === 0 ? (
              <div className="text-center py-8">
                <Users size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 mb-4">No friends yet!</p>
                <button 
                  onClick={() => setActiveTab('invite')}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                >
                  Invite Friends
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {friends.map(friend => (
                  <div key={friend.userId} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center">
                      <User size={20} className="text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{friend.name}</p>
                      <p className="text-sm text-gray-500">Age {friend.age}</p>
                    </div>
                    <div className="text-green-500">
                      <Check size={16} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Invite Friends Tab */}
        {activeTab === 'invite' && (
          <div className="space-y-6">
            {/* Share Link */}
            <div>
              <h3 className="font-semibold mb-3">Share Your Invite Link</h3>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-2">Anyone with this link can add you as a friend:</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-1 p-2 bg-white border border-gray-300 rounded text-sm"
                  />
                  <button
                    onClick={copyInviteLink}
                    className={`px-3 py-2 rounded text-sm font-medium ${
                      linkCopied 
                        ? 'bg-green-500 text-white' 
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {linkCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* Social Sharing */}
            <div>
              <h3 className="font-semibold mb-3">Share via Apps</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => shareViaApp('messages')}
                  className="p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"
                >
                  💬 Messages
                </button>
                <button
                  onClick={() => shareViaApp('whatsapp')}
                  className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  📱 WhatsApp
                </button>
                <button
                  onClick={() => shareViaApp('snapchat')}
                  className="p-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-medium"
                >
                  👻 Snapchat
                </button>
                <button
                  onClick={() => shareViaApp('instagram')}
                  className="p-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600 text-sm font-medium"
                >
                  📸 Instagram
                </button>
                <button
                  onClick={() => shareViaApp('twitter')}
                  className="p-3 bg-blue-400 text-white rounded-lg hover:bg-blue-500 text-sm font-medium"
                >
                  🐦 Twitter
                </button>
                <button
                  onClick={() => shareViaApp('generic')}
                  className="p-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm font-medium"
                >
                  📤 More Apps
                </button>
              </div>
            </div>

            {/* Direct Invites */}
            <div>
              <h3 className="font-semibold mb-3">Send Direct Invites</h3>
              <div className="space-y-2">
                <button
                  onClick={() => sendInviteByContact('email')}
                  className="w-full p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-left flex items-center space-x-3"
                >
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">@</span>
                  </div>
                  <div>
                    <p className="font-medium">Email Invitation</p>
                    <p className="text-xs text-gray-600">Send invite to email address</p>
                  </div>
                </button>
                <button
                  onClick={() => sendInviteByContact('phone')}
                  className="w-full p-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-left flex items-center space-x-3"
                >
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">📞</span>
                  </div>
                  <div>
                    <p className="font-medium">Phone Invitation</p>
                    <p className="text-xs text-gray-600">Send invite to phone number</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Find Friends Tab */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <div>
              <div className="flex space-x-2 mb-4">
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={searchUsers}
                  disabled={loading}
                  className="bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? '...' : <Search size={16} />}
                </button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map(user => (
                    <div key={user.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center">
                          <User size={20} className="text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-gray-500">Age {user.age}</p>
                        </div>
                      </div>
                      {!isFriend(user.userId) ? (
                        <button
                          onClick={() => addFriend(user)}
                          className="bg-green-500 text-white p-2 rounded-full hover:bg-green-600"
                        >
                          <UserPlus size={16} />
                        </button>
                      ) : (
                        <div className="text-green-500">
                          <Check size={16} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {searchResults.length === 0 && searchQuery && !loading && (
              <div className="text-center py-8">
                <Search size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">No users found for "{searchQuery}"</p>
                <p className="text-sm text-gray-400 mt-2">Try searching by exact name, email, or phone number</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Invite Landing Page Component (for when people click invite links)
const InviteLandingScreen = ({ inviteCode, setCurrentScreen }) => {
  const [inviterProfile, setInviterProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInviterProfile = async () => {
      try {
        // Find user by invite code (last 8 chars of their userId)
        const q = query(collection(db, 'users'));
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          if (userData.userId.slice(-8) === inviteCode) {
            setInviterProfile({ id: doc.id, ...userData });
          }
        });
      } catch (error) {
        console.error('Error loading inviter profile:', error);
      }
      setLoading(false);
    };

    if (inviteCode) {
      loadInviterProfile();
    }
  }, [inviteCode]);

  const acceptInvite = async () => {
    if (!auth.currentUser || !inviterProfile) return;

    try {
      // Add mutual friendship
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        friends: arrayUnion(inviterProfile.userId)
      });

      await updateDoc(doc(db, 'users', inviterProfile.userId), {
        friends: arrayUnion(auth.currentUser.uid)
      });

      alert(`You're now friends with ${inviterProfile.name}!`);
      setCurrentScreen('home');
    } catch (error) {
      console.error('Error accepting invite:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-purple-600">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (!inviterProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Invalid Invite</h2>
          <p className="text-gray-600 mb-6">This invite link is not valid or has expired.</p>
          <button 
            onClick={() => setCurrentScreen('auth')}
            className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600"
          >
            Go to GroupMatch
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 mb-2">
          You're Invited!
        </h1>
        
        <div className="mb-6">
          <div className="w-20 h-20 bg-purple-200 rounded-full mx-auto flex items-center justify-center mb-3">
            <User size={32} className="text-purple-600" />
          </div>
          <p className="text-lg font-semibold">{inviterProfile.name}</p>
          <p className="text-gray-600">wants to be friends on GroupMatch</p>
        </div>

        <div className="space-y-3">
          {auth.currentUser ? (
            <button 
              onClick={acceptInvite}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90"
            >
              Accept Friend Request
            </button>
          ) : (
            <button 
              onClick={() => setCurrentScreen('auth')}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90"
            >
              Join GroupMatch
            </button>
          )}
          
          <p className="text-sm text-gray-500">
            GroupMatch helps friend groups meet other friend groups!
          </p>
        </div>
      </div>
    </div>
  );
};

// Group Creation Screen
const CreateGroupScreen = ({ setCurrentScreen, friends, setActiveGroup, setGroups }) => {
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [lookingFor, setLookingFor] = useState('3-6');
  const [loading, setLoading] = useState(false);

  const toggleFriend = (friendId) => {
    setSelectedFriends(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      } else if (prev.length < 5) { // Max 5 friends + user = 6 total
        return [...prev, friendId];
      }
      return prev;
    });
  };

  const createGroup = async () => {
    if (selectedFriends.length === 0 || !groupName.trim()) return;
    
    setLoading(true);
    try {
      // Get current user profile
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();
      
      // Build group members array
      const groupMembers = [
        {
          userId: auth.currentUser.uid,
          name: userData.name,
          age: userData.age,
          bio: userData.bio,
          interests: userData.interests || [],
          photos: userData.photos || [],
          isCreator: true
        }
      ];

      // Add selected friends to group
      for (const friendId of selectedFriends) {
        const friendDoc = await getDoc(doc(db, 'users', friendId));
        if (friendDoc.exists()) {
          const friendData = friendDoc.data();
          groupMembers.push({
            userId: friendId,
            name: friendData.name,
            age: friendData.age,
            bio: friendData.bio,
            interests: friendData.interests || [],
            photos: friendData.photos || [],
            isCreator: false
          });
        }
      }

      // Create group in database
      const groupData = {
        name: groupName,
        members: groupMembers,
        memberIds: [auth.currentUser.uid, ...selectedFriends],
        createdBy: auth.currentUser.uid,
        createdAt: new Date(),
        lookingFor: lookingFor,
        active: true,
        likes: [],
        matches: []
      };

      const groupRef = await addDoc(collection(db, 'groups'), groupData);
      const newGroup = { id: groupRef.id, ...groupData };
      
      // Update user's groups array
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        groups: arrayUnion(groupRef.id)
      });

      // Update each friend's groups array
      for (const friendId of selectedFriends) {
        await updateDoc(doc(db, 'users', friendId), {
          groups: arrayUnion(groupRef.id)
        });
      }

      setActiveGroup(newGroup);
      setGroups(prev => [...prev, newGroup]);
      setCurrentScreen('group-details');
    } catch (error) {
      console.error('Error creating group:', error);
    }
    setLoading(false);
  };

  if (friends.length === 0) {
    return (
      <div className="max-w-sm mx-auto bg-white rounded-xl shadow-lg min-h-[600px] flex items-center justify-center">
        <div className="text-center p-4">
          <Users size={48} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold mb-2">No Friends Yet</h2>
          <p className="text-gray-600 mb-4">You need friends to create a group!</p>
          <button 
            onClick={() => setCurrentScreen('friends')}
            className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600"
          >
            Add Friends First
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto bg-white rounded-xl shadow-lg min-h-[600px] flex flex-col">
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white p-4 rounded-t-xl">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setCurrentScreen('home')}
            className="p-1 hover:bg-white/20 rounded"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-bold flex-1 text-center">Create Group</h1>
          <div className="w-6"></div>
        </div>
      </div>
      
      <div className="flex-1 p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Group Name</label>
          <input
            type="text"
            placeholder="e.g., Nashville Squad"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Select Friends (max 5)</label>
          <p className="text-xs text-gray-500 mb-3">Choose up to 5 friends to form a group of 6 total</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {friends.map(friend => (
              <div 
                key={friend.userId}
                onClick={() => toggleFriend(friend.userId)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${
                  selectedFriends.includes(friend.userId) 
                    ? 'bg-purple-50 border-purple-300' 
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center">
                    <User size={16} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">{friend.name}</p>
                    <p className="text-sm text-gray-500">Age {friend.age}</p>
                  </div>
                </div>
                {selectedFriends.includes(friend.userId) && (
                  <div className="text-purple-600">
                    <Check size={16} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Looking for groups of:</label>
          <div className="grid grid-cols-3 gap-2">
            {['2-4', '3-6', '4-8'].map(option => (
              <button
                key={option}
                onClick={() => setLookingFor(option)}
                className={`p-3 rounded-lg border text-center ${
                  lookingFor === option
                    ? 'bg-purple-500 text-white border-purple-500'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                {option} people
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Group Preview:</strong> You + {selectedFriends.length} friends = {selectedFriends.length + 1} people total
          </p>
        </div>

        <button 
          onClick={createGroup}
          disabled={selectedFriends.length === 0 || !groupName.trim() || loading}
          className={`w-full py-3 rounded-lg font-semibold ${
            selectedFriends.length === 0 || !groupName.trim() || loading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:opacity-90'
          }`}
        >
          {loading ? 'Creating Group...' : `Create Group (${selectedFriends.length + 1} members)`}
        </button>
      </div>
    </div>
  );
};

// Group Details Screen
const GroupDetailsScreen = ({ setCurrentScreen, activeGroup }) => {
  if (!activeGroup) {
    return (
      <div className="max-w-sm mx-auto bg-white rounded-xl shadow-lg min-h-[600px] flex items-center justify-center">
        <div className="text-center">
          <Users size={48} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold mb-2">No Active Group</h2>
          <button 
            onClick={() => setCurrentScreen('home')}
            className="bg-purple-500 text-white px-6 py-2 rounded-lg"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto bg-white rounded-xl shadow-lg min-h-[600px] flex flex-col">
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white p-4 rounded-t-xl">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setCurrentScreen('home')}
            className="p-1 hover:bg-white/20 rounded"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-bold flex-1 text-center">{activeGroup.name}</h1>
          <div className="w-6"></div>
        </div>
        <p className="text-sm text-center mt-1 opacity-90">Looking for {activeGroup.lookingFor} people</p>
      </div>
      
      <div className="flex-1 p-4 space-y-4">
        <div>
          <h3 className="font-semibold mb-3">Group Members ({activeGroup.members.length})</h3>
          <div className="space-y-3">
            {activeGroup.members.map((member, idx) => (
              <div key={member.userId} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center">
                  <User size={20} className="text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <p className="font-medium">{member.name}</p>
                    {member.isCreator && (
                      <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">
                        Creator
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">Age {member.age}</p>
                  <p className="text-xs text-gray-600 mt-1">{member.bio}</p>
                  {member.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {member.interests.slice(0, 3).map(interest => (
                        <span key={interest} className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-xs">
                          {interest}
                        </span>
                      ))}
                      {member.interests.length > 3 && (
                        <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-xs">
                          +{member.interests.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <button 
            onClick={() => setCurrentScreen('swipe')}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90"
          >
            Start Discovering Groups
          </button>
          
          <button 
            onClick={() => setCurrentScreen('home')}
            className="w-full bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

// Profile Screen (unchanged)
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

// Placeholder screens (updated)
const SwipeScreen = ({ setCurrentScreen }) => (
  <div className="max-w-sm mx-auto bg-white rounded-xl shadow-lg min-h-[600px] flex items-center justify-center">
    <div className="text-center">
      <Heart size={48} className="mx-auto mb-4 text-pink-500" />
      <h2 className="text-xl font-bold mb-2">Discover Groups</h2>
      <p className="text-gray-600 mb-4">Group discovery coming next!</p>
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
      <p className="text-gray-600 mb-4">Chat feature coming soon!</p>
      <button 
        onClick={() => setCurrentScreen('home')}
        className="bg-green-500 text-white px-6 py-2 rounded-lg"
      >
        Back to Home
      </button>
    </div>
  </div>
);


// Invite Landing Page Component (for when people click invite links)
const InviteLandingScreen = ({ inviteCode, setCurrentScreen }) => {
  const [inviterProfile, setInviterProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInviterProfile = async () => {
      try {
        // Find user by invite code (last 8 chars of their userId)
        const q = query(collection(db, 'users'));
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          if (userData.userId.slice(-8) === inviteCode) {
            setInviterProfile({ id: doc.id, ...userData });
          }
        });
      } catch (error) {
        console.error('Error loading inviter profile:', error);
      }
      setLoading(false);
    };

    if (inviteCode) {
      loadInviterProfile();
    }
  }, [inviteCode]);

  const acceptInvite = async () => {
    if (!auth.currentUser || !inviterProfile) return;

    try {
      // Add mutual friendship
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        friends: arrayUnion(inviterProfile.userId)
      });

      await updateDoc(doc(db, 'users', inviterProfile.userId), {
        friends: arrayUnion(auth.currentUser.uid)
      });

      alert(`You're now friends with ${inviterProfile.name}!`);
      setCurrentScreen('home');
    } catch (error) {
      console.error('Error accepting invite:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-purple-600">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (!inviterProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Invalid Invite</h2>
          <p className="text-gray-600 mb-6">This invite link is not valid or has expired.</p>
          <button 
            onClick={() => setCurrentScreen('auth')}
            className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600"
          >
            Go to GroupMatch
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 mb-2">
          You're Invited!
        </h1>
        
        <div className="mb-6">
          <div className="w-20 h-20 bg-purple-200 rounded-full mx-auto flex items-center justify-center mb-3">
            <User size={32} className="text-purple-600" />
          </div>
          <p className="text-lg font-semibold">{inviterProfile.name}</p>
          <p className="text-gray-600">wants to be friends on GroupMatch</p>
        </div>

        <div className="space-y-3">
          {auth.currentUser ? (
            <button 
              onClick={acceptInvite}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90"
            >
              Accept Friend Request
            </button>
          ) : (
            <button 
              onClick={() => setCurrentScreen('auth')}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90"
            >
              Join GroupMatch
            </button>
          )}
          
          <p className="text-sm text-gray-500">
            GroupMatch helps friend groups meet other friend groups!
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;