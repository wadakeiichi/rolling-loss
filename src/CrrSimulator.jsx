import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const THEME = {
  cardBg: "#ffffff",
  cardBorder: "#e2e8f0",
  textPrimary: "#1f2933",
  textMuted: "#5f6c7b",
  accent: "#0ea5e9",
  neutral: "#eef2f7",
  toggleOff: "#d1d5db",
  tooltipBg: "#ffffff",
  tooltipBorder: "#d1d5db",
  chartGrid: "#e5e7eb",
  chartAxis: "#475467",
};

function Card({ children, className = "" }) {
  return (
    <div
      className={className}
      style={{
        borderRadius: 18,
        border: `1px solid ${THEME.cardBorder}`,
        background: THEME.cardBg,
        boxShadow: "0 12px 24px rgba(15, 23, 42, 0.08)",
      }}
    >
      {children}
    </div>
  );
}
function CardHeader({ title, subtitle }) {
  return (
    <div style={{ padding: "20px 24px 12px", borderBottom: `1px solid ${THEME.cardBorder}` }}>
      <h2 style={{ fontSize: "1.05rem", margin: 0, color: THEME.textPrimary }}>{title}</h2>
      {subtitle && (
        <p style={{ fontSize: "0.85rem", color: THEME.textMuted, margin: "6px 0 0" }}>{subtitle}</p>
      )}
    </div>
  );
}
function CardContent({ children, className = "" }) {
  return (
    <div className={className} style={{ padding: 24 }}>
      {children}
    </div>
  );
}
function Label({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} style={{ fontSize: "0.85rem", color: THEME.textMuted, fontWeight: 600 }}>
      {children}
    </label>
  );
}
function NumberInput({ id, value, step = 0.0001, onChange, min, max, suffix, disabled }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        step={step}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: 140,
          borderRadius: 14,
          border: `1px solid ${THEME.cardBorder}`,
          padding: "8px 12px",
          fontSize: "0.95rem",
          color: THEME.textPrimary,
          background: disabled ? "#f4f6fb" : "#fff",
          opacity: disabled ? 0.7 : 1,
        }}
      />
      {suffix && <span style={{ color: THEME.textMuted, fontSize: "0.8rem" }}>{suffix}</span>}
    </div>
  );
}
function Switch({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        height: 24,
        width: 42,
        borderRadius: 999,
        background: checked ? THEME.accent : THEME.toggleOff,
        border: "none",
        padding: 0,
        position: "relative",
        cursor: "pointer",
        transition: "background 0.2s ease",
      }}
      aria-pressed={checked}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 22 : 3,
          height: 18,
          width: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s ease",
          boxShadow: "0 2px 4px rgba(15, 23, 42, 0.3)",
        }}
      />
    </button>
  );
}

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });
const formatPowerValue = (value) => `${value.toFixed(2)} W`;

const SAMPLE_POINTS = 240;
const BASE_HYSTERESIS_A = 0.012;
const G = 9.80665;
const BASE_RIM_RADIUS_M = 0.622 / 2; // 700C bead seat diameter
const BASELINE_PARAMS = {
  B: 0.004,
  D: 0.002,
  p0: 6.0,
  gamma: 1.8,
  speedKph: 30,
  massKg: 65,
  pMin: 3.0,
  pMax: 9.0,
  tireWidthMm: 28,
  kappa: 0.015,
};
const SIM_DEFAULTS = {
  ...BASELINE_PARAMS,
  A: BASE_HYSTERESIS_A,
  manualA: BASE_HYSTERESIS_A,
  useAutoA: true,
};
const FORM_DEFAULTS = {
  ...BASELINE_PARAMS,
  manualA: BASE_HYSTERESIS_A,
};

const cloneSimDefaults = () => ({ ...SIM_DEFAULTS });
const toFormDefaults = () => {
  const pairs = Object.entries(FORM_DEFAULTS).map(([k, v]) => [k, String(v)]);
  return Object.fromEntries(pairs);
};
const parseParams = (formState) => {
  const out = {};
  for (const key of Object.keys(FORM_DEFAULTS)) {
    const raw = formState[key];
    const trimmed = typeof raw === "string" ? raw.trim() : raw;
    const parsed = trimmed === "" ? Number.NaN : Number(trimmed);
    out[key] = Number.isFinite(parsed) ? parsed : FORM_DEFAULTS[key];
  }
  return out;
};

