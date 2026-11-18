import { Router } from 'express';
import { callEstimationAI } from '../estimation/estimationAI.js';
import { calcMetrics } from '../estimation/calculator.js';

const router = Router();
const sessions = new Map();

function initialState() {
  return {
    phase: 'project_name',
    project: { name: '', description: '' },
    method: null,
    fpa: {
      ilf: { low: 0, average: 0, high: 0 },
      eif: { low: 0, average: 0, high: 0 },
      ei:  { low: 0, average: 0, high: 0 },
      eo:  { low: 0, average: 0, high: 0 },
      eq:  { low: 0, average: 0, high: 0 },
    },
    gsc: Array(14).fill(3),
    ucp: {
      actors:   { simple: 0, average: 0, complex: 0 },
      usecases: { simple: 0, average: 0, complex: 0 },
    },
    tcf: Array(13).fill(3),
    ecf: Array(8).fill(3),
  };
}

function deepMerge(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return source;
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (Array.isArray(source[key])) {
      result[key] = source[key];
    } else if (source[key] && typeof source[key] === 'object') {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function getSession(sid) {
  if (!sessions.has(sid)) {
    sessions.set(sid, { state: initialState(), history: [] });
  }
  return sessions.get(sid);
}

// Phases that can only be reached after UCP data is collected
const POST_UCP_PHASES = new Set(['tcf_confirm', 'tcf', 'ecf', 'done']);

/**
 * Guard against the AI skipping required phases.
 * When method includes UCP ("ucp" or "both"), the conversation must collect
 * actor + use-case counts before moving to TCF/ECF or marking as done.
 * Returns { state, reply } — reply may be overridden with a corrective message.
 */
function guardPhaseTransition(state, aiReply) {
  const { phase, method, ucp } = state;
  const needsUCP = method === 'ucp' || method === 'both';
  if (!needsUCP || !POST_UCP_PHASES.has(phase)) return { state, reply: aiReply };

  const a = ucp?.actors   || {};
  const u = ucp?.usecases || {};
  const totalActors   = (a.simple||0) + (a.average||0) + (a.complex||0);
  const totalUsecases = (u.simple||0) + (u.average||0) + (u.complex||0);

  if (totalActors === 0) {
    return {
      state: { ...state, phase: 'ucp_actors' },
      reply:
        'لاحظت أنك اخترت كلا المنهجين، ولكننا لم ندرس UCP بعد!\n\n' +
        '**الأطراف الفاعلة (Actors)** هي كل من يتفاعل مع النظام من خارجه:\n' +
        '• بسيطة: نظام خارجي بواجهة API واضحة (وزن 1)\n' +
        '• متوسطة: مستخدم يعمل عبر واجهة محدودة (وزن 2)\n' +
        '• معقدة: مستخدم يعمل عبر واجهة رسومية كاملة (وزن 3)\n\n' +
        'كم عدد الأطراف الفاعلة في نظامك؟ (مثال: 2 بسيطة، 3 متوسطة، 1 معقدة)',
    };
  }

  if (totalUsecases === 0) {
    return {
      state: { ...state, phase: 'ucp_usecases' },
      reply:
        'ممتاز! سجّلت الأطراف الفاعلة. الآن نحتاج إلى **حالات الاستخدام (Use Cases)**:\n\n' +
        '• بسيطة: 3 خطوات أو أقل (وزن 5)\n' +
        '• متوسطة: 4-7 خطوات (وزن 10)\n' +
        '• معقدة: أكثر من 7 خطوات (وزن 15)\n\n' +
        'كم عدد كل نوع؟ (مثال: 5 بسيطة، 8 متوسطة، 2 معقدة)',
    };
  }

  return { state, reply: aiReply };
}

// Clean sessions older than 4 hours
setInterval(() => {
  const limit = Date.now() - 4 * 60 * 60 * 1000;
  for (const [id, s] of sessions.entries()) {
    if (s._ts && s._ts < limit) sessions.delete(id);
  }
}, 60 * 60 * 1000);

router.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body || {};
  if (typeof message !== 'string') {
    return res.status(400).json({ code: 400, message: 'message is required' });
  }

  const sid = typeof sessionId === 'string' && sessionId ? sessionId : `est-${Date.now()}`;
  const session = getSession(sid);

  try {
    const { reply, phase, updates } = await callEstimationAI(
      message,
      session.state,
      session.history
    );

    // Apply state updates (deep merge keeps existing nested values)
    let newState = deepMerge(session.state, updates);

    // Validate and set phase
    const VALID_PHASES = [
      'welcome','project_name','project_desc','method',
      'fpa_ilf','fpa_eif','fpa_ei','fpa_eo','fpa_eq',
      'gsc_1','gsc_2','ucp_actors','ucp_usecases',
      'tcf_confirm','tcf','ecf','done',
    ];
    if (VALID_PHASES.includes(phase)) newState.phase = phase;

    // Guard: ensure required phases are not skipped (e.g. UCP when method="both")
    const guarded = guardPhaseTransition(newState, reply);
    newState = guarded.state;
    const finalReply = guarded.reply;

    // Calculate live metrics
    const metrics = newState.method ? calcMetrics(newState) : {};

    // Update history (keep last 20 exchanges)
    session.history.push({ role: 'user', content: message });
    session.history.push({ role: 'assistant', content: finalReply });
    if (session.history.length > 30) session.history.splice(0, session.history.length - 30);
    session.state = newState;

    res.json({ reply: finalReply, phase: newState.phase, state: newState, metrics });
  } catch (err) {
    console.error('[estimation] error:', err.message);
    res.status(500).json({ code: 500, message: 'AI request failed: ' + err.message });
  }
});

router.post('/reset', (req, res) => {
  const { sessionId } = req.body || {};
  if (sessionId) sessions.delete(sessionId);
  res.json({ ok: true, state: initialState() });
});

export default router;
