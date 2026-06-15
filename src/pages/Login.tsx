import React, { useState } from "react";
import axios from "axios";
import { LogIn, ShieldAlert, Cpu, Leaf, DollarSign, UserPlus, Lock, Mail } from "lucide-react";
import { motion } from "motion/react";

interface LoginProps {
  onLoginSuccess: (token: string, userEmail: string, userUid: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email || !password) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    if (isRegister && password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const payload = { email, password };

      const response = await axios.post(endpoint, payload);
      const { success, token, user, error } = response.data;

      if (success && token && user) {
        if (isRegister) {
          setSuccessMsg("Registration successful! Logging you in...");
          setTimeout(() => {
            onLoginSuccess(token, user.email, user.uid);
          }, 1000);
        } else {
          onLoginSuccess(token, user.email, user.uid);
        }
      } else {
        setErrorMsg(error || "Authentication failed. Please check your inputs.");
      }
    } catch (err: any) {
      console.error("Auth portal entry failed:", err);
      const serverMsg = err.response?.data?.error;
      setErrorMsg(serverMsg || "Could not connect to authentication services. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-6 md:p-12 text-slate-800 relative overflow-hidden font-sans">
      {/* Background decorations */}
      <div className="absolute -left-[10%] -top-[10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -right-[10%] -bottom-[10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header rail */}
      <div className="flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center p-2 text-white">
            <Cpu className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-slate-900 select-none">
            EnergyWatch <span className="text-indigo-600">BD</span>
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 border border-slate-200 rounded px-2.5 py-1 uppercase bg-white shadow-sm font-semibold">
          SECURE ENCLAVE ACTIVE
        </span>
      </div>

      {/* Main Container Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto w-full items-center my-auto z-10">
        {/* Left column info */}
        <div className="space-y-6 text-left">
          <span className="px-3 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full text-xs font-mono font-semibold uppercase tracking-wider">
            IoT CLIMATE ANALYTICS
          </span>
          
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-slate-900 leading-[1.1] tracking-tight">
            Monitor, Control, and Predict your Smart Power.
          </h1>
          
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-lg">
            An advanced full-stack smart energy monitor customized for Bangladesh. Connects instantly with Smart Life plugs, offering progressive slab pricing, carbon limit warnings, and climate automations.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <DollarSign className="w-4 h-4 text-indigo-600" />
                <span>BPDB Billing</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                progressive slab mathematics estimates billings.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Leaf className="w-4 h-4 text-emerald-600" />
                <span>Grid Footprint</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Real-time BD grid carbon emission tracking.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Cpu className="w-4 h-4 text-indigo-600" />
                <span>Auto Climate</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Automate plugs using Dhaka forecasting.
              </p>
            </div>
          </div>
        </div>

        {/* Right column Form */}
        <div className="flex justify-center lg:justify-end">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm w-full shadow-md">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mx-auto mb-4">
              {isRegister ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            </div>

            <h2 className="font-display font-bold text-center text-slate-900 text-xl tracking-tight mb-2">
              {isRegister ? "Create Account" : "Authentication Portal"}
            </h2>
            <p className="text-xs text-center text-slate-500 mb-6 leading-normal">
              {isRegister
                ? "Register a private credentials account to synchronize schedules and predict live slab tariffs."
                : "Sign in with your credentials to access your secure energy monitoring logs."}
            </p>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 p-3 rounded-xl text-xs mb-5 flex items-start gap-2 text-left">
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 p-3 rounded-xl text-xs mb-5 flex items-start gap-2 text-left">
                <Leaf className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email field */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Confirm Password (only register) */}
              {isRegister && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] shadow-sm disabled:opacity-55"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing authentication...</span>
                  </>
                ) : (
                  <>
                    {isRegister ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                    <span>{isRegister ? "CREATE ACCOUNT" : "SIGN IN TO DASHBOARD"}</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold underline focus:outline-none cursor-pointer"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
              >
                {isRegister ? "Already have an account? Sign In" : "Don't have an account? Create one"}
              </button>
            </div>

            <span className="text-[10px] text-slate-400 font-mono block text-center mt-6 font-semibold uppercase select-none">
              AES-256 END-TO-END SECURITY
            </span>
          </div>
        </div>
      </div>

      {/* Footer rail */}
      <div className="flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 gap-2 border-t border-slate-200 pt-6 z-10 font-medium">
        <span>© 2026 EnergyWatch BD. All residential records private.</span>
        <span>Dhaka Regional Control Hub</span>
      </div>
    </div>
  );
}
