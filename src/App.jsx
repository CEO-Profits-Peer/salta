import { useState, useEffect, useCallback, useRef } from "react";
import {
  ERAS, COMPANIES, DECISIONS, RANDOM_EVENTS, TUTORIAL_STEPS,
  getRepLabel, formatMoney, getPassiveIncome
} from "./gameData";
import "./index.css";

// ─── INITIAL STATE ───────────────────────────
const INIT = {
  money: 1000,
  eraIndex: 0,
  rep: 0,
  totalEarned: 0,
  totalActions: 0,
  cooldowns: {},
  log: [],
  event: null,
  decision: null,
  clickCount: 0,
  won: false,
  ownedCompanies: [],
  upgrades: [],
  seenDecisions: [],
  tutorialStep: 0,
  tutorialDone: false,
  incomeMultiplier: 1.0,
  tempDebuff: false,
  decisionEffects: [],
  lastPassiveTick: Date.now(),
  totalPassiveEarned: 0,
};

// ─── GAME HOOK ────────────────────────────────
function useGame() {
  const [state, setState] = useState(() => {
    try {
      const s = localStorage.getItem("corruptocracy_v3");
      return s ? { ...INIT, ...JSON.parse(s) } : INIT;
    } catch { return INIT; }
  });

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const save = { ...state };
    localStorage.setItem("corruptocracy_v3", JSON.stringify(save));
  }, [state]);

  // Passive income tick
  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => {
        const income = getPassiveIncome(COMPANIES, s.ownedCompanies, s.upgrades, s.incomeMultiplier, s.tempDebuff);
        if (income === 0) return s;
        const entry = { text: "Passive Einkommen", amount: income, time: ts(), isPassive: true };
        return {
          ...s,
          money: s.money + income,
          totalEarned: s.totalEarned + income,
          totalPassiveEarned: (s.totalPassiveEarned || 0) + income,
          log: [entry, ...s.log].slice(0, 40),
        };
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Cooldown ticker
  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => {
        const next = {};
        for (const [k, v] of Object.entries(s.cooldowns)) {
          if (v > 1) next[k] = v - 1;
        }
        return { ...s, cooldowns: next };
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Temp debuff clear
  useEffect(() => {
    if (!state.tempDebuff) return;
    const id = setTimeout(() => setState((s) => ({ ...s, tempDebuff: false })), 30000);
    return () => clearTimeout(id);
  }, [state.tempDebuff]);

  const ts = () => new Date().toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });

  const addLog = (s, entry) => ({ ...s, log: [entry, ...s.log].slice(0, 40) });

  const doAction = useCallback((actionId) => {
    setState((s) => {
      const era = ERAS[s.eraIndex];
      const action = era.actions.find((a) => a.id === actionId);
      if (!action || s.money < action.cost || (s.cooldowns[actionId] || 0) > 0) return s;

      // Risk check
      let penalty = 0;
      let riskMsg = null;
      if (action.risk && Math.random() < action.risk.chance) {
        penalty = action.risk.penalty;
        riskMsg = action.risk.msg;
      }

      const net = action.gain - action.cost - penalty;
      const newMoney = s.money + net;
      const newRep = Math.max(-50, s.rep + (action.repEffect || 0));
      const newCD = { ...s.cooldowns };
      if (action.cooldown > 0) newCD[actionId] = action.cooldown;

      const logEntry = riskMsg
        ? { text: `${action.name} — RISIKO: ${riskMsg}`, amount: net, time: ts(), isRisk: true }
        : { text: action.name, amount: net, time: ts() };

      let ns = {
        ...s,
        money: newMoney,
        rep: newRep,
        totalEarned: s.totalEarned + Math.max(0, action.gain),
        totalActions: s.totalActions + 1,
        cooldowns: newCD,
        clickCount: s.clickCount + 1,
      };
      ns = addLog(ns, logEntry);

      // Random event trigger
      if (ns.clickCount % 8 === 0 && Math.random() < 0.65) {
        const pool = RANDOM_EVENTS.filter((e) => {
          if (ns.rep < -20) return true; // bad rep = more danger events
          return e.type !== "danger" || Math.random() < 0.5;
        });
        const ev = pool[Math.floor(Math.random() * pool.length)];
        ns.event = { ...ev, resolvedEffect: ev.effect(ns) };
      }

      // Decision trigger check
      const pending = DECISIONS.find(
        (d) =>
          d.triggerEra === ERAS[ns.eraIndex].id &&
          ns.money >= d.triggerMoney &&
          !ns.seenDecisions.includes(d.id) &&
          !ns.decision
      );
      if (pending) {
        ns.decision = pending;
        ns.seenDecisions = [...ns.seenDecisions, pending.id];
      }

      return ns;
    });
  }, []);

  const doUnlock = useCallback(() => {
    setState((s) => {
      const era = ERAS[s.eraIndex];
      if (!era.unlockCost || s.money < era.unlockCost) return s;
      const newEraIndex = s.eraIndex + 1;
      const newEra = ERAS[newEraIndex];
      const newOwned = [...s.ownedCompanies];
      // Auto-unlock era companies that have unlockCost=0
      if (newEra?.unlocksCompanies) {
        for (const cid of newEra.unlocksCompanies) {
          if (COMPANIES[cid]?.unlockCost === 0 && !newOwned.includes(cid)) {
            newOwned.push(cid);
          }
        }
      }
      const entry = { text: `EPOCHE ${newEraIndex + 1}: ${newEra?.label || "SIEG"}`, amount: -era.unlockCost, time: ts(), isEra: true };
      let ns = { ...s, money: s.money - era.unlockCost, eraIndex: newEraIndex, ownedCompanies: newOwned, won: newEraIndex >= ERAS.length };
      return addLog(ns, entry);
    });
  }, []);

  const buyCompany = useCallback((companyId) => {
    setState((s) => {
      const c = COMPANIES[companyId];
      if (!c || s.ownedCompanies.includes(companyId) || s.money < c.unlockCost) return s;
      const entry = { text: `Gekauft: ${c.name}`, amount: -c.unlockCost, time: ts() };
      let ns = { ...s, money: s.money - c.unlockCost, ownedCompanies: [...s.ownedCompanies, companyId] };
      return addLog(ns, entry);
    });
  }, []);

  const buyUpgrade = useCallback((upgradeId, companyId) => {
    setState((s) => {
      const c = COMPANIES[companyId];
      const u = c?.upgrades.find((x) => x.id === upgradeId);
      if (!u || s.upgrades.includes(upgradeId) || s.money < u.cost) return s;
      const entry = { text: `Upgrade: ${u.name}`, amount: -u.cost, time: ts() };
      let ns = { ...s, money: s.money - u.cost, upgrades: [...s.upgrades, upgradeId] };
      return addLog(ns, entry);
    });
  }, []);

  const resolveEvent = useCallback(() => {
    setState((s) => {
      if (!s.event) return s;
      const fx = s.event.resolvedEffect || {};
      return {
        ...s,
        money: s.money + (fx.money || 0),
        rep: s.rep + (fx.rep || 0),
        tempDebuff: fx.tempDebuff || s.tempDebuff,
        event: null,
      };
    });
  }, []);

  const resolveDecision = useCallback((optionId) => {
    setState((s) => {
      if (!s.decision) return s;
      const opt = s.decision.options.find((o) => o.id === optionId);
      if (!opt) return s;

      let fx = { ...opt.immediate };
      let lt = { ...opt.longterm };
      let flavorMsg = opt.flavor;

      // Handle risky options
      if (opt.isRisky && opt.successRate !== undefined) {
        if (Math.random() < opt.successRate) {
          if (opt.onSuccess) { fx = { ...fx, ...opt.onSuccess }; flavorMsg = opt.onSuccess.flavor || flavorMsg; }
        } else {
          if (opt.onFail) { fx = { ...opt.onFail }; lt = {}; flavorMsg = opt.onFail.flavor || flavorMsg; }
        }
      }

      const entry = { text: `Entscheidung: ${opt.label} — ${flavorMsg}`, amount: fx.money || 0, time: new Date().toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" }), isDecision: true };

      let ns = {
        ...s,
        money: s.money + (fx.money || 0),
        rep: s.rep + (fx.rep || 0),
        incomeMultiplier: s.incomeMultiplier * (lt.incomeMultiplier || 1),
        decision: null,
        decisionEffects: [...s.decisionEffects, { optionId, longterm: lt }],
      };
      return addLog(ns, entry);
    });
  }, []);

  const advanceTutorial = useCallback(() => {
    setState((s) => ({
      ...s,
      tutorialStep: s.tutorialStep + 1,
      tutorialDone: s.tutorialStep + 1 >= TUTORIAL_STEPS.length,
    }));
  }, []);

  const skipTutorial = useCallback(() => {
    setState((s) => ({ ...s, tutorialDone: true, tutorialStep: TUTORIAL_STEPS.length }));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem("corruptocracy_v3");
    setState(INIT);
  }, []);

  return { state, doAction, doUnlock, buyCompany, buyUpgrade, resolveEvent, resolveDecision, advanceTutorial, skipTutorial, reset };
}