const clampPositive = (value, fallback) => {
  if (Number.isFinite(value) && value > 0) return value;
  return fallback;
};

const effectiveRadiusFromWidth = (widthMm) => {
  const widthM = clampPositive(widthMm, FORM_DEFAULTS.tireWidthMm) / 1000;
  return BASE_RIM_RADIUS_M + widthM / 2; // tire radius ≈ width/2
};

function computeAutoA(params) {
  const widthMm = clampPositive(params.tireWidthMm, FORM_DEFAULTS.tireWidthMm);
  const widthM = widthMm / 1000;
  const mass = clampPositive(params.massKg, FORM_DEFAULTS.massKg);
  const radius = effectiveRadiusFromWidth(widthMm);
  const kappa = clampPositive(params.kappa, FORM_DEFAULTS.kappa);
  const normalForce = mass * G;
  const autoA = (kappa * normalForce) / (widthM * radius * 1e5);
  return Number(autoA.toFixed(6));
}

function useCurveData(params, showComponents) {
  const { A, B, D, p0, gamma, pMin, pMax, massKg, speedKph } = params;
  return useMemo(() => {
    const out = [];
    const speedMps = clampPositive(speedKph, FORM_DEFAULTS.speedKph) / 3.6;
    const powerScale = clampPositive(massKg, FORM_DEFAULTS.massKg) * G * speedMps;
    for (let i = 0; i < SAMPLE_POINTS; i++) {
      const p = pMin + (i * (pMax - pMin)) / (SAMPLE_POINTS - 1);
      const cH = A / p + B;
      const cI = D * Math.pow(p / p0, gamma);
      const cT = cH + cI;
      const row = { p, total: cT * powerScale };
      if (showComponents.hyst) row.hysteresis = cH * powerScale;
      if (showComponents.imp) row.impact = cI * powerScale;
      out.push(row);
    }
    return out;
  }, [A, B, D, p0, gamma, pMin, pMax, massKg, speedKph, showComponents.hyst, showComponents.imp]);
}

