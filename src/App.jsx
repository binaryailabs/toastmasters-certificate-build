import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileImage, FileText, Download, Users, CheckCircle, Search, ZoomIn, ZoomOut, Loader2, Archive } from 'lucide-react';

// --- Firebase Setup ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

let app, auth, db, appId;
try {
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    // Mock config for local testing if needed
  };
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  appId = typeof __app_id !== 'undefined' ? __app_id : 'default-toastmasters-app';
} catch (e) {
  console.warn("Firebase initialization skipped (ensure standard environment).", e);
}

// --- Dynamic Script Loader ---
const useScripts = (urls) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === urls.length) setLoaded(true);
    };

    urls.forEach(url => {
      if (document.querySelector(`script[src="${url}"]`)) {
        checkLoaded();
      } else {
        const script = document.createElement('script');
        script.src = url;
        script.onload = checkLoaded;
        document.head.appendChild(script);
      }
    });
  }, [urls]);

  return loaded;
};

const SCRIPT_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js'
];

// --- Template Configurations ---
// Define absolute coordinate positioning for form fields based on the template structures.
const getTemplateConfig = (id) => {
  const baseParticipation = {
    name: { top: '46%', left: '15%', width: '70%', height: '40px', align: 'left', baseSize: 32 },
    role: { top: '53.5%', left: '38%', width: '47%', height: '30px', align: 'left', baseSize: 22 },
    event: { top: '60.5%', left: '20%', width: '65%', height: '30px', align: 'left', baseSize: 22 },
    date: { top: '78.5%', left: '15%', width: '25%', height: '30px', align: 'center', baseSize: 20 },
    presenter: { top: '78.5%', left: '53%', width: '25%', height: '30px', align: 'center', baseSize: 20 }
  };

  if (id >= 5 && id <= 6) {
    return { // Appreciation with badge on left
      name: { top: '44%', left: '33%', width: '55%', height: '40px', align: 'left', baseSize: 32 },
      role: { top: '55%', left: '53%', width: '35%', height: '30px', align: 'left', baseSize: 22 },
      event: { top: '63%', left: '38%', width: '50%', height: '30px', align: 'left', baseSize: 22 },
      date: { top: '83%', left: '33%', width: '20%', height: '30px', align: 'center', baseSize: 20 },
      presenter: { top: '83%', left: '62%', width: '20%', height: '30px', align: 'center', baseSize: 20 }
    };
  } else if (id >= 7 && id <= 8) {
    return { // Appreciation with top logo
      name: { top: '44%', left: '20%', width: '60%', height: '40px', align: 'center', baseSize: 32 },
      role: { top: '53%', left: '42%', width: '38%', height: '30px', align: 'left', baseSize: 22 },
      event: { top: '61%', left: '28%', width: '52%', height: '30px', align: 'left', baseSize: 22 },
      date: { top: '80.5%', left: '24%', width: '22%', height: '30px', align: 'center', baseSize: 20 },
      presenter: { top: '80.5%', left: '54%', width: '22%', height: '30px', align: 'center', baseSize: 20 }
    };
  }
  return baseParticipation;
};

// --- Component: Auto-scaling Text Node ---
const AutoText = ({ text, styleConfig }) => {
  const textRef = useRef(null);
  
  useEffect(() => {
    if (!textRef.current || !text) return;
    const el = textRef.current;
    let currentSize = styleConfig.baseSize;
    el.style.fontSize = `${currentSize}px`;
    
    // Scale down if text exceeds container width
    while (el.scrollWidth > el.clientWidth && currentSize > 12) {
      currentSize--;
      el.style.fontSize = `${currentSize}px`;
    }
  }, [text, styleConfig.baseSize]);

  return (
    <div style={{
      position: 'absolute',
      top: styleConfig.top,
      left: styleConfig.left,
      width: styleConfig.width,
      height: styleConfig.height,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: styleConfig.align === 'center' ? 'center' : 'flex-start',
      color: '#333',
      fontFamily: '"Montserrat", "Helvetica Neue", sans-serif',
      fontWeight: 'bold',
      overflow: 'hidden'
    }}>
      <span ref={textRef} style={{ whiteSpace: 'nowrap', display: 'inline-block', lineHeight: 1 }}>
        {text}
      </span>
    </div>
  );
};

