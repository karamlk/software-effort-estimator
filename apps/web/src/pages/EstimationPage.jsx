import React, { useEffect, useRef, useState } from 'react';
import { Bot, Calculator, Download, RefreshCw, Send, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const WELCOME_TEXT =
  'مرحباً! أنا مُقيِّم 📊\n\n' +
  'مساعدك الذكي لتقدير حجم المشاريع البرمجية باستخدام معايير صناعية معتمدة:\n' +
  '• تحليل نقاط الوظيفة (FPA — Function Point Analysis)\n' +
  '• نقاط حالات الاستخدام (UCP — Use Case Points)\n\n' +
  'سأوجّهك خطوة بخطوة للحصول على تقدير احترافي للجهد والتكلفة المتوقعة.\n\n' +
  'ما اسم مشروعك البرمجي؟';

const WELCOME = { role: 'assistant', text: WELCOME_TEXT };

const PHASE_LABELS = {
  project_name:  'اسم المشروع',
  project_desc:  'وصف المشروع',
  method:        'اختيار المنهجية',
  fpa_ilf:       'ILF — الملفات الداخلية',
  fpa_eif:       'EIF — الواجهات الخارجية',
  fpa_ei:        'EI — المدخلات',
  fpa_eo:        'EO — المخرجات',
  fpa_eq:        'EQ — الاستعلامات',
  gsc_1:         'GSC — الخصائص ١–٧',
  gsc_2:         'GSC — الخصائص ٨–١٤',
  ucp_actors:    'الأطراف الفاعلة',
  ucp_usecases:  'حالات الاستخدام',
  tcf_confirm:   'تخصيص العوامل',
  tcf:           'TCF — العوامل التقنية',
  ecf:           'ECF — العوامل البيئية',
  done:          '✓ مكتمل',
};

const PHASE_ORDER = Object.keys(PHASE_LABELS);

function getSessionId() {
  const KEY = 'est_session_id';
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = `est-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 1 });
}
function fmtUSD(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString('en-US');
}

export default function EstimationPage() {
  const [messages, setMessages] = useState([WELCOME]);
  const [estState, setEstState] = useState({ phase: 'project_name', method: null });
  const [metrics, setMetrics]   = useState({});
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const sendMessage = async (e) => {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || sending) return;

    setMessages(m => [...m, { role: 'user', text }]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/estimation/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: getSessionId() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'طلب فاشل');

      setMessages(m => [...m, { role: 'assistant', text: data.reply || '…' }]);
      setEstState(data.state || {});
      setMetrics(data.metrics || {});
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', text: `عذراً، حدث خطأ: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('هل تريد إعادة تشغيل جلسة التقدير من البداية؟')) return;
    const sid = getSessionId();
    sessionStorage.removeItem('est_session_id');
    await fetch('/api/estimation/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    }).catch(() => {});
    setMessages([WELCOME]);
    setEstState({ phase: 'project_name', method: null });
    setMetrics({});
    setInput('');
    toast.success('تمت إعادة التشغيل');
  };

  const handlePrint = () => window.print();

  const phaseIdx  = PHASE_ORDER.indexOf(estState.phase);
  const progress  = phaseIdx >= 0 ? Math.round((phaseIdx / (PHASE_ORDER.length - 1)) * 100) : 0;
  const isDone    = estState.phase === 'done';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap');
        .est-root { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important; }
        @media print {
          .no-print  { display: none !important; }
          .print-only {
            display: block !important;
            font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
            direction: rtl; text-align: right;
            color: #111; background: #fff; padding: 36px;
          }
          @page { margin: 18mm; }
        }
        .print-only { display: none; }
      `}</style>

      {/* ===== MAIN UI ===== */}
      <div dir="rtl" className="est-root h-screen flex flex-col bg-background overflow-hidden no-print">
        {/* Header */}
        <header className="bg-[hsl(var(--node-bg))] border-b border-border px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Calculator className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">مُقيِّم</h1>
              <p className="text-xs text-muted-foreground">نظام تقدير البرامج — FPA &amp; UCP</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={handlePrint}
              disabled={!isDone}
              title={isDone ? 'تنزيل التقرير كـ PDF' : 'يتوفر التقرير بعد اكتمال التقدير'}
            >
              <Download className="w-4 h-4 ml-2" />
              تنزيل التقرير
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RefreshCw className="w-4 h-4 ml-2" />
              إعادة تشغيل
            </Button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Chat — primary (appears RIGHT in RTL) */}
          <section className="flex-1 flex flex-col min-w-0">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {messages.map((m, i) => <ChatBubble key={i} message={m} />)}
              {sending && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-muted-foreground">
                    جاري التفكير…
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border bg-[hsl(var(--node-bg))] px-6 py-4">
              <form onSubmit={sendMessage} className="flex gap-2">
                <Button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="اكتب ردّك هنا…"
                  disabled={sending || isDone}
                  className="bg-background text-foreground text-right"
                  autoFocus
                />
              </form>
              {isDone && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  اكتمل التقدير — اضغط "تنزيل التقرير" للحصول على ملف PDF
                </p>
              )}
            </div>
          </section>

          {/* Sidebar — secondary (appears LEFT in RTL) */}
          <aside className="w-72 flex flex-col border-r border-border bg-card flex-shrink-0">
            {/* Phase progress */}
            <div className="px-4 py-4 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground truncate">
                  {PHASE_LABELS[estState.phase] || 'الإعداد'}
                </span>
                <span className="text-xs text-muted-foreground ml-2">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Live metrics */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {estState.method ? (
                <>
                  {estState.method !== 'ucp' && (
                    <MetricsSection title="تحليل نقاط الوظيفة (FPA)" color="text-emerald-400">
                      <MRow label="نقاط الوظيفة الخام (UFP)" value={fmt(metrics.ufp)} />
                      <MRow label="مجموع التأثير (TDI)" value={fmt(metrics.tdi)} />
                      <MRow label="نقاط الوظيفة (FP)" value={fmt(metrics.fp)} highlight />
                      <MRow label="الجهد التقديري" value={metrics.effortFPA != null ? fmt(metrics.effortFPA) + ' ساعة' : '—'} />
                      <MRow label="التكلفة التقديرية" value={fmtUSD(metrics.costFPA)} highlight />
                    </MetricsSection>
                  )}

                  {estState.method !== 'fpa' && (
                    <MetricsSection title="نقاط حالات الاستخدام (UCP)" color="text-blue-400">
                      <MRow label="وزن الأطراف (UAW)" value={fmt(metrics.uaw)} />
                      <MRow label="وزن حالات الاستخدام (UUCW)" value={fmt(metrics.uucw)} />
                      <MRow label="المعامل التقني (TCF)" value={fmt(metrics.tcfValue)} />
                      <MRow label="المعامل البيئي (ECF)" value={fmt(metrics.ecfValue)} />
                      <MRow label="نقاط UCP" value={fmt(metrics.ucp)} highlight />
                      <MRow label="الجهد التقديري" value={metrics.effortUCP != null ? fmt(metrics.effortUCP) + ' ساعة' : '—'} />
                      <MRow label="التكلفة التقديرية" value={fmtUSD(metrics.costUCP)} highlight />
                    </MetricsSection>
                  )}
                </>
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <Calculator className="w-8 h-8 mx-auto mb-3 opacity-25" />
                  ستظهر نتائج التقدير<br />هنا أثناء المحادثة
                </div>
              )}

              <div className="text-xs text-muted-foreground border border-border rounded-lg p-3 space-y-1">
                <div className="font-semibold text-foreground mb-1">أسس الحساب</div>
                <div>FP = UFP × (0.65 + 0.01 × TDI)</div>
                <div>UCP = (UAW + UUCW) × TCF × ECF</div>
                <div className="pt-1 border-t border-border mt-1">
                  الجهد: 4.5 ساعة/FP — 10 ساعة/UCP<br />
                  التكلفة: $30 / ساعة
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ===== PRINT REPORT ===== */}
      <PrintReport estState={estState} metrics={metrics} />
    </>
  );
}

function ChatBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-secondary text-secondary-foreground' : 'bg-primary/15 text-primary'
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap break-words leading-relaxed ${
        isUser
          ? 'bg-primary text-primary-foreground rounded-tl-sm'
          : 'bg-card border border-border text-foreground rounded-tr-sm'
      }`}>
        {message.text}
      </div>
    </div>
  );
}

