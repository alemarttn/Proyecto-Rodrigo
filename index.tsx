import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

// --- CONFIGURACIÓN ---
const supabaseUrl = 'https://mzocyzpgrynftmjstukq.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16b2N5enBncnluZnRtanN0dWtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwOTY4NDUsImV4cCI6MjA4MjY3Mjg0NX0.nuR3x-8Yf7zqBbx8IuNcdKT9NQ9YH4-BcCX4LSGXu_I';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SYSTEM_PROMPT = `Eres "MINDCOACH AI", un motor de análisis para atletas de élite.
Tu objetivo es analizar biométricos y dar feedback accionable.
- Genera JSON siempre.
- Sé brutalmente honesto pero motivador.
- Clasificación: VERDE (Optimizado), AMARILLO (Precaución), ROJO (Riesgo de Lesión/Burnout).`;

// --- INTERFACES ---
interface AthleteProfile {
  athlete_id: string;
  nombre: string;
  apellidos: string;
  deporte_principal: string;
  resumen_perfil?: string;
}

interface DailyScores {
  energy: number;
  sleep_quality: number;
  mental_wellbeing: number;
  muscle_soreness: number;
  stress: number;
  motivation: number;
  fatigue: number;
  focus: number;
}

interface CoachResponse {
  computed: {
    score_global: number;
    classification: 'VERDE' | 'AMARILLO' | 'ROJO';
    top_fortalezas: string[];
    top_alertas: string[];
  };
  tool_psychology: {
    nombre: string;
    duracion: string;
    instrucciones: string[];
    mantra: string;
  };
  insight: string;
}

// --- SERVICIOS ---
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

async function analyzeProfile(data: any): Promise<AthleteProfile> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ text: `Estructura el perfil: ${JSON.stringify(data)}` }] },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nombre: { type: Type.STRING },
          apellidos: { type: Type.STRING },
          deporte_principal: { type: Type.STRING },
          resumen_perfil: { type: Type.STRING }
        }
      }
    }
  });
  const res = JSON.parse(response.text || '{}');
  return { ...res, athlete_id: `ath_${Date.now()}` };
}

async function getDailyAnalysis(profile: AthleteProfile, scores: DailyScores): Promise<CoachResponse> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ text: `Perfil: ${JSON.stringify(profile)}. Datos hoy: ${JSON.stringify(scores)}` }] },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          computed: {
            type: Type.OBJECT,
            properties: {
              score_global: { type: Type.NUMBER },
              classification: { type: Type.STRING },
              top_fortalezas: { type: Type.ARRAY, items: { type: Type.STRING } },
              top_alertas: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          },
          tool_psychology: {
            type: Type.OBJECT,
            properties: {
              nombre: { type: Type.STRING },
              duracion: { type: Type.STRING },
              instrucciones: { type: Type.ARRAY, items: { type: Type.STRING } },
              mantra: { type: Type.STRING }
            }
          },
          insight: { type: Type.STRING }
        }
      }
    }
  });
  return JSON.parse(response.text || '{}');
}

