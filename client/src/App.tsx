
import { useEffect, useState } from 'react'
import AuthPage from './pages/AuthPage'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  ChevronDown,
  Code2,
  GitCompareArrows,
  GitFork,
  GitBranch,
  LayoutDashboard,
  Search,
  Settings,
  Star,
  Users,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const activityData = [
  { day: 'Mon', commits: 12 },
  { day: 'Tue', commits: 19 },
  { day: 'Wed', commits: 15 },
  { day: 'Thu', commits: 28 },
  { day: 'Fri', commits: 22 },
  { day: 'Sat', commits: 35 },
  { day: 'Sun', commits: 26 },
]

const developers = [
  {
    name: 'torvalds',
    fullName: 'Linus Torvalds',
    description: 'Creator of Linux and Git',
    avatar: 'https://github.com/torvalds.png',
    followers: '230K',
    repos: 8,
    stars: '190K',
    language: 'C',
    color: '#60a5fa',
  },
  {
    name: 'sindresorhus',
    fullName: 'Sindre Sorhus',
    description: 'Open-source developer',
    avatar: 'https://github.com/sindresorhus.png',
    followers: '67K',
    repos: 1,
    stars: '75K',
    language: 'JavaScript',
    color: '#facc15',
  },
]

const repositories = [
  {
    name: 'linux',
    owner: 'torvalds',
    description: 'Linux kernel source tree',
    stars: '190k',
    language: 'C',
    color: '#60a5fa',
    updated: 'Recently updated',
  },
  {
    name: 'git',
    owner: 'git',
    description: 'Distributed version control system',
    stars: '55k',
    language: 'C',
    color: '#60a5fa',
    updated: 'Recently updated',
  },
  {
    name: 'awesome',
    owner: 'sindresorhus',
    description: 'Awesome lists about all kinds of interesting topics',
    stars: '40k',
    language: 'Markdown',
    color: '#a78bfa',
    updated: 'Recently updated',
  },
]

type Tab = 'Overview' | 'Discover' | 'Compare' | 'Collections'
type AuthUser = { id: number; username: string; email: string }
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

