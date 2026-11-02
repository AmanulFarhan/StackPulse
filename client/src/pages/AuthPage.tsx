import React, { useState } from 'react'
import { Activity, ArrowRight, Eye, EyeOff } from 'lucide-react'

type AuthMode = 'login' | 'signup'
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const isSignup = mode === 'signup'
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())
    const endpoint = isSignup ? '/api/auth/register' : '/api/auth/login'

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      })
      const data = (await response.json()) as {
        message?: string
        user?: JSON
      }

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed. Please try again.')
      }

      console.log("Login successfull: ", data.user)

      setMessage(isSignup ? 'Account created. You can now sign in.' : 'Signed in successfully.')
      if (isSignup) {
        window.location.assign('/login')
      } else {
        window.location.assign('/')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not reach the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#09090b] px-5 py-12 text-zinc-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute -right-40 bottom-[-14rem] h-[34rem] w-[34rem] rounded-full bg-indigo-500/[0.08] blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      </div>

      <section className="relative z-10 w-full max-w-[440px]">
        <a href="/" className="mb-9 flex items-center justify-center gap-3" aria-label="StackPulse home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-500/25">
            <Activity size={23} />
          </span>
          <span className="text-xl font-bold tracking-tight">
            Stack<span className="text-violet-400">Pulse</span>
          </span>
        </a>

        <div className="rounded-3xl border border-white/[0.09] bg-[#101013]/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9">
          <div className="mb-7 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/15 bg-violet-400/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              Developer intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {isSignup
                ? 'Start exploring the people and projects shaping open source.'
                : 'Sign in to pick up where your open-source research left off.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMessage('GitHub sign-in will be available when OAuth is connected.')}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm font-medium transition hover:border-white/[0.18] hover:bg-white/[0.06]"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current">
              <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.1.67-3.76-1.32-3.76-1.32-.5-1.29-1.24-1.63-1.24-1.63-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 1.71 2.63 1.22 3.27.93.1-.72.39-1.22.71-1.5-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.12-1.44 3.05-1.15 3.05-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.29-2.62 5.23-5.11 5.51.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" />
            </svg>
            Continue with GitHub
          </button>

          <div className="my-6 flex items-center gap-4 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">
            <span className="h-px flex-1 bg-white/[0.08]" />
            or with email
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <label className="block space-y-2">
                <span className="text-xs font-medium text-zinc-300">Username</span>
                <input
                  name="username"
                  autoComplete="username"
                  required
                  placeholder="alexdev"
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0b0b0e] px-4 py-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/10"
                />
              </label>
            )}
            <label className="block space-y-2">
              <span className="text-xs font-medium text-zinc-300">Email address</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/[0.09] bg-[#0b0b0e] px-4 py-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/10"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-medium text-zinc-300">Password</span>
              <span className="relative block">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  minLength={8}
                  required
                  placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'}
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0b0b0e] px-4 py-3 pr-12 text-sm outline-none transition placeholder:text-zinc-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500 transition hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {isSignup ? (
              <label className="flex items-start gap-2.5 pt-1 text-xs leading-5 text-zinc-500">
                <input required type="checkbox" className="mt-1 accent-violet-500" />
                <span>I agree to the <a href="#terms" className="text-zinc-300 hover:text-violet-300">Terms of Service</a> and <a href="#privacy" className="text-zinc-300 hover:text-violet-300">Privacy Policy</a>.</span>
              </label>
            ) : (
              <div className="flex items-center justify-between pt-1 text-xs">
                <label className="flex items-center gap-2 text-zinc-500">
                  <input type="checkbox" className="accent-violet-500" />
                  Remember me
                </label>
                <a href="#forgot-password" className="font-medium text-violet-300 transition hover:text-violet-200">Forgot password?</a>
              </div>
            )}

            <button
              type="submit"
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/15 transition hover:bg-violet-400"
            >
              {isSubmitting ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
              {!isSubmitting && <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />}
            </button>
          </form>

          {message && (
            <p role="status" className="mt-4 rounded-xl border border-violet-400/20 bg-violet-400/[0.06] px-3 py-2.5 text-xs leading-5 text-violet-200">
              {message}
            </p>
          )}

          <p className="mt-6 text-center text-sm text-zinc-500">
            {isSignup ? 'Already have an account?' : 'New to StackPulse?'}{' '}
            <a href={isSignup ? '/login' : '/signup'} className="font-semibold text-violet-300 hover:text-violet-200">
              {isSignup ? 'Sign in' : 'Create an account'}
            </a>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Built for the people building in public.
        </p>
      </section>
    </main>
  )
}
