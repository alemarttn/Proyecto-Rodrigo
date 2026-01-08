import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";

// --- 1. CONFIGURACIÓN ---
const supabaseUrl = 'https://mzocyzpgrynftmjstukq.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16b2N5enBncnluZnRtanN0dWtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwOTY4NDUsImV4cCI6MjA4MjY3Mjg0NX0.nuR3x-8Yf7zqBbx8IuNcdKT9NQ9YH4-BcCX4LSGXu_I';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SYSTEM_PROMPT = `Eres el "Coach Engine" de alto rendimiento. Analiza datos biométricos y psicológicos.
Reglas críticas:
- Genera JSON SIEMPRE válido.
- Sé extremadamente conciso (máximo 200 caracteres por texto).
- Clasifica: VERDE (Score > 0.7), AMARILLO (0.5-0.7), ROJO (< 0.5).`;

// --- 2. INTERFACES ---
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

interface CoachEngineResponse {
  computed: {
    score_global: number;
    classification: 'VERDE' | 'AMARILLO' | 'ROJO';
    top_fortalezas: { key: string; value: number }[];
    top_alertas: { key: string; value: number }[];
  };
  tool_psychology: {
    nombre_herramienta: string;
    duracion_min: number;
    pasos: string[];
    guion: string;
    variante_30s: string;
    plan_minimo_rojo: string;
  };
  motivational_message: string;
}

// --- 3. SERVICIOS ---
async function generateProfileAnalysis(data: any): Promise<AthleteProfile> {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ text: `Analiza y estructura este perfil de atleta: ${JSON.stringify(data)}` }] },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          athlete_id: { type: Type.STRING },
          nombre: { type: Type.STRING },
          apellidos: { type: Type.STRING },
          deporte_principal: { type: Type.STRING },
          resumen_perfil: { type: Type.STRING }
        },
        required: ["nombre", "apellidos"]
      }
    }
  });
  
  const aiData = JSON.parse(response.text || '{}');
  return {
    ...data,
    ...aiData,
    athlete_id: aiData.athlete_id || `ath_${Date.now()}`
  };
}

async function getCoachEngineAnalysis(profile: AthleteProfile, scores: DailyScores): Promise<CoachEngineResponse> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY_MISSING");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ text: `Estado actual: Perfil ${JSON.stringify(profile)}, Scores ${JSON.stringify(scores)}` }] },
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
              top_fortalezas: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { key: { type: Type.STRING }, value: { type: Type.NUMBER } } } },
              top_alertas: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { key: { type: Type.STRING }, value: { type: Type.NUMBER } } } }
            }
          },
          tool_psychology: {
            type: Type.OBJECT,
            properties: {
              nombre_herramienta: { type: Type.STRING },
              duracion_min: { type: Type.NUMBER },
              pasos: { type: Type.ARRAY, items: { type: Type.STRING } },
              guion: { type: Type.STRING },
              variante_30s: { type: Type.STRING },
              plan_minimo_rojo: { type: Type.STRING }
            }
          },
          motivational_message: { type: Type.STRING }
        },
        required: ["computed", "tool_psychology", "motivational_message"]
      }
    }
  });
  return JSON.parse(response.text || '{}');
}