export default function CrrSimulator() {
  const [formParams, setFormParams] = useState(() => toFormDefaults());
  const [simParams, setSimParams] = useState(() => cloneSimDefaults());
  const [showHyst, setShowHyst] = useState(true);
  const [showImp, setShowImp] = useState(true);
  const [chartWidth, setChartWidth] = useState(420);
  const [useAutoA, setUseAutoA] = useState(true);

  const handleParamChange = (key) => (value) => {
    setFormParams((prev) => ({ ...prev, [key]: value }));
  };

  const parsedForm = useMemo(() => parseParams(formParams), [formParams]);
  const previewAutoA = useMemo(() => computeAutoA(parsedForm), [parsedForm]);
  const previewResolvedA = useMemo(
    () => (useAutoA ? previewAutoA : parsedForm.manualA),
    [useAutoA, previewAutoA, parsedForm.manualA]
  );

  const applyParams = () => {
    setSimParams({ ...parsedForm, A: previewResolvedA, derivedA: previewAutoA, useAutoA });
  };

  const data = useCurveData(simParams, { hyst: showHyst, imp: showImp });
  const widthComparison = useMemo(() => {
    const offsets = [-2, 0, 2];
    const speedMps = clampPositive(simParams.speedKph, FORM_DEFAULTS.speedKph) / 3.6;
    const powerScale = clampPositive(simParams.massKg, FORM_DEFAULTS.massKg) * G * speedMps;
    const variants = offsets.map((offset, idx) => {
      const width = Math.max(10, simParams.tireWidthMm + offset);
      const derivedA = computeAutoA({ ...simParams, tireWidthMm: width });
      return { key: `widthVariant${idx}`, label: `${width.toFixed(1)} mm`, widthMm: width, A: derivedA };
    });
    const rows = [];
    for (let i = 0; i < SAMPLE_POINTS; i++) {
      const p = simParams.pMin + (i * (simParams.pMax - simParams.pMin)) / (SAMPLE_POINTS - 1);
      const row = { p };
      variants.forEach((variant) => {
        const cH = variant.A / p + simParams.B;
        const cI = simParams.D * Math.pow(p / simParams.p0, simParams.gamma);
        row[variant.key] = (cH + cI) * powerScale;
      });
      rows.push(row);
    }
    return { rows, variants };
  }, [simParams]);

  const reset = () => {
    setFormParams(toFormDefaults());
    setSimParams(cloneSimDefaults());
    setShowHyst(true);
    setShowImp(true);
    setUseAutoA(true);
    setChartWidth(420);
  };

  const crrAtP0 = useMemo(() => {
    const { A, B, D, p0, gamma } = simParams;
    return A / p0 + B + D * Math.pow(1, gamma);
  }, [simParams]);
  const powerAtP0 = useMemo(() => {
    const mass = clampPositive(simParams.massKg, FORM_DEFAULTS.massKg);
    const speedMps = clampPositive(simParams.speedKph, FORM_DEFAULTS.speedKph) / 3.6;
    return crrAtP0 * mass * G * speedMps;
  }, [crrAtP0, simParams.massKg, simParams.speedKph]);
  const appliedA = simParams.A ?? previewResolvedA;
  const appliedASourceLabel = simParams.useAutoA ? "自動" : "手動";

  const fieldStackStyle = { display: "flex", flexDirection: "column", gap: 6 };
  const formGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  };
  const toggleLabelStyle = { fontSize: "0.8rem", color: THEME.textMuted };
  const buttonBaseStyle = {
    border: "none",
    borderRadius: 12,
    fontSize: "0.85rem",
    fontWeight: 600,
    padding: "10px 18px",
    cursor: "pointer",
  };
  const ASPECT = 1.2;
  const MIN_CHART_WIDTH = 260;
  const MAX_CHART_WIDTH = 920;
  const resizeState = useRef({ active: false, startX: 0, startWidth: 0 });

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const handlePointerMove = useCallback((event) => {
    if (!resizeState.current.active) return;
    const deltaX = event.clientX - resizeState.current.startX;
    const nextWidth = clamp(resizeState.current.startWidth + deltaX, MIN_CHART_WIDTH, MAX_CHART_WIDTH);
    setChartWidth(nextWidth);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!resizeState.current.active) return;
    resizeState.current.active = false;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove]);

  const startResize = (event) => {
    event.preventDefault();
    resizeState.current = { active: true, startX: event.clientX, startWidth: chartWidth };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const chartHeight = chartWidth / ASPECT;

  return (
    <div style={{ width: "100%", minHeight: "80vh" }}>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 24,
        }}
      >
        <Card>
          <CardHeader title="パラメータ" subtitle="モデル: Crr(p) = A/p + B + D·(p/p0)^γ" />
          <CardContent>
            <div style={formGridStyle}>
              <div style={fieldStackStyle}>
                <Label htmlFor="tireWidth">タイヤ太さ (mm)</Label>
                <NumberInput
                  id="tireWidth"
                  value={formParams.tireWidthMm}
                  step={0.5}
                  onChange={handleParamChange("tireWidthMm")}
                  suffix="mm"
                />
              </div>
              <div style={{ ...fieldStackStyle, gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <Label htmlFor="A">A (ヒステリシス係数)</Label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: THEME.textMuted }}>
                    <input
                      type="checkbox"
                      checked={useAutoA}
                      onChange={(e) => setUseAutoA(e.target.checked)}
                      style={{ accentColor: THEME.accent }}
                    />
                    自動算出
                  </label>
                </div>
                <NumberInput
                  id="A"
                  value={formParams.manualA}
                  step={0.0005}
                  onChange={handleParamChange("manualA")}
                  disabled={useAutoA}
                />
                <span style={{ fontSize: "0.78rem", color: THEME.textMuted }}>
                  推定 A = {fmt.format(previewAutoA)} （A ≈ κ·N/(w·R)/10⁵）
                </span>
              </div>
              <div style={{ ...fieldStackStyle, gap: 8 }}>
                <Label htmlFor="kappa">κ (材料・構造係数)</Label>
                <NumberInput id="kappa" value={formParams.kappa} step={0.001} onChange={handleParamChange("kappa")} />
                <span style={{ fontSize: "0.78rem", color: THEME.textMuted }}>
                  tanδ やカーカス損失をまとめた係数（0.01〜0.05 目安）
                </span>
              </div>
              <div style={fieldStackStyle}>
                <Label htmlFor="B">B (high-pressure floor)</Label>
                <NumberInput id="B" value={formParams.B} step={0.0001} onChange={handleParamChange("B")} />
              </div>
              <div style={fieldStackStyle}>
                <Label htmlFor="D">D (impact magnitude @ p0)</Label>
                <NumberInput id="D" value={formParams.D} step={0.00005} onChange={handleParamChange("D")} />
              </div>
              <div style={fieldStackStyle}>
                <Label htmlFor="p0">p0 (bar)</Label>
                <NumberInput id="p0" value={formParams.p0} step={0.1} onChange={handleParamChange("p0")} />
              </div>
              <div style={fieldStackStyle}>
                <Label htmlFor="gamma">γ (impact exponent)</Label>
                <NumberInput id="gamma" value={formParams.gamma} step={0.1} onChange={handleParamChange("gamma")} />
              </div>
              <div style={fieldStackStyle}>
                <Label htmlFor="speed">速度 (km/h)</Label>
                <NumberInput id="speed" value={formParams.speedKph} step={1} onChange={handleParamChange("speedKph")} />
              </div>
              <div style={fieldStackStyle}>
                <Label htmlFor="mass">mass (kg: rider+bike)</Label>
                <NumberInput id="mass" value={formParams.massKg} step={1} onChange={handleParamChange("massKg")} />
              </div>
              <div style={fieldStackStyle}>
                <Label htmlFor="pmin">p_min (bar)</Label>
                <NumberInput id="pmin" value={formParams.pMin} step={0.1} onChange={handleParamChange("pMin")} />
              </div>
              <div style={fieldStackStyle}>
                <Label htmlFor="pmax">p_max (bar)</Label>
                <NumberInput id="pmax" value={formParams.pMax} step={0.1} onChange={handleParamChange("pMax")} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 18, paddingTop: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={toggleLabelStyle}>Hysteresis</span>
                <Switch checked={showHyst} onChange={setShowHyst} />
                <span style={toggleLabelStyle}>Impact</span>
                <Switch checked={showImp} onChange={setShowImp} />
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={reset}
                  style={{ ...buttonBaseStyle, background: THEME.neutral, color: THEME.textPrimary }}
                >
                  Reset defaults
                </button>
                <button
                  onClick={applyParams}
                  style={{ ...buttonBaseStyle, background: THEME.accent, color: "#fff" }}
                >
                  実行
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12, fontSize: "0.8rem", color: THEME.textMuted, lineHeight: 1.6 }}>
              <p style={{ margin: 0 }}>
                参考：p = p0 での Crr = {fmt.format(crrAtP0)}、P = {formatPowerValue(powerAtP0)}。
              </p>
              <p style={{ margin: "6px 0 0" }}>現在の A = {fmt.format(appliedA)} （{appliedASourceLabel}）</p>
              <p style={{ margin: "6px 0 0" }}>
                自動算出モードでは A ≈ κ·N/(w·R)/10⁵（N = m·g, w[m], R=700Cベース半径+ w/2）を使用し、質量とタイヤ太さから有効半径を推定しています。
              </p>
              <p style={{ marginTop: 6 }}>
                目的に応じて A/B はタイヤ構造、D/γ は路面粗さ・速度の影響として調整してください。
              </p>
              <p style={{ marginTop: 6 }}>
                下段の比較グラフでは、現在の幅に ±2mm のオフセットを与えたときの rolling loss 変化を同条件で可視化しています。
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Rolling Loss vs. Pressure"
            subtitle={`P(p) = (A/p + B + D·(p/p0)^γ) · N · v   |   speed=${simParams.speedKph} km/h, mass=${simParams.massKg} kg, A=${fmt.format(appliedA)} (${appliedASourceLabel})`}
          />
          <CardContent>
            <div className="chart-shell" style={{ width: "100%", maxWidth: chartWidth, margin: "0 auto" }}>
              <div style={{ position: "relative" }}>
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={THEME.chartGrid} />
                  <XAxis
                    dataKey="p"
                    type="number"
                    domain={[simParams.pMin, simParams.pMax]}
                    tick={{ fill: THEME.chartAxis, fontSize: 12 }}
                    tickFormatter={(v) => `${v.toFixed(1)}`}
                    label={{ value: "Pressure [bar]", position: "insideBottomRight", offset: -2, fill: THEME.chartAxis }}
                  />
                  <YAxis
                    tick={{ fill: THEME.chartAxis, fontSize: 12 }}
                    width={80}
                    tickFormatter={(v) => v.toFixed(1)}
                    label={{ value: "Rolling loss [W]", angle: -90, position: "insideLeft", fill: THEME.chartAxis }}
                  />
                  <Tooltip
                    contentStyle={{ background: THEME.tooltipBg, border: `1px solid ${THEME.tooltipBorder}`, borderRadius: 12 }}
                    labelStyle={{ color: THEME.textPrimary }}
                    formatter={(val, name) => [formatPowerValue(Number(val)), name]}
                    labelFormatter={(v) => `p = ${Number(v).toFixed(2)} bar`}
                  />
                  <Legend wrapperStyle={{ color: THEME.textPrimary }} />
                  {showHyst && (
                    <Line
                      dot={false}
                      type="monotone"
                      dataKey="hysteresis"
                      strokeWidth={2}
                      stroke="#f97316"
                      name="Hysteresis power"
                    />
                  )}
                  {showImp && (
                    <Line
                      dot={false}
                      type="monotone"
                      dataKey="impact"
                      strokeWidth={2}
                      stroke="#6366f1"
                      name="Impact power"
                    />
                  )}
                    <Line
                      dot={false}
                      type="monotone"
                      dataKey="total"
                      strokeWidth={3}
                      stroke={THEME.accent}
                      name="Total power"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div
                  onPointerDown={startResize}
                  style={{
                    position: "absolute",
                    right: 6,
                    bottom: 6,
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: THEME.accent,
                    cursor: "nwse-resize",
                    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.2)",
                  }}
                  aria-label="グラフサイズを変更"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="幅 ±2mm の Rolling Loss 比較"
            subtitle="同じ条件でタイヤ太さを ±2mm オフセットした場合の total rolling loss"
          />
          <CardContent>
            <div className="chart-shell" style={{ width: "100%", maxWidth: chartWidth, margin: "0 auto" }}>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart data={widthComparison.rows} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={THEME.chartGrid} />
                  <XAxis
                    dataKey="p"
                    type="number"
                    domain={[simParams.pMin, simParams.pMax]}
                    tick={{ fill: THEME.chartAxis, fontSize: 12 }}
                    tickFormatter={(v) => `${v.toFixed(1)}`}
                    label={{ value: "Pressure [bar]", position: "insideBottomRight", offset: -2, fill: THEME.chartAxis }}
                  />
                  <YAxis
                    tick={{ fill: THEME.chartAxis, fontSize: 12 }}
                    width={80}
                    tickFormatter={(v) => v.toFixed(1)}
                    label={{ value: "Rolling loss [W]", angle: -90, position: "insideLeft", fill: THEME.chartAxis }}
                  />
                  <Tooltip
                    contentStyle={{ background: THEME.tooltipBg, border: `1px solid ${THEME.tooltipBorder}`, borderRadius: 12 }}
                    labelStyle={{ color: THEME.textPrimary }}
                    formatter={(val, name) => [formatPowerValue(Number(val)), name]}
                    labelFormatter={(v) => `p = ${Number(v).toFixed(2)} bar`}
                  />
                  <Legend wrapperStyle={{ color: THEME.textPrimary }} />
                  {widthComparison.variants.map((variant, idx) => {
                    const colors = ["#f43f5e", "#0ea5e9", "#22c55e"];
                    return (
                      <Line
                        key={variant.key}
                        dot={false}
                        type="monotone"
                        dataKey={variant.key}
                        strokeWidth={3}
                        stroke={colors[idx % colors.length]}
                        name={`w=${variant.label}`}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div style={{ maxWidth: 1100, margin: "24px auto 0", fontSize: "0.85rem", color: THEME.textMuted, lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>
          * このアプリは現象論モデルです。粗い路（チップシールやグラベル）・高速域では、
          係数 D と指数 γ を大きめにすると実測に近づくことがあります。自己発熱の温度依存や
          チューブ/ケーシング差、空力は含めていません。
        </p>
      </div>
    </div>
  );
}
