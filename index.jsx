import React, { useState, useRef } from 'react';
import { Camera, Upload, Send, Trash2, Copy, CheckCircle, RefreshCw, UserCheck, Table as TableIcon, FileSpreadsheet, CloudUpload, FileText } from 'lucide-react';

const App = () => {
  const [image, setImage] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState([]);
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState(false);
  const [sheetUrl, setSheetUrl] = useState(''); // เก็บ Web App URL จาก Apps Script
  const fileInputRef = useRef(null);

  const apiKey = ""; // The API key will be provided by the environment

  // Handle Image Selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(URL.createObjectURL(file));
        setBase64Image(reader.result.split(',')[1]);
      };
      reader.readAsDataURL(file);
    }
  };

  // Call Gemini API for OCR and Correction
  const processImageWithAI = async () => {
    if (!base64Image) return;

    setLoading(true);
    setStatus('กำลังวิเคราะห์และแยกข้อมูลด้วย AI...');
    setResult([]);

    const prompt = `
      Extract a list of people's information from this image.
      The data is in Thai.
      
      Rules for Extraction:
      1. Prefix & First Name: Keep them together (e.g., "นายสมชาย").
      2. Title Change: If the prefix is "น.ส.", change it to "นางสาว".
      3. Last Name: Separate into a different field.
      4. Address: Extract the "House Number" (บ้านเลขที่).
      5. Correction: Fix common Thai OCR errors (vowels, tone marks).
      
      Return ONLY a JSON array of objects with these keys: 
      "firstName" (includes prefix), "lastName", and "address" (house number).
      
      Format example: [{"firstName": "นางสาวสมหญิง", "lastName": "รักเรียน", "address": "123/45"}]
    `;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/png", data: base64Image } }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const callAPI = async () => {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );

        if (!response.ok) throw new Error('API Error');

        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const jsonResult = JSON.parse(textResponse);
        setResult(jsonResult);
        setLoading(false);
        setStatus('ประมวลผลสำเร็จ');
      } catch (error) {
        setLoading(false);
        setStatus('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }
    };

    callAPI();
  };

  // ฟังก์ชันส่งข้อมูลไปยัง Google Apps Script
  const saveToGoogleSheets = async () => {
    if (!sheetUrl) {
      alert("กรุณาใส่ Web App URL จาก Google Apps Script ก่อน");
      return;
    }
    if (result.length === 0) return;

    setSaving(true);
    setStatus('กำลังส่งข้อมูลไปยัง Google Sheets...');

    try {
      const response = await fetch(sheetUrl, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      });

      setSaving(false);
      setStatus('ส่งข้อมูลไปยัง Google Sheets เรียบร้อยแล้ว!');
    } catch (error) {
      console.error(error);
      setSaving(false);
      setStatus('เกิดข้อผิดพลาดในการส่งข้อมูล');
    }
  };

  // ฟังก์ชันสำหรับดาวน์โหลดไฟล์ .txt สำหรับเปิดใน Notepad
  const downloadAsNotepad = () => {
    if (result.length === 0) return;

    // สร้างเนื้อหาไฟล์โดยแยกข้อมูลแต่ละแถว
    const content = result.map((item, index) => 
      `${index + 1}. ชื่อ: ${item.firstName} นามสกุล: ${item.lastName} บ้านเลขที่: ${item.address}`
    ).join('\n');

    // ใส่ BOM เพื่อให้ Notepad อ่านภาษาไทยออก (UTF-8)
    const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `list_names_${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    const textToCopy = result.map(item => `${item.firstName}\t${item.lastName}\t${item.address}`).join('\n');
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    document.body.removeChild(textArea);
  };

  const reset = () => {
    setImage(null);
    setBase64Image(null);
    setResult([]);
    setStatus('');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="flex justify-center mb-2">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg text-white">
              <UserCheck size={32} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">AI Sync to Google Sheets</h1>
          <p className="text-slate-500 mt-2">สแกนรายชื่อและบันทึกข้อมูลแบบ Real-time</p>
        </header>

        {/* URL Config */}
        <div className="mb-6 bg-indigo-50 p-4 rounded-2xl border border-indigo-100 max-w-2xl mx-auto">
          <label className="block text-xs font-bold text-indigo-700 uppercase mb-2">Google Apps Script Web App URL:</label>
          <input 
            type="text" 
            placeholder="https://script.google.com/macros/s/.../exec"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-indigo-200 focus:ring-2 focus:ring-indigo-300 outline-none text-sm"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-fit">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Upload size={20} className="text-indigo-500" />
              จัดการรูปภาพ
            </h2>
            {!image ? (
              <div onClick={() => fileInputRef.current.click()} className="border-2 border-dashed border-slate-300 rounded-2xl h-64 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                <Camera size={48} className="text-slate-400 mb-2" />
                <p className="text-slate-500 text-sm text-center px-4">คลิกเพื่อถ่ายภาพ หรือเลือกรูปจากเครื่อง</p>
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
              </div>
            ) : (
              <div className="relative">
                <img src={image} alt="Preview" className="w-full h-64 object-contain rounded-2xl bg-slate-100" />
                <button onClick={reset} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow-md"><Trash2 size={18} /></button>
              </div>
            )}
            <button
              disabled={!image || loading}
              onClick={processImageWithAI}
              className={`w-full mt-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${!image || loading ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
              {loading ? <RefreshCw className="animate-spin" /> : <Send size={20} />}
              {loading ? 'กำลังประมวลผล...' : 'เริ่มแสกนข้อมูล'}
            </button>
            {status && <p className="text-center mt-3 text-sm text-slate-500 italic">{status}</p>}
          </div>

          {/* Results Section */}
          <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col min-h-[500px]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <TableIcon size={20} className="text-emerald-500" />
                ผลลัพธ์ ({result.length})
              </h2>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                {result.length > 0 && (
                  <>
                    <button onClick={copyToClipboard} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all">
                      {copied ? <CheckCircle size={16} /> : <Copy size={16} />} 
                      {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                    </button>
                    <button onClick={downloadAsNotepad} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-sm transition-all">
                      <FileText size={16} /> บันทึก Notepad
                    </button>
                    <button 
                      onClick={saveToGoogleSheets}
                      disabled={saving}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md disabled:bg-slate-300 transition-all"
                    >
                      {saving ? <RefreshCw className="animate-spin" size={16} /> : <CloudUpload size={16} />}
                      ลง Sheets
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              {result.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 font-bold text-xs text-slate-400 uppercase">
                      <th className="py-3 px-4 w-12">#</th>
                      <th className="py-3 px-4">ชื่อ</th>
                      <th className="py-3 px-4">นามสกุล</th>
                      <th className="py-3 px-4">บ้านเลขที่</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.map((item, index) => (
                      <tr key={index} className="border-b border-slate-50 group hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-4 text-slate-300 text-xs font-mono">{index + 1}</td>
                        <td className="py-2 px-4">
                          <input type="text" value={item.firstName} onChange={(e) => {
                            const n = [...result]; n[index].firstName = e.target.value; setResult(n);
                          }} className="w-full bg-transparent outline-none text-slate-700 border-b border-transparent focus:border-indigo-300 transition-all" />
                        </td>
                        <td className="py-2 px-4">
                          <input type="text" value={item.lastName} onChange={(e) => {
                            const n = [...result]; n[index].lastName = e.target.value; setResult(n);
                          }} className="w-full bg-transparent outline-none text-slate-700 border-b border-transparent focus:border-indigo-300 transition-all" />
                        </td>
                        <td className="py-2 px-4">
                          <input type="text" value={item.address} onChange={(e) => {
                            const n = [...result]; n[index].address = e.target.value; setResult(n);
                          }} className="w-full bg-transparent outline-none text-emerald-700 font-mono border-b border-transparent focus:border-emerald-300 transition-all" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p>ยังไม่มีข้อมูล</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
