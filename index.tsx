import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

// --- CLIENTE SUPABASE ---
const supabaseUrl = 'https://mzocyzpgrynftmjstukq.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16b2N5enBncnluZnRtanN0dWtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwOTY4NDUsImV4cCI6MjA4MjY3Mjg0NX0.nuR3x-8Yf7zqBbx8IuNcdKT9NQ9YH4-BcCX4LSGXu_I';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- TIPOS ---
interface AthleteProfile {
  athlete_id: string;
  nombre: string;
  apellidos: string;
  deporte: string;
}

interface DailyMetrics {
  energia: number;
  sueno: number;
  animo: number;
  dolor: number;
  estres: number;
  motivacion: number;
}

interface CoachReport {
  global_score: number;
  status: 'VERDE' | 'AMARILLO' | 'ROJO';
  insight: string;
  protocol: {
    nombre: string;
    pasos: string[];
    mantra: string;
  };
}

const App = () => {
  const [view, setView] = useState<'onboarding' | 'dashboard' | 'report'>('onboarding');
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [metrics, setMetrics] = useState<DailyMetrics>({ energia: 5, sueno: 5, animo: 5, dolor: 5, estres: 5, motivacion: 5 });
  const [report, setReport] = useState<CoachReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('mc_v3_profile');
    if (saved) {
      setProfile(JSON.parse(saved));
      setView('dashboard');
    }
  }, []);

  const handleOnboarding = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newProfile = {
      athlete_id: `ath_${Date.now()}`,
      nombre: formData.get('nombre') as string,
      apellidos: formData.get('apellidos') as string,
      deporte: formData.get('deporte') as string,
    };
    setProfile(newProfile);
    localStorage.setItem('mc_v3_profile', JSON.stringify(newProfile));
    setView('dashboard');
  };

  const getAnalysis = async () => {
    setLoading(true);
    try {
      // Intento directo con process.env.API_KEY inyectado por el entorno
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ 
          role: 'user', 
          parts: [{ text: `Atleta: ${profile?.nombre}. Métricas: ${JSON.stringify(metrics)}. Genera informe.` }] 
        }],
        config: {
          systemInstruction: "Devuelve SIEMPRE un JSON válido con: global_score (0-1), status (VERDE/AMARILLO/ROJO), insight (frase corta), protocol (nombre, pasos[], mantra).",
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              global_score: { type: Type.NUMBER },
              status: { type: Type.STRING },
              insight: { type: Type.STRING },
              protocol: {
                type: Type.OBJECT,
                properties: {
                  nombre: { type: Type.STRING },
                  pasos: { type: Type.ARRAY, items: { type: Type.STRING } },
                  mantra: { type: Type.STRING }
                },
                required: ["nombre", "pasos", "mantra"]
              }
            },
            required: ["global_score", "status", "insight", "protocol"]
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setReport(data);
      
      if (profile) {
        supabase.from('reportes_diarios').insert({
          athlete_id: profile.athlete_id,
          metrics,
          status: data.status,
          score: data.global_score
        }).then(() => console.log("Data Sync OK"));
      }
      
      setView('report');
    } catch (err: any) {
      console.error("Critical Engine Error:", err);
      alert(`Error de Motor: ${err.message || "Fallo en la comunicación con la IA. Verifica que la API_KEY sea válida y esté activa."}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050507]">
      <div className="w-12 h-12 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-6"></div>
      <p className="text-[9px] font-black uppercase tracking-[0.4em] text-indigo-400 animate-pulse">Sincronizando Biométrica Deportiva...</p>
    </div>
  );

  if (view === 'onboarding') return (
    <div className="max-w-md mx-auto min-h-screen flex items-center p-6 bg-[#050507]">
      <div className="glass w-full p-10 rounded-[2.5rem] border border-white/5">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-8 text-center">MINDCOACH</h1>
        <form onSubmit={handleOnboarding} className="space-y-3">
          <input name="nombre" placeholder="Nombre" required className="w-full bg-white/5 p-4 rounded-xl border border-white/10 text-sm outline-none focus:border-indigo-500 transition-all" />
          <input name="apellidos" placeholder="Apellidos" required className="w-full bg-white/5 p-4 rounded-xl border border-white/10 text-sm outline-none focus:border-indigo-500 transition-all" />
          <input name="deporte" placeholder="Especialidad Deportiva" required className="w-full bg-white/5 p-4 rounded-xl border border-white/10 text-sm outline-none focus:border-indigo-500 transition-all" />
          <button className="w-full bg-white text-black font-black uppercase py-4 rounded-xl hover:bg-indigo-600 hover:text-white transition-all transform active:scale-95 mt-4">Activar Perfil</button>
        </form>
      </div>
    </div>
  );

  if (view === 'dashboard') return (
    <div className="max-w-xl mx-auto p-6 pt-12 pb-24 bg-[#050507]">
      <header className="mb-12 flex justify-between items-end border-b border-white/5 pb-6">
        <div>
          <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Check-In</h2>
          <p className="text-indigo-500 text-[10px] font-bold uppercase tracking-widest mt-2 opacity-70">{profile?.nombre} • {profile?.deporte}</p>
        </div>
        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-[9px] text-slate-600 font-bold uppercase hover:text-white transition-colors">Reset</button>
      </header>
      
      <div className="grid gap-4">
        {Object.entries(metrics).map(([key, val]) => (
          <div key={key} className="glass p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{key.replace('sueno', 'sueño').replace('animo', 'ánimo').replace('estres', 'estrés').replace('motivacion', 'motivación')}</span>
              <span className="text-indigo-400 font-black">{val}</span>
            </div>
            <input 
              type="range" min="1" max="10" value={val} 
              onChange={(e) => setMetrics({...metrics, [key]: parseInt(e.target.value)})}
              className="w-full"
            />
          </div>
        ))}
        <button onClick={getAnalysis} className="mt-8 w-full bg-indigo-600 text-white font-black uppercase py-6 rounded-2xl hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 transition-all transform active:scale-95">Lanzar Análisis IA</button>
      </div>
    </div>
  );

  if (view === 'report' && report) return (
    <div className="max-w-xl mx-auto p-6 pt-12 pb-32 bg-[#050507]">
      <div className={`p-12 rounded-[3.5rem] border-2 mb-10 text-center transition-all ${report.status === 'VERDE' ? 'neon-border-green bg-emerald-500/5' : report.status === 'AMARILLO' ? 'neon-border-yellow bg-amber-500/5' : 'neon-border-red bg-red-500/5'}`}>
        <span className="text-7xl font-black italic block mb-2">{(report.global_score * 100).toFixed(0)}%</span>
        <span className={`inline-block text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest mb-6 ${report.status === 'VERDE' ? 'bg-emerald-500 text-black' : report.status === 'AMARILLO' ? 'bg-amber-500 text-black' : 'bg-red-500 text-white'}`}>{report.status}</span>
        <p className="text-lg font-bold italic text-slate-200 leading-snug">"{report.insight}"</p>
      </div>

      <div className="grid gap-6">
        <div className="glass p-10 rounded-[2.5rem]">
          <h3 className="text-indigo-500 text-[10px] font-black uppercase tracking-widest mb-4">Protocolo Sugerido</h3>
          <h4 className="text-2xl font-black uppercase mb-6 leading-none">{report.protocol.nombre}</h4>
          <ul className="space-y-4">
            {report.protocol.pasos.map((paso, i) => (
              <li key={i} className="text-sm text-slate-400 flex gap-4 items-start">
                <span className="text-indigo-600 font-black">0{i+1}</span>
                <span>{paso}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-indigo-600 p-10 rounded-[2.5rem] text-center">
          <p className="text-[9px] font-black uppercase text-black/40 mb-2">Focus Mantra</p>
          <p className="text-2xl font-black italic uppercase tracking-tighter leading-none">"{report.protocol.mantra}"</p>
        </div>
        
        <button onClick={() => setView('dashboard')} className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 hover:text-white transition-all mt-10 text-center w-full">Volver al Dashboard</button>
      </div>
    </div>
  );

  return null;
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
