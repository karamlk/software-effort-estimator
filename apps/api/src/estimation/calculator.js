const FPA_WEIGHTS = {
  ilf: { low: 7,  average: 10, high: 15 },
  eif: { low: 5,  average: 7,  high: 10 },
  ei:  { low: 3,  average: 4,  high: 6  },
  eo:  { low: 4,  average: 5,  high: 7  },
  eq:  { low: 3,  average: 4,  high: 6  },
};

const TCF_WEIGHTS = [2.0, 1.0, 1.0, 1.0, 1.0, 0.5, 0.5, 2.0, 1.0, 1.0, 1.0, 1.0, 1.0];
const ECF_WEIGHTS = [1.5, 0.5, 1.0, 0.5, 1.0, 2.0, -1.0, -1.0];

const HOURLY_RATE = 30;
const EFFORT_PER_FP = 4.5;
const EFFORT_PER_UCP = 10;

export function calcUFP(fpa) {
  let ufp = 0;
  for (const [type, w] of Object.entries(FPA_WEIGHTS)) {
    const c = fpa[type] || { low: 0, average: 0, high: 0 };
    ufp += (c.low || 0) * w.low + (c.average || 0) * w.average + (c.high || 0) * w.high;
  }
  return ufp;
}

export function calcFPA(fpa, gsc) {
  const ufp = calcUFP(fpa);
  const tdi = (gsc || []).reduce((s, v) => s + (v || 0), 0);
  const fp  = round1(ufp * (0.65 + 0.01 * tdi));
  return { ufp, tdi, fp };
}

export function calcUCPMetrics(ucp, tcfArr, ecfArr) {
  const a = ucp.actors   || { simple: 0, average: 0, complex: 0 };
  const u = ucp.usecases || { simple: 0, average: 0, complex: 0 };

  const uaw  = a.simple * 1  + a.average * 2  + a.complex * 3;
  const uucw = u.simple * 5  + u.average * 10 + u.complex * 15;

  const tcfSum = (tcfArr || []).reduce((s, v, i) => s + (v || 0) * (TCF_WEIGHTS[i] || 0), 0);
  const ecfSum = (ecfArr || []).reduce((s, v, i) => s + (v || 0) * (ECF_WEIGHTS[i] || 0), 0);

  const tcf = round2(0.6  + 0.01  * tcfSum);
  const ecf = round2(1.4  + (-0.03 * ecfSum));
  const ucpVal = round1((uaw + uucw) * tcf * ecf);

  return { uaw, uucw, tcf, ecf, ucp: ucpVal };
}

export function calcMetrics(state) {
  const m = {};

  if (state.method !== 'ucp') {
    const { ufp, tdi, fp } = calcFPA(state.fpa || {}, state.gsc || []);
    m.ufp = ufp;
    m.tdi = tdi;
    m.fp  = fp;
    m.effortFPA = Math.round(fp * EFFORT_PER_FP);
    m.costFPA   = m.effortFPA * HOURLY_RATE;
  }

  if (state.method !== 'fpa') {
    const { uaw, uucw, tcf, ecf, ucp } = calcUCPMetrics(
      state.ucp  || {},
      state.tcf  || Array(13).fill(3),
      state.ecf  || Array(8).fill(3)
    );
    m.uaw      = uaw;
    m.uucw     = uucw;
    m.tcfValue = tcf;
    m.ecfValue = ecf;
    m.ucp      = ucp;
    m.effortUCP = Math.round(ucp * EFFORT_PER_UCP);
    m.costUCP   = m.effortUCP * HOURLY_RATE;
  }

  return m;
}

function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }
