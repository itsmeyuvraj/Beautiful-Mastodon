/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Heart, 
  Repeat, 
  MessageCircle, 
  User, 
  LogOut, 
  Search, 
  Hash,
  Bell,
  Home,
  RefreshCw,
  X,
  ExternalLink,
  Flag,
  Image as ImageIcon,
  Loader2,
  ArrowLeft,
  TrendingUp,
  Settings,
  ChevronDown,
  Globe,
  Ghost,
  Bookmark,
  Users as UsersGroup,
  Plus,
  Trash2,
  AtSign,
  Lock,
  Camera,
  MessageSquare,
  Menu,
  Send as SendIcon,
  Monitor,
  Sun,
  Moon,
  Cpu,
  Info,
  Shield
} from 'lucide-react';

// Types
interface Account {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  header: string;
  note: string;
  url: string;
  followers_count: number;
  following_count: number;
  statuses_count: number;
}

interface Relationship {
  id: string;
  following: boolean;
  followed_by: boolean;
  blocking: boolean;
  muting: boolean;
  requested: boolean;
  domain_blocking: boolean;
  showing_reblogs: boolean;
  endorsed: boolean;
  notifying: boolean;
  languages: string[];
  note: string;
}

interface SavedAccount {
  account: Account;
  token: string;
  instance: string;
}

interface Status {
  id: string;
  created_at: string;
  content: string;
  account: Account;
  reblog: Status | null;
  replies_count: number;
  reblogs_count: number;
  favourites_count: number;
  media_attachments: any[];
  favourited: boolean;
  reblogged: boolean;
  bookmarked: boolean;
  language: string | null;
}