function MetricsSection({ title, color, children }) {
  return (
    <div>
      <h3 className={`text-xs font-bold mb-2 ${color}`}>{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function MRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className={highlight ? 'text-foreground font-medium' : 'text-muted-foreground'}>{label}</span>
      <span className={`font-mono ${highlight ? 'text-primary font-semibold' : 'text-foreground'}`}>{value || '—'}</span>
    </div>
  );
}

/* ========================= PRINT REPORT ========================= */

const FPA_TYPES = {
  ilf: { label: 'ILF — الملفات الداخلية',    lw: 7, aw: 10, hw: 15 },
  eif: { label: 'EIF — الواجهات الخارجية',   lw: 5, aw: 7,  hw: 10 },
  ei:  { label: 'EI  — المدخلات الخارجية',   lw: 3, aw: 4,  hw: 6  },
  eo:  { label: 'EO  — المخرجات الخارجية',   lw: 4, aw: 5,  hw: 7  },
  eq:  { label: 'EQ  — الاستعلامات الخارجية',lw: 3, aw: 4,  hw: 6  },
};

function PrintReport({ estState, metrics }) {
  const { project = {}, method, fpa = {}, ucp = {} } = estState;
  const today = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const methodLabel =
    method === 'fpa'  ? 'تحليل نقاط الوظيفة (FPA)' :
    method === 'ucp'  ? 'نقاط حالات الاستخدام (UCP)' :
    method === 'both' ? 'FPA + UCP' : '—';

  return (
    <div className="print-only">
      {/* Title */}
      <div style={{ borderBottom: '3px solid #1e293b', paddingBottom: 14, marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#1e293b' }}>تقرير تقدير البرامج</h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>مُقيِّم — نظام تقدير FPA &amp; UCP</p>
      </div>

      {/* Project info */}
      <table style={pTbl}>
        <tbody>
          <PR label="اسم المشروع"    value={project.name        || '—'} />
          <PR label="وصف المشروع"    value={project.description || '—'} />
          <PR label="المنهجية"       value={methodLabel} />
          <PR label="تاريخ التقرير"  value={today} />
        </tbody>
      </table>

      {/* FPA */}
      {method !== 'ucp' && metrics.fp != null && (
        <section style={{ marginBottom: 26 }}>
          <h2 style={h2s}>تحليل نقاط الوظيفة (FPA)</h2>
          <table style={pTbl}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <TH>النوع</TH><TH>بسيطة (Low)</TH><TH>متوسطة (Avg)</TH><TH>معقدة (High)</TH><TH>المجموع</TH>
              </tr>
            </thead>
            <tbody>
              {Object.entries(FPA_TYPES).map(([k, { label, lw, aw, hw }]) => {
                const c = fpa[k] || { low: 0, average: 0, high: 0 };
                const tot = (c.low||0)*lw + (c.average||0)*aw + (c.high||0)*hw;
                return (
                  <tr key={k}>
                    <TD>{label}</TD>
                    <TD>{c.low||0} × {lw} = {(c.low||0)*lw}</TD>
                    <TD>{c.average||0} × {aw} = {(c.average||0)*aw}</TD>
                    <TD>{c.high||0} × {hw} = {(c.high||0)*hw}</TD>
                    <TD><b>{tot}</b></TD>
                  </tr>
                );
              })}
              <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                <TD>UFP الإجمالي</TD><TD colSpan={3}></TD><TD><b>{metrics.ufp}</b></TD>
              </tr>
            </tbody>
          </table>
          <div style={calcBox}>
            <p style={cp}><b>TDI = {metrics.tdi}</b> (مجموع تقييمات الـ 14 خاصية عامة، كل منها من 0 إلى 5)</p>
            <p style={cp}><b>FP = UFP × (0.65 + 0.01 × TDI) = {metrics.ufp} × (0.65 + 0.01 × {metrics.tdi}) = <span style={{color:'#2563eb'}}>{metrics.fp}</span></b></p>
            <p style={cp}><b>الجهد = {metrics.fp} × 4.5 ساعة/FP = <span style={{color:'#2563eb'}}>{metrics.effortFPA?.toLocaleString('en-US')} ساعة شخصية</span></b></p>
            <p style={cp}><b>التكلفة = {metrics.effortFPA?.toLocaleString('en-US')} × $30 = <span style={{color:'#2563eb'}}>{metrics.costFPA ? '$' + metrics.costFPA.toLocaleString('en-US') : '—'}</span></b></p>
          </div>
        </section>
      )}

      {/* UCP */}
      {method !== 'fpa' && metrics.ucp != null && (
        <section style={{ marginBottom: 26 }}>
          <h2 style={h2s}>نقاط حالات الاستخدام (UCP)</h2>
          {(() => {
            const a = ucp.actors   || { simple: 0, average: 0, complex: 0 };
            const u = ucp.usecases || { simple: 0, average: 0, complex: 0 };
            return (
              <table style={pTbl}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <TH>النوع</TH><TH>بسيطة</TH><TH>متوسطة</TH><TH>معقدة</TH><TH>الوزن</TH>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <TD>الأطراف الفاعلة (Actors)</TD>
                    <TD>{a.simple||0} × 1 = {(a.simple||0)*1}</TD>
                    <TD>{a.average||0} × 2 = {(a.average||0)*2}</TD>
                    <TD>{a.complex||0} × 3 = {(a.complex||0)*3}</TD>
                    <TD><b>UAW = {metrics.uaw}</b></TD>
                  </tr>
                  <tr>
                    <TD>حالات الاستخدام (Use Cases)</TD>
                    <TD>{u.simple||0} × 5 = {(u.simple||0)*5}</TD>
                    <TD>{u.average||0} × 10 = {(u.average||0)*10}</TD>
                    <TD>{u.complex||0} × 15 = {(u.complex||0)*15}</TD>
                    <TD><b>UUCW = {metrics.uucw}</b></TD>
                  </tr>
                </tbody>
              </table>
            );
          })()}
          <div style={calcBox}>
            <p style={cp}><b>UAW + UUCW = {metrics.uaw} + {metrics.uucw} = {(metrics.uaw||0)+(metrics.uucw||0)}</b></p>
            <p style={cp}><b>TCF (المعامل التقني) = {metrics.tcfValue}</b></p>
            <p style={cp}><b>ECF (المعامل البيئي) = {metrics.ecfValue}</b></p>
            <p style={cp}><b>UCP = ({metrics.uaw} + {metrics.uucw}) × {metrics.tcfValue} × {metrics.ecfValue} = <span style={{color:'#2563eb'}}>{metrics.ucp}</span></b></p>
            <p style={cp}><b>الجهد = {metrics.ucp} × 10 ساعة/UCP = <span style={{color:'#2563eb'}}>{metrics.effortUCP?.toLocaleString('en-US')} ساعة شخصية</span></b></p>
            <p style={cp}><b>التكلفة = {metrics.effortUCP?.toLocaleString('en-US')} × $30 = <span style={{color:'#2563eb'}}>{metrics.costUCP ? '$' + metrics.costUCP.toLocaleString('en-US') : '—'}</span></b></p>
          </div>
        </section>
      )}

      {/* Summary table */}
      <section>
        <h2 style={h2s}>ملخص التقدير</h2>
        <table style={pTbl}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <TH>المنهجية</TH><TH>الحجم</TH><TH>الجهد (ساعة شخصية)</TH><TH>التكلفة التقديرية</TH>
            </tr>
          </thead>
          <tbody>
            {method !== 'ucp' && metrics.fp != null && (
              <tr>
                <TD>FPA</TD>
                <TD>{metrics.fp} نقطة وظيفة</TD>
                <TD>{metrics.effortFPA?.toLocaleString('en-US')}</TD>
                <TD>{metrics.costFPA ? '$' + metrics.costFPA.toLocaleString('en-US') : '—'}</TD>
              </tr>
            )}
            {method !== 'fpa' && metrics.ucp != null && (
              <tr>
                <TD>UCP</TD>
                <TD>{metrics.ucp} نقطة حالة استخدام</TD>
                <TD>{metrics.effortUCP?.toLocaleString('en-US')}</TD>
                <TD>{metrics.costUCP ? '$' + metrics.costUCP.toLocaleString('en-US') : '—'}</TD>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <p style={{ marginTop: 32, fontSize: 11, color: '#94a3b8', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
        تقرير مُوَلَّد بواسطة مُقيِّم — نظام تقدير البرامج المبني على الذكاء الاصطناعي
      </p>
    </div>
  );
}

/* Print helpers */
const pTbl   = { width: '100%', borderCollapse: 'collapse', marginBottom: 10, fontSize: 12 };
const h2s    = { fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 10px', borderBottom: '1px solid #cbd5e1', paddingBottom: 5 };
const calcBox = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', fontSize: 12.5, lineHeight: 2, marginTop: 8 };
const cp     = { margin: '2px 0' };
function TH({ children, colSpan }) {
  return <th colSpan={colSpan} style={{ border: '1px solid #cbd5e1', padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{children}</th>;
}
function TD({ children, colSpan }) {
  return <td colSpan={colSpan} style={{ border: '1px solid #e2e8f0', padding: '5px 10px', textAlign: 'right' }}>{children}</td>;
}
function PR({ label, value }) {
  return (
    <tr>
      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', fontWeight: 600, width: '28%', background: '#f8fafc' }}>{label}</td>
      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px' }}>{value}</td>
    </tr>
  );
}