// ─── COMPONENTS ──────────────────────────────

function TutorialOverlay({ step, onNext, onSkip }) {
  const t = TUTORIAL_STEPS[step];
  if (!t) return null;
  return (
    <div className="tutorial-overlay">
      <div className="tutorial-card">
        <div className="tutorial-step-label">Tutorial {step + 1} / {TUTORIAL_STEPS.length}</div>
        <div className="tutorial-title">{t.title}</div>
        <div className="tutorial-body">{t.body}</div>
        <div className="tutorial-actions">
          <button className="btn-ghost" onClick={onSkip}>Ueberspringen</button>
          <button className="btn-primary" onClick={onNext}>
            {step + 1 < TUTORIAL_STEPS.length ? "Weiter →" : "Los geht's"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DecisionModal({ decision, onChoose }) {
  if (!decision) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-eyebrow">Strategische Entscheidung</div>
        <div className="modal-title">{decision.title}</div>
        <div className="modal-desc">{decision.desc}</div>
        <div className="modal-options">
          {decision.options.map((opt) => (
            <div
              key={opt.id}
              className={`modal-option ${opt.isRisky ? "risky" : ""}`}
              onClick={() => onChoose(opt.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onChoose(opt.id)}
            >
              <div className="modal-opt-header">
                <span className="modal-opt-label">{opt.label}</span>
                {opt.isRisky && <span className="risk-badge">Riskant</span>}
              </div>
              <div className="modal-opt-desc">{opt.desc}</div>
              {opt.immediate && Object.keys(opt.immediate).length > 0 && (
                <div className="modal-opt-immediate">
                  Sofort:&nbsp;
                  {opt.immediate.money && <span style={{ color: opt.immediate.money > 0 ? "var(--success)" : "var(--danger)" }}>{formatMoney(opt.immediate.money)}</span>}
                  {opt.immediate.rep && <span style={{ color: opt.immediate.rep > 0 ? "var(--success)" : "var(--danger)", marginLeft: 6 }}>Ruf {opt.immediate.rep > 0 ? "+" : ""}{opt.immediate.rep}</span>}
                </div>
              )}
              {opt.longterm && Object.keys(opt.longterm).length > 0 && (
                <div className="modal-opt-lt">
                  Langfristig:&nbsp;
                  {opt.longterm.incomeMultiplier && <span>Einkommen ×{opt.longterm.incomeMultiplier}</span>}
                  {opt.longterm.passiveBonus && <span>+${opt.longterm.passiveBonus}/tick</span>}
                  {opt.longterm.repPenaltyPerEra && <span style={{ color: "var(--danger)" }}>Ruf {opt.longterm.repPenaltyPerEra}/Epoche</span>}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="modal-note">Diese Entscheidung ist permanent und nicht rueckgaengig zu machen.</div>
      </div>
    </div>
  );
}

function EventBanner({ event, onDismiss }) {
  if (!event) return null;
  return (
    <div className={`event-banner ${event.type}`} onClick={onDismiss} role="button" tabIndex={0}>
      <div className="event-title">{event.text}</div>
      <div className="event-detail">{event.detail} &nbsp;·&nbsp; Klicken zum Schliessen</div>
    </div>
  );
}

function CompanyCard({ company, owned, upgrades, money, onBuy, onUpgrade, passive }) {
  const ownedUpgrades = company.upgrades.filter((u) => upgrades.includes(u.id));
  const nextUpgrade = company.upgrades.find((u) => !upgrades.includes(u.id));
  const currentIncome = getPassiveIncome(
    { [company.id]: company },
    owned ? [company.id] : [],
    upgrades, 1, false
  );

  return (
    <div className={`company-card ${owned ? "owned" : "locked"}`}>
      <div className="company-header">
        <span className="company-icon">{company.icon}</span>
        <div>
          <div className="company-name">{company.name}</div>
          <div className="company-income">
            {owned ? `+${formatMoney(currentIncome)} / 5s` : `kostet ${formatMoney(company.unlockCost)}`}
          </div>
        </div>
        {!owned && company.unlockCost > 0 && (
          <button
            className={`btn-buy ${money >= company.unlockCost ? "" : "disabled"}`}
            onClick={() => money >= company.unlockCost && onBuy(company.id)}
            disabled={money < company.unlockCost}
          >
            Kaufen
          </button>
        )}
        {owned && <span className="owned-badge">Aktiv</span>}
      </div>

      {owned && (
        <div className="company-desc">{company.desc}</div>
      )}

      {owned && (
        <div className="upgrades-list">
          {company.upgrades.map((u) => {
            const isOwned = upgrades.includes(u.id);
            const canAfford = money >= u.cost;
            return (
              <div key={u.id} className={`upgrade-row ${isOwned ? "done" : canAfford ? "available" : "expensive"}`}>
                <div className="upgrade-dot">{isOwned ? "✓" : "○"}</div>
                <div className="upgrade-info">
                  <span className="upgrade-name">{u.name}</span>
                  <span className="upgrade-desc">{u.desc}</span>
                </div>
                {!isOwned && (
                  <button
                    className={`btn-upgrade ${canAfford ? "" : "disabled"}`}
                    onClick={() => canAfford && onUpgrade(u.id, company.id)}
                    disabled={!canAfford}
                  >
                    {formatMoney(u.cost)}
                  </button>
                )}
                {isOwned && <span className="upgrade-mult">×{u.incomeMult}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionCard({ action, money, cooldown, onAction }) {
  const locked = money < action.cost;
  const onCD = cooldown > 0;
  const net = action.gain - action.cost;
  const hasRisk = !!action.risk;

  return (
    <div
      className={`action-card ${locked ? "locked" : ""} ${onCD ? "on-cooldown" : ""}`}
      onClick={() => !locked && !onCD && onAction(action.id)}
      role="button"
      tabIndex={locked || onCD ? -1 : 0}
      onKeyDown={(e) => e.key === "Enter" && !locked && !onCD && onAction(action.id)}
    >
      <div className="action-left">
        <div className="action-name">
          {action.name}
          {hasRisk && <span className="risk-dot" title={`${Math.round(action.risk.chance * 100)}% Risiko`}>⚡</span>}
        </div>
        <div className="action-desc">{action.desc}</div>
        {onCD && <div className="action-cooldown">Cooldown: {cooldown} Ticks</div>}
      </div>
      <div className="action-meta">
        <div className={`action-gain ${net >= 0 ? "pos" : "neg"}`}>
          {net >= 0 ? "+" : ""}{formatMoney(net)}
        </div>
        {action.cost > 0 && (
          <div className="action-cost-label">Kosten: {formatMoney(action.cost)}</div>
        )}
        {hasRisk && (
          <div className="action-risk-label">{Math.round(action.risk.chance * 100)}% Risiko</div>
        )}
      </div>
    </div>
  );
}

function UnlockCard({ era, money, onUnlock }) {
  const pct = Math.min(100, Math.round((money / era.unlockCost) * 100));
  const locked = money < era.unlockCost;
  return (
    <div className="unlock-section">
      <div className="unlock-header">
        <span className="unlock-label">Ziel: {era.unlockLabel}</span>
        <span className="unlock-pct">{pct}%</span>
      </div>
      <div className="progress-wrap"><div className="progress-fill" style={{ width: pct + "%" }} /></div>
      <div className="unlock-desc">{era.unlockDesc}</div>
      <button
        className={`btn-unlock ${locked ? "disabled" : ""}`}
        onClick={() => !locked && onUnlock()}
        disabled={locked}
      >
        {locked ? `Noch ${formatMoney(era.unlockCost - money)} fehlen` : `→ ${era.unlockLabel} (${formatMoney(era.unlockCost)})`}
      </button>
    </div>
  );
}

function Ticker({ log }) {
  return (
    <div className="ticker-panel">
      <div className="section-label">Live-Ticker</div>
      {log.length === 0 && <div className="ticker-empty">Noch keine Aktivitaet.</div>}
      {log.map((entry, i) => (
        <div
          key={i}
          className={`ticker-entry ${entry.isPassive ? "passive" : ""} ${entry.isEra ? "era-entry" : ""} ${entry.isDecision ? "decision-entry" : ""} ${entry.isRisk ? "risk-entry" : ""}`}
        >
          <div className="ticker-text">{entry.text}</div>
          {entry.amount !== 0 && (
            <span className={`ticker-amount ${entry.amount > 0 ? "pos" : "neg"}`}>
              {entry.amount > 0 ? "+" : ""}{formatMoney(entry.amount)}
            </span>
          )}
          <div className="ticker-time">{entry.time}</div>
        </div>
      ))}
    </div>
  );
}

function WinScreen({ state, onReset }) {
  return (
    <div className="modal-overlay">
      <div className="win-box">
        <div className="win-title">WELTHERRSCHAFT</div>
        <div className="win-sub">Du hast alles. Und trotzdem reicht es nicht.</div>
        <div className="win-stats">
          {[
            ["Verdient", formatMoney(state.totalEarned)],
            ["Passiv", formatMoney(state.totalPassiveEarned || 0)],
            ["Aktionen", state.totalActions],
            ["Ruf", getRepLabel(state.rep).icon + " " + getRepLabel(state.rep).label],
          ].map(([l, v]) => (
            <div key={l} className="win-stat">
              <div className="win-stat-val">{v}</div>
              <div className="win-stat-label">{l}</div>
            </div>
          ))}
        </div>
        <button className="btn-restart" onClick={onReset}>Von vorne anfangen</button>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────
export default function App() {
  const { state, doAction, doUnlock, buyCompany, buyUpgrade, resolveEvent, resolveDecision, advanceTutorial, skipTutorial, reset } = useGame();
  const [activeTab, setActiveTab] = useState("actions");

  const era = ERAS[state.eraIndex];
  const repInfo = getRepLabel(state.rep);
  const passiveIncome = getPassiveIncome(COMPANIES, state.ownedCompanies, state.upgrades, state.incomeMultiplier, state.tempDebuff);

  // Available companies for this era
  const availableCompanyIds = ERAS
    .slice(0, state.eraIndex + 1)
    .flatMap((e) => e.unlocksCompanies || []);
  const availableCompanies = availableCompanyIds.map((id) => COMPANIES[id]).filter(Boolean);

  return (
    <div className="app">
      {!state.tutorialDone && (
        <TutorialOverlay
          step={state.tutorialStep}
          onNext={advanceTutorial}
          onSkip={skipTutorial}
        />
      )}
      {state.decision && (
        <DecisionModal decision={state.decision} onChoose={resolveDecision} />
      )}
      {state.won && <WinScreen state={state} onReset={reset} />}

      {/* ── HEADER ── */}
      <header className="header">
        <div>
          <div className="header-title font-display">CORRUPTOCRACY</div>
          <div className="header-sub">Hinterhof → FIFA → Weltherrschaft</div>
        </div>
        <div className="header-right">
          <div className="header-money font-mono">{formatMoney(state.money)}</div>
          <div className="header-passive">+{formatMoney(passiveIncome)}/5s</div>
          <button className="btn-reset" onClick={reset} title="Neu starten">↺</button>
        </div>
      </header>

      {/* ── STATS BAR ── */}
      <div className="stats-bar">
        <div className="sbar-item">
          <span className="sbar-label">Epoche</span>
          <span className="sbar-val">{state.eraIndex + 1} / {ERAS.length}</span>
        </div>
        <div className="sbar-item">
          <span className="sbar-label">Ruf</span>
          <span className="sbar-val" style={{ color: repInfo.color }}>{repInfo.icon} {repInfo.label}</span>
        </div>
        <div className="sbar-item">
          <span className="sbar-label">Unternehmen</span>
          <span className="sbar-val">{state.ownedCompanies.length}</span>
        </div>
        <div className="sbar-item">
          <span className="sbar-label">Gesamt</span>
          <span className="sbar-val font-mono">{formatMoney(state.totalEarned)}</span>
        </div>
        <div className="sbar-item era-progress-item">
          <span className="sbar-label">{era?.label}</span>
          <div className="sbar-era-dots">
            {ERAS.map((e, i) => (
              <div key={e.id} className={`era-pip ${i < state.eraIndex ? "done" : i === state.eraIndex ? "active" : ""}`} />
            ))}
          </div>
        </div>
      </div>

      {/* ── EVENT BANNER ── */}
      {state.event && <EventBanner event={state.event} onDismiss={resolveEvent} />}

      {/* ── MAIN ── */}
      <div className="main-layout">
        {/* LEFT: Era intro + Actions */}
        <div className="left-col">
          <div className="era-intro-card">
            <div className="era-intro-label">Epoche {state.eraIndex + 1}</div>
            <div className="era-intro-title">{era?.label}</div>
            <div className="era-intro-body">{era?.intro}</div>
          </div>

          {/* Tab bar */}
          <div className="tab-bar">
            {["actions", "companies"].map((tab) => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "actions" ? "Aktionen" : `Unternehmen (${state.ownedCompanies.length})`}
              </button>
            ))}
          </div>

          {activeTab === "actions" && era && (
            <div className="actions-panel">
              <div className="section-label">Verfuegbare Aktionen</div>
              {era.actions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  money={state.money}
                  cooldown={state.cooldowns[action.id] || 0}
                  onAction={doAction}
                />
              ))}
              {era.unlockCost && (
                <UnlockCard era={era} money={state.money} onUnlock={doUnlock} />
              )}
            </div>
          )}

          {activeTab === "companies" && (
            <div className="companies-panel">
              <div className="section-label">Dein Imperium</div>
              {availableCompanies.length === 0 && (
                <div className="empty-state">Noch keine Unternehmen verfuegbar. Spiele weiter.</div>
              )}
              {availableCompanies.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  owned={state.ownedCompanies.includes(company.id)}
                  upgrades={state.upgrades}
                  money={state.money}
                  passive={passiveIncome}
                  onBuy={buyCompany}
                  onUpgrade={buyUpgrade}
                />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Ticker */}
        <div className="right-col">
          <Ticker log={state.log} />
          {state.decisionEffects.length > 0 && (
            <div className="decisions-history">
              <div className="section-label">Vergangene Entscheidungen</div>
              {state.decisionEffects.map((de, i) => {
                const dec = DECISIONS.find((d) => d.options.some((o) => o.id === de.optionId));
                const opt = dec?.options.find((o) => o.id === de.optionId);
                if (!dec || !opt) return null;
                return (
                  <div key={i} className="dec-history-row">
                    <div className="dec-hist-title">{dec.title}</div>
                    <div className="dec-hist-choice">→ {opt.label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
