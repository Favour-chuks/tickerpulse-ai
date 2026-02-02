import React, { useState } from "react";
import {
  Zap,
  ArrowRight,
  Loader2,
  Lock,
  Mail,
  User,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";

const AuthPage: React.FC = () => {
  const [view, setView] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    login,
    loginWithGoogle,
    register,
    resetPassword,
    isLoading,
    error,
  } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view === "login") {
      await login(email, password);
    } else if (view === "register") {
      await register(email, password, firstName, lastName);
    } else if (view === "forgot") {
      await resetPassword(email);
      setResetSent(true);
    }
  };

  const handleGoogleLogin = async () => {
    await loginWithGoogle();
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#0a0a0b] flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-200/40 dark:bg-brand-500/10 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-normal"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-200/40 dark:bg-indigo-500/10 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-normal"></div>
      </div>

      <div className="w-full max-w-md z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white/80 dark:bg-[#121214] border border-white/50 dark:border-[#212124] p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-brand-600 dark:bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20 mb-5">
              <Zap size={28} className="text-white fill-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
              TickerPulse
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              Institutional Narrative Intelligence
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl flex items-start gap-3">
              <div className="mt-0.5 min-w-[4px] h-4 bg-rose-500 rounded-full"></div>
              <p className="text-rose-600 dark:text-rose-400 text-sm font-semibold">
                {error.message}
              </p>
            </div>
          )}

          {view === "forgot" && resetSent ? (
            <div className="text-center space-y-6 py-4">
              <div className="mx-auto w-16 h-16 bg-brand-50 dark:bg-brand-500/10 rounded-full flex items-center justify-center text-brand-600 dark:text-brand-500 mb-2">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-slate-900 dark:text-white font-bold text-xl">
                  Reset Link Sent
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  Check your inbox at{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {email}
                  </span>{" "}
                  for instructions.
                </p>
              </div>
              <button
                onClick={() => {
                  setView("login");
                  setResetSent(false);
                }}
                className="w-full py-3 bg-slate-100 dark:bg-[#1c1c1f] text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-[#252529] transition-all">
                Return to Login
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <form onSubmit={handleSubmit} className="space-y-5">
                {view === "register" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within:text-brand-500" />
                      <input
                        type="text"
                        placeholder="First Name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#1c1c1f] border border-slate-200 dark:border-[#2d2d31] rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all placeholder:text-slate-400"
                        required
                      />
                    </div>
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within:text-brand-500" />
                      <input
                        type="text"
                        placeholder="Last Name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#1c1c1f] border border-slate-200 dark:border-[#2d2d31] rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all placeholder:text-slate-400"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within:text-brand-500" />
                  <input
                    type="email"
                    placeholder="Work Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#1c1c1f] border border-slate-200 dark:border-[#2d2d31] rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all placeholder:text-slate-400"
                    required
                  />
                </div>

                {view !== "forgot" && (
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within:text-brand-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#1c1c1f] border border-slate-200 dark:border-[#2d2d31] rounded-xl pl-10 pr-10 py-3 text-sm text-slate-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all placeholder:text-slate-400"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors z-10 p-1">
                      {showPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                )}

                {view === "login" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setView("forgot")}
                      className="text-xs font-semibold text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                      Forgot Password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-400 text-white dark:text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20 dark:shadow-brand-500/20 hover:scale-[1.02] active:scale-[0.98]">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {view === "login"
                        ? "Login"
                        : view === "register"
                        ? "Create Account"
                        : "Send Reset Link"}
                      {view !== "forgot" && (
                        <ArrowRight className="w-4 h-4" />
                      )}
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {view !== "forgot" && (
            <>
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-[#2d2d31]"></div>
                </div>
                <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                  <span className="bg-white dark:bg-[#121214] px-3 text-slate-400">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* this is the signin with google */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full bg-white dark:bg-[#1c1c1f] hover:bg-slate-50 dark:hover:bg-[#252529] border border-slate-200 dark:border-[#2d2d31] text-slate-700 dark:text-white py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 font-semibold text-sm shadow-sm hover:shadow-md">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign in with Google
              </button>
            </>
          )}

          <div className="mt-8 text-center border-t border-slate-100 dark:border-[#212124] pt-6">
            {view === "login" ? (
              <p className="text-sm text-slate-500">
                Don't have an account?{" "}
                <button
                  onClick={() => setView("register")}
                  className="font-bold text-brand-600 dark:text-brand-400 hover:underline">
                  Register
                </button>
              </p>
            ) : view === "register" ? (
              <p className="text-sm text-slate-500">
                Already have an account?{" "}
                <button
                  onClick={() => setView("login")}
                  className="font-bold text-brand-600 dark:text-brand-400 hover:underline">
                  Login
                </button>
              </p>
            ) : (
              <button
                onClick={() => setView("login")}
                className="flex items-center justify-center gap-2 w-full text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                <ArrowLeft size={16} /> Back to Login
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-600 font-medium">
            Protected by enterprise-grade encryption.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
