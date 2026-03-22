import { useEffect, useRef, useState } from "react";
import { useInternetIdentity } from "./hooks/useInternetIdentity";

// ---- Types ----
interface Story {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage?: string;
  images: string[];
  links: { label: string; url: string }[];
  seriesId?: string;
  seriesOrder?: number;
  readCount: number;
  createdAt: number;
  published: boolean;
  googleDriveUrl?: string;
  subtext?: string;
}

interface Comment {
  id: string;
  storyId: string;
  author: string;
  principal: string;
  text: string;
  createdAt: number;
  approved: boolean;
  featured?: boolean;
}

interface PrivateMessage {
  id: string;
  storyId?: string;
  author: string;
  principal: string;
  text: string;
  createdAt: number;
  read: boolean;
}

interface Series {
  id: string;
  title: string;
  description: string;
}

interface UserProfile {
  principal: string;
  displayName: string;
  bio: string;
  favorites: string[];
  readHistory: { storyId: string; progress: number; lastRead: number }[];
  following: string[];
  followers: string[];
}

interface BannedUser {
  principal: string;
  reason: string;
  bannedAt: number;
}

// ---- Storage helpers ----
function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---- Logo ----
function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Stories and Reviews logo</title>
      <defs>
        <linearGradient
          id="logoGrad"
          x1="0"
          y1="0"
          x2="100"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00fff7" />
          <stop offset="100%" stopColor="#39ff14" />
        </linearGradient>
        <clipPath id="circle-clip">
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>
      {/* Circle background with gradient */}
      <circle cx="50" cy="50" r="48" fill="url(#logoGrad)" />
      <circle cx="50" cy="50" r="48" fill="#111" fillOpacity="0.7" />
      {/* Open book */}
      <g clipPath="url(#circle-clip)">
        <path
          d="M20 60 Q35 45 50 55 Q65 45 80 60 L80 75 Q65 62 50 70 Q35 62 20 75 Z"
          fill="url(#logoGrad)"
          opacity="0.9"
        />
        <line x1="50" y1="55" x2="50" y2="75" stroke="#111" strokeWidth="1.5" />
        {/* tiny unreadable lines on pages */}
        {[48, 51, 54, 57, 60, 63, 66].map((y, i) => (
          <line
            key={`left-${y}`}
            x1={i % 2 === 0 ? 23 : 25}
            y1={y}
            x2={48}
            y2={y}
            stroke="url(#logoGrad)"
            strokeWidth="0.8"
            opacity="0.5"
          />
        ))}
        {[48, 51, 54, 57, 60, 63, 66].map((y, i) => (
          <line
            key={`right-${y}`}
            x1={52}
            y1={y}
            x2={i % 2 === 0 ? 77 : 75}
            y2={y}
            stroke="url(#logoGrad)"
            strokeWidth="0.8"
            opacity="0.5"
          />
        ))}
        {/* Fountain pen diagonal through book */}
        <line
          x1="65"
          y1="30"
          x2="35"
          y2="78"
          stroke="url(#logoGrad)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <polygon points="35,78 31,85 40,77" fill="url(#logoGrad)" />
        <rect
          x="62"
          y="25"
          width="6"
          height="10"
          rx="2"
          fill="url(#logoGrad)"
          transform="rotate(-52 65 30)"
        />
      </g>
      {/* Border */}
      <circle
        cx="50"
        cy="50"
        r="48"
        stroke="url(#logoGrad)"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

// ---- Main App ----
export default function App() {
  const { identity, login, clear } = useInternetIdentity();
  const principal = identity?.getPrincipal().toText() ?? null;

  const [stories, setStories] = useState<Story[]>(() =>
    load("sar_stories", []),
  );
  const [comments, setComments] = useState<Comment[]>(() =>
    load("sar_comments", []),
  );
  const [privateMessages, setPrivateMessages] = useState<PrivateMessage[]>(() =>
    load("sar_pm", []),
  );
  const [series, setSeries] = useState<Series[]>(() => load("sar_series", []));
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>(() =>
    load("sar_profiles", []),
  );
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>(() =>
    load("sar_banned", []),
  );
  const [adminPrincipal, setAdminPrincipal] = useState<string | null>(() =>
    load("sar_admin", null),
  );
  const [siteOpen, setSiteOpen] = useState<boolean>(() =>
    load("sar_siteopen", false),
  );
  const [authorBio, setAuthorBio] = useState<string>(() => load("sar_bio", ""));
  const [page, setPage] = useState<string>("home");
  const [browseMode, setBrowseMode] = useState(false);
  const [adminPasswordVerified, setAdminPasswordVerified] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminPasswordError, setAdminPasswordError] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [selectedProfilePrincipal, setSelectedProfilePrincipal] = useState<
    string | null
  >(null);
  const [category, setCategory] = useState("recent");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Story[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const isAdmin = !!principal && principal === adminPrincipal;

  // Reset password gate when navigating away from admin
  useEffect(() => {
    if (page !== "admin") {
      setAdminPasswordVerified(false);
      setAdminPasswordInput("");
      setAdminPasswordError(false);
    }
  }, [page]);
  const isBanned =
    !!principal && bannedUsers.some((b) => b.principal === principal);

  // Persist state
  useEffect(() => {
    save("sar_stories", stories);
  }, [stories]);
  useEffect(() => {
    save("sar_comments", comments);
  }, [comments]);
  useEffect(() => {
    save("sar_pm", privateMessages);
  }, [privateMessages]);
  useEffect(() => {
    save("sar_series", series);
  }, [series]);
  useEffect(() => {
    save("sar_profiles", userProfiles);
  }, [userProfiles]);
  useEffect(() => {
    save("sar_banned", bannedUsers);
  }, [bannedUsers]);
  useEffect(() => {
    save("sar_siteopen", siteOpen);
  }, [siteOpen]);
  useEffect(() => {
    save("sar_bio", authorBio);
  }, [authorBio]);

  // Auto-set first login as admin
  useEffect(() => {
    if (principal && !adminPrincipal) {
      setAdminPrincipal(principal);
      save("sar_admin", principal);
    }
  }, [principal, adminPrincipal]);

  // Search
  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }
    const q = search.toLowerCase();
    const results = stories.filter(
      (s) =>
        s.published &&
        (s.title.toLowerCase().includes(q) ||
          s.excerpt.toLowerCase().includes(q)),
    );
    setSearchResults(results.slice(0, 6));
    setShowSearch(true);
  }, [search, stories]);

  // Close search on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSearch(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function getOrCreateProfile(p: string): UserProfile {
    return (
      userProfiles.find((u) => u.principal === p) ?? {
        principal: p,
        displayName: `${p.slice(0, 10)}...`,
        bio: "",
        favorites: [],
        readHistory: [],
        following: [],
        followers: [],
      }
    );
  }

  function updateProfile(updated: UserProfile) {
    setUserProfiles((prev) => {
      const existing = prev.find((u) => u.principal === updated.principal);
      if (existing)
        return prev.map((u) =>
          u.principal === updated.principal ? updated : u,
        );
      return [...prev, updated];
    });
  }

  const myProfile = principal ? getOrCreateProfile(principal) : null;

  function toggleFavorite(storyId: string) {
    if (!principal) return;
    const profile = getOrCreateProfile(principal);
    const favs = profile.favorites.includes(storyId)
      ? profile.favorites.filter((f) => f !== storyId)
      : [...profile.favorites, storyId];
    updateProfile({ ...profile, favorites: favs });
  }

  function recordRead(storyId: string) {
    if (!principal) return;
    const profile = getOrCreateProfile(principal);
    const existing = profile.readHistory.find((r) => r.storyId === storyId);
    const entry = {
      storyId,
      progress: existing?.progress ?? 0,
      lastRead: Date.now(),
    };
    const history = existing
      ? profile.readHistory.map((r) => (r.storyId === storyId ? entry : r))
      : [...profile.readHistory, entry];
    updateProfile({ ...profile, readHistory: history });
    setStories((prev) =>
      prev.map((s) =>
        s.id === storyId ? { ...s, readCount: s.readCount + 1 } : s,
      ),
    );
  }

  function banUser(p: string) {
    if (!bannedUsers.find((b) => b.principal === p))
      setBannedUsers((prev) => [
        ...prev,
        { principal: p, reason: "Banned by admin", bannedAt: Date.now() },
      ]);
  }

  function unbanUser(p: string) {
    setBannedUsers((prev) => prev.filter((b) => b.principal !== p));
  }

  // Site closed
  if (!siteOpen && !isAdmin && !browseMode) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white">
        <Logo size={80} />
        <h1
          className="text-3xl font-bold mt-6 mb-2"
          style={{
            background: "linear-gradient(90deg,#00fff7,#39ff14)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Stories and Reviews
        </h1>
        <p className="text-gray-400 mt-2 mb-6">
          Welcome! Browse stories or log in as admin.
        </p>
        <div className="flex flex-col gap-3 w-52">
          <button
            type="button"
            onClick={() => setBrowseMode(true)}
            className="px-4 py-2 rounded bg-[#39ff14] text-black font-semibold text-sm hover:opacity-80"
          >
            Browse Stories
          </button>
          <button
            type="button"
            onClick={() => {
              setBrowseMode(true);
              login();
            }}
            className="px-4 py-2 rounded bg-white text-black font-semibold text-sm hover:opacity-80"
          >
            Login to Comment
          </button>
          <button
            type="button"
            onClick={login}
            className="px-4 py-2 rounded bg-[#00fff7] text-black font-semibold text-sm hover:opacity-80"
          >
            Admin Login
          </button>
        </div>
      </div>
    );
  }

  // Nav
  function Nav() {
    return (
      <nav className="bg-[#111] border-b border-[#222] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => setPage("home")}
            className="flex items-center gap-2 font-bold text-lg"
            style={{
              background: "linear-gradient(90deg,#00fff7,#39ff14)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            <Logo size={36} /> Stories and Reviews
          </button>
          <div className="flex-1" />
          {/* Search */}
          <div className="relative" ref={searchRef}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stories..."
              className="bg-[#1a1a1a] border border-[#333] rounded-full px-4 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00fff7] w-52"
            />
            {showSearch && searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-lg z-50">
                {searchResults.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => {
                      setSelectedStoryId(s.id);
                      setPage("story");
                      setShowSearch(false);
                      setSearch("");
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#222] text-sm text-white border-b border-[#222] last:border-0"
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPage("about")}
            className="text-gray-300 hover:text-white text-sm"
          >
            About
          </button>
          <button
            type="button"
            onClick={() => setPage("series")}
            className="text-gray-300 hover:text-white text-sm"
          >
            Series
          </button>
          {principal && (
            <button
              type="button"
              onClick={() => {
                setSelectedProfilePrincipal(principal);
                setPage("profile");
              }}
              className="text-gray-300 hover:text-white text-sm"
            >
              My Profile
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setPage("admin")}
              className="text-[#00fff7] hover:text-white text-sm font-semibold"
            >
              Admin
            </button>
          )}
          {principal ? (
            <button
              type="button"
              onClick={clear}
              className="text-gray-400 hover:text-white text-xs border border-[#333] rounded px-2 py-1"
            >
              Logout
            </button>
          ) : (
            <button
              type="button"
              onClick={login}
              className="text-sm px-3 py-1 rounded bg-[#00fff7] text-black font-semibold hover:opacity-80"
            >
              Login
            </button>
          )}
        </div>
      </nav>
    );
  }

  if (page === "about")
    return (
      <>
        <Nav />
        <AboutPage authorBio={authorBio} />
      </>
    );
  if (page === "series")
    return (
      <>
        <Nav />
        <SeriesPage
          stories={stories}
          series={series}
          setPage={setPage}
          setSelectedStoryId={setSelectedStoryId}
        />
      </>
    );
  if (page === "profile" && selectedProfilePrincipal)
    return (
      <>
        <Nav />
        <ProfilePage
          principal={selectedProfilePrincipal}
          myPrincipal={principal}
          profiles={userProfiles}
          stories={stories}
          updateProfile={updateProfile}
          getOrCreateProfile={getOrCreateProfile}
          setPage={setPage}
          setSelectedStoryId={setSelectedStoryId}
        />
      </>
    );
  if (page === "story" && selectedStoryId) {
    const story = stories.find((s) => s.id === selectedStoryId);
    if (!story) {
      setPage("home");
      return null;
    }
    return (
      <>
        <Nav />
        <StoryPage
          story={story}
          comments={comments}
          principal={principal}
          isBanned={isBanned}
          login={login}
          onComment={(text) => {
            if (!principal || isBanned) return;
            const c: Comment = {
              id: Date.now().toString(),
              storyId: story.id,
              author: myProfile?.displayName ?? `${principal.slice(0, 8)}...`,
              principal,
              text,
              createdAt: Date.now(),
              approved: true,
            };
            setComments((prev) => [...prev, c]);
          }}
          onPrivateMessage={(text) => {
            if (!principal) return;
            const pm: PrivateMessage = {
              id: Date.now().toString(),
              storyId: story.id,
              author: myProfile?.displayName ?? `${principal.slice(0, 8)}...`,
              principal,
              text,
              createdAt: Date.now(),
              read: false,
            };
            setPrivateMessages((prev) => [...prev, pm]);
          }}
          onFavorite={() => toggleFavorite(story.id)}
          isFavorite={!!myProfile?.favorites.includes(story.id)}
          onView={() => recordRead(story.id)}
          setPage={setPage}
          setSelectedProfilePrincipal={setSelectedProfilePrincipal}
        />
      </>
    );
  }
  if (page === "admin") {
    if (!isAdmin) {
      setPage("home");
      return null;
    }
    if (!adminPasswordVerified) {
      const handleAdminPasswordSubmit = () => {
        if (adminPasswordInput === "3275" || adminPasswordInput === "#@&%") {
          setAdminPasswordVerified(true);
          setAdminPasswordError(false);
        } else {
          setAdminPasswordError(true);
        }
      };
      return (
        <div
          style={{ background: "#0a0a0a", minHeight: "100vh" }}
          className="flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-6 p-10 rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-2xl w-full max-w-sm">
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl">🔒</span>
              <h2 className="text-white text-2xl font-bold tracking-wide">
                Admin Access
              </h2>
              <p className="text-white/50 text-sm text-center">
                Enter the admin password to continue
              </p>
            </div>
            <input
              data-ocid="admin.input"
              type="password"
              value={adminPasswordInput}
              onChange={(e) => {
                setAdminPasswordInput(e.target.value);
                setAdminPasswordError(false);
              }}
              onKeyDown={(e) =>
                e.key === "Enter" && handleAdminPasswordSubmit()
              }
              placeholder="Password"
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-teal-400 transition"
            />
            {adminPasswordError && (
              <p data-ocid="admin.error_state" className="text-red-400 text-sm">
                Incorrect password. Please try again.
              </p>
            )}
            <button
              type="button"
              data-ocid="admin.submit_button"
              onClick={handleAdminPasswordSubmit}
              className="w-full py-3 rounded-lg font-semibold text-white transition"
              style={{
                background: "linear-gradient(90deg, #00d4a0, #00ff88)",
                color: "#0a0a0a",
              }}
            >
              Unlock Admin Panel
            </button>
            <button
              type="button"
              data-ocid="admin.cancel_button"
              onClick={() => setPage("home")}
              className="text-white/40 hover:text-white/70 text-sm transition"
            >
              Go back home
            </button>
          </div>
        </div>
      );
    }
    return (
      <>
        <Nav />
        <AdminPage
          stories={stories}
          setStories={setStories}
          comments={comments}
          setComments={setComments}
          privateMessages={privateMessages}
          setPrivateMessages={setPrivateMessages}
          series={series}
          setSeries={setSeries}
          bannedUsers={bannedUsers}
          banUser={banUser}
          unbanUser={unbanUser}
          siteOpen={siteOpen}
          setSiteOpen={setSiteOpen}
          authorBio={authorBio}
          setAuthorBio={setAuthorBio}
        />
      </>
    );
  }

  // Home
  const published = stories.filter((s) => s.published);
  let filtered = [...published];
  if (category === "recent") filtered.sort((a, b) => b.createdAt - a.createdAt);
  else if (category === "read")
    filtered.sort((a, b) => b.readCount - a.readCount);
  else if (category === "comments")
    filtered.sort(
      (a, b) =>
        comments.filter((c) => c.storyId === b.id).length -
        comments.filter((c) => c.storyId === a.id).length,
    );
  else if (category === "favorites" && myProfile)
    filtered = filtered.filter((s) => myProfile.favorites.includes(s.id));
  else if (category === "similar" && myProfile) {
    const favIds = myProfile.favorites;
    if (favIds.length === 0) filtered = [];
    else filtered = filtered.filter((s) => !favIds.includes(s.id)).slice(0, 10);
  }

  const cats = [
    { id: "recent", label: "Most Recent" },
    { id: "read", label: "Most Read" },
    { id: "comments", label: "Most Comments" },
    { id: "favorites", label: "Your Favorites" },
    { id: "similar", label: "Similar to Favorites" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Nav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-2 flex-wrap mb-8">
          {cats.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                category === c.id
                  ? "border-[#00fff7] text-[#00fff7] bg-[#00fff7]/10"
                  : "border-[#333] text-gray-400 hover:border-[#555]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-center py-20">
            {category === "favorites"
              ? "No favorites yet."
              : category === "similar"
                ? "Add favorites to see similar stories."
                : "No stories yet."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                isFavorite={!!myProfile?.favorites.includes(story.id)}
                commentCount={
                  comments.filter((c) => c.storyId === story.id).length
                }
                onFavorite={() => toggleFavorite(story.id)}
                onClick={() => {
                  setSelectedStoryId(story.id);
                  setPage("story");
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Story Card ----
function StoryCard({
  story,
  isFavorite,
  commentCount,
  onFavorite,
  onClick,
}: {
  story: Story;
  isFavorite: boolean;
  commentCount: number;
  onFavorite: () => void;
  onClick: () => void;
}) {
  return (
    <article className="bg-[#111] border border-[#222] rounded-xl overflow-hidden hover:border-[#00fff7]/40 transition-all">
      {story.coverImage && (
        <button
          type="button"
          onClick={onClick}
          className="w-full border-0 p-0 bg-transparent cursor-pointer"
        >
          <img
            src={story.coverImage}
            alt={story.title}
            className="w-full h-44 object-cover"
          />
        </button>
      )}
      {!story.coverImage && (
        <button
          type="button"
          className="w-full h-44 bg-[#1a1a1a] flex items-center justify-center cursor-pointer border-0"
          onClick={onClick}
        >
          <span className="text-4xl opacity-20">📖</span>
        </button>
      )}
      <div className="p-4">
        <button
          type="button"
          className="font-bold text-lg mb-1 text-white group-hover:text-[#00fff7] transition-colors text-left w-full bg-transparent border-0 p-0 cursor-pointer"
          onClick={onClick}
        >
          {story.title}
        </button>
        {story.subtext && (
          <p className="text-gray-500 text-xs italic mb-1">{story.subtext}</p>
        )}
        <p className="text-gray-400 text-sm mb-3 line-clamp-2">
          {story.excerpt}
        </p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            👁 {story.readCount} &nbsp; 💬 {commentCount}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFavorite();
            }}
            className={`transition-colors ${isFavorite ? "text-[#00fff7]" : "hover:text-[#00fff7]"}`}
          >
            {isFavorite ? "♥" : "♡"} Favorite
          </button>
        </div>
      </div>
    </article>
  );
}

// ---- Story Page ----
function StoryPage({
  story,
  comments: storyPageComments,
  principal,
  isBanned,
  login,
  onComment,
  onPrivateMessage,
  onFavorite,
  isFavorite,
  onView,
  setPage,
  setSelectedProfilePrincipal,
}: {
  story: Story;
  comments: Comment[];
  principal: string | null;
  isBanned: boolean;
  login: () => void;
  onComment: (text: string) => void;
  onPrivateMessage: (text: string) => void;
  onFavorite: () => void;
  isFavorite: boolean;
  onView: () => void;
  setPage: (p: string) => void;
  setSelectedProfilePrincipal: (p: string) => void;
}) {
  const [commentText, setCommentText] = useState("");
  const [pmText, setPmText] = useState("");
  const [showPm, setShowPm] = useState(false);
  const [pmSent, setPmSent] = useState(false);
  const storyComments = storyPageComments.filter(
    (c) => c.storyId === story.id && c.approved,
  );
  const url = window.location.href;

  useEffect(() => {
    onView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onView]);

  function submitComment() {
    if (!commentText.trim()) return;
    onComment(commentText.trim());
    setCommentText("");
  }

  function submitPm() {
    if (!pmText.trim()) return;
    onPrivateMessage(pmText.trim());
    setPmText("");
    setPmSent(true);
  }

  function copyLink() {
    navigator.clipboard.writeText(url).catch(() => {});
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button
        type="button"
        onClick={() => setPage("home")}
        className="text-gray-400 hover:text-white text-sm mb-6"
      >
        ← Back
      </button>
      {story.coverImage && (
        <img
          src={story.coverImage}
          alt={story.title}
          className="w-full rounded-xl mb-6 object-cover max-h-72"
        />
      )}
      <h1 className="text-3xl font-bold mb-2 text-white">{story.title}</h1>
      {story.subtext && (
        <p className="text-gray-400 text-sm italic mb-3">{story.subtext}</p>
      )}
      <div className="flex gap-3 mb-6 flex-wrap">
        <button
          type="button"
          onClick={onFavorite}
          className={`text-sm px-3 py-1 rounded border ${isFavorite ? "border-[#00fff7] text-[#00fff7]" : "border-[#333] text-gray-400 hover:border-[#00fff7] hover:text-[#00fff7]"}`}
        >
          {isFavorite ? "♥ Favorited" : "♡ Favorite"}
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="text-sm px-3 py-1 rounded border border-[#333] text-gray-400 hover:border-[#39ff14] hover:text-[#39ff14]"
        >
          🔗 Copy Link
        </button>
        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(story.title)}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm px-3 py-1 rounded border border-[#333] text-gray-400 hover:border-[#1DA1F2] hover:text-[#1DA1F2]"
        >
          X / Twitter
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm px-3 py-1 rounded border border-[#333] text-gray-400 hover:border-[#1877F2] hover:text-[#1877F2]"
        >
          Facebook
        </a>
        <a
          href={`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(story.title)}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm px-3 py-1 rounded border border-[#333] text-gray-400 hover:border-[#FF4500] hover:text-[#FF4500]"
        >
          Reddit
        </a>
      </div>

      <div className="prose max-w-none bg-white text-black leading-relaxed whitespace-pre-wrap mb-6 rounded-xl p-6 shadow">
        {story.body}
      </div>

      {story.images.map((img, i) => (
        <img
          key={`img-${i}-${img.slice(-8)}`}
          src={img}
          alt=""
          className="w-full rounded-lg mb-4 object-contain"
        />
      ))}

      {story.links.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Links</h3>
          {story.links.map((l, i) => (
            <a
              key={`link-${i}-${l.url.slice(-8)}`}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="block text-[#00fff7] hover:underline text-sm mb-1"
            >
              {l.label || l.url}
            </a>
          ))}
        </div>
      )}

      {story.googleDriveUrl && (
        <div className="mb-6">
          <a
            href={story.googleDriveUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-[#39ff14] hover:underline border border-[#333] px-3 py-1.5 rounded"
          >
            📄 View on Google Drive
          </a>
        </div>
      )}

      {/* Private Message */}
      <div className="border-t border-[#222] pt-6 mb-6">
        <button
          type="button"
          onClick={() => setShowPm((p) => !p)}
          className="text-sm px-4 py-2 rounded border border-[#333] text-gray-300 hover:border-[#00fff7] hover:text-[#00fff7]"
        >
          ✉ Send Private Review
        </button>
        {showPm && (
          <div className="mt-4">
            {pmSent ? (
              <p className="text-[#39ff14] text-sm">
                Message sent! Only the author can see it.
              </p>
            ) : !principal ? (
              <div>
                <p className="text-gray-400 text-sm mb-2">
                  Please login to send a private message.
                </p>
                <button
                  type="button"
                  onClick={login}
                  className="text-sm px-3 py-1 bg-[#00fff7] text-black rounded font-semibold"
                >
                  Login
                </button>
              </div>
            ) : (
              <>
                <textarea
                  value={pmText}
                  onChange={(e) => setPmText(e.target.value)}
                  placeholder="Your private message to the author..."
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm resize-none focus:outline-none focus:border-[#00fff7] h-24"
                />
                <button
                  type="button"
                  onClick={submitPm}
                  className="mt-2 px-4 py-1.5 bg-[#00fff7] text-black rounded font-semibold text-sm hover:opacity-80"
                >
                  Send
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="border-t border-[#222] pt-6">
        <h3 className="text-xl font-bold mb-4">Reviews & Comments</h3>
        {storyComments.map((c) => (
          <div
            key={c.id}
            className="bg-[#111] rounded-lg p-4 mb-3 border border-[#222]"
          >
            <div className="flex items-center justify-between mb-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedProfilePrincipal(c.principal);
                  setPage("profile");
                }}
                className="font-semibold text-sm text-[#00fff7] hover:underline"
              >
                {c.author}
              </button>
              <span className="text-xs text-gray-500">
                {new Date(c.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="text-gray-300 text-sm">{c.text}</p>
          </div>
        ))}
        {storyComments.length === 0 && (
          <p className="text-gray-500 text-sm">No reviews yet. Be the first!</p>
        )}
        <div className="mt-4">
          {!principal ? (
            <div>
              <p className="text-gray-400 text-sm mb-2">
                Login to leave a review.
              </p>
              <button
                type="button"
                onClick={login}
                className="text-sm px-3 py-1 bg-[#00fff7] text-black rounded font-semibold"
              >
                Login
              </button>
            </div>
          ) : isBanned ? (
            <p className="text-red-400 text-sm">
              You are banned from leaving reviews.
            </p>
          ) : (
            <>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write your review..."
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm resize-none focus:outline-none focus:border-[#00fff7] h-24"
              />
              <button
                type="button"
                onClick={submitComment}
                className="mt-2 px-4 py-1.5 bg-[#00fff7] text-black rounded font-semibold text-sm hover:opacity-80"
              >
                Post Review
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- About Page ----
function AboutPage({ authorBio }: { authorBio: string }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6 text-white">About the Author</h1>
      <div className="bg-[#111] border border-[#222] rounded-xl p-6">
        <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
          {authorBio || "Author bio coming soon..."}
        </p>
      </div>
    </div>
  );
}

// ---- Series Page ----
function SeriesPage({
  stories,
  series,
  setPage,
  setSelectedStoryId,
}: {
  stories: Story[];
  series: Series[];
  setPage: (p: string) => void;
  setSelectedStoryId: (id: string) => void;
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-white">Story Series</h1>
      {series.length === 0 && <p className="text-gray-500">No series yet.</p>}
      {series.map((s) => {
        const seriesStories = stories
          .filter((st) => st.seriesId === s.id && st.published)
          .sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0));
        return (
          <div key={s.id} className="mb-8">
            <h2 className="text-xl font-bold text-[#00fff7] mb-2">{s.title}</h2>
            {s.description && (
              <p className="text-gray-400 text-sm mb-3">{s.description}</p>
            )}
            <div className="space-y-2">
              {seriesStories.map((st, i) => (
                <button
                  type="button"
                  key={st.id}
                  onClick={() => {
                    setSelectedStoryId(st.id);
                    setPage("story");
                  }}
                  className="w-full text-left flex items-center gap-3 bg-[#111] border border-[#222] rounded-lg px-4 py-2 hover:border-[#00fff7]/40 transition-all"
                >
                  <span className="text-gray-500 text-sm w-6">{i + 1}.</span>
                  <span className="text-white text-sm">{st.title}</span>
                </button>
              ))}
              {seriesStories.length === 0 && (
                <p className="text-gray-500 text-sm">
                  No stories in this series yet.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Profile Page ----
function ProfilePage({
  principal,
  myPrincipal,
  stories,
  updateProfile,
  getOrCreateProfile,
  setPage,
  setSelectedStoryId,
}: {
  principal: string;
  myPrincipal: string | null;
  profiles: UserProfile[];
  stories: Story[];
  updateProfile: (p: UserProfile) => void;
  getOrCreateProfile: (p: string) => UserProfile;
  setPage: (p: string) => void;
  setSelectedStoryId: (id: string) => void;
}) {
  const profile = getOrCreateProfile(principal);
  const isMe = myPrincipal === principal;
  const myProfile = myPrincipal ? getOrCreateProfile(myPrincipal) : null;
  const isFollowing = myProfile?.following.includes(principal) ?? false;

  function toggleFollow() {
    if (!myPrincipal || !myProfile) return;
    if (isFollowing) {
      updateProfile({
        ...myProfile,
        following: myProfile.following.filter((f) => f !== principal),
      });
      updateProfile({
        ...profile,
        followers: profile.followers.filter((f) => f !== myPrincipal),
      });
    } else {
      updateProfile({
        ...myProfile,
        following: [...myProfile.following, principal],
      });
      updateProfile({
        ...profile,
        followers: [...profile.followers, myPrincipal],
      });
    }
  }

  const favoriteStories = stories.filter(
    (s) => profile.favorites.includes(s.id) && s.published,
  );
  const historyStories = profile.readHistory
    .sort((a, b) => b.lastRead - a.lastRead)
    .map((r) => ({ ...r, story: stories.find((s) => s.id === r.storyId) }))
    .filter((r) => r.story?.published);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button
        type="button"
        onClick={() => setPage("home")}
        className="text-gray-400 hover:text-white text-sm mb-6"
      >
        ← Back
      </button>
      <div className="bg-[#111] border border-[#222] rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              {profile.displayName}
            </h1>
            <p className="text-gray-500 text-xs mb-3">
              {principal.slice(0, 20)}...
            </p>
            <p className="text-gray-400 text-sm">
              {profile.bio || "No bio yet."}
            </p>
          </div>
          <div className="text-right text-sm text-gray-400">
            <p>{profile.followers.length} followers</p>
            <p>{profile.following.length} following</p>
            {!isMe && myPrincipal && (
              <button
                type="button"
                onClick={toggleFollow}
                className={`mt-2 px-3 py-1 rounded text-sm font-semibold ${isFollowing ? "bg-[#1a1a1a] border border-[#333] text-gray-300" : "bg-[#00fff7] text-black"}`}
              >
                {isFollowing ? "Unfollow" : "Follow"}
              </button>
            )}
          </div>
        </div>
      </div>

      {favoriteStories.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3 text-white">Favorites</h2>
          <div className="space-y-2">
            {favoriteStories.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => {
                  setSelectedStoryId(s.id);
                  setPage("story");
                }}
                className="w-full text-left bg-[#111] border border-[#222] rounded-lg px-4 py-2 hover:border-[#00fff7]/40 text-sm text-white"
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {historyStories.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3 text-white">Reading History</h2>
          <div className="space-y-2">
            {historyStories.map(
              (r) =>
                r.story && (
                  <button
                    type="button"
                    key={r.storyId}
                    onClick={() => {
                      setSelectedStoryId(r.storyId);
                      setPage("story");
                    }}
                    className="w-full text-left bg-[#111] border border-[#222] rounded-lg px-4 py-2 hover:border-[#00fff7]/40"
                  >
                    <span className="text-sm text-white">{r.story.title}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {new Date(r.lastRead).toLocaleDateString()}
                    </span>
                  </button>
                ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Admin Page ----
function AdminPage({
  stories,
  setStories,
  comments,
  setComments,
  privateMessages,
  setPrivateMessages,
  series,
  setSeries,
  bannedUsers,
  banUser,
  unbanUser,
  siteOpen,
  setSiteOpen,
  authorBio,
  setAuthorBio,
}: {
  stories: Story[];
  setStories: React.Dispatch<React.SetStateAction<Story[]>>;
  comments: Comment[];
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
  privateMessages: PrivateMessage[];
  setPrivateMessages: React.Dispatch<React.SetStateAction<PrivateMessage[]>>;
  series: Series[];
  setSeries: React.Dispatch<React.SetStateAction<Series[]>>;
  bannedUsers: BannedUser[];
  banUser: (p: string) => void;
  unbanUser: (p: string) => void;
  siteOpen: boolean;
  setSiteOpen: (v: boolean) => void;
  authorBio: string;
  setAuthorBio: (v: string) => void;
}) {
  const [tab, setTab] = useState("stories");
  const [editStory, setEditStory] = useState<Partial<Story> | null>(null);
  const [editSeries, setEditSeries] = useState<Partial<Series> | null>(null);
  const [openPopupId, setOpenPopupId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<{
    commentId: string;
    storyId: string;
    author: string;
  } | null>(null);
  const [showAddComment, setShowAddComment] = useState(false);
  const [newCommentStoryId, setNewCommentStoryId] = useState("");
  const [newCommentText, setNewCommentText] = useState("");
  const [privateMessageTarget, setPrivateMessageTarget] = useState<{
    principal: string;
    author: string;
  } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [privateMessageText, setPrivateMessageText] = useState("");

  const tabs = [
    "stories",
    "comments",
    "messages",
    "series",
    "banned",
    "settings",
  ];

  // Close popup on outside click
  useEffect(() => {
    const handler = () => setOpenPopupId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  function saveStory(publish?: boolean) {
    if (!editStory?.title) return;
    const publishedValue =
      publish !== undefined ? publish : (editStory.published ?? false);
    if (editStory.id) {
      setStories((prev) =>
        prev.map((s) =>
          s.id === editStory.id
            ? ({ ...s, ...editStory, published: publishedValue } as Story)
            : s,
        ),
      );
    } else {
      const newStory: Story = {
        id: Date.now().toString(),
        title: editStory.title ?? "",
        excerpt: editStory.excerpt ?? "",
        body: editStory.body ?? "",
        coverImage: editStory.coverImage ?? "",
        images: editStory.images ?? [],
        links: editStory.links ?? [],
        seriesId: editStory.seriesId,
        seriesOrder: editStory.seriesOrder,
        readCount: 0,
        createdAt: Date.now(),
        published: publishedValue,
        googleDriveUrl: editStory.googleDriveUrl,
        subtext: editStory.subtext,
      };
      setStories((prev) => [...prev, newStory]);
    }
    setEditStory(null);
  }

  function togglePublished(id: string) {
    setStories((prev) =>
      prev.map((s) => (s.id === id ? { ...s, published: !s.published } : s)),
    );
  }

  function saveSeries() {
    if (!editSeries?.title) return;
    if (editSeries.id) {
      setSeries((prev) =>
        prev.map((s) =>
          s.id === editSeries.id ? ({ ...s, ...editSeries } as Series) : s,
        ),
      );
    } else {
      setSeries((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          title: editSeries.title ?? "",
          description: editSeries.description ?? "",
        },
      ]);
    }
    setEditSeries(null);
  }

  function addLink() {
    setEditStory((prev) => ({
      ...prev,
      links: [...(prev?.links ?? []), { label: "", url: "" }],
    }));
  }

  return (
    <div
      className="max-w-5xl mx-auto px-4 py-8"
      onClick={() => setOpenPopupId(null)}
      onKeyDown={() => setOpenPopupId(null)}
      role="presentation"
    >
      {/* Private Message Modal */}
      {privateMessageTarget && (
        <div
          className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center"
          data-ocid="privatemsg.modal"
          onClick={() => setPrivateMessageTarget(null)}
          onKeyDown={() => setPrivateMessageTarget(null)}
          role="presentation"
        >
          <div
            className="bg-[#111] border border-[#333] rounded-xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold mb-1">Message Privately</h3>
            <p className="text-gray-400 text-sm mb-3">
              To:{" "}
              <span className="text-[#00fff7]">
                {privateMessageTarget.author}
              </span>
            </p>
            <textarea
              className="w-full bg-[#222] border border-[#333] text-white text-sm rounded p-3 resize-none mb-3"
              rows={4}
              placeholder="Write your private message..."
              value={privateMessageText}
              onChange={(e) => setPrivateMessageText(e.target.value)}
              data-ocid="privatemsg.textarea"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                data-ocid="privatemsg.cancel_button"
                className="px-4 py-2 text-sm text-gray-400 border border-[#333] rounded hover:text-white"
                onClick={() => {
                  setPrivateMessageTarget(null);
                  setPrivateMessageText("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                data-ocid="privatemsg.submit_button"
                className="px-4 py-2 text-sm bg-[#00fff7] text-black rounded font-medium hover:bg-[#00e5de]"
                onClick={() => {
                  if (!privateMessageText.trim()) return;
                  setPrivateMessages((prev) => [
                    ...prev,
                    {
                      id: Date.now().toString(),
                      author: `Admin (to ${privateMessageTarget.author})`,
                      principal: "admin",
                      text: privateMessageText.trim(),
                      createdAt: Date.now(),
                      read: true,
                    },
                  ]);
                  setPrivateMessageText("");
                  setPrivateMessageTarget(null);
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <div className="flex items-center gap-3">
          <span
            className={`text-sm font-medium ${siteOpen ? "text-green-400" : "text-red-400"}`}
          >
            {siteOpen ? "Site is Open" : "Site is Closed"}
          </span>
          {siteOpen ? (
            <button
              type="button"
              data-ocid="admin.close_site_button"
              onClick={() => setSiteOpen(false)}
              className="px-3 py-1.5 rounded text-sm font-semibold bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 transition-colors"
            >
              Close Site
            </button>
          ) : (
            <button
              type="button"
              data-ocid="admin.open_site_button"
              onClick={() => setSiteOpen(true)}
              className="px-3 py-1.5 rounded text-sm font-semibold bg-[#00fff7] text-black hover:bg-[#00e5de] transition-colors"
            >
              Open Site
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {tabs.map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm capitalize border transition-all ${
              tab === t
                ? "border-[#00fff7] text-[#00fff7] bg-[#00fff7]/10"
                : "border-[#333] text-gray-400 hover:border-[#555]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Stories */}
      {tab === "stories" && (
        <div>
          <button
            type="button"
            onClick={() =>
              setEditStory({ links: [], images: [], published: false })
            }
            className="mb-4 px-4 py-2 bg-[#00fff7] text-black rounded font-semibold text-sm hover:opacity-80"
          >
            Add Story
          </button>
          {editStory !== null && (
            <div className="bg-[#111] border border-[#222] rounded-xl p-6 mb-6">
              <h3 className="font-bold mb-4 text-white">
                {editStory.id ? "Edit Story" : "New Story"}
              </h3>
              <div className="space-y-3">
                <input
                  value={editStory.title ?? ""}
                  onChange={(e) =>
                    setEditStory((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="Title"
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00fff7]"
                />
                <input
                  value={editStory.subtext ?? ""}
                  onChange={(e) =>
                    setEditStory((p) => ({ ...p, subtext: e.target.value }))
                  }
                  placeholder="Enter Subtext (optional subtitle)"
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00fff7]"
                />
                <input
                  value={editStory.excerpt ?? ""}
                  onChange={(e) =>
                    setEditStory((p) => ({ ...p, excerpt: e.target.value }))
                  }
                  placeholder="Excerpt (short preview)"
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00fff7]"
                />
                <textarea
                  value={editStory.body ?? ""}
                  onChange={(e) =>
                    setEditStory((p) => ({ ...p, body: e.target.value }))
                  }
                  placeholder="Story body..."
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00fff7] h-40 resize-none"
                />
                <input
                  value={editStory.coverImage ?? ""}
                  onChange={(e) =>
                    setEditStory((p) => ({ ...p, coverImage: e.target.value }))
                  }
                  placeholder="Cover image URL"
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00fff7]"
                />
                <input
                  value={editStory.googleDriveUrl ?? ""}
                  onChange={(e) =>
                    setEditStory((p) => ({
                      ...p,
                      googleDriveUrl: e.target.value,
                    }))
                  }
                  placeholder="Google Drive link (optional)"
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00fff7]"
                />
                <select
                  value={editStory.seriesId ?? ""}
                  onChange={(e) =>
                    setEditStory((p) => ({
                      ...p,
                      seriesId: e.target.value || undefined,
                    }))
                  }
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00fff7]"
                >
                  <option value="">No series</option>
                  {/* series list injected from parent via prop - we don't have it here, so skip for now */}
                </select>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Links</span>
                    <button
                      type="button"
                      onClick={addLink}
                      className="text-xs text-[#00fff7] hover:underline"
                    >
                      + Add Link
                    </button>
                  </div>
                  {(editStory.links ?? []).map((l, i) => (
                    <div
                      key={`editlink-${l.url || l.label || i}`}
                      className="flex gap-2 mb-2"
                    >
                      <input
                        value={l.label}
                        onChange={(e) =>
                          setEditStory((p) => ({
                            ...p,
                            links: (p?.links ?? []).map((x, j) =>
                              j === i ? { ...x, label: e.target.value } : x,
                            ),
                          }))
                        }
                        placeholder="Label"
                        className="flex-1 bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-white text-xs focus:outline-none"
                      />
                      <input
                        value={l.url}
                        onChange={(e) =>
                          setEditStory((p) => ({
                            ...p,
                            links: (p?.links ?? []).map((x, j) =>
                              j === i ? { ...x, url: e.target.value } : x,
                            ),
                          }))
                        }
                        placeholder="URL"
                        className="flex-2 bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-white text-xs focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEditStory((p) => ({
                            ...p,
                            links: (p?.links ?? []).filter((_, j) => j !== i),
                          }))
                        }
                        className="text-red-400 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    data-ocid="story.save_draft_button"
                    onClick={() => saveStory(false)}
                    className="px-4 py-2 bg-[#1a1a1a] border border-yellow-600 text-yellow-400 rounded font-semibold text-sm hover:bg-yellow-900/20"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    data-ocid="story.publish_button"
                    onClick={() => saveStory(true)}
                    className="px-4 py-2 bg-[#00fff7] text-black rounded font-semibold text-sm hover:opacity-80"
                  >
                    Publish
                  </button>
                  <button
                    type="button"
                    data-ocid="story.cancel_button"
                    onClick={() => setEditStory(null)}
                    className="px-4 py-2 bg-[#1a1a1a] border border-[#333] text-gray-300 rounded text-sm hover:bg-[#222]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {stories.map((s) => (
              <div
                key={s.id}
                className="bg-[#111] border border-[#222] rounded-lg px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <span className="font-medium text-white text-sm">
                    {s.title}
                  </span>
                  <span
                    className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${s.published ? "bg-[#00fff7]/20 text-[#00fff7] border border-[#00fff7]/40" : "bg-yellow-900/30 text-yellow-400 border border-yellow-600/40"}`}
                  >
                    {s.published ? "✓ Published" : "✎ Draft"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-ocid="story.toggle_publish_button"
                    onClick={() => togglePublished(s.id)}
                    className={`text-xs px-2 py-1 rounded border ${s.published ? "text-gray-400 border-[#333] hover:text-white hover:border-gray-400" : "text-[#00fff7] border-[#00fff7]/40 hover:bg-[#00fff7]/10"}`}
                  >
                    {s.published ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    data-ocid="story.edit_button"
                    onClick={() => setEditStory(s)}
                    className="text-xs text-gray-400 hover:text-white border border-[#333] px-2 py-1 rounded"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setStories((prev) => prev.filter((x) => x.id !== s.id))
                    }
                    className="text-xs text-red-400 hover:text-red-300 border border-[#333] px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      {tab === "comments" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              data-ocid="admin.add_comment_button"
              onClick={() => setShowAddComment((v) => !v)}
              className="px-4 py-2 bg-[#00fff7] text-black rounded font-semibold text-sm hover:opacity-80"
            >
              {showAddComment ? "Cancel" : "Add Comment"}
            </button>
          </div>
          {showAddComment && (
            <div className="bg-[#111] border border-[#222] rounded-xl p-5 space-y-3">
              <h3 className="font-bold text-white">Add Admin Comment</h3>
              <select
                value={newCommentStoryId}
                onChange={(e) => setNewCommentStoryId(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00fff7]"
                data-ocid="admin.comment.select"
              >
                <option value="">Select a story…</option>
                {stories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <input
                readOnly
                value="Admin"
                className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-gray-400 text-sm"
              />
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Write your comment…"
                rows={3}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00fff7] resize-none"
                data-ocid="admin.comment.textarea"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  data-ocid="admin.comment.submit_button"
                  onClick={() => {
                    if (!newCommentStoryId || !newCommentText.trim()) return;
                    setComments((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        storyId: newCommentStoryId,
                        author: "Admin",
                        principal: "admin",
                        text: newCommentText.trim(),
                        createdAt: Date.now(),
                        approved: true,
                        featured: false,
                      },
                    ]);
                    setNewCommentText("");
                    setNewCommentStoryId("");
                    setShowAddComment(false);
                  }}
                  className="px-4 py-2 bg-[#00fff7] text-black rounded font-semibold text-sm hover:opacity-80"
                >
                  Submit
                </button>
                <button
                  type="button"
                  data-ocid="admin.comment.cancel_button"
                  onClick={() => {
                    setShowAddComment(false);
                    setNewCommentText("");
                    setNewCommentStoryId("");
                  }}
                  className="px-4 py-2 bg-[#1a1a1a] border border-[#333] text-gray-300 rounded text-sm hover:bg-[#222]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {comments.length === 0 && (
            <p className="text-gray-500">No reviews yet.</p>
          )}
          {comments.map((c) => (
            <div
              key={c.id}
              className="bg-[#111] border border-[#222] rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="relative inline-block">
                    <button
                      type="button"
                      data-ocid="comment.author.button"
                      className="text-[#00fff7] hover:underline cursor-pointer font-medium text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenPopupId(openPopupId === c.id ? null : c.id);
                      }}
                    >
                      {c.author}
                    </button>
                    {c.featured && (
                      <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded">
                        Featured
                      </span>
                    )}
                    {openPopupId === c.id && (
                      <div
                        className="absolute left-0 top-6 z-50 w-48 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#222]"
                          onClick={() => {
                            setReplyTarget({
                              commentId: c.id,
                              storyId: c.storyId,
                              author: c.author,
                            });
                            setOpenPopupId(null);
                          }}
                        >
                          💬 Comment
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#222]"
                          onClick={() => {
                            setComments((prev) =>
                              prev.map((x) =>
                                x.id === c.id
                                  ? { ...x, featured: !x.featured }
                                  : x,
                              ),
                            );
                            setOpenPopupId(null);
                          }}
                        >
                          ⭐ {c.featured ? "Unfeature" : "Feature Comment"}
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#222]"
                          onClick={() => {
                            setPrivateMessageTarget({
                              principal: c.principal,
                              author: c.author,
                            });
                            setOpenPopupId(null);
                          }}
                        >
                          ✉️ Message Privately
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-orange-400 hover:bg-[#222]"
                          onClick={() => {
                            banUser(c.principal);
                            setOpenPopupId(null);
                          }}
                        >
                          🚫 Ban
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-green-400 hover:bg-[#222]"
                          onClick={() => {
                            unbanUser(c.principal);
                            setOpenPopupId(null);
                          }}
                        >
                          ✅ Unban
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 ml-2">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                  <p className="text-gray-300 text-sm mt-1">{c.text}</p>
                  {replyTarget?.commentId === c.id && (
                    <div
                      className="mt-3 flex gap-2"
                      data-ocid="comment.reply.panel"
                    >
                      <textarea
                        className="flex-1 bg-[#222] border border-[#333] text-white text-sm rounded p-2 resize-none"
                        rows={2}
                        placeholder="Write a reply..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        data-ocid="comment.textarea"
                      />
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          data-ocid="comment.submit_button"
                          className="text-xs bg-[#00fff7] text-black px-3 py-1 rounded hover:bg-[#00e5de] font-medium"
                          onClick={() => {
                            if (!replyText.trim()) return;
                            setComments((prev) => [
                              ...prev,
                              {
                                id: Date.now().toString(),
                                storyId: c.storyId,
                                author: "Admin",
                                principal: "admin",
                                text: replyText.trim(),
                                createdAt: Date.now(),
                                approved: true,
                              },
                            ]);
                            setReplyText("");
                            setReplyTarget(null);
                          }}
                        >
                          Send
                        </button>
                        <button
                          type="button"
                          data-ocid="comment.cancel_button"
                          className="text-xs text-gray-400 hover:text-white"
                          onClick={() => setReplyTarget(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setComments((prev) => prev.filter((x) => x.id !== c.id))
                    }
                    className="text-xs text-red-400 border border-[#333] px-2 py-1 rounded hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Private Messages */}
      {tab === "messages" && (
        <div className="space-y-3">
          {privateMessages.length === 0 && (
            <p className="text-gray-500">No private messages yet.</p>
          )}
          {privateMessages.map((m) => (
            <div
              key={m.id}
              className={`bg-[#111] border rounded-lg p-4 ${m.read ? "border-[#222]" : "border-[#00fff7]/40"}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="relative inline-block">
                    <button
                      type="button"
                      data-ocid="message.author.button"
                      className="text-[#00fff7] hover:underline cursor-pointer font-medium text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenPopupId(openPopupId === m.id ? null : m.id);
                      }}
                    >
                      {m.author}
                    </button>
                    {openPopupId === m.id && (
                      <div
                        className="absolute left-0 top-6 z-50 w-48 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#222]"
                          onClick={() => {
                            setPrivateMessageTarget({
                              principal: m.principal,
                              author: m.author,
                            });
                            setOpenPopupId(null);
                          }}
                        >
                          ✉️ Message Privately
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-orange-400 hover:bg-[#222]"
                          onClick={() => {
                            banUser(m.principal);
                            setOpenPopupId(null);
                          }}
                        >
                          🚫 Ban
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-green-400 hover:bg-[#222]"
                          onClick={() => {
                            unbanUser(m.principal);
                            setOpenPopupId(null);
                          }}
                        >
                          ✅ Unban
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 ml-2">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                  {!m.read && (
                    <span className="ml-2 text-xs text-[#00fff7]">New</span>
                  )}
                  <p className="text-gray-300 text-sm mt-1">{m.text}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPrivateMessages((prev) =>
                      prev.map((x) =>
                        x.id === m.id ? { ...x, read: true } : x,
                      ),
                    )
                  }
                  className="text-xs text-gray-400 border border-[#333] px-2 py-1 rounded ml-4 hover:text-white"
                >
                  Mark Read
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Series */}
      {tab === "series" && (
        <div>
          <button
            type="button"
            onClick={() => setEditSeries({ title: "", description: "" })}
            className="mb-4 px-4 py-2 bg-[#00fff7] text-black rounded font-semibold text-sm hover:opacity-80"
          >
            + New Series
          </button>
          {editSeries !== null && (
            <div className="bg-[#111] border border-[#222] rounded-xl p-6 mb-6">
              <h3 className="font-bold mb-4 text-white">
                {editSeries.id ? "Edit Series" : "New Series"}
              </h3>
              <div className="space-y-3">
                <input
                  value={editSeries.title ?? ""}
                  onChange={(e) =>
                    setEditSeries((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="Series title"
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00fff7]"
                />
                <input
                  value={editSeries.description ?? ""}
                  onChange={(e) =>
                    setEditSeries((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Description"
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00fff7]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveSeries}
                    className="px-4 py-2 bg-[#00fff7] text-black rounded font-semibold text-sm hover:opacity-80"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditSeries(null)}
                    className="px-4 py-2 bg-[#1a1a1a] border border-[#333] text-gray-300 rounded text-sm hover:bg-[#222]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {series.map((s) => (
              <div
                key={s.id}
                className="bg-[#111] border border-[#222] rounded-lg px-4 py-3 flex items-center justify-between"
              >
                <span className="font-medium text-white text-sm">
                  {s.title}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditSeries(s)}
                    className="text-xs text-gray-400 hover:text-white border border-[#333] px-2 py-1 rounded"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSeries((prev) => prev.filter((x) => x.id !== s.id))
                    }
                    className="text-xs text-red-400 hover:text-red-300 border border-[#333] px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Banned Users */}
      {tab === "banned" && (
        <div className="space-y-3">
          {bannedUsers.length === 0 && (
            <p className="text-gray-500">No banned users.</p>
          )}
          {bannedUsers.map((b) => (
            <div
              key={b.principal}
              className="bg-[#111] border border-[#222] rounded-lg px-4 py-3 flex items-center justify-between"
            >
              <div>
                <span className="text-sm text-white">
                  {b.principal.slice(0, 20)}...
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  {new Date(b.bannedAt).toLocaleDateString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => unbanUser(b.principal)}
                className="text-xs text-[#39ff14] border border-[#333] px-2 py-1 rounded hover:opacity-80"
              >
                Unban
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Settings */}
      {tab === "settings" && (
        <div className="space-y-6">
          <div>
            <h3 className="font-bold text-white mb-3">Author Bio</h3>
            <textarea
              value={authorBio}
              onChange={(e) => setAuthorBio(e.target.value)}
              placeholder="Write your author bio..."
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm resize-none focus:outline-none focus:border-[#00fff7] h-32"
            />
          </div>
        </div>
      )}
    </div>
  );
}
