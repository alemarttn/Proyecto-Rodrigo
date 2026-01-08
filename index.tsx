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
    const saved = localStorage.getItem('mc_profile');
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
    localStorage.setItem('mc_profile', JSON.stringify(newProfile));
    setView('dashboard');
  };

  const getAnalysis = async () => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analiza este atleta: ${JSON.stringify(profile)}. Métricas de hoy: ${JSON.stringify(metrics)}.`,
        config: {
          systemInstruction: "Eres un Coach de Élite. Analiza y devuelve un JSON con: global_score (0-1), status (VERDE/AMARILLO/ROJO), insight (frase corta), protocol (nombre, pasos[], mantra).",
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
                }
              }
            }
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setReport(data);
      
      // Guardar en Supabase
      if (profile) {
        await supabase.from('reportes_diarios').insert({
          athlete_id: profile.athlete_id,
          metrics,
          status: data.status,
          score: data.global_score
        });
      }
      
      setView('report');
    } catch (err) {
      console.error(err);
      alert("Error en el motor de IA. Revisa la API_KEY en Netlify.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Procesando Biométrica</p>
    </div>
  );

  if (view === 'onboarding') return (
    <div className="max-w-md mx-auto min-h-screen flex items-center p-6">
      <div className="glass w-full p-10 rounded-[2.5rem]">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-8 text-center">MINDCOACH</h1>
        <form onSubmit={handleOnboarding} className="space-y-4">
          <input name="nombre" placeholder="Nombre" required className="w-full bg-white/5 p-4 rounded-xl border border-white/10 text-sm outline-none focus:border-indigo-500" />
          <input name="apellidos" placeholder="Apellidos" required className="w-full bg-white/5 p-4 rounded-xl border border-white/10 text-sm outline-none focus:border-indigo-500" />
          <input name="deporte" placeholder="Deporte Principal" required className="w-full bg-white/5 p-4 rounded-xl border border-white/10 text-sm outline-none focus:border-indigo-500" />
          <button className="w-full bg-white text-black font-black uppercase py-4 rounded-xl hover:bg-indigo-500 hover:text-white transition-all">Iniciar Perfil</button>
        </form>
      </div>
    </div>
  );

  if (view === 'dashboard') return (
    <div className="max-w-2xl mx-auto p-6 pt-12">
      <header className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black uppercase italic tracking-tighter">Check-In</h2>
          <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest">{profile?.nombre} | {profile?.deporte}</p>
        </div>
        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-[10px] text-slate-500 font-bold uppercase">Reset</button>
      </header>
      
      <div className="grid gap-6">
        {Object.entries(metrics).map(([key, val]) => (
          <div key={key} className="glass p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{key}</span>
              <span className="text-indigo-400 font-bold">{val}</span>
            </div>
            <input 
              type="range" min="1" max="10" value={val} 
              onChange={(e) => setMetrics({...metrics, [key]: parseInt(e.target.value)})}
            />
          </div>
        ))}
        <button onClick={getAnalysis} className="mt-6 w-full bg-indigo-600 text-white font-black uppercase py-6 rounded-3xl hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 transition-all">Analizar Rendimiento</button>
      </div>
    </div>
  );

  if (view === 'report' && report) return (
    <div className="max-w-2xl mx-auto p-6 pt-12 pb-20">
      <div className={`p-12 rounded-[3rem] border-2 mb-10 ${report.status === 'VERDE' ? 'neon-border-green' : report.status === 'AMARILLO' ? 'neon-border-yellow' : 'neon-border-red'}`}>
        <div className="flex justify-between items-center mb-6">
          <span className="text-6xl font-black italic">{(report.global_score * 100).toFixed(0)}%</span>
          <span className="text-[10px] font-black border px-4 py-2 rounded-full uppercase">{report.status}</span>
        </div>
        <p className="text-xl font-medium italic text-slate-200 leading-relaxed">"{report.insight}"</p>
      </div>

      <div className="grid gap-6">
        <div className="glass p-10 rounded-[2.5rem]">
          <h3 className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-4">Protocolo Elite</h3>
          <h4 className="text-2xl font-black uppercase mb-6">{report.protocol.nombre}</h4>
          <ul className="space-y-4">
            {report.protocol.pasos.map((paso, i) => (
              <li key={i} className="text-sm text-slate-400 flex gap-4">
                <span className="text-indigo-500 font-bold">0{i+1}</span>
                {paso}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-indigo-600 p-10 rounded-[2.5rem] text-center shadow-2xl shadow-indigo-600/30">
          <p className="text-[10px] font-bold uppercase text-black/40 mb-2">Mantra Diario</p>
          <p className="text-2xl font-black italic italic uppercase tracking-tighter">"{report.protocol.mantra}"</p>
        </div>
        
        <button onClick={() => setView('dashboard')} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 hover:text-white transition-all mt-8">Volver al Dashboard</button>
      </div>
    </div>
  );

  return null;
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
