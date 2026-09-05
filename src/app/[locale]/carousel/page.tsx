'use client';
import React, { useState, useCallback } from 'react';
import { Upload, Download, Loader2, RefreshCw, ChevronLeft, ChevronRight, Palette, Sparkles } from 'lucide-react';

const PALETTES = [
  { id: 'cream',  label: 'Кремовый', bg: '#F5F1EB', text: '#3D4A3E' },
  { id: 'yellow', label: 'Жёлтый',  bg: '#EEECD7', text: '#3D4A3E' },
  { id: 'green',  label: 'Зелёный', bg: '#E8EDE3', text: '#3D4A3E' },
  { id: 'white',  label: 'Белый',   bg: '#FAFAF8', text: '#3D4A3E' },
];

const SLIDE_TYPES = ['cover','thesis','list','antithesis','final'];
const SLIDE_LABELS: Record<string,string> = {
  cover:'Обложка', thesis:'Тезис', list:'Список', antithesis:'Антитезис', final:'Финал'
};

export default function CarouselPage() {
  const [palette, setPalette]       = useState('cream');
  const [slides, setSlides]         = useState<any[]>([]);
  const [sessionId, setSessionId]   = useState('');
  const [generated, setGenerated]   = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading]       = useState(false);
  const [parsing, setParsing]       = useState(false);
  const [error, setError]           = useState('');
  const [dragging, setDragging]     = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setParsing(true); setError(''); setSlides([]); setGenerated([]);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/carousel/parse', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSlides(data.slides);
    } catch(e:any) { setError(e.message); }
    finally { setParsing(false); }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const generate = async () => {
    setLoading(true); setError(''); setGenerated([]); setCurrentIdx(0);
    try {
      const sid = crypto.randomUUID();
      const res = await fetch('/api/carousel/generate', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ session_id: sid, slides, palette }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSessionId(data.session_id);
      setGenerated(data.slides);
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const updateSlide = (idx: number, field: string, value: any) => {
    setSlides(prev => prev.map((s,i) => i===idx ? {...s, [field]: value} : s));
  };

  const currentPalette = PALETTES.find(p => p.id === palette)!;

  return (
    <div style={{minHeight:'100vh',background:'#1a1a2e',color:'#fff',fontFamily:'Inter,sans-serif'}}>
      {/* Header */}
      <div style={{borderBottom:'1px solid #2a2a4a',padding:'20px 40px',display:'flex',alignItems:'center',gap:16}}>
        <Sparkles size={24} color='#B8956A'/>
        <span style={{fontSize:20,fontWeight:700,color:'#B8956A'}}>VIReyou</span>
        <span style={{color:'#888',fontSize:14}}>Генератор каруселей Instagram</span>
      </div>

      <div style={{maxWidth:1400,margin:'0 auto',padding:'40px 40px',display:'grid',gridTemplateColumns:'1fr 420px',gap:40}}>
        {/* LEFT: Controls */}
        <div style={{display:'flex',flexDirection:'column',gap:32}}>

          {/* Upload */}
          <div>
            <h2 style={{fontSize:18,fontWeight:600,marginBottom:16,color:'#e0e0e0'}}>1. Загрузите бриф</h2>
            <div
              onDrop={onDrop}
              onDragOver={e=>{e.preventDefault();setDragging(true)}}
              onDragLeave={()=>setDragging(false)}
              onClick={()=>document.getElementById('file-input')?.click()}
              style={{
                border:`2px dashed ${dragging?'#B8956A':'#3a3a5a'}`,
                borderRadius:16, padding:'40px 20px', textAlign:'center',
                cursor:'pointer', transition:'all .2s',
                background: dragging ? 'rgba(184,149,106,.05)' : 'rgba(255,255,255,.02)',
              }}
            >
              <Upload size={36} color='#B8956A' style={{margin:'0 auto 12px'}}/>
              <p style={{color:'#ccc',margin:0}}>Перетащите PDF или TXT сюда</p>
              <p style={{color:'#666',fontSize:13,marginTop:6}}>или нажмите для выбора</p>
              <input id='file-input' type='file' accept='.pdf,.txt,.md' style={{display:'none'}}
                onChange={e=>{ if(e.target.files?.[0]) handleFile(e.target.files[0]); }}/>
            </div>
            {parsing && (
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:16,color:'#B8956A'}}>
                <Loader2 size={18} className='animate-spin'/>
                <span>Gemini анализирует бриф...</span>
              </div>
            )}
          </div>

          {/* Palette */}
          <div>
            <h2 style={{fontSize:18,fontWeight:600,marginBottom:16,color:'#e0e0e0',display:'flex',alignItems:'center',gap:8}}>
              <Palette size={18}/> 2. Цвет фона
            </h2>
            <div style={{display:'flex',gap:12}}>
              {PALETTES.map(p=>(
                <div key={p.id} onClick={()=>setPalette(p.id)} style={{
                  width:72, height:72, borderRadius:12, background:p.bg,
                  cursor:'pointer', border: palette===p.id ? '3px solid #B8956A' : '3px solid transparent',
                  transition:'all .2s', display:'flex', alignItems:'flex-end',
                  justifyContent:'center', paddingBottom:6,
                }}>
                  <span style={{fontSize:10,color:p.text,fontWeight:600}}>{p.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Slides editor */}
          {slides.length > 0 && (
            <div>
              <h2 style={{fontSize:18,fontWeight:600,marginBottom:16,color:'#e0e0e0'}}>
                3. Редактируйте слайды ({slides.length})
              </h2>
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                {slides.map((slide,i) => (
                  <div key={i} style={{background:'rgba(255,255,255,.04)',borderRadius:12,padding:20,border:'1px solid #2a2a4a'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                      <span style={{background:'#B8956A',color:'#fff',borderRadius:6,padding:'2px 10px',fontSize:12,fontWeight:700}}>
                        {SLIDE_LABELS[slide.type] || slide.type}
                      </span>
                      <select
                        value={slide.type}
                        onChange={e=>updateSlide(i,'type',e.target.value)}
                        style={{background:'#1a1a2e',color:'#ccc',border:'1px solid #3a3a5a',borderRadius:6,padding:'4px 8px',fontSize:13}}
                      >
                        {SLIDE_TYPES.map(t=><option key={t} value={t}>{SLIDE_LABELS[t]}</option>)}
                      </select>
                    </div>
                    {Object.entries(slide).filter(([k])=>k!=='type'&&k!=='items').map(([k,v])=>(
                      <div key={k} style={{marginBottom:8}}>
                        <label style={{fontSize:11,color:'#888',display:'block',marginBottom:4,textTransform:'uppercase'}}>{k}</label>
                        <textarea
                          value={v as string || ''}
                          onChange={e=>updateSlide(i,k,e.target.value)}
                          rows={2}
                          style={{width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid #3a3a5a',
                            borderRadius:8,padding:'8px 12px',color:'#fff',fontSize:13,resize:'vertical',boxSizing:'border-box'}}
                        />
                      </div>
                    ))}
                    {slide.items && (
                      <div>
                        <label style={{fontSize:11,color:'#888',display:'block',marginBottom:4,textTransform:'uppercase'}}>Пункты списка</label>
                        {slide.items.map((item: any, ii: number) => (
                          <div key={ii} style={{display:'flex',gap:8,marginBottom:6}}>
                            <input value={item.name||''} placeholder='Название'
                              onChange={e=>{ const its=[...slide.items]; its[ii]={...its[ii],name:e.target.value}; updateSlide(i,'items',its); }}
                              style={{flex:'0 0 140px',background:'rgba(255,255,255,.05)',border:'1px solid #3a3a5a',borderRadius:6,padding:'6px 10px',color:'#fff',fontSize:12}}/>
                            <input value={item.desc||''} placeholder='Описание'
                              onChange={e=>{ const its=[...slide.items]; its[ii]={...its[ii],desc:e.target.value}; updateSlide(i,'items',its); }}
                              style={{flex:1,background:'rgba(255,255,255,.05)',border:'1px solid #3a3a5a',borderRadius:6,padding:'6px 10px',color:'#fff',fontSize:12}}/>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate button */}
          {slides.length > 0 && (
            <button
              onClick={generate} disabled={loading}
              style={{
                display:'flex',alignItems:'center',justifyContent:'center',gap:12,
                background: loading ? '#444' : 'linear-gradient(135deg,#B8956A,#8B6A45)',
                color:'#fff',border:'none',borderRadius:14,padding:'18px 32px',
                fontSize:16,fontWeight:700,cursor: loading?'not-allowed':'pointer',
                transition:'all .2s',
              }}
            >
              {loading ? <><Loader2 size={20}/> Генерирую...</> : <><Sparkles size={20}/> Сгенерировать карусель</>}
            </button>
          )}

          {error && (
            <div style={{background:'rgba(200,50,50,.1)',border:'1px solid rgba(200,50,50,.3)',borderRadius:10,padding:16,color:'#ff9999'}}>
              {error}
            </div>
          )}
        </div>

        {/* RIGHT: Preview */}
        <div style={{position:'sticky',top:40,height:'fit-content'}}>
          <h2 style={{fontSize:18,fontWeight:600,marginBottom:16,color:'#e0e0e0'}}>Предпросмотр</h2>
          <div style={{
            background:currentPalette.bg, borderRadius:20, overflow:'hidden',
            aspectRatio:'4/5', display:'flex', alignItems:'center', justifyContent:'center',
            position:'relative', boxShadow:'0 20px 60px rgba(0,0,0,.5)',
          }}>
            {generated.length > 0 ? (
              <>
                <img
                  src={`/api/carousel/slide?session=${sessionId}&file=${generated[currentIdx]}`}
                  alt={`Slide ${currentIdx+1}`}
                  style={{width:'100%',height:'100%',objectFit:'cover'}}
                />
                {/* Navigation */}
                <div style={{position:'absolute',bottom:16,left:0,right:0,display:'flex',justifyContent:'center',alignItems:'center',gap:16}}>
                  <button onClick={()=>setCurrentIdx(i=>Math.max(0,i-1))}
                    disabled={currentIdx===0}
                    style={{background:'rgba(0,0,0,.5)',border:'none',borderRadius:'50%',width:40,height:40,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}>
                    <ChevronLeft size={20}/>
                  </button>
                  <span style={{background:'rgba(0,0,0,.5)',color:'#fff',borderRadius:20,padding:'4px 14px',fontSize:13}}>
                    {currentIdx+1} / {generated.length}
                  </span>
                  <button onClick={()=>setCurrentIdx(i=>Math.min(generated.length-1,i+1))}
                    disabled={currentIdx===generated.length-1}
                    style={{background:'rgba(0,0,0,.5)',border:'none',borderRadius:'50%',width:40,height:40,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}>
                    <ChevronRight size={20}/>
                  </button>
                </div>
              </>
            ) : (
              <div style={{textAlign:'center',color:currentPalette.text,opacity:.4}}>
                <Sparkles size={48} style={{margin:'0 auto 12px'}}/>
                <p style={{fontSize:15}}>Здесь появятся слайды</p>
              </div>
            )}
          </div>

          {generated.length > 0 && (
            <a href={`/api/carousel/download?session=${sessionId}`}
              style={{
                display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginTop:16,
                background:'linear-gradient(135deg,#B8956A,#8B6A45)',color:'#fff',
                borderRadius:12,padding:'14px',fontWeight:700,textDecoration:'none',fontSize:15,
              }}>
              <Download size={20}/> Скачать все ({generated.length} PNG)
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