// --- 4. COMPONENTES ---
const Spinner = () => (
  <svg className="animate-spin h-10 w-10 text-indigo-500" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const EMOJIS: Record<number, string> = { 1: '😫', 2: '😣', 3: '😕', 4: '😐', 5: '🙂', 6: '😌', 7: '😀', 8: '😄', 9: '🤩', 10: '🔥' };
const METRICS: Record<keyof DailyScores, { label: string }> = {
  energy: { label: 'Energía' }, sleep_quality: { label: 'Sueño' },
  mental_wellbeing: { label: 'Bienestar' }, muscle_soreness: { label: 'Músculos' },
  stress: { label: 'Estrés' }, motivation: { label: 'Motivación' },
  fatigue: { label: 'Fatiga' }, focus: { label: 'Enfoque' }
};

// --- 5. APP PRINCIPAL ---
const App: React.FC = () => {
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [view, setView] = useState<'onboarding' | 'checkin' | 'results'>('onboarding');
  const [scores, setScores] = useState<DailyScores>({ energy: 5, sleep_quality: 5, mental_wellbeing: 5, muscle_soreness: 5, stress: 5, motivation: 5, fatigue: 5, focus: 5 });
  const [results, setResults] = useState<CoachEngineResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('athlete_profile');
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
        setView('checkin');
      } catch (e) {
        localStorage.removeItem('athlete_profile');
      }
    }
  }, []);

  const handleOnboarding = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());
    try {
      const full = await generateProfileAnalysis(data);
      setProfile(full);
      localStorage.setItem('athlete_profile', JSON.stringify(full));
      await supabase.from('perfiles').upsert([full], { onConflict: 'athlete_id' });
      setView('checkin');
    } catch (err: any) {
      console.error("DEBUG ERROR IA:", err);
      if (err.message === "API_KEY_MISSING") {
        alert("¡Error Crítico! process.env.API_KEY no detectado. Si estás en Netlify, asegúrate de que la variable esté guardada y hayas hecho un 'New Deploy'.");
      } else {
        alert("Error al conectar con la IA. Revisa la consola (F12) para detalles.");
      }
    } finally { setLoading(false); }
  };

  const handleCheckIn = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const analysis = await getCoachEngineAnalysis(profile, scores);
      setResults(analysis);
      await supabase.from('reportes_diarios').insert([{
        athlete_id: profile.athlete_id,
        scores,
        classification: analysis.computed.classification,
        created_at: new Date().toISOString()
      }]);
      setView('results');
    } catch (err) {
      console.error(err);
      alert("Error en el análisis diario.");
    } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center text-indigo-500">
      <Spinner /><p className="mt-4 font-black uppercase tracking-widest animate-pulse">Procesando con Coach Engine...</p>
    </div>
  );

  if (view === 'onboarding') return (
    <div className="min-h-screen bg-[#050507] flex items-center justify-center p-6 text-white font-sans">
      <div className="max-w-md w-full bg-[#111115] border border-white/5 p-10 rounded-[2.5rem] shadow-2xl">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-indigo-500 mb-8 text-center">Athlete Profile</h1>
        <form onSubmit={handleOnboarding} className="space-y-4">
          <input name="nombre" placeholder="Nombre" required className="w-full bg-black/40 border border-white/10 p-4 rounded-xl outline-none focus:border-indigo-500 transition-all" />
          <input name="apellidos" placeholder="Apellidos" required className="w-full bg-black/40 border border-white/10 p-4 rounded-xl outline-none focus:border-indigo-500 transition-all" />
          <input name="deporte_principal" placeholder="Deporte Principal" required className="w-full bg-black/40 border border-white/10 p-4 rounded-xl outline-none focus:border-indigo-500 transition-all" />
          <button className="w-full py-5 bg-white text-black font-black uppercase rounded-2xl hover:bg-indigo-600 hover:text-white transition-all transform active:scale-95">Comenzar</button>
        </form>
      </div>
    </div>
  );

  if (view === 'checkin') return (
    <div className="min-h-screen bg-[#050507] text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex justify-between items-end border-b border-white/5 pb-8">
          <div>
            <span className="text-indigo-500 text-[10px] font-black uppercase tracking-widest">MindCoach AI</span>
            <h1 className="text-5xl font-black italic uppercase tracking-tighter">Check-in</h1>
          </div>
          <button onClick={() => { localStorage.clear(); setView('onboarding'); }} className="text-[10px] text-slate-600 font-bold uppercase hover:text-red-500 transition-colors">Reset</button>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(Object.keys(METRICS) as Array<keyof DailyScores>).map(key => (
            <div key={key} className="bg-white/[0.02] p-6 rounded-2xl border border-white/5 space-y-4 group hover:border-white/10 transition-all">
              <div className="flex justify-between items-center">
                <span className="font-bold text-xs uppercase text-slate-400 group-hover:text-indigo-400">{METRICS[key].label}</span>
                <span className="text-3xl">{EMOJIS[scores[key]] || '😐'}</span>
              </div>
              <input type="range" min="1" max="10" value={scores[key]} onChange={e => setScores({...scores, [key]: Number(e.target.value)})} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-indigo-500 cursor-pointer" />
              <div className="flex justify-between text-[10px] font-bold text-slate-600"><span>Nivel {scores[key]}</span></div>
            </div>
          ))}
        </div>
        <button onClick={handleCheckIn} className="w-full py-6 bg-indigo-600 text-white font-black uppercase tracking-[0.2em] rounded-3xl shadow-2xl hover:bg-indigo-500 transition-all transform active:scale-95">Sincronizar Coach Engine</button>
      </div>
    </div>
  );

  if (view === 'results' && results) return (
    <div className="min-h-screen bg-[#050507] text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className={`p-12 rounded-[3rem] border ${results.computed.classification === 'ROJO' ? 'border-red-500/30 bg-red-500/5' : results.computed.classification === 'AMARILLO' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-7xl font-black italic tracking-tighter">{(results.computed.score_global * 100).toFixed(0)}%</h2>
            <span className={`px-6 py-2 rounded-full text-[10px] font-black uppercase ${results.computed.classification === 'ROJO' ? 'bg-red-500 text-white' : results.computed.classification === 'AMARILLO' ? 'bg-yellow-500 text-black' : 'bg-emerald-500 text-black'}`}>
              {results.computed.classification}
            </span>
          </div>
          <p className="text-xl text-slate-300 italic leading-relaxed">"{results.motivational_message}"</p>
        </div>

        <div className="bg-indigo-600 p-10 rounded-[3rem] shadow-2xl">
          <h3 className="text-3xl font-black uppercase italic mb-6">{results.tool_psychology.nombre_herramienta}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {results.tool_psychology.pasos.map((p, i) => (
              <div key={i} className="bg-white/10 p-4 rounded-xl text-sm font-medium">0{i+1}. {p}</div>
            ))}
          </div>
          <div className="bg-black/20 p-6 rounded-2xl italic border border-white/5">
            <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-50">Guion Mental</p>
            "{results.tool_psychology.guion}"
          </div>
        </div>

        <footer className="text-center pb-12">
          <button onClick={() => setView('checkin')} className="px-12 py-4 border border-white/10 rounded-full text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all">Nuevo Check-in</button>
        </footer>
      </div>
    </div>
  );

  return null;
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
