/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, ReactNode, useEffect } from 'react';
import { 
  Play, 
  Plus, 
  Search, 
  Bell, 
  User, 
  LogOut, 
  CreditCard, 
  Library, 
  Info, 
  X,
  ChevronRight,
  TrendingUp,
  History,
  Shield,
  Briefcase,
  Edit,
  PlusCircle,
  Settings,
  Film,
  Home,
  Tv,
  Star,
  Eye,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MediaItem, Category, UserRole } from './types';
import { MEDIA_ITEMS } from './constants';
import { db, auth } from './firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc,
  deleteDoc,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [portalStep, setPortalStep] = useState<'selection' | 'login'>('selection');
  const [activeCategory, setActiveCategory] = useState<Category>('Home');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<MediaItem | null>(null);
  const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<MediaItem | null>(null);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Sync with Firestore
  useEffect(() => {
    const path = 'mediaItems';
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as MediaItem[];
      
      if (items.length > 0) {
        setMediaItems(items);
      } else {
        setMediaItems(MEDIA_ITEMS);
      }
      setLoading(false);
    }, (error) => {
      console.warn("Firestore sync failed, falling back to local constants:", error);
      setMediaItems(MEDIA_ITEMS);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Validate connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // If logged in via Google, determine role (default to user unless admin email)
        if (user.email === 'u02cs25s0031@klebcadwd.com') {
          setUserRole('owner');
        } else {
          setUserRole('user');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google Sign-in failed", error);
    }
  };

  const filteredMedia = useMemo(() => {
    return mediaItems.filter(m => {
      const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.language.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      if (activeCategory === 'Movies') return m.mediaType === 'movie';
      if (activeCategory === 'TV Shows') return m.mediaType === 'tv-show';
      if (activeCategory === 'Trending') return m.rating >= 8.5; // items "trending on internet" (high rating)
      
      return true; // Home displays everything, split into sections
    });
  }, [searchQuery, activeCategory, mediaItems]);

  const featuredMedia = useMemo(() => {
    if (activeCategory === 'TV Shows') {
      return mediaItems.find(m => m.mediaType === 'tv-show' && m.rating >= 9.0) || mediaItems.find(m => m.mediaType === 'tv-show');
    }
    if (activeCategory === 'Trending') {
      return mediaItems.filter(m => m.rating >= 8.5).sort((a, b) => b.rating - a.rating)[0];
    }
    return mediaItems.find(m => m.mediaType === 'movie' && m.rating >= 8.5) || mediaItems[0];
  }, [activeCategory, mediaItems]);

  const renderContent = () => {
    if (searchQuery) {
      return (
        <section className="relative px-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 px-3 border-l-2 border-white/20">
              Search Results
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredMedia.map((item) => (
              <MovieCard 
                key={item.id} 
                movie={item} 
                onClick={() => setSelectedMovie(item)} 
                userRole={userRole}
                onEdit={() => {
                  setEditingMovie(item);
                  setIsManagementModalOpen(true);
                }}
              />
            ))}
          </div>
        </section>
      );
    }

    if (activeCategory === 'Home') {
      const trending = mediaItems.filter(m => m.rating >= 8.5).slice(0, 10);
      const topMovies = mediaItems.filter(m => m.mediaType === 'movie' && m.rating >= 8.0).slice(0, 10);
      const topShows = mediaItems.filter(m => m.mediaType === 'tv-show' && m.rating >= 8.0).slice(0, 10);

      return (
        <div className="space-y-12 pb-20 px-8">
          <SectionRow 
            title="Trending on Internet" 
            items={trending} 
            userRole={userRole} 
            onSelect={setSelectedMovie} 
            onEdit={(item) => { setEditingMovie(item); setIsManagementModalOpen(true); }} 
            accentColor="text-amber-400 border-amber-500"
          />

          <SectionRow 
            title="Blockbuster Movies" 
            items={topMovies} 
            userRole={userRole} 
            onSelect={setSelectedMovie} 
            onEdit={(item) => { setEditingMovie(item); setIsManagementModalOpen(true); }} 
            accentColor="text-hotstar-blue border-hotstar-blue"
          />

          <SectionRow 
            title="Top Rated TV Shows" 
            items={topShows} 
            userRole={userRole} 
            onSelect={setSelectedMovie} 
            onEdit={(item) => { setEditingMovie(item); setIsManagementModalOpen(true); }} 
            accentColor="text-fuchsia-400 border-fuchsia-500"
          />
        </div>
      );
    }

    // Movies, TV Shows, or Trending Focused View
    if (activeCategory === 'Movies') {
      const sortedByRating = [...filteredMedia].sort((a, b) => b.rating - a.rating);
      const top3 = sortedByRating.slice(0, 3);
      const top4to10 = sortedByRating.slice(3, 10);
      const remainingMovies = sortedByRating.slice(10);

      return (
        <div className="space-y-16 pb-20 px-8">
          {/* Featured Global Charts */}
          <section>
            <div className="mb-10 flex flex-col items-start gap-1">
              <h3 className="text-3xl font-display font-black uppercase italic tracking-tighter text-white">
                Featured Global <span className="text-hotstar-blue">Charts</span>
              </h3>
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Top Rated Recommendations • Weekly Update</p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {top3.map((movie, index) => (
                <FeaturedRankCard 
                  key={movie.id} 
                  movie={movie} 
                  rank={index + 1} 
                  onClick={() => setSelectedMovie(movie)} 
                />
              ))}
            </div>
          </section>

          {/* Trending Highlights */}
          <section>
            <div className="mb-10 flex flex-col items-start gap-1">
              <h3 className="text-2xl font-display font-black uppercase italic tracking-tighter text-white">
                Trending <span className="text-hotstar-blue">Highlights</span>
              </h3>
              <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Top 4 - 10 Trending This Week</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
              {top4to10.map((movie, index) => (
                <MovieCard 
                  key={movie.id} 
                  movie={movie} 
                  rank={index + 4} 
                  userRole={userRole}
                  onEdit={() => {
                    setEditingMovie(movie);
                    setIsManagementModalOpen(true);
                  }}
                  onClick={() => setSelectedMovie(movie)} 
                />
              ))}
            </div>
          </section>

          {/* Library Catalog */}
          {remainingMovies.length > 0 && (
            <section>
              <div className="mb-10 flex flex-col items-start gap-1">
                <h3 className="text-2xl font-display font-black uppercase italic tracking-tighter text-white/40">
                  Library <span className="text-white/20">Catalog</span>
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 opacity-60 hover:opacity-100 transition-opacity duration-500">
                {remainingMovies.map((item) => (
                  <MovieCard 
                    key={item.id} 
                    movie={item} 
                    onClick={() => setSelectedMovie(item)} 
                    userRole={userRole}
                    onEdit={() => {
                      setEditingMovie(item);
                      setIsManagementModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      );
    }

    return (
      <div className="px-8 pb-20">
        <section className="relative">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-hotstar-blue px-3 border-l-2 border-hotstar-blue">
              All {activeCategory}
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredMedia.map((item) => (
              <MovieCard 
                key={item.id} 
                movie={item} 
                onClick={() => setSelectedMovie(item)} 
                userRole={userRole}
                onEdit={() => {
                  setEditingMovie(item);
                  setIsManagementModalOpen(true);
                }}
              />
            ))}
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-dark-bg selection:bg-hotstar-blue selection:text-white font-sans overflow-hidden">
      {!userRole ? (
        portalStep === 'login' ? (
          <div className="min-h-screen bg-[#030b17] text-white overflow-hidden flex flex-col items-center justify-center relative p-6">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-hotstar-blue/10 rounded-full blur-[120px]" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px]" />
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md bg-white/5 backdrop-blur-2xl p-12 rounded-[2.5rem] relative z-20 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            >
              <div className="flex justify-between items-center mb-10">
                <button 
                  onClick={() => setPortalStep('selection')}
                  className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all border border-white/10"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
                <h2 className="text-2xl font-display font-black tracking-tighter uppercase italic">Secure Login</h2>
                <div className="w-10" />
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2">Display Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter your name..."
                    className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none focus:border-hotstar-blue/50 focus:ring-4 focus:ring-hotstar-blue/10 transition-all placeholder:text-white/10"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2">Mobile Number</label>
                  <div className="flex gap-2">
                     <div className="px-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white/40">+91</div>
                     <input 
                        type="tel" 
                        placeholder="Enter mobile number"
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none focus:border-hotstar-blue/50 focus:ring-4 focus:ring-hotstar-blue/10 transition-all placeholder:text-white/10"
                      />
                  </div>
                </div>

                <div className="pt-6 space-y-4">
                  <button 
                    onClick={() => setUserRole('user')}
                    className="w-full bg-hotstar-blue text-white font-black py-5 rounded-2xl shadow-2xl shadow-hotstar-blue/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-[0.2em]"
                  >
                    Continue
                  </button>

                  <div className="relative flex items-center justify-center py-4">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                    <span className="relative z-10 bg-[#030b17] px-6 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">OR</span>
                  </div>

                  <button 
                    onClick={handleGoogleLogin}
                    className="w-full bg-white/5 border border-white/10 py-5 rounded-2xl font-black flex items-center justify-center gap-4 hover:bg-white/10 transition-all text-sm uppercase tracking-widest text-white tracking-[0.1em]"
                  >
                    <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="" />
                    Google ID
                  </button>
                </div>
              </div>

              <p className="mt-10 text-center text-[9px] text-white/20 font-bold uppercase tracking-widest leading-relaxed">
                By continuing, you agree to CINEVIBE'S <br/>Terms of Service & Privacy Policy.
              </p>
            </motion.div>
          </div>
        ) : (
          <div className="min-h-screen bg-[#030b17] text-white overflow-hidden flex flex-col items-center justify-center relative p-6">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-hotstar-blue/10 rounded-full blur-[120px]" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px]" />
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 text-center mb-16"
            >
              <div className="flex items-center justify-center gap-4 mb-4">
                 <div className="w-12 h-12 rounded-2xl bg-hotstar-blue flex items-center justify-center shadow-2xl shadow-hotstar-blue/40">
                   <Film className="w-8 h-8 text-white" />
                 </div>
                 <h1 className="text-6xl font-display font-black tracking-tighter italic text-white uppercase translate-y-1">
                  CINE<span className="text-hotstar-blue">VIBE</span>
                </h1>
              </div>
              <p className="text-white/30 uppercase tracking-[0.5em] text-[10px] font-black mt-4">Select Portal</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 w-full max-w-6xl">
              <PortalCard 
                role="user" 
                title="User" 
                description="Access your personal library and stream cinematic content"
                icon={<User />}
                onClick={() => setPortalStep('login')}
                shadowColor="hotstar-blue"
              />
              <PortalCard 
                role="employee" 
                title="Employee" 
                description="Manage content, analyze metrics and support viewers"
                icon={<Briefcase />}
                onClick={() => setUserRole('employee')}
                shadowColor="hotstar-blue"
              />
              <PortalCard 
                role="owner" 
                title="Owner" 
                description="System configuration and executive global controls"
                icon={<Shield />}
                onClick={() => setUserRole('owner')}
                shadowColor="hotstar-blue"
              />
            </div>

            <div className="mt-20 text-white/10 text-[9px] font-black uppercase tracking-[0.5em] relative z-10">
              CINEVIBE ENTERTAINMENT SYSTEM • 2024
            </div>
          </div>
        )
      ) : (
        <div className="flex h-screen relative">
          {/* Expandable Sidebar */}
          <aside className="fixed left-0 top-0 h-full w-20 hover:w-64 bg-[#0f1014]/95 backdrop-blur-3xl border-r border-white/5 z-[100] transition-all duration-300 group overflow-hidden flex flex-col items-center group-hover:items-start pt-12 shadow-2xl shadow-black">
            <div className="mb-12 px-6">
               <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-hotstar-blue to-indigo-600 flex items-center justify-center shadow-xl">
                 <Film className="w-6 h-6 text-white" />
               </div>
            </div>

            <nav className="flex-1 w-full flex flex-col items-center group-hover:items-start">
              <SidebarItem expand={true} icon={<Home className="w-5 h-5" />} label="Home" active={activeCategory === 'Home'} onClick={() => setActiveCategory('Home')} />
              <SidebarItem expand={true} icon={<Film className="w-5 h-5" />} label="Movies" active={activeCategory === 'Movies'} onClick={() => setActiveCategory('Movies')} />
              <SidebarItem expand={true} icon={<Tv className="w-5 h-5" />} label="TV Shows" active={activeCategory === 'TV Shows'} onClick={() => setActiveCategory('TV Shows')} />
              <SidebarItem expand={true} icon={<TrendingUp className="w-5 h-5" />} label="Trending" active={activeCategory === 'Trending'} onClick={() => setActiveCategory('Trending')} />
            </nav>

            <div className="w-full space-y-0 mb-8 flex flex-col items-center group-hover:items-start border-t border-white/5 pt-6">
               {(userRole === 'owner' || userRole === 'employee') && (
                  <SidebarItem expand={true} icon={<PlusCircle className="w-5 h-5 text-amber-400" />} label="Add Content" onClick={() => { setEditingMovie(null); setIsManagementModalOpen(true); }} />
               )}
               <SidebarItem 
                expand={true} 
                icon={<User className="w-5 h-5" />} 
                label="Account" 
                onClick={() => setIsProfileExpanded(!isProfileExpanded)} 
              />
              <SidebarItem 
                expand={true} 
                icon={<LogOut className="w-5 h-5" />} 
                label="Log Out" 
                danger
                onClick={() => setUserRole(null)} 
              />
            </div>
          </aside>

          <main className="flex-1 ml-20 transition-all overflow-y-auto h-screen no-scrollbar relative">
            {/* Top Navbar */}
            <header className={`fixed top-0 right-0 left-20 z-50 px-12 py-8 flex justify-between items-center bg-gradient-to-b from-[#0f1014]/90 via-[#0f1014]/50 to-transparent pointer-events-none`}>
              <div className="flex items-center gap-12 pointer-events-auto">
                 <h1 className="text-3xl font-display font-black tracking-tighter uppercase italic text-white flex items-center gap-2">
                  CINE<span className="text-hotstar-blue">VIBE</span>
                </h1>
              </div>

              <div className="relative group flex items-center gap-8 pointer-events-auto">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-hotstar-blue transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Search movies, shows and more" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-full pl-12 pr-6 py-2.5 w-64 md:w-96 text-xs outline-none focus:ring-2 focus:ring-hotstar-blue/30 focus:border-hotstar-blue/50 transition-all placeholder:text-white/20"
                  />
                </div>
                <button 
                  className="w-10 h-10 rounded-full bg-hotstar-blue/20 border border-hotstar-blue/30 flex items-center justify-center font-black text-hotstar-blue text-xs hover:bg-hotstar-blue hover:text-white transition-all shadow-lg"
                  onClick={() => setIsProfileExpanded(!isProfileExpanded)}
                >
                  {auth.currentUser?.email?.[0].toUpperCase() || 'U'}
                </button>
              </div>
            </header>

            {/* Hero Section */}
            {!searchQuery && activeCategory !== 'Trending' && featuredMedia && (
              <motion.section 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={featuredMedia.id}
                className="relative h-[85vh] w-full overflow-hidden"
              >
                <div className="absolute inset-0">
                  <img 
                    src={featuredMedia.bannerUrl} 
                    className="w-full h-full object-cover" 
                    alt={featuredMedia.title} 
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0f1014] via-[#0f1014]/60 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f1014] via-transparent to-transparent" />
                </div>

                <div className="relative h-full flex flex-col justify-center px-20 md:px-32 max-w-4xl z-10">
                  <motion.div 
                     initial={{ y: 30, opacity: 0 }}
                     animate={{ y: 0, opacity: 1 }}
                     transition={{ delay: 0.2 }}
                     className="space-y-6"
                  >
                    <div className="flex items-center gap-4">
                      <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">Featured</span>
                      <span className="text-white/60 text-sm font-medium">{featuredMedia.year} • {featuredMedia.duration} • {featuredMedia.genre[0]}</span>
                    </div>
                    
                    <h2 className="text-7xl md:text-9xl font-display font-black tracking-tighter uppercase italic drop-shadow-2xl">
                      {featuredMedia.title}
                    </h2>
                    
                    <p className="text-lg text-white/70 line-clamp-3 leading-relaxed max-w-xl font-medium">
                      {featuredMedia.description}
                    </p>

                    <div className="flex items-center gap-4 pt-6">
                      <button 
                        onClick={() => setSelectedMovie(featuredMedia)}
                        className="bg-white text-black px-12 py-4 rounded-xl font-black flex items-center gap-4 hover:bg-hotstar-blue hover:text-white transition-all active:scale-95 shadow-2xl text-sm"
                      >
                        <Play className="w-5 h-5 fill-current" /> WATCH NOW
                      </button>
                      <button className="glass px-12 py-4 rounded-xl font-black flex items-center gap-4 hover:bg-white/20 transition-all text-sm uppercase tracking-widest">
                        <Plus className="w-5 h-5" /> Watchlist
                      </button>
                    </div>
                  </motion.div>
                </div>
              </motion.section>
            )}

            {/* Catalog Rows */}
            <div className={!searchQuery && activeCategory !== 'Trending' ? "-mt-20 relative z-20" : "pt-32"}>
              {renderContent()}
            </div>
          </main>
        </div>
      )}

      {/* Movie Details Modal */}
      <AnimatePresence>
        {selectedMovie && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-12 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              className="glass max-w-6xl w-full rounded-[3.5rem] overflow-hidden flex relative shadow-3xl h-[80vh]"
            >
              <button 
                onClick={() => setSelectedMovie(null)}
                className="absolute top-10 right-10 z-10 w-12 h-12 glass rounded-full flex items-center justify-center hover:bg-white/20 transition-all"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="w-5/12 relative group h-full">
                <img src={selectedMovie.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-black/80" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <div className="w-20 h-20 bg-hotstar-blue rounded-full flex items-center justify-center shadow-hotstar-blue/40 shadow-2xl">
                     <Play className="w-10 h-10 fill-current text-white ml-2" />
                   </div>
                </div>
              </div>
              
              <div className="w-7/12 p-16 flex flex-col justify-center overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-3 mb-8">
                  {selectedMovie.genre.map(g => (
                    <span key={g} className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-white/5 border border-white/10 rounded-lg">
                      {g}
                    </span>
                  ))}
                  <div className="ml-auto flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-amber-400 font-black text-sm">{selectedMovie.rating} IMDb</span>
                  </div>
                </div>
                
                <h2 className="text-6xl font-display font-black mb-6 tracking-tighter leading-[0.9]">
                  {selectedMovie.title}
                </h2>
                
                <div className="flex items-center gap-6 text-white/40 text-xs font-bold uppercase tracking-widest mb-10">
                  <span>{selectedMovie.year}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-hotstar-blue/40" />
                  <span>{selectedMovie.duration}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-hotstar-blue/40" />
                  <span className="text-white/70">{selectedMovie.language} Original</span>
                </div>

                <p className="text-xl text-white/60 leading-relaxed font-light mb-12">
                  {selectedMovie.description}
                </p>

                <div className="flex flex-col gap-6">
                  <div className="flex gap-6">
                    <button className="flex-1 bg-hotstar-blue text-white py-5 rounded-3xl font-black flex items-center justify-center gap-4 hover:bg-white hover:text-black transition-all active:scale-95 shadow-2xl">
                      <Play className="w-6 h-6 fill-current" /> Start Streaming Now
                    </button>
                    <button className="w-20 glass rounded-3xl flex items-center justify-center hover:bg-white/20 transition-all">
                      <Library className="w-8 h-8" />
                    </button>
                  </div>
                  
                  {userRole === 'employee' && (
                    <button 
                      onClick={() => {
                        setEditingMovie(selectedMovie);
                        setIsManagementModalOpen(true);
                      }}
                      className="w-full glass py-4 rounded-3xl font-black flex items-center justify-center gap-4 hover:bg-white hover:text-black transition-all border border-hotstar-blue/30 text-hotstar-blue uppercase tracking-widest text-xs"
                    >
                      <Edit className="w-4 h-4" /> Update Movie Details
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Management Modal (Add/Update) */}
      <AnimatePresence>
        {isManagementModalOpen && (
          <ManagementModal 
            movie={editingMovie} 
            onClose={() => setIsManagementModalOpen(false)} 
            onSave={async (updatedMovie) => {
              const path = `mediaItems/${updatedMovie.id}`;
              try {
                await setDoc(doc(db, 'mediaItems', updatedMovie.id), updatedMovie);
                setIsManagementModalOpen(false);
                setEditingMovie(null);
                setSelectedMovie(null); // Close details modal if it was open
              } catch (error) {
                handleFirestoreError(error, OperationType.WRITE, path);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Global Status Footer */}
      <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-8 px-8 py-3 bg-black/60 rounded-full border border-white/10 text-[9px] font-black tracking-[0.3em] text-white/30 uppercase backdrop-blur-md shadow-2xl">
        <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> 4K Stream Ready</span>
        <span className="w-1 h-1 bg-white/10 rounded-full" />
        <span>Spatial Audio Support</span>
        <span className="w-1 h-1 bg-white/10 rounded-full" />
        <span>Server: CINEVIBE-ASIA-01</span>
      </footer>
    </div>
  );
}

function SidebarItem({ icon, label, count, active = false, danger = false, onClick, expand = false }: { icon: ReactNode, label: string, count?: number, active?: boolean, danger?: boolean, onClick?: () => void, expand?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-6 px-6 py-4 transition-all relative group/item overflow-hidden ${
        active 
          ? 'text-hotstar-blue' 
          : danger 
            ? 'text-rose-500 hover:bg-rose-500/10' 
            : 'text-white/50 hover:text-white hover:bg-white/10'
      }`}
    >
      <div className={`${active ? 'scale-125 text-hotstar-blue drop-shadow-[0_0_8px_rgba(3,119,204,0.6)]' : 'group-hover/item:scale-110 group-hover/item:text-white'} transition-all duration-300`}>
        {icon}
      </div>
      <span className={`text-sm font-bold tracking-tight transition-all duration-300 whitespace-nowrap ${expand ? 'opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0' : ''}`}>
        {label}
      </span>
      {count !== undefined && expand && (
        <span className="ml-auto bg-white/10 text-[10px] font-black px-2 py-0.5 rounded-full group-hover:opacity-100 opacity-0 transition-opacity">
          {count}
        </span>
      )}
      {active && (
        <motion.div 
          layoutId="sidebar-active"
          className="absolute left-0 w-1 h-8 bg-hotstar-blue rounded-r-full shadow-[0_0_15px_#0377cc]"
        />
      )}
    </button>
  );
}

function SectionRow({ title, items, userRole, onSelect, onEdit, accentColor }: { 
  title: string, 
  items: MediaItem[], 
  userRole?: UserRole, 
  onSelect: (item: MediaItem) => void, 
  onEdit: (item: MediaItem) => void,
  accentColor: string
}) {
  return (
    <section className="relative group/section">
      <div className="flex items-center justify-between mb-6">
        <h3 className={`text-sm font-bold uppercase tracking-[0.2em] px-3 border-l-2 ${accentColor}`}>
          {title}
        </h3>
        <button className="text-[10px] uppercase tracking-widest font-black text-white/30 hover:text-hotstar-blue transition-colors">
          View All
        </button>
      </div>
      <div className="horizontal-scroll pb-6 group-hover/section:mask-fade transition-all">
        {items.map((item) => (
          <div key={item.id} className="horizontal-scroll-item">
            <MovieCard 
              movie={item} 
              onClick={() => onSelect(item)} 
              userRole={userRole} 
              onEdit={() => onEdit(item)} 
            />
          </div>
        ))}
      </div>
    </section>
  );
}

interface MovieCardProps {
  movie: MediaItem;
  onClick: () => void;
  onEdit?: () => void;
  userRole?: UserRole;
  rank?: number;
}

function FeaturedRankCard({ movie, rank, onClick }: { movie: MediaItem, rank: number, onClick: () => void }) {
  return (
    <motion.div 
      whileHover={{ y: -8, scale: 1.01 }}
      onClick={onClick}
      className="bg-[#1a1c21]/80 backdrop-blur-xl rounded-[2rem] overflow-hidden flex h-80 border border-white/5 hover:border-hotstar-blue/30 transition-all cursor-pointer group shadow-2xl"
    >
      <div className="w-5/12 relative overflow-hidden">
        <img src={movie.thumbnailUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={movie.title} />
        <div className="absolute top-4 left-4 bg-hotstar-blue px-3 py-1.5 rounded-xl text-xs font-black italic shadow-2xl z-20">
          #{rank}
        </div>
        <button className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-hotstar-blue transition-all z-10">
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>
      <div className="w-7/12 p-8 flex flex-col relative bg-gradient-to-br from-[#1a1c21] to-[#121418]">
        <div className="flex flex-col">
           <h4 className="font-display font-black text-2xl leading-tight uppercase italic transition-colors group-hover:text-hotstar-blue line-clamp-1">{movie.title}</h4>
           <div className="flex items-center gap-3 mt-3 text-[11px] font-bold text-white/40 uppercase tracking-widest">
             <span>{movie.year}</span>
             <span className="w-1 h-1 bg-white/20 rounded-full" />
             <span>{movie.duration}</span>
             <span className="px-2 py-0.5 border border-white/10 rounded uppercase text-[9px] font-black">{movie.rating >= 9.0 ? 'PG-13' : 'R'}</span>
           </div>
        </div>
        
        <div className="flex items-center gap-4 mt-6">
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-sm font-black text-amber-400">{movie.rating}</span>
            <span className="text-[10px] text-white/20 font-bold ml-1">(82K)</span>
          </div>
          <button className="flex items-center gap-1.5 text-[11px] font-black text-hotstar-blue uppercase tracking-widest hover:text-white transition-colors">
            <Star className="w-4 h-4" /> Rate
          </button>
        </div>

        <button className="flex items-center gap-2 mt-6 text-[11px] font-black text-white/40 hover:text-white transition-colors uppercase tracking-widest group/btn self-start">
          <Eye className="w-5 h-5 group-hover/btn:text-hotstar-blue transition-colors" /> Mark as watched
        </button>

        <p className="mt-6 text-[11px] leading-relaxed text-white/30 line-clamp-3 font-medium">
          {movie.description}
        </p>
      </div>
    </motion.div>
  );
}

function MovieCard({ movie, onClick, onEdit, userRole, rank }: MovieCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="group cursor-pointer flex flex-col relative"
    >
      <div 
        onClick={onClick}
        className="relative aspect-[3/4.5] rounded-2xl overflow-hidden mb-3 border border-white/5 shadow-2xl transition-all group-hover:border-hotstar-blue/40 group-hover:shadow-[0_0_30px_rgba(3,119,204,0.15)]"
      >
        <img 
          src={movie.thumbnailUrl} 
          alt={movie.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        {rank !== undefined && (
          <div className="absolute top-0 left-0 bg-hotstar-blue px-4 py-2 text-[11px] font-black italic rounded-br-2xl shadow-2xl z-20 select-none">
            #{rank}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
          <div className="w-14 h-14 bg-hotstar-blue rounded-full flex items-center justify-center shadow-2xl transform scale-50 group-hover:scale-100 transition-all duration-300">
            <Play className="w-7 h-7 fill-current text-white ml-1.5" />
          </div>
        </div>

        <div className="absolute top-2 right-2 flex flex-col gap-2 z-10 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all">
           <button className="w-9 h-9 glass rounded-xl flex items-center justify-center hover:bg-hotstar-blue transition-colors">
             <Plus className="w-4 h-4" />
           </button>
        </div>
      </div>

      {userRole === 'owner' && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          className="absolute top-2 left-2 z-20 w-8 h-8 rounded-full glass border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white hover:text-black"
        >
          <Edit className="w-4 h-4" />
        </button>
      )}

      <div onClick={onClick} className="px-1 mt-2">
        <div className="flex items-center justify-between gap-2 overflow-hidden mb-1">
          <h4 className="font-bold text-[13px] truncate tracking-tight text-white/80 group-hover:text-white transition-colors">
            {movie.title}
          </h4>
          <div className="flex items-center gap-1 shrink-0">
             <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
             <span className="text-[11px] font-bold text-amber-400">{movie.rating}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 opacity-40">
           <span className="text-[10px] font-bold uppercase tracking-widest">{movie.year}</span>
           <span className="text-[10px] font-bold uppercase tracking-widest">{movie.genre[0]}</span>
        </div>
      </div>
    </motion.div>
  );
}

function PortalCard({ role, title, description, icon, onClick, shadowColor }: { role: string, title: string, description: string, icon: ReactNode, onClick: () => void, shadowColor: string }) {
  return (
    <motion.div
      whileHover={{ y: -10, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative group cursor-pointer p-10 flex flex-col items-center text-center transition-all duration-500 overflow-hidden h-[450px] justify-center rounded-3xl border border-white/5 bg-gradient-to-b from-white/5 to-white/[0.02] hover:border-hotstar-blue/40 shadow-2xl hover:shadow-${shadowColor}/20`}
    >
      <div className={`absolute inset-0 bg-gradient-to-t from-hotstar-blue/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
      
      <div className={`w-24 h-24 rounded-full mb-10 flex items-center justify-center bg-white/5 border border-white/10 shadow-2xl transition-all group-hover:scale-110 group-hover:bg-hotstar-blue shadow-hotstar-blue/20`}>
        {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<any>, { className: 'w-10 h-10 text-white' })}
      </div>

      <h3 className="text-4xl font-display font-black mb-4 tracking-tighter uppercase italic">{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed max-w-[220px] font-medium">{description}</p>

      <div className="mt-12 px-10 py-4 rounded-xl bg-hotstar-blue text-white text-[11px] font-black uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0 shadow-xl shadow-hotstar-blue/40">
        Enter Portal
      </div>
    </motion.div>
  );
}

function ManagementModal({ movie, onClose, onSave }: { movie: MediaItem | null, onClose: () => void, onSave: (movie: MediaItem) => void }) {
  const [formData, setFormData] = useState<Partial<MediaItem>>(
    movie || {
      title: '',
      description: '',
      rating: 7.0,
      year: 2024,
      duration: '2h 0m',
      genre: ['Action'],
      language: 'Bollywood',
      thumbnailUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=400&h=600&fit=crop',
      bannerUrl: 'https://images.unsplash.com/photo-1478720568477-152d9b164626?q=80&w=1200&h=600&fit=crop',
      mediaType: 'movie'
    }
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="glass max-w-4xl w-full p-12 rounded-[4rem] relative overflow-hidden shadow-3xl"
      >
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-4xl font-display font-black tracking-tighter uppercase italic">
            {movie ? 'Update Content' : 'Add New Content'}
          </h2>
          <button onClick={onClose} className="w-12 h-12 glass rounded-full flex items-center justify-center hover:bg-white/20">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Content Title</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none focus:border-indigo-500/50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Description</label>
              <textarea 
                rows={3}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none focus:border-indigo-500/50 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Rating</label>
                <input 
                  type="number" step="0.1"
                  value={formData.rating}
                  onChange={e => setFormData({ ...formData, rating: parseFloat(e.target.value) })}
                  className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Year</label>
                <input 
                  type="number"
                  value={formData.year}
                  onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Thumbnail URL</label>
              <input 
                type="text" 
                value={formData.thumbnailUrl}
                onChange={e => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Duration</label>
              <input 
                type="text"
                value={formData.duration}
                onChange={e => setFormData({ ...formData, duration: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Industry / Language</label>
              <select 
                value={formData.language}
                onChange={e => setFormData({ ...formData, language: e.target.value as any })}
                className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none appearance-none"
              >
                <option value="Bollywood" className="bg-dark-bg">Bollywood</option>
                <option value="Hollywood" className="bg-dark-bg">Hollywood</option>
                <option value="Kannada" className="bg-dark-bg">Kannada</option>
                <option value="Hindi" className="bg-dark-bg">Hindi</option>
                <option value="English" className="bg-dark-bg">English</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Banner URL</label>
              <input 
                type="text" 
                value={formData.bannerUrl}
                onChange={e => setFormData({ ...formData, bannerUrl: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none focus:border-indigo-500/50"
              />
            </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Media Type</label>
                  <select 
                    value={formData.mediaType}
                    onChange={e => setFormData({ ...formData, mediaType: e.target.value as any })}
                    className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none appearance-none"
                  >
                    <option value="movie" className="bg-dark-bg">Movie</option>
                    <option value="tv-show" className="bg-dark-bg">TV Show</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Actions</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onSave({ ...formData, id: movie?.id || Math.random().toString(36).substr(2, 9) } as MediaItem)}
                      className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-indigo-500 transition-all text-[10px] uppercase tracking-widest"
                    >
                      {movie ? 'Update Database' : 'Add Content'}
                    </button>
                    {movie && (
                      <button 
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete this content?')) {
                            const path = `mediaItems/${movie.id}`;
                            try {
                              await deleteDoc(doc(db, 'mediaItems', movie.id));
                              onClose();
                            } catch (error) {
                              handleFirestoreError(error, OperationType.DELETE, path);
                            }
                          }
                        }}
                        className="px-4 bg-rose-600/20 text-rose-500 border border-rose-500/20 font-black py-4 rounded-2xl hover:bg-rose-600 hover:text-white transition-all text-[10px] uppercase tracking-widest"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