// --- Component: Certificate Preview ---
const CertificateCanvas = React.forwardRef(({ templateId, data }, ref) => {
  const config = getTemplateConfig(templateId);
  return (
    <div 
      ref={ref}
      style={{
        width: '1000px',
        height: '707px',
        position: 'relative',
        backgroundColor: '#fff',
        backgroundImage: `url('/${templateId}.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
      className="shadow-xl"
    >
      {/* Fallback styling just in case images are missing */}
      <AutoText text={data.name || ''} styleConfig={config.name} />
      <AutoText text={data.role || ''} styleConfig={config.role} />
      <AutoText text={data.event || ''} styleConfig={config.event} />
      <AutoText text={data.date || ''} styleConfig={config.date} />
      <AutoText text={data.presenter || ''} styleConfig={config.presenter} />
    </div>
  );
});

export default function App() {
  const scriptsLoaded = useScripts(SCRIPT_URLS);
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  
  const [formData, setFormData] = useState({ name: '', role: '', event: '', date: '', presenter: '' });
  const [zoom, setZoom] = useState(0.7);
  const certRef = useRef(null);
  
  // Bulk states
  const [bulkData, setBulkData] = useState([]);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const hiddenCertRef = useRef(null);
  const [hiddenData, setHiddenData] = useState({});

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const saveToFirebase = async (dataRecord) => {
    if (!user || !db) return;
    try {
      const recordsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'certificates');
      await addDoc(recordsRef, {
        ...dataRecord,
        templateId: selectedTemplate,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to save to Firebase:", err);
    }
  };

  const handleDownload = async (format) => {
    if (!certRef.current || !window.html2canvas) return;
    try {
      const canvas = await window.html2canvas(certRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `Certificate_${formData.name.replace(/\s+/g, '_')}.png`;
        link.href = imgData;
        link.click();
      } else if (format === 'pdf') {
        const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'px', format: [1000, 707] });
        pdf.addImage(imgData, 'PNG', 0, 0, 1000, 707);
        pdf.save(`Certificate_${formData.name.replace(/\s+/g, '_')}.pdf`);
      }
      
      await saveToFirebase(formData);
    } catch (err) {
      console.error("Download Error", err);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !window.Papa) return;
    
    window.Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const mappedData = results.data.map(row => ({
          name: row.Name || row.name || '',
          role: row.Role || row.role || '',
          event: row.Event || row.event || '',
          date: row.Date || row.date || '',
          presenter: row.Presenter || row.Designation || row.presenter || ''
        }));
        setBulkData(mappedData);
      }
    });
  };

  const generateBulk = async (format) => {
    if (!bulkData.length || !window.html2canvas || !window.JSZip) return;
    setIsGeneratingBulk(true);
    setBulkProgress({ current: 0, total: bulkData.length });
    
    const zip = new window.JSZip();
    
    for (let i = 0; i < bulkData.length; i++) {
      setHiddenData(bulkData[i]);
      // Wait for React to render and text to scale
      await new Promise(resolve => setTimeout(resolve, 200)); 
      
      const canvas = await window.html2canvas(hiddenCertRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const safeName = bulkData[i].name.replace(/[^a-zA-Z0-9]/g, '_') || `Cert_${i}`;
      
      if (format === 'pdf') {
        const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'px', format: [1000, 707] });
        pdf.addImage(imgData, 'PNG', 0, 0, 1000, 707);
        const pdfBlob = pdf.output('blob');
        zip.file(`${safeName}.pdf`, pdfBlob);
      } else {
        const base64Data = imgData.split(',')[1];
        zip.file(`${safeName}.png`, base64Data, { base64: true });
      }
      
      await saveToFirebase(bulkData[i]);
      setBulkProgress({ current: i + 1, total: bulkData.length });
    }
    
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `Toastmasters_Certificates_${format.toUpperCase()}.zip`;
    link.click();
    
    setIsGeneratingBulk(false);
  };

  const isAppreciation = selectedTemplate >= 5;

  if (!scriptsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-[#004165]">
        <Loader2 className="animate-spin w-12 h-12 mb-4 mx-auto" />
        <h2 className="text-xl font-bold">Loading Generator Assets...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-12">
      {/* Header */}
      <header className="bg-[#004165] text-white py-6 shadow-md border-b-4 border-[#772432]">
        <div className="max-w-6xl mx-auto px-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-wide flex items-center gap-3">
              <AwardIcon className="w-8 h-8 text-[#F2DF74]"/>
              Toastmasters Certificate Generator
            </h1>
            <p className="text-sm text-gray-200 mt-1">Official template automated creation tool</p>
          </div>
          <div className="flex bg-[#002f4a] rounded-lg p-1">
            <button 
              onClick={() => setMode('single')}
              className={`px-4 py-2 rounded-md font-semibold text-sm transition-colors ${mode === 'single' ? 'bg-[#772432] text-white shadow' : 'text-gray-300 hover:text-white'}`}
            >
              Single Generation
            </button>
            <button 
              onClick={() => { setMode('bulk'); setStep(2); }}
              className={`px-4 py-2 rounded-md font-semibold text-sm transition-colors ${mode === 'bulk' ? 'bg-[#772432] text-white shadow' : 'text-gray-300 hover:text-white'}`}
            >
              Bulk Upload
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        {/* Step 1: Select Template */}
        {step === 1 && mode === 'single' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-[#004165] mb-6 border-b border-gray-200 pb-2">Step 1: Choose a Template</h2>
            
            <div className="mb-8">
              <h3 className="text-lg font-bold text-[#772432] mb-4">Certificates of Participation</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(id => (
                  <div 
                    key={id} 
                    onClick={() => { setSelectedTemplate(id); setStep(2); }}
                    className={`cursor-pointer rounded-lg border-4 transition-all duration-200 ${selectedTemplate === id ? 'border-[#F2DF74] shadow-lg transform scale-105' : 'border-transparent hover:border-gray-300 shadow'}`}
                  >
                    <img src={`/${id}.jpg`} alt={`Template ${id}`} className="w-full rounded bg-white object-cover aspect-[1.414]" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#772432] mb-4">Certificates of Appreciation</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[5, 6, 7, 8].map(id => (
                  <div 
                    key={id} 
                    onClick={() => { setSelectedTemplate(id); setStep(2); }}
                    className={`cursor-pointer rounded-lg border-4 transition-all duration-200 ${selectedTemplate === id ? 'border-[#F2DF74] shadow-lg transform scale-105' : 'border-transparent hover:border-gray-300 shadow'}`}
                  >
                    <img src={`/${id}.jpg`} alt={`Template ${id}`} className="w-full rounded bg-white object-cover aspect-[1.414]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Form Input (Single) */}
        {step === 2 && mode === 'single' && (
          <div className="flex flex-col md:flex-row gap-8 animate-fade-in">
            <div className="w-full md:w-1/3 bg-white p-6 rounded-xl shadow-md border border-gray-100">
              <button onClick={() => setStep(1)} className="text-sm text-[#004165] hover:underline mb-4 inline-block">&larr; Back to Templates</button>
              <h2 className="text-xl font-bold text-[#772432] mb-6">Certificate Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Recipient Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-[#004165] outline-none" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{isAppreciation ? 'Role / Participation As' : 'Where Participating / Details'}</label>
                  <input type="text" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-[#004165] outline-none" placeholder={isAppreciation ? 'Keynote Speaker' : 'Speech Contest'} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Event Name</label>
                  <input type="text" value={formData.event} onChange={e => setFormData({...formData, event: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-[#004165] outline-none" placeholder="Annual Conference 2026" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                    <input type="text" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-[#004165] outline-none" placeholder="Oct 24, 2026" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{isAppreciation ? 'Designation' : 'Presenter'}</label>
                    <input type="text" value={formData.presenter} onChange={e => setFormData({...formData, presenter: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-[#004165] outline-none" placeholder="Club President" />
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full md:w-2/3 bg-gray-200 rounded-xl p-6 shadow-inner flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-700 flex items-center gap-2"><Search className="w-4 h-4"/> Preview & Download</h3>
                <div className="flex gap-2">
                  <button onClick={() => setZoom(z => Math.max(0.4, z - 0.1))} className="p-2 bg-white rounded shadow hover:bg-gray-50"><ZoomOut className="w-4 h-4 text-gray-600"/></button>
                  <button onClick={() => setZoom(z => Math.min(1.2, z + 0.1))} className="p-2 bg-white rounded shadow hover:bg-gray-50"><ZoomIn className="w-4 h-4 text-gray-600"/></button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-gray-300 rounded border border-gray-400 flex items-center justify-center p-4">
                {/* Scaled wrapper to fit screen comfortably without changing dom width of the cert */}
                <div style={{ width: `${1000 * zoom}px`, height: `${707 * zoom}px`, transition: 'all 0.2s' }}>
                  <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                    <CertificateCanvas ref={certRef} templateId={selectedTemplate} data={formData} />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-4">
                <button onClick={() => handleDownload('png')} className="flex items-center gap-2 bg-[#004165] hover:bg-[#002f4a] text-white px-6 py-3 rounded-lg font-bold shadow transition-colors">
                  <FileImage className="w-5 h-5"/> Download PNG
                </button>
                <button onClick={() => handleDownload('pdf')} className="flex items-center gap-2 bg-[#772432] hover:bg-[#5a1b26] text-white px-6 py-3 rounded-lg font-bold shadow transition-colors">
                  <FileText className="w-5 h-5"/> Download PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Bulk Mode */}
        {mode === 'bulk' && (
          <div className="animate-fade-in bg-white rounded-xl shadow p-8">
             <h2 className="text-2xl font-bold text-[#004165] mb-6">Bulk Generate Certificates</h2>
             
             <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">1. Select Template to Apply</label>
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {[1,2,3,4,5,6,7,8].map(id => (
                    <div 
                      key={id} 
                      onClick={() => setSelectedTemplate(id)}
                      className={`flex-shrink-0 cursor-pointer rounded-lg border-2 w-32 ${selectedTemplate === id ? 'border-[#772432] shadow-md' : 'border-gray-200'}`}
                    >
                      <img src={`/${id}.jpg`} alt={`Tpl ${id}`} className="w-full h-auto rounded" />
                    </div>
                  ))}
                </div>
             </div>

             <div className="mb-8 p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-700">Upload CSV File</h3>
                <p className="text-sm text-gray-500 mb-4 mt-1">Columns needed: Name, Role, Event, Date, Presenter</p>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="csv-upload" />
                <label htmlFor="csv-upload" className="cursor-pointer bg-[#004165] text-white px-5 py-2 rounded-md font-medium hover:bg-[#002f4a] transition-colors">
                  Select CSV File
                </label>
             </div>

             {bulkData.length > 0 && (
               <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-[#772432] flex items-center gap-2"><Users className="w-5 h-5"/> Found {bulkData.length} records</h3>
                  </div>
                  <div className="max-h-60 overflow-y-auto border rounded mb-6">
                    <table className="w-full text-sm text-left text-gray-600">
                      <thead className="bg-gray-100 text-gray-700 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 border-b">Name</th>
                          <th className="px-4 py-3 border-b">Role</th>
                          <th className="px-4 py-3 border-b">Event</th>
                          <th className="px-4 py-3 border-b">Date</th>
                          <th className="px-4 py-3 border-b">Presenter</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkData.slice(0, 10).map((row, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium">{row.name}</td>
                            <td className="px-4 py-2">{row.role}</td>
                            <td className="px-4 py-2">{row.event}</td>
                            <td className="px-4 py-2">{row.date}</td>
                            <td className="px-4 py-2">{row.presenter}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {bulkData.length > 10 && <div className="p-3 text-center text-sm text-gray-500 bg-gray-50 border-t">...and {bulkData.length - 10} more rows</div>}
                  </div>

                  {isGeneratingBulk ? (
                    <div className="bg-[#e6f0f5] p-6 rounded-lg text-center border border-[#004165]">
                      <Loader2 className="w-8 h-8 animate-spin text-[#004165] mx-auto mb-3" />
                      <p className="font-bold text-[#004165]">Generating ZIP Archive...</p>
                      <div className="w-full bg-gray-300 rounded-full h-2.5 mt-4 max-w-md mx-auto">
                        <div className="bg-[#772432] h-2.5 rounded-full transition-all duration-300" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}></div>
                      </div>
                      <p className="text-sm mt-2 text-gray-600">{bulkProgress.current} / {bulkProgress.total} processed</p>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <button onClick={() => generateBulk('pdf')} className="flex-1 flex items-center justify-center gap-2 bg-[#772432] text-white py-3 rounded-lg font-bold hover:bg-[#5a1b26] transition-colors">
                        <Archive className="w-5 h-5"/> Generate PDF ZIP
                      </button>
                      <button onClick={() => generateBulk('png')} className="flex-1 flex items-center justify-center gap-2 bg-[#004165] text-white py-3 rounded-lg font-bold hover:bg-[#002f4a] transition-colors">
                        <Archive className="w-5 h-5"/> Generate PNG ZIP
                      </button>
                    </div>
                  )}
               </div>
             )}
          </div>
        )}

      </main>

      {/* Hidden container for bulk rendering */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <CertificateCanvas ref={hiddenCertRef} templateId={selectedTemplate} data={hiddenData} />
      </div>

    </div>
  );
}

const AwardIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="8" r="6" />
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
  </svg>
);