function App() {
  const currentPath = window.location.pathname.replace(/\/$/, '')
  if (currentPath === '/login') return <AuthPage mode="login" />
  if (currentPath === '/signup') return <AuthPage mode="signup" />

  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [username, setUsername] = useState('')
  const [searchMessage, setSearchMessage] = useState('')
  const [savedRepos, setSavedRepos] = useState<string[]>(['linux'])
  const [selectedDevelopers, setSelectedDevelopers] = useState<string[]>([
    'torvalds',
    'sindresorhus',
  ])
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let active = true

    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return null
        const data = (await response.json()) as { user?: AuthUser } & Partial<AuthUser>
        return data.user ?? (data.id && data.username ? (data as AuthUser) : null)
      })
      .catch(() => null)
      .then((user) => {
        if (active) {
          setAuthUser(user)
        }
      })

    return () => {
      active = false
    }
  }, [])

  async function signOut() {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      setAuthUser(null)
    }
  }

  function searchDeveloper(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanUsername = username.trim().replace(/^@/, '')

    if (!cleanUsername) {
      setSearchMessage('Enter a GitHub username to get started.')
      return
    }

    setSearchMessage(
      `Search UI is ready for @${cleanUsername}. Live GitHub integration is our next milestone.`,
    )
  }

  function toggleSavedRepo(name: string) {
    setSavedRepos((current) =>
      current.includes(name)
        ? current.filter((repo) => repo !== name)
        : [...current, name],
    )
  }

  function toggleDeveloper(name: string) {
    setSelectedDevelopers((current) => {
      if (current.includes(name)) {
        return current.filter((developer) => developer !== name)
      }
      if (current.length >= 3) return current
      return [...current, name]
    })
  }

  const navItems: { label: Tab; icon: typeof LayoutDashboard }[] = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Discover', icon: Search },
    { label: 'Compare', icon: GitCompareArrows },
    { label: 'Collections', icon: Bookmark },
  ]

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/[0.07] bg-[#0d0d10] p-5 lg:flex">
          <a href="#" className="mb-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-white shadow-lg shadow-violet-500/20">
              <Activity size={23} />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">
                Stack<span className="text-violet-400">Pulse</span>
              </div>
              <div className="text-xs text-zinc-500">Developer intelligence</div>
            </div>
          </a>

          <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
            Workspace
          </div>

          <nav className="space-y-1">
            {navItems.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => {
                  setActiveTab(label)
                  setSearchMessage('')
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                  activeTab === label
                    ? 'bg-violet-500/10 font-medium text-violet-300'
                    : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
                }`}
              >
                <Icon size={18} />
                {label}
                {label === 'Collections' && savedRepos.length > 0 && (
                  <span className="ml-auto rounded-md bg-white/[0.06] px-2 py-0.5 text-xs">
                    {savedRepos.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-9 mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
            Preferences
          </div>
          <button className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-zinc-500 hover:bg-white/[0.04]">
            <Settings size={18} />
            Settings
          </button>

          <div className="mt-auto rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/10 to-transparent p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Zap size={16} className="text-violet-400" />
              Developer insights
            </div>
            <p className="text-xs leading-5 text-zinc-500">
              Explore open-source projects and compare developer activity.
            </p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full w-2/3 rounded-full bg-violet-400" />
            </div>
            <div className="mt-2 text-[10px] text-zinc-600">
              Your workspace, your discoveries
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-white/[0.07] bg-[#09090b]/90 px-5 backdrop-blur-xl sm:px-8">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <GitBranch size={17} />
              <span className="hidden sm:inline">Workspace</span>
              <span>/</span>
              <span className="text-zinc-200">{activeTab}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-zinc-500 sm:flex">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Demo mode
              </div>
              <button
                aria-label="Notifications"
                className="rounded-xl border border-white/[0.08] p-2.5 text-zinc-400 hover:bg-white/[0.05]"
              >
                <Bell size={17} />
              </button>
              {authUser ? (
                <div className="flex items-center gap-3">
                  <div className="hidden text-right sm:block">
                    <div className="max-w-36 truncate text-sm font-medium text-zinc-200">{authUser.username}</div>
                    <button onClick={signOut} className="text-xs text-zinc-500 transition hover:text-violet-300">Sign out</button>
                  </div>
                  <div
                    aria-label={`${authUser.username} profile picture`}
                    title={authUser.username}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-sm font-semibold uppercase text-violet-300 ring-1 ring-violet-400/20"
                  >
                    {authUser.username.slice(0, 2)}
                  </div>
                  <button onClick={signOut} className="text-xs text-zinc-400 sm:hidden">Sign out</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <a href="/login" className="rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white">
                    Log in
                  </a>
                  <a href="/signup" className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-400">
                    Sign up
                  </a>
                </div>
              )}
            </div>
          </header>

          <div className="mx-auto max-w-[1440px] p-5 sm:p-8">
            <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-medium text-violet-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                  YOUR OPEN-SOURCE COMMAND CENTER
                </div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {activeTab === 'Overview'
                    ? 'Developer overview'
                    : activeTab}
                  <span className="text-violet-400">.</span>
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                  Discover developers, explore repositories, and turn GitHub
                  activity into meaningful insights.
                </p>
              </div>

              <form
                onSubmit={searchDeveloper}
                className="flex w-full gap-2 md:max-w-md"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.1] bg-[#111114] px-3 focus-within:border-violet-400/60">
                  <Search size={18} className="shrink-0 text-zinc-500" />
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Search GitHub username..."
                    aria-label="GitHub username"
                    className="w-full min-w-0 bg-transparent py-3 text-sm outline-none placeholder:text-zinc-600"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white transition hover:bg-violet-400"
                >
                  Search
                </button>
              </form>
            </section>

            {searchMessage && (
              <div
                role="status"
                className="mb-6 rounded-xl border border-violet-400/20 bg-violet-400/[0.06] px-4 py-3 text-sm text-violet-200"
              >
                {searchMessage}
              </div>
            )}

            <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: 'Developers tracked',
                  value: '02',
                  change: 'Sample profiles',
                  icon: Users,
                  trend: 'up',
                },
                {
                  label: 'Total stars',
                  value: '265K',
                  change: 'Across demo profiles',
                  icon: Star,
                  trend: 'up',
                },
                {
                  label: 'Repositories',
                  value: '9',
                  change: 'Sample data',
                  icon: Code2,
                  trend: 'up',
                },
                {
                  label: 'Commit activity',
                  value: '157',
                  change: 'Illustrative this week',
                  icon: Activity,
                  trend: 'down',
                },
              ].map((metric) => {
                const Icon = metric.icon
                return (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-white/[0.07] bg-[#101013] p-5 transition hover:border-white/[0.13]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">
                        {metric.label}
                      </span>
                      <div className="rounded-xl bg-white/[0.04] p-2.5 text-zinc-400">
                        <Icon size={18} />
                      </div>
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-tight">
                      {metric.value}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
                      {metric.trend === 'up' ? (
                        <ArrowUpRight size={14} className="text-emerald-400" />
                      ) : (
                        <ArrowDownRight size={14} className="text-amber-400" />
                      )}
                      {metric.change}
                    </div>
                  </div>
                )
              })}
            </section>

            <section className="mb-8 grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
              <div className="rounded-2xl border border-white/[0.07] bg-[#101013] p-5 sm:p-6">
                <div className="mb-6 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Commit activity</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Illustrative weekly activity · demo data
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-zinc-400">
                    Last 7 days <ChevronDown size={13} className="ml-2 inline" />
                  </div>
                </div>
                <div className="h-[230px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityData}>
                      <defs>
                        <linearGradient
                          id="activityGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#a78bfa"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor="#a78bfa"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke="rgba(255,255,255,0.06)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        width={30}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#18181b',
                          border: '1px solid #3f3f46',
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="commits"
                        stroke="#a78bfa"
                        strokeWidth={2.5}
                        fill="url(#activityGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-[#101013] p-5 sm:p-6">
                <div className="mb-5">
                  <h2 className="font-semibold">Language distribution</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Illustrative distribution · demo data
                  </p>
                </div>
                <div className="space-y-5">
                  {[
                    { name: 'C', percent: 42, color: '#60a5fa' },
                    { name: 'JavaScript', percent: 28, color: '#facc15' },
                    { name: 'TypeScript', percent: 18, color: '#818cf8' },
                    { name: 'Python', percent: 12, color: '#34d399' },
                  ].map((language) => (
                    <div key={language.name}>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="text-zinc-300">{language.name}</span>
                        <span className="text-zinc-500">
                          {language.percent}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${language.percent}%`,
                            backgroundColor: language.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-xl bg-white/[0.025] p-3 text-xs leading-5 text-zinc-500">
                  Language metrics will be calculated from GitHub repository
                  data in the API integration stage.
                </div>
              </div>
            </section>

            <section className="mb-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Tracked developers</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Sample profiles to preview the dashboard
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('Discover')}
                  className="text-sm text-violet-300 hover:text-violet-200"
                >
                  Discover developers →
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {developers.map((developer) => (
                  <div
                    key={developer.name}
                    className="rounded-2xl border border-white/[0.07] bg-[#101013] p-5 transition hover:border-violet-400/20"
                  >
                    <div className="flex items-start gap-4">
                      <img
                        src={developer.avatar}
                        alt={`${developer.fullName} avatar`}
                        className="h-14 w-14 rounded-2xl border border-white/10 bg-zinc-800"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{developer.fullName}</h3>
                        <a
                          href={`https://github.com/${developer.name}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-violet-300 hover:underline"
                        >
                          @{developer.name}
                        </a>
                        <p className="mt-2 text-xs text-zinc-500">
                          {developer.description}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleDeveloper(developer.name)}
                        aria-label={`${
                          selectedDevelopers.includes(developer.name)
                            ? 'Remove'
                            : 'Add'
                        } ${developer.name} ${
                          selectedDevelopers.includes(developer.name)
                            ? 'from'
                            : 'to'
                        } comparison`}
                        className={`rounded-xl border p-2.5 transition ${
                          selectedDevelopers.includes(developer.name)
                            ? 'border-violet-400/30 bg-violet-400/10 text-violet-300'
                            : 'border-white/[0.08] text-zinc-500 hover:text-white'
                        }`}
                      >
                        <GitCompareArrows size={17} />
                      </button>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <Star size={13} /> Stars
                        </div>
                        <div className="mt-1.5 font-semibold">
                          {developer.stars}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <Users size={13} /> Followers
                        </div>
                        <div className="mt-1.5 font-semibold">
                          {developer.followers}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <GitFork size={13} /> Repos
                        </div>
                        <div className="mt-1.5 font-semibold">
                          {developer.repos}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: developer.color }}
                      />
                      Primary language: {developer.language}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-8 rounded-2xl border border-white/[0.07] bg-[#101013] p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Notable repositories</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Pin repositories to your personal collection
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('Collections')}
                  className="text-sm text-violet-300 hover:text-violet-200"
                >
                  View collection →
                </button>
              </div>

              <div className="divide-y divide-white/[0.06]">
                {repositories.map((repo) => (
                  <div
                    key={repo.name}
                    className="flex items-center gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4"
                  >
                    <div className="hidden rounded-xl bg-white/[0.04] p-3 text-zinc-400 sm:block">
                      <Code2 size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <a
                        href={`https://github.com/${repo.owner}/${repo.name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-violet-300 hover:underline"
                      >
                        {repo.owner}/{repo.name}
                      </a>
                      <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                        {repo.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Star size={13} /> {repo.stars}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: repo.color }}
                          />
                          {repo.language}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSavedRepo(repo.name)}
                      aria-label={`${
                        savedRepos.includes(repo.name) ? 'Unpin' : 'Pin'
                      } ${repo.name}`}
                      className={`shrink-0 rounded-xl border p-2.5 transition ${
                        savedRepos.includes(repo.name)
                          ? 'border-violet-400/30 bg-violet-400/10 text-violet-300'
                          : 'border-white/[0.08] text-zinc-500 hover:border-violet-400/30 hover:text-violet-300'
                      }`}
                    >
                      <Bookmark
                        size={17}
                        fill={
                          savedRepos.includes(repo.name)
                            ? 'currentColor'
                            : 'none'
                        }
                      />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <footer className="flex flex-col justify-between gap-2 border-t border-white/[0.07] py-5 text-xs text-zinc-600 sm:flex-row">
              <span>StackPulse · GitHub Developer Intelligence</span>
              <span>Built with React, TypeScript & Recharts</span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