// --- APP ---
const App: React.FC = () => {
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [view, setView] = useState<'onboarding' | 'checkin' | 'results'>('onboarding');
  const [scores, setScores] = useState<DailyScores>({ energy: 5, sleep_quality: 5, mental_wellbeing: 5, muscle_soreness: 5, stress: 5, motivation: 5, fatigue: 5, focus: 5 });
  const [results, setResults] = useState<CoachResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('mindcoach_p');
    if (saved) {
      setProfile(JSON.parse(saved));
      setView('checkin');
    }
  }, []);

  const handleStart = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const p = await analyzeProfile(Object.fromEntries(fd));
      setProfile(p);
      localStorage.setItem('mindcoach_p', JSON.stringify(p));
      await supabase.from('perfiles').upsert(p);
      setView('checkin');
    } catch (err) {
      alert("Error de conexión. Verifica tu API Key en Netlify Deploys.");
    } finally { setLoading(false); }
  };

  const handleCheck = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const res = await getDailyAnalysis(profile, scores);
      setResults(res);
      await supabase.from('reportes_diarios').insert({ athlete_id: profile.athlete_id, scores, classification: res.computed.classification });
      setView('results');
    } catch (err) {
      alert("Fallo en el análisis del Coach Engine.");
    } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-white text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Sincronizando Neuronas AI</span>
    </div>
  );

  if (view === 'onboarding') return (
    <div className="min-h-screen bg-[#050507] p-6 flex items-center justify-center">
      <div className="max-w-md w-full glass p-10 rounded-[3rem] border border-white/10">
        <div className="mb-10 text-center">
          <div className="w-16 h-1 bg-indigo-500 mx-auto mb-4 rounded-full"></div>
          <h1 className="text-white text-3xl font-black italic uppercase tracking-tighter">MINDCOACH AI</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Plataforma de Alto Rendimiento</p>
        </div>
        <form onSubmit={handleStart} className="space-y-4">
          <input name="nombre" placeholder="Nombre" required className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-indigo-500 transition-all" />
          <input name="apellidos" placeholder="Apellidos" required className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-indigo-500 transition-all" />
          <input name="deporte_principal" placeholder="Deporte" required className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-indigo-500 transition-all" />
          <button className="w-full py-5 bg-white text-black font-black uppercase rounded-2xl hover:bg-indigo-500 hover:text-white transition-all transform active:scale-95 shadow-xl shadow-white/5">Crear Perfil Atleta</button>
        </form>
      </div>
    </div>
  );

  if (view === 'checkin') return (
    <div className="min-h-screen bg-[#050507] p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex justify-between items-center border-b border-white/5 pb-8">
          <div>
            <h2 className="text-white text-4xl font-black italic uppercase tracking-tighter">Daily Check-in</h2>
            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">{profile?.nombre} {profile?.apellidos} | {profile?.deporte_principal}</p>
          </div>
          <button onClick={() => { localStorage.clear(); setView('onboarding'); }} className="text-[10px] text-slate-600 font-bold uppercase border border-white/10 px-4 py-2 rounded-full hover:text-red-500 transition-all">Reset</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {(Object.keys(scores) as Array<keyof DailyScores>).map(key => (
            <div key={key} className="glass p-8 rounded-3xl border border-white/5 hover:border-white/20 transition-all">
              <div className="flex justify-between items-center mb-6">
                <span className="text-slate-400 font-black uppercase text-[10px] tracking-widest">{key.replace('_', ' ')}</span>
                <span className="text-2xl font-black text-indigo-500">{scores[key]}</span>
              </div>
              <input type="range" min="1" max="10" value={scores[key]} onChange={e => setScores({...scores, [key]: Number(e.target.value)})} className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer" />
            </div>
          ))}
        </div>

        <button onClick={handleCheck} className="w-full py-8 bg-indigo-600 text-white font-black uppercase tracking-[0.4em] rounded-[2rem] hover:bg-indigo-500 transition-all transform active:scale-95 shadow-2xl shadow-indigo-500/20">Ejecutar Análisis Coach AI</button>
      </div>
    </div>
  );

  if (view === 'results' && results) return (
    <div className="min-h-screen bg-[#050507] p-8 pb-20">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className={`p-12 rounded-[4rem] border-2 ${results.computed.classification === 'ROJO' ? 'border-red-500 bg-red-500/5' : results.computed.classification === 'AMARILLO' ? 'border-yellow-500 bg-yellow-500/5' : 'border-emerald-500 bg-emerald-500/5'}`}>
          <div className="flex justify-between items-end mb-8">
            <h2 className="text-8xl font-black italic tracking-tighter text-white">{(results.computed.score_global * 100).toFixed(0)}<span className="text-2xl opacity-50">%</span></h2>
            <div className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest ${results.computed.classification === 'ROJO' ? 'bg-red-500' : results.computed.classification === 'AMARILLO' ? 'bg-yellow-500 text-black' : 'bg-emerald-500 text-black'}`}>
              Estado: {results.computed.classification}
            </div>
          </div>
          <p className="text-2xl text-slate-200 font-light italic leading-relaxed">"{results.insight}"</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="glass p-10 rounded-[3rem]">
            <h3 className="text-indigo-500 text-[10px] font-black uppercase tracking-widest mb-6 underline underline-offset-8">Herramienta Psicológica</h3>
            <h4 className="text-white text-2xl font-black uppercase mb-2">{results.tool_psychology.nombre}</h4>
            <span className="text-slate-500 text-xs font-bold uppercase">{results.tool_psychology.duracion}</span>
            <div className="mt-6 space-y-3">
              {results.tool_psychology.instrucciones.map((ins, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <span className="text-indigo-500 font-black">0{i+1}</span>
                  <p className="text-sm text-slate-400">{ins}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-indigo-600 p-10 rounded-[3rem] text-white flex flex-col justify-center">
            <span className="text-black/50 text-[10px] font-black uppercase tracking-widest mb-4 text-center">Mantra de Enfoque</span>
            <p className="text-3xl font-black italic text-center leading-tight">"{results.tool_psychology.mantra}"</p>
          </div>
        </div>

        <div className="flex justify-center">
          <button onClick={() => setView('checkin')} className="px-12 py-5 border border-white/10 rounded-full text-xs font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 transition-all">Volver al Panel</button>
        </div>
      </div>
    </div>
  );

  return null;
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