const COUNTRIES = [
  { name: 'Global', code: null, flag: '🌐' },
  { name: 'USA', code: 'en', flag: '🇺🇸' },
  { name: 'UK', code: 'en', flag: '🇬🇧' },
  { name: 'Japan', code: 'ja', flag: '🇯🇵' },
  { name: 'France', code: 'fr', flag: '🇫🇷' },
  { name: 'Germany', code: 'de', flag: '🇩🇪' },
  { name: 'Spain', code: 'es', flag: '🇪🇸' },
  { name: 'Brazil', code: 'pt', flag: '🇧🇷' },
  { name: 'Italy', code: 'it', flag: '🇮🇹' },
  { name: 'India', code: 'hi', flag: '🇮🇳' },
  { name: 'Korea', code: 'ko', flag: '🇰🇷' },
  { name: 'China', code: 'zh', flag: '🇨🇳' },
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [instance, setInstance] = useState('');
  const [currentUser, setCurrentUser] = useState<Account | null>(null);
  const [targetAccount, setTargetAccount] = useState<Account | null>(null);
  const [targetRelationship, setTargetRelationship] = useState<Relationship | null>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleApiError = async (res: Response) => {
    if (res.status === 401) {
      setIsAuthenticated(false);
    }
    return res;
  };
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [editHeaderFile, setEditHeaderFile] = useState<File | null>(null);
  const [editHeaderPreview, setEditHeaderPreview] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const startEditingProfile = () => {
    if (currentUser) {
      setEditDisplayName(currentUser.display_name);
      // Strip HTML for the editor as the Mastodon update_credentials expects plaintext for note? 
      // Actually it usually returns HTML but accepts content.
      // We'll just use the raw note string but it might have HTML. 
      // Improving: replace <br/> with \n and strip other tags for a better editing experience.
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = currentUser.note;
      setEditNote(tempDiv.innerText || tempDiv.textContent || '');
      setEditAvatarPreview(currentUser.avatar);
      setEditAvatarFile(null);
      setEditHeaderPreview(currentUser.header);
      setEditHeaderFile(null);
      pushView('editProfile');
    }
  };

  const handleViewProfile = async (account: Account) => {
    pushView('profile', account);
    fetchUserStatuses(account.id);
    setTargetRelationship(null);
    
    // Optionally fetch full account info to get header etc if missing
    try {
      const [accRes, relRes] = await Promise.all([
        fetch(`/api/mastodon/v1/accounts/${account.id}`),
        fetch(`/api/mastodon/v1/accounts/relationships?id[]=${account.id}`)
      ]);

      if (accRes.ok) {
        const fullAccount = await accRes.json();
        setTargetAccount(fullAccount);
      }

      if (relRes.ok) {
        const relationships = await relRes.json();
        if (relationships.length > 0) {
          setTargetRelationship(relationships[0]);
        }
      }
    } catch (e) {
      console.error('Failed to fetch account details or relationships', e);
    }
  };

  const handleUpdateProfile = async () => {
    setIsUpdatingProfile(true);
    try {
      const formData = new FormData();
      formData.append('display_name', editDisplayName);
      formData.append('note', editNote);
      if (editAvatarFile) {
        formData.append('avatar', editAvatarFile);
      }
      if (editHeaderFile) {
        formData.append('header', editHeaderFile);
      }

      const res = await fetch('/api/mastodon/v1/accounts/update_credentials', {
        method: 'PATCH',
        body: formData
      });

      if (res.ok) {
        const updatedUser = await res.json();
        setCurrentUser(updatedUser);
        if (view === 'editProfile') goBack();
        alert('Profile updated successfully!');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update profile');
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred while updating profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const [profileTab, setProfileTab] = useState<'posts' | 'replies' | 'media'>('posts');
  const [composeOpen, setComposeOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('app-theme') as any) || 'system';
  });
  const [autoRefresh, setAutoRefresh] = useState(() => {
    return localStorage.getItem('auto-refresh') !== 'false';
  });

  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;
      let effectiveTheme = theme;
      if (theme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      root.setAttribute('data-theme', effectiveTheme);
    };
    
    applyTheme();
    localStorage.setItem('app-theme', theme);
    
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('auto-refresh', String(autoRefresh));
  }, [autoRefresh]);
  const [newToot, setNewToot] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [view, setView] = useState<'home' | 'notifications' | 'search' | 'profile' | 'details' | 'trending' | 'bookmarks' | 'editProfile' | 'settings'>('home');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const [context, setContext] = useState<{ ancestors: Status[], descendants: Status[] }>({ ancestors: [], descendants: [] });
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userStatuses, setUserStatuses] = useState<Status[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<Status[]>([]);
  const [trendingOffset, setTrendingOffset] = useState(0);
  const [hasMoreTrending, setHasMoreTrending] = useState(true);
  const [hasMoreHome, setHasMoreHome] = useState(true);
  const [hasMoreLocal, setHasMoreLocal] = useState(true);
  const [hasMoreFederated, setHasMoreFederated] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [bookmarks, setBookmarks] = useState<Status[]>([]);
  const [localStatuses, setLocalStatuses] = useState<Status[]>([]);
  const [federatedStatuses, setFederatedStatuses] = useState<Status[]>([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [history, setHistory] = useState<{view: typeof view, targetAccount: Account | null, selectedStatus: Status | null}[]>([]);

  const pushView = (newView: typeof view, account: Account | null = targetAccount, status: Status | null = selectedStatus) => {
    setHistory(prev => [...prev, { view, targetAccount, selectedStatus }]);
    if (account !== undefined) setTargetAccount(account);
    if (status !== undefined) setSelectedStatus(status);
    setView(newView);
  };

  const goBack = () => {
    if (history.length === 0) {
      setView('home');
      setTargetAccount(null);
      setSelectedStatus(null);
      return;
    }
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setView(last.view);
    setTargetAccount(last.targetAccount);
    setSelectedStatus(last.selectedStatus);
    
    // Refresh data if needed when returning to certain views
    if (last.view === 'profile' && last.targetAccount) {
      fetchUserStatuses(last.targetAccount.id);
    } else if (last.view === 'details' && last.selectedStatus) {
      fetchStatusDetail(last.selectedStatus.id);
    }
  };

  const resetToView = (newView: typeof view) => {
    setHistory([]);
    setTargetAccount(null);
    setSelectedStatus(null);
    setView(newView);
  };
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view === 'local') fetchLocal();
    if (view === 'federated') fetchFederated();
  }, [selectedLanguage]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      if (view === 'home') fetchTimeline();
      if (view === 'local') fetchLocal();
      if (view === 'federated') fetchFederated();
    }, 60000); // Polling every minute if auto-refresh is on
    
    return () => clearInterval(interval);
  }, [autoRefresh, view]);

  useEffect(() => {
    const saved = localStorage.getItem('mastodon_accounts');
    if (saved) setSavedAccounts(JSON.parse(saved));
  }, []);

  const saveAccount = useCallback((account: Account, token: string, instance: string) => {
    setSavedAccounts(prev => {
      const exists = prev.find(a => a.account.id === account.id && a.instance === instance);
      if (exists) return prev;
      const updated = [...prev, { account, token, instance }];
      localStorage.setItem('mastodon_accounts', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const switchAccount = async (saved: SavedAccount) => {
    setProfileMenuOpen(false);
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: saved.token, instance: saved.instance })
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isLoadingMore && !isRefreshing) {
        if (view === 'trending' && hasMoreTrending) fetchTrending(true);
        if (view === 'home' && hasMoreHome) fetchTimeline(true);
        if (view === 'local' && hasMoreLocal) fetchLocal(true);
        if (view === 'federated' && hasMoreFederated) fetchFederated(true);
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [view, isLoadingMore, isRefreshing, hasMoreTrending, hasMoreHome, hasMoreLocal, hasMoreFederated]);

  const fetchStatusDetail = async (id: string) => {
    setIsRefreshing(true);
    try {
      // Fetch status
      const sRes = await fetch(`/api/mastodon/v1/statuses/${id}`);
      if (!sRes.ok) throw new Error('Status not found');
      const sData = await sRes.json();
      
      // Fetch context (ancestors/descendants)
      const cRes = await fetch(`/api/mastodon/v1/statuses/${id}/context`);
      let cData = { ancestors: [], descendants: [] };
      if (cRes.ok) {
        cData = await cRes.json();
      }
      
      pushView('details', targetAccount, sData);
      setContext(cData);
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      alert('Could not load post details. It might have been deleted.');
    } finally {
      setIsRefreshing(false);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>({ accounts: [], statuses: [], hashtags: [] });
  const [searchRelationships, setSearchRelationships] = useState<Record<string, Relationship>>({});

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
      if (data.authenticated) {
        if (data.instance) setInstance(data.instance);
        fetchUser();
        fetchTimeline();
      }
    } catch (e) {
      setIsAuthenticated(false);
    }
  };

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/mastodon/v1/accounts/verify_credentials');
      const data = await res.json();
      setCurrentUser(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUserStatuses = async (accountId: string, tab: 'posts' | 'replies' | 'media' = 'posts') => {
    setIsRefreshing(true);
    setProfileTab(tab);
    try {
      let url = `/api/mastodon/v1/accounts/${accountId}/statuses?limit=40`;
      if (tab === 'posts') url += '&exclude_replies=true';
      if (tab === 'media') url += '&only_media=true';
      
      const res = await fetch(url);
      const data = await res.json();
      setUserStatuses(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setUserStatuses([]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchLocal = async (loadMore = false) => {
    if (loadMore) {
      if (isLoadingMore || !hasMoreLocal || localStatuses.length === 0) return;
      setIsLoadingMore(true);
    } else {
      setIsRefreshing(true);
      setHasMoreLocal(true);
    }

    try {
      const maxId = loadMore ? localStatuses[localStatuses.length - 1].id : undefined;
      let url = `/api/mastodon/v1/timelines/public?local=1&limit=20`;
      if (maxId) url += `&max_id=${maxId}`;
      if (selectedLanguage) url += `&lang=${selectedLanguage}`;
      const res = await fetch(url);
      const data = await res.json();
      const newPosts = Array.isArray(data) ? data : [];
      
      if (loadMore) {
        setLocalStatuses(prev => [...prev, ...newPosts]);
      } else {
        setLocalStatuses(newPosts);
      }
      
      if (newPosts.length < 20) setHasMoreLocal(false);
    } catch (e) {
      console.error(e);
      if (!loadMore) setLocalStatuses([]);
    } finally {
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const fetchFederated = async (loadMore = false) => {
    if (loadMore) {
      if (isLoadingMore || !hasMoreFederated || federatedStatuses.length === 0) return;
      setIsLoadingMore(true);
    } else {
      setIsRefreshing(true);
      setHasMoreFederated(true);
    }

    try {
      const maxId = loadMore ? federatedStatuses[federatedStatuses.length - 1].id : undefined;
      let url = `/api/mastodon/v1/timelines/public?limit=20`;
      if (maxId) url += `&max_id=${maxId}`;
      if (selectedLanguage) url += `&lang=${selectedLanguage}`;
      const res = await fetch(url);
      const data = await res.json();
      const newPosts = Array.isArray(data) ? data : [];
      
      if (loadMore) {
        setFederatedStatuses(prev => [...prev, ...newPosts]);
      } else {
        setFederatedStatuses(newPosts);
      }
      
      if (newPosts.length < 20) setHasMoreFederated(false);
    } catch (e) {
      console.error(e);
      if (!loadMore) setFederatedStatuses([]);
    } finally {
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const fetchBookmarks = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/mastodon/v1/bookmarks');
      const data = await res.json();
      setBookmarks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setBookmarks([]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchTrending = async (loadMore = false) => {
    if (loadMore) {
      if (isLoadingMore || !hasMoreTrending) return;
      setIsLoadingMore(true);
    } else {
      setIsRefreshing(true);
      setTrendingOffset(0);
      setHasMoreTrending(true);
    }

    try {
      const offset = loadMore ? trendingOffset + 20 : 0;
      // Use offset and timestamp to ensure fresh results from potential middle-caches
      const res = await fetch(`/api/mastodon/v1/trends/statuses?offset=${offset}&limit=20&_=${Date.now()}`);
      const data = await res.json();
      
      const newPosts = Array.isArray(data) ? data : [];
      if (loadMore) {
        setTrendingPosts(prev => [...prev, ...newPosts]);
        setTrendingOffset(offset);
      } else {
        setTrendingPosts(newPosts);
      }
      
      if (newPosts.length < 20) {
        setHasMoreTrending(false);
      }
    } catch (e) {
      console.error(e);
      if (!loadMore) setTrendingPosts([]);
    } finally {
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const fetchTimeline = async (loadMore = false) => {
    if (loadMore) {
      if (isLoadingMore || !hasMoreHome || statuses.length === 0) return;
      setIsLoadingMore(true);
    } else {
      setIsRefreshing(true);
      setHasMoreHome(true);
    }

    try {
      const maxId = loadMore ? statuses[statuses.length - 1].id : undefined;
      const res = await fetch(`/api/mastodon/v1/timelines/home?${maxId ? `max_id=${maxId}` : ''}&limit=20`);
      const data = await res.json();
      const newPosts = Array.isArray(data) ? data : [];
      
      if (loadMore) {
        setStatuses(prev => [...prev, ...newPosts]);
      } else {
        setStatuses(newPosts);
      }
      
      if (newPosts.length < 20) setHasMoreHome(false);
    } catch (e) {
      console.error(e);
      if (!loadMore) setStatuses([]);
    } finally {
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const fetchNotifications = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/mastodon/v1/notifications');
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setNotifications([]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults({ accounts: [], statuses: [], hashtags: [] });
      setSearchRelationships({});
      return;
    }
    try {
      const res = await fetch(`/api/mastodon/v2/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data);

      if (data.accounts?.length > 0) {
        const ids = data.accounts.map((a: any) => `id[]=${a.id}`).join('&');
        const relRes = await fetch(`/api/mastodon/v1/accounts/relationships?${ids}`);
        if (relRes.ok) {
          const rels = await relRes.json();
          const relMap = rels.reduce((acc: any, rel: any) => ({ ...acc, [rel.id]: rel }), {});
          setSearchRelationships(relMap);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (view === 'home') fetchTimeline();
    if (view === 'notifications') fetchNotifications();
    if (view === 'profile' && currentUser?.id) fetchUserStatuses(currentUser.id);
    if (view === 'trending') fetchTrending();
    if (view === 'local') fetchLocal();
    if (view === 'federated') fetchFederated();
    if (view === 'bookmarks') fetchBookmarks();
  }, [view, currentUser?.id]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { instance, token } = event.data;
        // Fetch user data for this new account
        try {
          const res = await fetch('/api/mastodon/v1/accounts/verify_credentials');
          const account = await res.json();
          saveAccount(account, token, instance);
          checkAuth();
        } catch (e) {
          console.error('Failed to fetch account info after auth', e);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [saveAccount]);

  const handleLogin = async (e: any) => {
    e.preventDefault();
    if (!instance) return;

    try {
      // Clean instance URL
      const cleanInstance = instance.replace(/^https?:\/\//, '').split('/')[0];
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance: cleanInstance })
      });
      const { client_id } = await regRes.json();

      const urlRes = await fetch(`/api/auth/url?instance=${cleanInstance}&client_id=${client_id}`);
      const { url } = await urlRes.json();

      window.open(url, 'mastodon_oauth', 'width=600,height=700');
    } catch (e) {
      console.error(e);
      alert('Failed to connect to instance');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAuthenticated(false);
    setCurrentUser(null);
    setStatuses([]);
  };

  const handleFollow = async (id: string, isFollowing?: boolean) => {
    // Optimistic update for profile relationship
    const originalRelationship = targetRelationship;
    if (targetAccount?.id === id && targetRelationship) {
      setTargetRelationship({
        ...targetRelationship,
        following: !isFollowing,
      });
    }

    try {
      const endpoint = isFollowing ? 'unfollow' : 'follow';
      const res = await fetch(`/api/mastodon/v1/accounts/${id}/${endpoint}`, { method: 'POST' });
      
      if (!res.ok) throw new Error('Follow failed');

      // Sync with server state
      if (targetAccount?.id === id) {
        const relRes = await fetch(`/api/mastodon/v1/accounts/relationships?id[]=${id}`);
        if (relRes.ok) {
          const relationships = await relRes.json();
          if (relationships.length > 0) {
            setTargetRelationship(relationships[0]);
          }
        }
      }
    } catch (e) {
      console.error(e);
      // Rollback on failure
      if (targetAccount?.id === id) {
        setTargetRelationship(originalRelationship);
      }
    }
  };

  const handleReport = async (statusId: string) => {
    const reason = prompt('Please describe why you are reporting this post:');
    if (!reason) return;
    try {
      await fetch('/api/mastodon/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_ids: [statusId], comment: reason })
      });
      alert('Report submitted. Thank you for keeping this community safe.');
    } catch (e) {
      console.error(e);
      alert('Failed to submit report');
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/mastodon/v1/statuses/${statusId}`, { method: 'DELETE' });
      if (res.ok) {
        const filterList = (list: Status[]) => list.filter(s => s.id !== statusId);
        setStatuses(filterList);
        setTrendingPosts(filterList);
        setLocalStatuses(filterList);
        setFederatedStatuses(filterList);
        setUserStatuses(filterList);
        setBookmarks(filterList);
        if (selectedStatus?.id === statusId) {
          setView('home');
          setSelectedStatus(null);
        }
      } else {
        alert('Failed to delete post');
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred while deleting the post');
    }
  };

  const handlePost = async () => {
    if (!newToot.trim() && selectedFiles.length === 0) return;
    setIsUploading(true);
    try {
      const mediaIds: string[] = [];
      
      // Upload media first if any
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        const mediaRes = await fetch('/api/mastodon/v1/media', {
          method: 'POST',
          body: formData
        });
        const mediaData = await mediaRes.json();
        if (mediaData.id) mediaIds.push(mediaData.id);
      }

      const body: any = { 
        status: newToot,
        media_ids: mediaIds
      };

      if (replyToId) {
        body.in_reply_to_id = replyToId;
      }

      await fetch('/api/mastodon/v1/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      setNewToot('');
      setSelectedFiles([]);
      setReplyToId(null);
      setComposeOpen(false);
      
      if (view === 'details' && selectedStatus) {
        fetchStatusDetail(selectedStatus.id);
      } else {
        fetchTimeline();
      }
    } catch (e) {
      console.error(e);
      alert('Failed to post. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const openReply = (status: Status) => {
    if (!status) return;
    const data = status.reblog || status;
    if (!data.account) return;
    setNewToot(`@${data.account.username} `);
    setReplyToId(data.id);
    setComposeOpen(true);
  };

  const handleInteract = async (id: string, type: 'favourite' | 'reblog' | 'bookmark') => {
    // 1. Find the current status to determine if we are toggling on or off and for potential rollback
    const findStatus = (list: Status[]) => list.find(s => s.id === id);
    const originalStatus = findStatus(statuses) || 
                        findStatus(trendingPosts) || 
                        findStatus(localStatuses) || 
                        findStatus(federatedStatuses) || 
                        findStatus(userStatuses) ||
                        (selectedStatus?.id === id ? selectedStatus : null) ||
                        context.ancestors.find(s => s.id === id) ||
                        context.descendants.find(s => s.id === id);

    if (!originalStatus) return;

    // 2. Prepare optimistic state
    const data = originalStatus.reblog || originalStatus;
    let isOn = false;
    if (type === 'favourite') isOn = data.favourited;
    if (type === 'reblog') isOn = data.reblogged;
    if (type === 'bookmark') isOn = originalStatus.bookmarked;

    const endpoint = isOn ? `un${type}` : type;

    // Deep clone to avoid mutating existing state
    const optimisticStatus = JSON.parse(JSON.stringify(originalStatus));
    const oData = optimisticStatus.reblog || optimisticStatus;

    if (type === 'favourite') {
      oData.favourited = !isOn;
      oData.favourites_count += isOn ? -1 : 1;
    } else if (type === 'reblog') {
      oData.reblogged = !isOn;
      oData.reblogs_count += isOn ? -1 : 1;
    } else if (type === 'bookmark') {
      optimisticStatus.bookmarked = !isOn;
    }

    const applyUpdate = (targetStatus: Status) => {
      const updateList = (list: Status[]) => list.map(s => s.id === id ? targetStatus : s);
      
      setStatuses(updateList);
      setTrendingPosts(updateList);
      setLocalStatuses(updateList);
      setFederatedStatuses(updateList);
      setUserStatuses(updateList);
      
      if (selectedStatus?.id === id) {
        setSelectedStatus(targetStatus);
      }

      setContext(prev => ({
        ancestors: prev.ancestors.map(s => s.id === id ? targetStatus : s),
        descendants: prev.descendants.map(s => s.id === id ? targetStatus : s),
      }));
    };

    // 3. Update UI immediately
    applyUpdate(optimisticStatus);

    try {
      const res = await fetch(`/api/mastodon/v1/statuses/${id}/${endpoint}`, { method: 'POST' });
      if (!res.ok) throw new Error('Interaction failed');
      const confirmedStatus = await res.json();
      
      // Update with server data to ensure counts are exactly correct
      applyUpdate(confirmedStatus);
    } catch (e) {
      console.error(e);
      // Rollback on failure
      applyUpdate(originalStatus);
    }
  };

  if (isAuthenticated === null) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg-base text-text-main flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-display font-extrabold tracking-tighter bg-gradient-to-br from-text-main to-text-muted bg-clip-text text-transparent">Beautiful</h1>
            <p className="text-text-muted font-mono text-[10px] uppercase tracking-[0.3em]">Minimal Federated Client</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative group">
              <input 
                type="text"
                placeholder="mastodon.social"
                value={instance}
                onChange={(e) => setInstance(e.target.value)}
                className="w-full bg-text-main/5 border border-border-subtle rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-brand/50 transition-all focus:ring-4 focus:ring-brand/5"
                id="instance-input"
              />
              <p className="mt-3 px-2 text-[10px] text-text-muted font-mono uppercase tracking-wider">Enter your instance URL to begin</p>
            </div>
            <button 
              type="submit"
              className="w-full bg-brand text-bg-base font-bold py-4 rounded-2xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_-10px_rgba(125,211,252,0.3)]"
              id="login-button"
            >
              Initialize Node <ExternalLink size={18} />
            </button>
          </form>

          <div className="pt-8 border-t border-white/5 flex justify-center gap-6 opacity-30">
            <Hash size={20} />
            <Search size={20} />
            <Bell size={20} />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-main flex font-sans overflow-x-hidden">
      <div className="noise" />
      
      {/* Sidebar Navigation */}
      <motion.nav 
        animate={{ width: sidebarExpanded ? 260 : 80 }}
        className="border-r border-border-subtle flex flex-col bg-bg-surface/40 backdrop-blur-3xl fixed h-full z-40 overflow-hidden"
      >
        <div className="p-4 flex flex-col h-full">
          <div className="mb-12 flex items-center justify-between px-3 h-10">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 bg-brand rounded-lg rotate-12 flex-shrink-0 flex items-center justify-center text-bg-base font-display font-bold shadow-[0_0_20px_rgba(125,211,252,0.3)]">M</div>
              {sidebarExpanded && (
                <motion.span 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-display font-black text-xl tracking-tighter"
                >
                  Beautiful
                </motion.span>
              )}
            </div>
            <button 
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="p-2 hover:bg-text-main/10 rounded-xl text-text-muted transition-colors"
            >
              <Menu size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-2">
            <NavItem expanded={sidebarExpanded} active={view === 'home'} icon={<Home size={22} />} label="Home" onClick={() => resetToView('home')} />
            <NavItem expanded={sidebarExpanded} active={view === 'trending'} icon={<TrendingUp size={22} />} label="Trending" onClick={() => resetToView('trending')} />
            <NavItem expanded={sidebarExpanded} active={view === 'bookmarks'} icon={<Bookmark size={22} />} label="Bookmarks" onClick={() => resetToView('bookmarks')} />
            <NavItem expanded={sidebarExpanded} active={view === 'notifications'} icon={<Bell size={22} />} label="Alerts" onClick={() => resetToView('notifications')} />
            <NavItem expanded={sidebarExpanded} active={view === 'search'} icon={<Search size={22} />} label="Search" onClick={() => resetToView('search')} />
            <NavItem expanded={sidebarExpanded} active={view === 'settings'} icon={<Settings size={22} />} label="Settings" onClick={() => resetToView('settings')} />
            <NavItem expanded={sidebarExpanded} active={view === 'profile' && !targetAccount} icon={<User size={22} />} label="Profile" onClick={() => { setTargetAccount(null); resetToView('profile'); fetchUserStatuses(currentUser?.id || ''); }} />
          </div>

        <div className="pt-4 border-t border-white/5 relative">
          <AnimatePresence>
            {profileMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute bottom-full left-0 w-64 bg-[#1a1a1a] border border-white/10 rounded-2xl mb-3 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 py-2"
              >
                <div className="px-4 py-2 border-b border-white/5 mb-1">
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted">My Accounts</p>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto">
                  {savedAccounts.map((sa) => (
                    <button 
                      key={`${sa.instance}-${sa.account.id}`}
                      onClick={() => sa.account.id !== currentUser?.id && switchAccount(sa)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group ${sa.account.id === currentUser?.id ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <img src={sa.account.avatar} className="w-8 h-8 rounded-full border border-white/10" alt="" />
                      <div className="flex-1 text-left truncate">
                        <p className={`text-xs font-semibold ${sa.account.id === currentUser?.id ? 'text-text-main' : 'text-text-muted group-hover:text-text-main'}`}>
                          {sa.account.display_name}
                        </p>
                        <p className="text-[10px] text-text-muted font-mono truncate">{sa.instance}</p>
                      </div>
                      {sa.account.id === currentUser?.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="border-t border-white/5 mt-1 pt-1">
                  <button 
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setIsAuthenticated(false); // Show login screen
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-text-main/5 transition-colors text-xs text-text-main font-medium group"
                  >
                    <Plus size={16} className="text-text-muted group-hover:text-text-main transition-colors" />
                    <span>Add another account</span>
                  </button>
                </div>

                <div className="border-t border-white/5 mt-1 pt-1">
                  <button 
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setEditDisplayName(currentUser?.display_name || '');
                      const tempDiv = document.createElement('div');
                      tempDiv.innerHTML = currentUser?.note || '';
                      setEditNote(tempDiv.innerText || tempDiv.textContent || '');
                      pushView('settings');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-text-main/5 transition-colors text-xs text-text-main"
                  >
                    <Settings size={16} className="text-text-muted" />
                    <span>System Configuration</span>
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogout();
                      setProfileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-xs text-red-400 font-medium group"
                  >
                    <LogOut size={16} className="group-hover:scale-110 transition-transform" />
                    <span>Decommission connection</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div 
            className="flex items-center gap-3 p-2 group cursor-pointer hover:bg-white/[0.03] rounded-xl transition-colors" 
            onClick={(e) => {
              e.stopPropagation();
              setTargetAccount(null);
              resetToView('profile');
              fetchUserStatuses(currentUser?.id || '');
              setProfileMenuOpen(false);
            }}
          >
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} className="w-8 h-8 rounded-full border border-border-subtle shrink-0" alt="" />
            ) : (
              <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center shrink-0"><User size={16} /></div>
            )}
            {sidebarExpanded && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="truncate flex-1"
              >
                <p className="text-xs font-semibold truncate text-text-main">{currentUser?.display_name || currentUser?.username}</p>
                <p className="text-[10px] text-text-muted font-mono italic">Account Options</p>
              </motion.div>
            )}
            {sidebarExpanded && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`transition-transform duration-200 ${profileMenuOpen ? 'rotate-180' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileMenuOpen(!profileMenuOpen);
                }}
              >
                <ChevronDown size={14} className="text-text-muted" />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.nav>

      {/* Main Feed Content */}
      <motion.main 
        animate={{ marginLeft: sidebarExpanded ? 260 : 80 }}
        className="flex-1 max-w-4xl mx-auto border-x border-border-subtle min-h-screen relative z-30 transition-all"
      >
        {/* Floating Action Button */}
        <AnimatePresence>
          {!['settings', 'editProfile'].includes(view) && (
            <motion.button 
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setReplyToId(null);
                setComposeOpen(true);
              }}
              className="fixed bottom-8 right-8 w-14 h-14 bg-brand text-bg-base rounded-2xl flex items-center justify-center shadow-[0_12px_40px_rgba(125,211,252,0.25)] z-40 group"
              id="compose-fab"
            >
              <MessageCircle size={24} className="group-hover:rotate-12 transition-transform" />
            </motion.button>
          )}
        </AnimatePresence>
        <header className="sticky top-0 glass border-b border-border-subtle z-50 px-6 py-4 flex items-center gap-4">
          <h2 className="text-xl font-display font-bold capitalize flex-1 tracking-tight">
            {view === 'details' ? 'Conversation' : view === 'editProfile' ? 'Identity' : view === 'settings' ? 'Instance Settings' : view}
          </h2>
          <AnimatePresence>
            {!['settings', 'editProfile'].includes(view) && (
              <motion.button 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => {
                  if (view === 'home') fetchTimeline();
                  if (view === 'local') fetchLocal();
                  if (view === 'federated') fetchFederated();
                  if (view === 'notifications') fetchNotifications();
                  if (view === 'details' && selectedStatus) fetchStatusDetail(selectedStatus.id);
                  if (view === 'trending') fetchTrending();
                  if (view === 'profile') fetchUserStatuses((targetAccount || currentUser)?.id || '');
                  if (view === 'bookmarks') fetchBookmarks();
                }}
                className={`p-2 hover:bg-white/5 rounded-full transition-all active:rotate-180 ${isRefreshing ? 'animate-spin opacity-50' : ''}`}
                id="refresh-button"
                disabled={isRefreshing}
              >
                <RefreshCw size={18} />
              </motion.button>
            )}
          </AnimatePresence>
        </header>

        <div className="w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="divide-y divide-white/[0.06]"
            >
              {view === 'home' && (
                <>
                  {statuses.map((status, index) => (
                    <motion.div
                      key={status.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.5) }}
                    >
                      <Toot 
                        status={status} 
                        onLike={() => handleInteract(status.id, 'favourite')} 
                        onReport={() => handleReport(status.id)}
                        onBookmark={() => handleInteract(status.id, 'bookmark')}
                        onDelete={() => handleDeleteStatus(status.id)}
                        isOwner={status.account.id === currentUser?.id}
                        bookmarked={status.bookmarked}
                        onClick={() => fetchStatusDetail(status.id)}
                        onReply={() => openReply(status)}
                        onRepost={() => handleInteract(status.id, 'reblog')}
                        onProfileClick={handleViewProfile}
                      />
                    </motion.div>
                  ))}
                  {statuses.length === 0 && !isRefreshing && (
                    <div className="py-20 text-center text-gray-600 font-mono text-sm tracking-wide">
                      No activity found on your node.
                    </div>
                  )}
                  {statuses.length > 0 && (
                    <div ref={loaderRef} className="py-8 flex justify-center border-t border-white/[0.06]">
                      {hasMoreHome ? (
                        <Loader2 size={24} className="text-brand animate-spin" />
                      ) : (
                        <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">End of the line</span>
                      )}
                    </div>
                  )}
                </>
              )}
          
              {view === 'local' && (
                <motion.div
                  key="local"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="glass px-6 py-4 flex items-center justify-between border-b border-white/[0.06] sticky top-[61px] z-20">
                    <span className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Local Feed</span>
                    <div className="flex gap-2 p-1 bg-white/5 rounded-xl overflow-x-auto max-w-[200px] no-scrollbar border border-white/5">
                      {COUNTRIES.map(c => (
                        <button
                          key={c.name}
                          onClick={() => setSelectedLanguage(c.code)}
                          className={`px-3 py-1 rounded-lg text-xs transition-all ${selectedLanguage === c.code ? 'bg-white text-black font-bold' : 'text-gray-500 hover:text-gray-300'}`}
                          title={c.name}
                        >
                          {c.flag}
                        </button>
                      ))}
                    </div>
                  </div>
                  {localStatuses.map((status, index) => (
                    <motion.div
                      key={status.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.5) }}
                    >
                      <Toot 
                        status={status} 
                        onLike={() => handleInteract(status.id, 'favourite')} 
                        onReport={() => handleReport(status.id)}
                        onBookmark={() => handleInteract(status.id, 'bookmark')}
                        onDelete={() => handleDeleteStatus(status.id)}
                        isOwner={status.account.id === currentUser?.id}
                        bookmarked={status.bookmarked}
                        onClick={() => fetchStatusDetail(status.id)}
                        onReply={() => openReply(status)}
                        onRepost={() => handleInteract(status.id, 'reblog')}
                        onProfileClick={handleViewProfile}
                      />
                    </motion.div>
                  ))}
                  {localStatuses.length === 0 && !isRefreshing && (
                    <div className="py-20 text-center text-gray-600 font-mono text-sm tracking-wide">
                      No local posts found.
                    </div>
                  )}
                  {localStatuses.length > 0 && (
                    <div ref={loaderRef} className="py-8 flex justify-center border-t border-white/[0.06]">
                      {hasMoreLocal ? (
                        <Loader2 size={24} className="text-brand animate-spin" />
                      ) : (
                        <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">End of the line</span>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {view === 'federated' && (
                <motion.div
                  key="federated"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="glass px-6 py-4 flex items-center justify-between border-b border-white/[0.06] sticky top-[61px] z-20">
                    <span className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Public Federated Feed</span>
                    <div className="flex gap-2 p-1 bg-white/5 rounded-xl overflow-x-auto max-w-[200px] no-scrollbar border border-white/5">
                      {COUNTRIES.map(c => (
                        <button
                          key={c.name}
                          onClick={() => setSelectedLanguage(c.code)}
                          className={`px-3 py-1 rounded-lg text-xs transition-all ${selectedLanguage === c.code ? 'bg-white text-black font-bold' : 'text-gray-500 hover:text-gray-300'}`}
                          title={c.name}
                        >
                          {c.flag}
                        </button>
                      ))}
                    </div>
                  </div>
                  {federatedStatuses.map((status, index) => (
                    <motion.div
                      key={status.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.5) }}
                    >
                      <Toot 
                        status={status} 
                        onLike={() => handleInteract(status.id, 'favourite')} 
                        onReport={() => handleReport(status.id)}
                        onBookmark={() => handleInteract(status.id, 'bookmark')}
                        onDelete={() => handleDeleteStatus(status.id)}
                        isOwner={status.account.id === currentUser?.id}
                        bookmarked={status.bookmarked}
                        onClick={() => fetchStatusDetail(status.id)}
                        onReply={() => openReply(status)}
                        onRepost={() => handleInteract(status.id, 'reblog')}
                        onProfileClick={handleViewProfile}
                      />
                    </motion.div>
                  ))}
                  {federatedStatuses.length === 0 && !isRefreshing && (
                    <div className="py-20 text-center text-gray-600 font-mono text-sm tracking-wide">
                      No public posts found.
                    </div>
                  )}
                  {federatedStatuses.length > 0 && (
                    <div ref={loaderRef} className="py-8 flex justify-center border-t border-white/[0.06]">
                      {hasMoreFederated ? (
                        <Loader2 size={24} className="text-brand animate-spin" />
                      ) : (
                        <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">End of the line</span>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {view === 'bookmarks' && (
                <motion.div
                  key="bookmarks"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="glass px-6 py-4 flex items-center justify-between border-b border-white/[0.06] sticky top-[61px] z-20">
                    <span className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Your Bookmarks</span>
                  </div>
                  {bookmarks.map((status, index) => (
                    <motion.div
                      key={status.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.5) }}
                    >
                      <Toot 
                        status={status} 
                        onLike={() => handleInteract(status.id, 'favourite')} 
                        onReport={() => handleReport(status.id)}
                        onBookmark={() => handleInteract(status.id, 'bookmark')}
                        onDelete={() => handleDeleteStatus(status.id)}
                        isOwner={status.account.id === currentUser?.id}
                        bookmarked={status.bookmarked}
                        onClick={() => fetchStatusDetail(status.id)}
                        onReply={() => openReply(status)}
                        onRepost={() => handleInteract(status.id, 'reblog')}
                        onProfileClick={handleViewProfile}
                      />
                    </motion.div>
                  ))}
                  {bookmarks.length === 0 && !isRefreshing && (
                    <div className="py-20 text-center text-gray-600 font-mono text-sm tracking-wide">
                      You haven't bookmarked any posts yet.
                    </div>
                  )}
                </motion.div>
              )}

              {view === 'trending' && (
                <>
                  <div className="glass px-6 py-4 flex items-center justify-between border-b border-white/[0.06]">
                    <span className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Popular across decentralized nodes</span>
                  </div>
                  {trendingPosts.map((status, index) => (
                    <motion.div
                      key={status.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.5) }}
                    >
                      <Toot 
                        status={status} 
                        onLike={() => handleInteract(status.id, 'favourite')} 
                        onReport={() => handleReport(status.id)}
                        onBookmark={() => handleInteract(status.id, 'bookmark')}
                        onDelete={() => handleDeleteStatus(status.id)}
                        isOwner={status.account.id === currentUser?.id}
                        bookmarked={status.bookmarked}
                        onClick={() => fetchStatusDetail(status.id)}
                        onReply={() => openReply(status)}
                        onRepost={() => handleInteract(status.id, 'reblog')}
                        onProfileClick={handleViewProfile}
                      />
                    </motion.div>
                  ))}
                  {trendingPosts.length === 0 && !isRefreshing && (
                    <div className="py-20 text-center text-gray-600 font-mono text-sm tracking-wide">
                      The feed is currently quiet.
                    </div>
                  )}
                  
                  {trendingPosts.length > 0 && (
                    <div ref={loaderRef} className="py-8 flex justify-center border-t border-white/[0.06]">
                      {hasMoreTrending ? (
                        <Loader2 size={24} className="text-brand animate-spin" />
                      ) : (
                        <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">End of the line</span>
                      )}
                    </div>
                  )}
                </>
              )}

              {view === 'details' && selectedStatus && (
                <motion.div
                  key={`details-${selectedStatus.id}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="pb-20"
                >
                  <div className="glass px-6 py-4 flex items-center gap-4 border-b border-white/[0.06] sticky top-[61px] z-20">
                    <button onClick={goBack} className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors">
                      <ArrowLeft size={18} />
                    </button>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Thread Analysis</span>
                      <span className="text-[9px] text-brand font-mono tracking-widest">{selectedStatus.account.display_name}'s conversation</span>
                    </div>
                  </div>
                  
                  <div className="divide-y divide-white/[0.04]">
                    {context.ancestors.map(s => (
                      <Toot 
                        key={s.id} 
                        status={s} 
                        onLike={() => handleInteract(s.id, 'favourite')} 
                        onReport={() => handleReport(s.id)}
                        onBookmark={() => handleInteract(s.id, 'bookmark')}
                        onDelete={() => handleDeleteStatus(s.id)}
                        isOwner={s.account.id === currentUser?.id}
                        bookmarked={s.bookmarked}
                        onClick={() => fetchStatusDetail(s.id)}
                        onReply={() => openReply(s)}
                        onRepost={() => handleInteract(s.id, 'reblog')}
                        onProfileClick={handleViewProfile}
                      />
                    ))}
                  </div>

                  <div className="border-y-8 border-white/[0.02] bg-white/[0.01]">
                    <Toot 
                      status={selectedStatus} 
                      onLike={() => handleInteract(selectedStatus.id, 'favourite')} 
                      onReport={() => handleReport(selectedStatus.id)}
                      onBookmark={() => handleInteract(selectedStatus.id, 'bookmark')}
                      onDelete={() => handleDeleteStatus(selectedStatus.id)}
                      isOwner={selectedStatus.account.id === currentUser?.id}
                      bookmarked={selectedStatus.bookmarked}
                      onReply={() => openReply(selectedStatus)}
                      onRepost={() => handleInteract(selectedStatus.id, 'reblog')}
                      onProfileClick={handleViewProfile}
                    />
                  </div>

                  <div className="glass px-6 py-4 flex items-center justify-between border-b border-white/[0.06]">
                    <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted">Node Connections / Replies</h4>
                    <span className="text-[10px] font-mono text-brand">{context.descendants.length} branch(es)</span>
                  </div>

                  <div className="divide-y divide-white/[0.04]">
                    {context.descendants.map((s, index) => (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Toot 
                          status={s} 
                          onLike={() => handleInteract(s.id, 'favourite')} 
                          onReport={() => handleReport(s.id)}
                          onBookmark={() => handleInteract(s.id, 'bookmark')}
                          onDelete={() => handleDeleteStatus(s.id)}
                          isOwner={s.account.id === currentUser?.id}
                          bookmarked={s.bookmarked}
                          onClick={() => fetchStatusDetail(s.id)}
                          onReply={() => openReply(s)}
                          onRepost={() => handleInteract(s.id, 'reblog')}
                          onProfileClick={handleViewProfile}
                        />
                      </motion.div>
                    ))}
                  </div>
                  
                  {context.descendants.length === 0 && (
                    <div className="py-20 text-center text-text-muted font-mono text-xs tracking-widest uppercase opacity-50">
                      Terminal leaf node. No further replies.
                    </div>
                  )}
                </motion.div>
              )}

              {view === 'notifications' && (
                <div className="divide-y divide-white/[0.06]">
                  {notifications.map((notif, index) => (
                    <motion.div 
                      key={notif.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.5) }}
                      className="p-6 flex items-start gap-4 hover:bg-white/[0.01] transition-colors cursor-pointer group/notif"
                      onClick={() => handleViewProfile(notif.account)}
                    >
                      <div className="pt-1">
                        {notif.type === 'favourite' && <Heart size={18} className="text-rose-500" fill="currentColor" />}
                        {notif.type === 'reblog' && <Repeat size={18} className="text-emerald-500" />}
                        {notif.type === 'follow' && <User size={18} className="text-brand" />}
                        {notif.type === 'mention' && <MessageCircle size={18} className="text-violet-500" />}
                      </div>
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <img src={notif.account.avatar} className="w-8 h-8 rounded-lg border border-white/5 group-hover/notif:scale-110 transition-transform" alt="" />
                          <div className="flex flex-col truncate">
                            <span className="font-bold text-text-main text-sm group-hover/notif:text-brand transition-colors">{notif.account.display_name}</span>
                            <span className="text-[10px] text-text-muted font-mono tracking-tight group-hover/notif:text-text-main">
                              {notif.type === 'favourite' && 'favourited your post'}
                              {notif.type === 'reblog' && 'boosted your post'}
                              {notif.type === 'follow' && 'followed you'}
                              {notif.type === 'mention' && 'mentioned you'}
                            </span>
                          </div>
                        </div>
                        {notif.status && (
                          <div 
                            className="text-sm text-text-muted line-clamp-2 pl-1 font-sans prose prose-sm prose-a:text-brand prose-a:no-underline hover:prose-a:underline" 
                            dangerouslySetInnerHTML={{ __html: notif.status.content }} 
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              const link = target.closest('a');
                              if (link) {
                                e.preventDefault();
                                e.stopPropagation();
                                window.open(link.href, '_blank');
                              } else {
                                fetchStatusDetail(notif.status.id);
                              }
                            }}
                          />
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {notifications.length === 0 && !isRefreshing && (
                    <div className="py-20 text-center text-gray-600 font-mono text-sm tracking-wide">
                      Your alert log is empty.
                    </div>
                  )}
                </div>
              )}

              {view === 'search' && (
                <div className="p-0 space-y-0">
                  <div className="sticky top-[61px] glass px-6 py-4 z-20 border-b border-white/[0.06]">
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand transition-colors" size={20} />
                      <input 
                        type="text" 
                        placeholder="Search identities, posts, or tags..." 
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-brand/30 focus:bg-white/[0.06] transition-all"
                      />
                    </div>
                  </div>

                  <div className="p-6 space-y-8">
                    <div className="space-y-6">
                      {searchResults.accounts.length > 0 && (
                        <section className="space-y-4">
                          <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 px-1">People</h3>
                          <div className="grid gap-2">
                            {searchResults.accounts.map((acc: any) => (
                              <div 
                                key={acc.id} 
                                className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-2xl hover:bg-white/[0.04] transition-all border border-white/5 group cursor-pointer"
                                onClick={() => handleViewProfile(acc)}
                              >
                                <img src={acc.avatar} className="w-12 h-12 rounded-xl group-hover:scale-105 transition-transform" alt="" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-text-main truncate">{acc.display_name}</p>
                                  <p className="text-[10px] text-text-muted font-mono truncate">@{acc.username}</p>
                                </div>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const isFollowing = searchRelationships[acc.id]?.following;
                                    handleFollow(acc.id, isFollowing);
                                    
                                    // Optimistically update search relationships
                                    setSearchRelationships(prev => ({
                                      ...prev,
                                      [acc.id]: {
                                        ...(prev[acc.id] || {}),
                                        following: !isFollowing
                                      } as Relationship
                                    }));
                                  }}
                                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
                                    searchRelationships[acc.id]?.following
                                      ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                                      : 'bg-brand text-bg-base hover:brightness-110'
                                  }`}
                                >
                                  {searchRelationships[acc.id]?.following ? 'Following' : 'Follow'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {searchResults.statuses.length > 0 && (
                        <section className="space-y-4">
                          <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 px-1">Discoveries</h3>
                          <div className="divide-y divide-white/[0.06] -mx-6">
                            {searchResults.statuses.map((s: any) => (
                              <Toot 
                                key={s.id} 
                                status={s} 
                                onLike={() => handleInteract(s.id, 'favourite')} 
                                onReport={() => handleReport(s.id)}
                                onBookmark={() => handleInteract(s.id, 'bookmark')}
                                onDelete={() => handleDeleteStatus(s.id)}
                                isOwner={s.account.id === currentUser?.id}
                                bookmarked={s.bookmarked}
                                onClick={() => fetchStatusDetail(s.id)}
                                onReply={() => openReply(s)}
                                onRepost={() => handleInteract(s.id, 'reblog')}
                                onProfileClick={handleViewProfile}
                              />
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  </div>
                </div>
              )}

          {view === 'profile' && (targetAccount || currentUser) && (
            <div className="pb-12">
              <div className="glass px-6 py-4 flex items-center gap-4 border-b border-white/[0.06] sticky top-[61px] z-20">
                {(targetAccount || history.length > 0) && (
                  <button onClick={goBack} className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors">
                    <ArrowLeft size={18} />
                  </button>
                )}
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Profile Node</span>
                  <span className="text-[9px] text-brand font-mono tracking-widest">
                    {(targetAccount || currentUser)?.display_name}'s space
                  </span>
                </div>
              </div>
              <div className="h-48 md:h-64 bg-white/5 relative overflow-hidden">
                {(targetAccount || currentUser)?.header && <img src={(targetAccount || currentUser)?.header} className="w-full h-full object-cover shadow-2xl" alt="" />}
                <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-transparent to-slate-950/20" />
              </div>
              <div className="px-6 -mt-16 relative z-10 space-y-6">
                <div className="flex items-end justify-between">
                  <div className="relative group">
                    <img src={(targetAccount || currentUser)?.avatar} className="w-24 h-24 md:w-32 md:h-32 rounded-3xl border-4 border-bg-base bg-bg-surface shadow-2xl" alt="" />
                    <div className="absolute inset-0 rounded-3xl bg-brand/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                  {targetAccount && targetAccount.id !== currentUser?.id ? (
                    <button 
                      onClick={() => handleFollow(targetAccount.id, targetRelationship?.following)}
                      className={`mb-4 px-8 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-xl active:scale-95 ${
                        targetRelationship?.following 
                          ? 'bg-white/5 text-white hover:bg-white/10 border border-white/10' 
                          : 'bg-brand text-bg-base hover:brightness-110 shadow-brand/20'
                      }`}
                    >
                      {targetRelationship?.following ? 'Following' : 'Follow Node'}
                    </button>
                  ) : (
                    <button 
                      onClick={startEditingProfile}
                      className="mb-4 px-8 py-2.5 bg-white/5 text-white border border-white/10 rounded-2xl text-xs font-bold hover:bg-white/10 transition-all shadow-xl active:scale-95"
                    >
                      Edit Profile
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <h1 className="text-3xl font-display font-black tracking-tight text-white leading-none">
                    {(targetAccount || currentUser)?.display_name}
                  </h1>
                  <div className="flex items-center gap-2">
                    <AtSign size={12} className="text-brand" />
                    <span className="text-text-muted font-mono text-sm tracking-tight">{(targetAccount || currentUser)?.username}</span>
                  </div>
                </div>
                <div 
                  className="text-text-main/80 leading-relaxed font-sans text-base max-w-2xl prose prose-a:text-brand prose-a:no-underline hover:prose-a:underline" 
                  dangerouslySetInnerHTML={{ __html: (targetAccount || currentUser)?.note || '' }} 
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    const link = target.closest('a');
                    if (link) {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open(link.href, '_blank');
                    }
                  }}
                />
                <div className="flex gap-10 py-6 border-t border-white/[0.06] mt-8 bg-white/[0.01] -mx-6 px-6">
                  <Stat label="Statuses" value={(targetAccount || currentUser)?.statuses_count || 0} />
                  <Stat label="Followers" value={(targetAccount || currentUser)?.followers_count || 0} />
                  <Stat label="Following" value={(targetAccount || currentUser)?.following_count || 0} />
                </div>
              </div>

              <div className="mt-8 border-t border-white/[0.06]">
                <div className="flex border-b border-white/[0.04] sticky top-[113px] bg-bg-base/80 backdrop-blur-md z-10">
                  <button 
                    onClick={() => fetchUserStatuses((targetAccount || currentUser)!.id, 'posts')}
                    className={`flex-1 py-4 text-xs font-mono uppercase tracking-widest transition-all relative group ${profileTab === 'posts' ? 'text-brand' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Posts
                    {profileTab === 'posts' && <motion.div layoutId="profile-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand shadow-[0_0_15px_rgba(125,211,252,0.5)]" />}
                  </button>
                  <button 
                    onClick={() => fetchUserStatuses((targetAccount || currentUser)!.id, 'replies')}
                    className={`flex-1 py-4 text-xs font-mono uppercase tracking-widest transition-all relative group ${profileTab === 'replies' ? 'text-brand' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Replies
                    {profileTab === 'replies' && <motion.div layoutId="profile-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand shadow-[0_0_10px_#2b90d9]" />}
                  </button>
                  <button 
                    onClick={() => fetchUserStatuses((targetAccount || currentUser)!.id, 'media')}
                    className={`flex-1 py-4 text-xs font-mono uppercase tracking-widest transition-all relative group ${profileTab === 'media' ? 'text-brand' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Media
                    {profileTab === 'media' && <motion.div layoutId="profile-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand shadow-[0_0_10px_#2b90d9]" />}
                  </button>
                </div>
                {userStatuses.length === 0 && !isRefreshing && (
                  <div className="p-20 text-center space-y-4">
                    <Ghost size={40} className="mx-auto text-white/10" />
                    <p className="text-text-muted font-mono text-xs uppercase tracking-widest">No signals detected in this frequency</p>
                  </div>
                )}
                <div className="divide-y divide-white/[0.06]">
                  {userStatuses.map((status, index) => (
                  <motion.div
                    key={status.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.05, 0.5) }}
                  >
                    <Toot 
                      status={status} 
                      onLike={() => handleInteract(status.id, 'favourite')} 
                      onReport={() => handleReport(status.id)}
                      onBookmark={() => handleInteract(status.id, 'bookmark')}
                      onDelete={() => handleDeleteStatus(status.id)}
                      isOwner={status.account.id === currentUser?.id}
                      bookmarked={status.bookmarked}
                      onClick={() => fetchStatusDetail(status.id)}
                      onReply={() => openReply(status)}
                      onRepost={() => handleInteract(status.id, 'reblog')}
                      onProfileClick={handleViewProfile}
                    />
                  </motion.div>
                ))}
                {userStatuses.length === 0 && !isRefreshing && (
                  <div className="py-20 text-center text-gray-600 font-mono text-sm tracking-wide">
                    Empty activity log.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
              {view === 'settings' && currentUser && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="pb-20"
                >
                  <div className="glass px-6 py-6 border-b border-border-subtle sticky top-[61px] z-20 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-display font-black tracking-tighter text-text-main">System Configuration</h2>
                      <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mt-1">Interface & Sync Protocols</p>
                    </div>
                  </div>

                  <div className="px-6 py-8 space-y-12">
                    {/* Appearance Section */}
                    <section className="space-y-6">
                      <div className="flex items-center gap-3 text-brand">
                        <Monitor size={18} />
                        <h3 className="font-mono text-xs uppercase tracking-[0.2em] font-bold">Aesthetic Schema</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          { id: 'light', label: 'Solar Mode', icon: <Sun size={20} /> },
                          { id: 'dark', label: 'Void Mode', icon: <Moon size={20} /> },
                          { id: 'system', label: 'Neutral Sync', icon: <Cpu size={20} /> }
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setTheme(opt.id as any)}
                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 group ${
                              theme === opt.id 
                                ? 'bg-brand/10 border-brand shadow-[0_0_20px_rgba(125,211,252,0.1)]' 
                                : 'bg-text-main/[0.02] border-border-subtle hover:border-text-main/20'
                            }`}
                          >
                            <div className={`p-4 rounded-xl transition-colors ${theme === opt.id ? 'bg-brand text-bg-base' : 'bg-text-main/5 text-text-muted group-hover:text-text-main'}`}>
                              {opt.icon}
                            </div>
                            <span className={`font-mono text-[10px] uppercase tracking-widest ${theme === opt.id ? 'text-brand font-bold' : 'text-text-muted'}`}>
                              {opt.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* Data Sync Section */}
                    <section className="space-y-6">
                      <div className="flex items-center gap-3 text-brand">
                        <RefreshCw size={18} />
                        <h3 className="font-mono text-xs uppercase tracking-[0.2em] font-bold">Data Frequency</h3>
                      </div>

                      <div className="glass p-6 rounded-2xl flex items-center justify-between group">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-text-main">Real-time Stream Integration</p>
                          <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Auto-refresh feed every 60 seconds</p>
                        </div>
                        <button 
                          onClick={() => setAutoRefresh(!autoRefresh)}
                          className={`w-14 h-8 rounded-full p-1 transition-all relative ${autoRefresh ? 'bg-brand shadow-[0_0_15px_rgba(125,211,252,0.3)]' : 'bg-text-main/10'}`}
                        >
                          <motion.div 
                            animate={{ x: autoRefresh ? 24 : 0 }}
                            className={`w-6 h-6 rounded-full shadow-lg ${autoRefresh ? 'bg-bg-base' : 'bg-text-muted'}`}
                          />
                        </button>
                      </div>
                    </section>

                    {/* Node Info Section */}
                    <section className="space-y-6">
                      <div className="flex items-center gap-3 text-brand">
                        <Info size={18} />
                        <h3 className="font-mono text-xs uppercase tracking-[0.2em] font-bold">Node Identity</h3>
                      </div>
                      
                      <div className="glass p-8 rounded-3xl space-y-6 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-brand">
                          <Shield size={120} />
                        </div>
                        
                        <div className="flex items-center gap-6 relative z-10">
                          <img src={currentUser.avatar} className="w-16 h-16 rounded-2xl border-2 border-border-subtle shadow-2xl" alt="" />
                          <div>
                            <p className="text-lg font-bold text-text-main">{currentUser.display_name}</p>
                            <p className="text-sm text-brand font-mono">@{currentUser.acct}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 relative z-10">
                          <div className="p-4 bg-text-main/5 rounded-xl border border-border-subtle space-y-1">
                            <p className="text-[8px] font-mono text-text-muted uppercase tracking-widest">Instance Node</p>
                            <p className="text-xs font-bold truncate text-text-main">{localStorage.getItem('mastodon-instance')}</p>
                          </div>
                          <div className="p-4 bg-text-main/5 rounded-xl border border-border-subtle space-y-1">
                            <p className="text-[8px] font-mono text-text-muted uppercase tracking-widest">Auth Protocol</p>
                            <p className="text-xs font-bold text-text-main">Encrypted OAuth2</p>
                          </div>
                        </div>

                        <button 
                          onClick={handleLogout}
                          className="w-full py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-2xl text-[10px] font-mono uppercase tracking-[0.3em] font-black transition-all group overflow-hidden relative"
                        >
                          <span className="relative z-10">Decommission Connection</span>
                        </button>
                      </div>
                    </section>
                  </div>
                </motion.div>
              )}

          {view === 'editProfile' && currentUser && (
            <motion.div
              key="edit-profile"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="p-0 space-y-0"
            >
              <div className="glass px-6 py-4 flex items-center justify-between border-b border-white/[0.06] sticky top-[61px] z-20">
                <div className="flex items-center gap-4">
                  <button onClick={goBack} className="p-2 -ml-2 hover:bg-text-main/5 rounded-full transition-colors text-text-muted hover:text-text-main">
                    <X size={20} />
                  </button>
                  <span className="text-[10px] font-mono text-text-main uppercase tracking-[0.2em] font-bold">Identity Configuration</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleUpdateProfile}
                    disabled={isUpdatingProfile}
                    className="flex items-center gap-2 px-6 py-2 bg-brand text-bg-base rounded-xl text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50 shadow-xl shadow-brand/20 active:scale-95"
                  >
                    {isUpdatingProfile && <Loader2 size={14} className="animate-spin" />}
                    Save Protocol
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-12">
                {/* Banner Edit */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Profile Panorama</label>
                    <span className="text-[10px] font-mono text-text-muted/60">1500x500 recommended</span>
                  </div>
                  <div className="relative h-48 md:h-64 bg-white/[0.02] rounded-3xl overflow-hidden group cursor-pointer border border-white/[0.06] shadow-inner">
                    <img 
                      src={editHeaderPreview || currentUser.header} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      alt="" 
                    />
                    <div className="absolute inset-0 bg-slate-900/40 group-hover:bg-slate-900/20 transition-all" />
                    <label 
                      htmlFor="header-upload"
                      className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer gap-3"
                    >
                      <div className="p-4 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                        <Camera size={32} className="text-white" />
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white font-bold drop-shadow-md">Upload New Header</span>
                    </label>
                    <input 
                      type="file" 
                      id="header-upload" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setEditHeaderFile(file);
                          setEditHeaderPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </div>
                </section>

                <div className="flex flex-col md:flex-row gap-12">
                  {/* Avatar Edit */}
                  <section className="space-y-4 flex flex-col items-center shrink-0">
                    <label className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em] w-full text-center">Identity Mask</label>
                    <div className="relative group cursor-pointer">
                      <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] overflow-hidden border-4 border-[#030303] bg-[#0a0a0a] shadow-2xl relative">
                        <img 
                          src={editAvatarPreview || currentUser.avatar} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                          alt="" 
                        />
                        <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-transparent transition-all" />
                      </div>
                      <label 
                        htmlFor="avatar-upload"
                        className="absolute inset-0 flex items-center justify-center bg-slate-900/40 rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-[2px]"
                      >
                        <Camera size={32} className="text-white" />
                      </label>
                      <input 
                        type="file" 
                        id="avatar-upload" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setEditAvatarFile(file);
                            setEditAvatarPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </div>
                  </section>

                  <div className="flex-1 space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em] px-1">Display Descriptor</label>
                      <input 
                        type="text"
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        placeholder="Set your public handle..."
                        className="w-full bg-text-main/[0.03] border border-border-subtle rounded-2xl px-5 py-4 focus:outline-none focus:border-brand/40 focus:bg-text-main/[0.05] transition-all text-text-main font-bold"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em] px-1">Node Bio / Signal</label>
                      <textarea 
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="Broadcast your signal to the network..."
                        className="w-full bg-text-main/[0.03] border border-border-subtle rounded-2xl px-5 py-4 focus:outline-none focus:border-brand/40 focus:bg-text-main/[0.05] transition-all text-text-main min-h-[160px] resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  </motion.main>

      {/* Compose Modal */}
      <AnimatePresence>
        {composeOpen && (
          <div className="fixed inset-0 bg-[#000]/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#0a0a0a] w-full max-w-2xl rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]"
            >
              <div className="glass px-8 py-5 flex items-center justify-between border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-text-main">
                    {replyToId ? 'Constructing Reply' : 'Broadcasting Status'}
                  </h3>
                </div>
                <button 
                  onClick={() => {
                    setComposeOpen(false);
                    setReplyToId(null);
                  }} 
                  className="p-2 hover:bg-text-main/5 rounded-full text-text-muted hover:text-text-main transition-colors"
                >
                  <X size={20}/>
                </button>
              </div>

              <div className="p-8 space-y-6">
                {replyToId && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-brand/5 border border-brand/10 rounded-2xl text-[10px] text-brand font-mono uppercase tracking-[0.1em]">
                    <MessageSquare size={14} />
                    <span>Synchronizing with branch: {replyToId}</span>
                  </div>
                )}
                
                <div className="flex gap-4">
                  {currentUser && (
                    <img 
                      src={currentUser.avatar} 
                      className="w-12 h-12 rounded-xl hidden sm:block border border-white/10 cursor-pointer hover:border-brand transition-all" 
                      alt="" 
                      onClick={() => {
                        setTargetAccount(null);
                        setView('profile');
                        fetchUserStatuses(currentUser.id);
                        setComposeOpen(false);
                      }}
                    />
                  )}
                  <textarea 
                    autoFocus
                    placeholder={replyToId ? "Synthesize your response..." : "Broadcast your signals to the decentralized network..."}
                    value={newToot}
                    onChange={(e) => setNewToot(e.target.value)}
                    className="w-full bg-transparent border-none text-xl sm:text-2xl font-bold placeholder:text-text-muted/40 resize-none focus:ring-0 min-h-[180px] p-0 text-text-main leading-tight"
                    id="composer-input"
                  />
                </div>

                {selectedFiles.length > 0 && (
                  <div className="flex gap-3 pb-2 overflow-x-auto no-scrollbar scroll-smooth">
                    {selectedFiles.map((file, i) => (
                      <div key={i} className="relative group shrink-0">
                        <img src={URL.createObjectURL(file)} className="w-32 h-32 object-cover rounded-[2rem] border-2 border-white/5 shadow-2xl" alt="" />
                        <button 
                          onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-2 border-2 border-bg-base shadow-xl hover:scale-110 transition-transform"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-6 border-t border-white/[0.06]">
                  <div className="flex gap-3">
                    <input 
                      type="file" 
                      id="file-upload" 
                      className="hidden" 
                      multiple 
                      accept="image/*" 
                      onChange={(e) => {
                        if (e.target.files) {
                          setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                        }
                      }}
                    />
                    <label 
                      htmlFor="file-upload" 
                      className="p-3 bg-text-main/[0.03] hover:bg-text-main/[0.08] border border-border-subtle rounded-2xl text-text-muted hover:text-brand cursor-pointer transition-all active:scale-95"
                    >
                      <ImageIcon size={22}/>
                    </label>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <span className={`text-[10px] font-mono tracking-widest uppercase font-bold ${newToot.length > 500 ? 'text-red-500 font-black' : 'text-text-muted'}`}>
                        {500 - newToot.length}
                      </span>
                      <div className="w-20 h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                        <motion.div 
                          className={`h-full ${newToot.length > 500 ? 'bg-red-500' : 'bg-brand'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((newToot.length / 500) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handlePost}
                      disabled={isUploading || (newToot.trim().length === 0 && selectedFiles.length === 0) || newToot.length > 500}
                      className="px-10 py-3.5 bg-brand text-bg-base rounded-2xl text-sm font-black hover:brightness-110 disabled:opacity-30 transition-all shadow-xl shadow-brand/20 active:scale-[0.98] flex items-center gap-3"
                    >
                      {isUploading ? <Loader2 size={18} className="animate-spin" /> : <SendIcon size={18} />}
                      {isUploading ? 'Publishing...' : 'Publish Update'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick, expanded = true }: { icon: any; label: string; active?: boolean; onClick?: () => void; expanded?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 relative group overflow-hidden ${
        active 
          ? 'bg-brand/10 text-brand' 
          : 'text-text-muted hover:text-text-main hover:bg-white/[0.04]'
      }`}
    >
      <div className={`transition-all duration-300 ${active ? 'scale-110 text-brand' : 'group-hover:scale-110'}`}>
        {icon}
      </div>
      {expanded && (
        <motion.span 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className={`transition-all duration-300 font-medium whitespace-nowrap ${active ? 'translate-x-0.5 text-white' : ''}`}
        >
          {label}
        </motion.span>
      )}
      {active && (
        <motion.div 
          layoutId="nav-glow"
          className="absolute left-0 w-1.5 h-6 bg-brand rounded-r-full shadow-[0_0_15px_rgba(125,211,252,0.5)]"
        />
      )}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-text-main font-bold">{value}</p>
      <p className="text-xs text-text-muted font-mono uppercase">{label}</p>
    </div>
  );
}

function Toot({ 
  status, 
  onLike, 
  onReport, 
  onClick, 
  onReply,
  onBookmark,
  bookmarked,
  onDelete,
  isOwner,
  onRepost,
  onProfileClick
}: { 
  key?: string | number;
  status: Status; 
  onLike: () => void | Promise<void>; 
  onReport?: () => void | Promise<void>; 
  onClick?: () => void; 
  onReply?: () => void;
  onBookmark?: () => void | Promise<void>;
  bookmarked?: boolean;
  onDelete?: () => void | Promise<void>;
  isOwner?: boolean;
  onRepost?: () => void | Promise<void>;
  onProfileClick?: (account: Account) => void;
}) {
  if (!status) return null;
  const isReblog = !!status.reblog;
  const data = status.reblog || status;

  if (!data || !data.account) return null;

  const displayName = data.account.display_name || data.account.username || 'User';
  const username = data.account.username || 'unknown';
  const avatar = data.account.avatar || '';
  const content = data.content || '';
  const dateStr = data.created_at ? new Date(data.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

  return (
    <article 
      onClick={onClick}
      className="p-6 group hover:bg-text-main/[0.02] transition-all duration-300 cursor-pointer border-l-2 border-transparent hover:border-brand/40"
      id={`toot-${status.id}`}
    >
      {isReblog && (
        <div 
          className="flex items-center gap-2 mb-4 text-text-muted font-mono text-[9px] uppercase tracking-[0.2em] pl-14 hover:text-brand transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            if (status.account) onProfileClick?.(status.account);
          }}
        >
          <Repeat size={12} className="text-brand" /> {status.account?.display_name || status.account?.username} boosted
        </div>
      )}
      
      <div className="flex gap-4">
        <div 
          className="relative group/avatar"
          onClick={(e) => {
            e.stopPropagation();
            onProfileClick?.(data.account);
          }}
        >
          <img 
            src={avatar} 
            className="w-12 h-12 rounded-xl object-cover ring-1 ring-white/10 group-hover/avatar:ring-brand/50 transition-all duration-300" 
            alt={displayName} 
          />
          <div className="absolute inset-0 rounded-xl bg-brand/10 opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
        </div>
        
        <div className="flex-1 space-y-3 min-w-0">
          <div className="flex items-center justify-between">
            <div 
              className="flex flex-col truncate hover:opacity-80 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onProfileClick?.(data.account);
              }}
            >
              <span className="font-display font-bold text-text-main tracking-tight text-base leading-tight truncate">
                {displayName}
              </span>
              <span className="text-text-muted font-mono text-[10px] tracking-tight truncate">
                @{username}
              </span>
            </div>
            <span className="text-text-muted font-mono text-[10px] uppercase tracking-wider tabular-nums">{dateStr}</span>
          </div>

          <div 
            className="text-text-main/80 leading-relaxed break-words prose prose-sm max-w-none font-sans prose-a:text-brand prose-a:no-underline hover:prose-a:underline transition-all"
            dangerouslySetInnerHTML={{ __html: content }}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              const link = target.closest('a');
              if (link) {
                e.preventDefault();
                e.stopPropagation();
                window.open(link.href, '_blank');
              }
            }}
          />

          {data.media_attachments.length > 0 && (
            <div className={`grid gap-2 pt-1 ${data.media_attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {data.media_attachments.map(att => (
                <div key={att.id} className="relative aspect-video rounded-2xl overflow-hidden border border-white/[0.06] group/img">
                  <img src={att.preview_url} className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105" alt="" />
                  <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover/img:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-6 md:gap-8 pt-4">
            <ActionButton 
              icon={<MessageCircle size={18} />} 
              count={data.replies_count} 
              activeColor="hover:text-brand"
              onClick={(e) => { e.stopPropagation(); onReply?.(); }}
            />
            <ActionButton 
              icon={<Repeat size={18} />} 
              count={data.reblogs_count} 
              activeColor="hover:text-emerald-400"
              active={data.reblogged}
              onClick={(e) => { e.stopPropagation(); onRepost?.(); }}
            />
            <ActionButton 
              icon={<Heart size={18} fill={data.favourited ? 'currentColor' : 'none'} />} 
              count={data.favourites_count} 
              activeColor="hover:text-rose-500"
              active={data.favourited}
              activeFill="text-rose-500"
              onClick={(e) => { e.stopPropagation(); onLike(); }}
            />
            <ActionButton 
              icon={<Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />} 
              activeColor="hover:text-amber-400"
              active={bookmarked}
              activeFill="text-amber-400"
              onClick={(e) => { e.stopPropagation(); onBookmark?.(); }}
            />
            
            <div className="flex-1" />

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => { e.stopPropagation(); onReport?.(); }}
                className="p-2 text-text-muted hover:text-text-main hover:bg-text-main/5 rounded-lg transition-all"
                title="Report Post"
              >
                <Flag size={14} />
              </button>
              {isOwner && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                  className="p-2 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                  title="Delete Post"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ActionButton({ 
  icon, 
  count, 
  onClick, 
  active = false, 
  activeColor = "hover:text-white",
  activeFill = "text-white"
}: { 
  icon: any; 
  count?: number; 
  onClick: (e: any) => void; 
  active?: boolean;
  activeColor?: string;
  activeFill?: string;
}) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 transition-all group/btn ${active ? activeFill : `text-text-muted ${activeColor}`}`}
    >
      <div className={`p-2 transition-all rounded-full ${active ? 'bg-white/5' : 'group-hover/btn:bg-white/5 group-hover/btn:scale-110'}`}>
        {icon}
      </div>
      {typeof count === 'number' && (
        <span className="text-[10px] font-mono font-medium tabular-nums tracking-tighter">{count > 0 ? count : ''}</span>
      )}
    </button>
  );
}

