"use client";

import { useState, useEffect } from "react";
import { plans } from "../plan";

// ---------- 日期工具 ----------
function pad(n: number) { return String(n).padStart(2, "0"); }
function toStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return toStr(new Date()); }
function addDaysStr(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toStr(new Date(y, m - 1, d + n));
}
function diffDaysStr(a: string, b: string) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000);
}
function todayText() {
  const d = new Date();
  const week = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getMonth() + 1}月${d.getDate()}日 · 周${week[d.getDay()]}`;
}

// ---------- 训练计划状态 ----------
type HistoryEntry = { date: string; day: "A" | "B"; done: string[] };
type Defer = { date: string; day: "A" | "B" };
type PlanState = { history: HistoryEntry[]; defer: Defer | null; started: boolean };

type TodayStatus =
  | { kind: "first" }
  | { kind: "train"; day: "A" | "B" }
  | { kind: "done"; day: "A" | "B" }
  | { kind: "rest"; nextDate: string; nextDay: "A" | "B" };

const flip = (d: "A" | "B"): "A" | "B" => (d === "A" ? "B" : "A");

// ---------- 训练节奏：周一/三/五训练，A/B 交替 ----------
function weekday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=周日 1=周一 ... 6=周六
}
function isTrainDay(dateStr: string): boolean {
  const wd = weekday(dateStr);
  return wd === 1 || wd === 3 || wd === 5;
}
function nextTrainDate(dateStr: string): string {
  for (let i = 1; i <= 4; i++) {
    const nd = addDaysStr(dateStr, i);
    if (isTrainDay(nd)) return nd;
  }
  return addDaysStr(dateStr, 1);
}
// from 之后（不含）到 to 之前（不含）之间的训练日数量
function trainDaysBetween(from: string, to: string): number {
  let count = 0;
  for (let i = 1; i < diffDaysStr(from, to); i++) {
    if (isTrainDay(addDaysStr(from, i))) count++;
  }
  return count;
}
// prev 之后第 (n+1) 个训练日该练什么（n 为中间训练日数）
function dayFor(prev: HistoryEntry | null, dateStr: string): "A" | "B" {
  if (!prev) return "A";
  return (trainDaysBetween(prev.date, dateStr) % 2 === 0) ? flip(prev.day) : prev.day;
}

function sortHistory(history: HistoryEntry[]) {
  return [...history].sort((a, b) => a.date.localeCompare(b.date));
}

function computeDay(history: HistoryEntry[], defer: Defer | null, started: boolean, dateStr: string): TodayStatus {
  if (defer) {
    const d = diffDaysStr(defer.date, dateStr);
    if (d >= 0) return { kind: "train", day: defer.day };
    return { kind: "rest", nextDate: defer.date, nextDay: defer.day };
  }
  const sorted = sortHistory(history);
  const last = sorted.length ? sorted[sorted.length - 1] : null;
  if (!last) return started ? { kind: "train", day: "A" } : { kind: "first" };
  if (last.date === dateStr) return { kind: "done", day: last.day };
  if (isTrainDay(dateStr)) {
    return { kind: "train", day: dayFor(last, dateStr) };
  }
  const nd = nextTrainDate(dateStr);
  return { kind: "rest", nextDate: nd, nextDay: dayFor(last, nd) };
}

// ---------- 日历格子状态 ----------
type CellStatus =
  | { type: "done"; day: "A" | "B" }
  | { type: "rest" }
  | { type: "miss"; day: "A" | "B" }
  | { type: "pending"; day: "A" | "B" }
  | { type: "plan"; day: "A" | "B" }
  | { type: "none" };

function classifyDate(history: HistoryEntry[], dateStr: string): CellStatus {
  const entry = history.find((h) => h.date === dateStr);
  if (entry) return { type: "done", day: entry.day };
  const today = todayStr();
  const sorted = sortHistory(history);
  if (!sorted.length) {
    return dateStr === today ? { type: "pending", day: "A" } : { type: "none" };
  }
  let prev: HistoryEntry | undefined;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].date < dateStr) { prev = sorted[i]; break; }
  }
  if (!prev) return { type: "none" };
  if (!isTrainDay(dateStr)) return { type: "rest" };
  const day = dayFor(prev, dateStr);
  if (dateStr < today) return { type: "miss", day };
  if (dateStr === today) return { type: "pending", day };
  return { type: "plan", day };
}

function monthStats(history: HistoryEntry[], year: number, month: number) {
  let done = 0, miss = 0, rest = 0;
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const st = classifyDate(history, toStr(new Date(year, month, d)));
    if (st.type === "done") done++;
    else if (st.type === "miss") miss++;
    else if (st.type === "rest") rest++;
  }
  return { done, miss, rest };
}

// ---------- 日历 ----------
function formatShort(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const week = ["日", "一", "二", "三", "四", "五", "六"];
  return { wd: week[new Date(y, m - 1, d).getDay()], d };
}

function Calendar({ history, onBackfill }: { history: HistoryEntry[]; onBackfill: (date: string) => void }) {
  const [view, setView] = useState<"week" | "month" | "year">("week");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based

  const today = todayStr();
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysStr(today, i - 6));

  const firstWd = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthDates: (string | null)[] = [
    ...Array.from({ length: firstWd }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toStr(new Date(year, month, i + 1))),
  ];

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function renderCell(dateStr: string) {
    const st = classifyDate(history, dateStr);
    const { wd, d } = formatShort(dateStr);
    const isToday = dateStr === today;
    let label = "";
    let cls = "none";
    if (st.type === "done") { label = st.day; cls = st.day === "A" ? "a" : "b"; }
    else if (st.type === "rest") { label = "休"; cls = "rest"; }
    else if (st.type === "miss") { label = "缺"; cls = "miss"; }
    else if (st.type === "pending") { label = st.day; cls = "pending"; }
    else if (st.type === "plan") { label = st.day; cls = "plan"; }
    const clickable = st.type === "miss" || st.type === "done";
    return (
      <div
        key={dateStr}
        className={`cal-cell ${isToday ? "cal-today" : ""} ${clickable ? "clickable" : ""}`}
        onClick={clickable ? () => onBackfill(dateStr) : undefined}
      >
        <div className="cal-wd">{wd}</div>
        <div className={`cal-d cal-${cls}`}>{d}</div>
        <div className="cal-mark">{label}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="cal-tabs">
        {(["week", "month", "year"] as const).map((v) => (
          <button key={v} className={`cal-tab ${view === v ? "active" : ""}`} onClick={() => setView(v)}>
            {v === "week" ? "周" : v === "month" ? "月" : "年"}
          </button>
        ))}
      </div>

      {view === "week" && <div className="calendar">{weekDates.map((d) => renderCell(d))}</div>}

      {view === "month" && (
        <>
          <div className="cal-nav">
            <button onClick={() => shiftMonth(-1)}>‹</button>
            <span>{year}年{month + 1}月</span>
            <button onClick={() => shiftMonth(1)}>›</button>
          </div>
          <div className="calendar cal-month">
            {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
              <div key={w} className="cal-wd-head">{w}</div>
            ))}
            {monthDates.map((d, i) => (d ? renderCell(d) : <div key={`e${i}`} className="cal-empty" />))}
          </div>
          <MonthStats history={history} year={year} month={month} />
        </>
      )}

      {view === "year" && (
        <>
          <div className="cal-nav">
            <button onClick={() => setYear(year - 1)}>‹</button>
            <span>{year}年</span>
            <button onClick={() => setYear(year + 1)}>›</button>
          </div>
          <div className="year-grid">
            {Array.from({ length: 12 }, (_, i) => {
              const st = monthStats(history, year, i);
              const isFuture = year > now.getFullYear() || (year === now.getFullYear() && i > now.getMonth());
              return (
                <div key={i} className="year-cell" onClick={() => { setMonth(i); setView("month"); }}>
                  <div className="year-m">{i + 1}月</div>
                  <div className="year-s">{isFuture ? "—" : `✓${st.done} · 缺${st.miss}`}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MonthStats({ history, year, month }: { history: HistoryEntry[]; year: number; month: number }) {
  const st = monthStats(history, year, month);
  return (
    <div className="month-stats">
      <span>打卡 <b>{st.done}</b> 天</span>
      <span>缺勤 <b>{st.miss}</b> 天</span>
      <span>休息 <b>{st.rest}</b> 天</span>
    </div>
  );
}

export default function Home() {
  const [planState, setPlanState] = useState<PlanState>({ history: [], defer: null, started: false });
  const [done, setDone] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [finished, setFinished] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [backfillDate, setBackfillDate] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // 水合后恢复
  useEffect(() => {
    try {
      const t = localStorage.getItem("fitness-theme");
      if (t === "dark" || t === "light") setTheme(t);
      const p = localStorage.getItem("fitness-plan");
      if (p) {
        const data = JSON.parse(p);
        setPlanState({ history: data.history || [], defer: data.defer || null, started: !!data.started });
      }
      const s = localStorage.getItem("fitness-done");
      if (s) {
        const data = JSON.parse(s);
        if (data.date === todayStr()) setDone(data.done || []);
      }
    } catch {}
    setLoaded(true);
  }, []);

  // 持久化
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("fitness-theme", theme);
    localStorage.setItem("fitness-plan", JSON.stringify(planState));
  }, [loaded, theme, planState]);
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("fitness-done", JSON.stringify({ date: todayStr(), done }));
  }, [loaded, done]);

  const today = computeDay(planState.history, planState.defer, planState.started, todayStr());
  const tomorrow = computeDay(planState.history, planState.defer, planState.started, addDaysStr(todayStr(), 1));
  const tomorrowText =
    tomorrow.kind === "rest" ? "明天 · 休息"
    : tomorrow.kind === "train" ? `明天 · ${tomorrow.day}日`
    : "";

  const curDay: "A" | "B" = today.kind === "train" ? today.day : today.kind === "done" ? today.day : "A";
  const plan = plans[curDay];
  const todayDone = today.kind === "done"
    ? planState.history.find((h) => h.date === todayStr())?.done || []
    : done;

  function complete() {
    const entry = { date: todayStr(), day: curDay, done };
    const history = [...planState.history.filter((h) => h.date !== todayStr()), entry];
    setPlanState({ history, defer: null, started: true });
    setDone([]);
    setFinished(true);
  }

  function deferToday() {
    setPlanState({ ...planState, defer: { date: addDaysStr(todayStr(), 1), day: curDay } });
  }

  function initHistory(dateStr: string, d: "A" | "B" | null) {
    const history = d ? [{ date: dateStr, day: d, done: [] }] : [];
    setPlanState({ history, defer: null, started: true });
  }

  function backfill(dateStr: string, day: "A" | "B") {
    const history = sortHistory([
      ...planState.history.filter((h) => h.date !== dateStr),
      { date: dateStr, day, done: [] },
    ]);
    setPlanState({ history, defer: null, started: true });
    setDone([]);
    setBackfillDate(null);
  }

  function removeEntry(dateStr: string) {
    setPlanState({ ...planState, history: planState.history.filter((h) => h.date !== dateStr) });
    setBackfillDate(null);
  }

  function toggle(name: string) {
    setDone((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  function renderTips(tips: string[]) {
    return (
      <div className="detail">
        <ul>
          {tips.map((t, i) => (
            <li key={i} className={t.includes("别") ? "warn" : ""}>{t}</li>
          ))}
        </ul>
      </div>
    );
  }

  function renderRoutine(secs: { title: string; items: { name: string; sets: string; tips: string[] }[] }[], prefix: string) {
    return secs.map((sec, si) => (
      <div key={sec.title}>
        <div className="section-sub">{sec.title}</div>
        {sec.items.map((item, ii) => {
          const k = `${prefix}:${si}:${ii}`;
          return (
            <div key={k} className="card routine">
              <div className="card-top" onClick={() => setOpen(open === k ? null : k)}>
                <span className="ex-name">{item.name}</span>
                <span className="sets">{item.sets}</span>
              </div>
              {open === k && renderTips(item.tips)}
            </div>
          );
        })}
      </div>
    ));
  }

  const isTraining = today.kind === "train";
  const isDone = today.kind === "done";
  const existing = backfillDate ? planState.history.find((h) => h.date === backfillDate) : undefined;

  return (
    <main className="phone">
      <div className="topbar">
        <div className="top-date">{todayText()}</div>
        <button className="theme-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>

      {today.kind === "first" && (
        <div className="onboard">
          <div className="onboard-title">上次训练是？</div>
          <div className="onboard-sub">告诉我上次练了什么，我好按周一/三/五算今天该干嘛</div>
          <button className="btn" onClick={() => initHistory(addDaysStr(todayStr(), -1), "A")}>昨天练了 A 日</button>
          <button className="btn ghost" onClick={() => initHistory(addDaysStr(todayStr(), -1), "B")}>昨天练了 B 日</button>
          <button className="btn ghost" onClick={() => initHistory(todayStr(), null)}>今天第一次练</button>
        </div>
      )}

      {today.kind === "rest" && (
        <div className="rest-view">
          <div className="today">今天休息</div>
          <div className="sub">下次训练 · {today.nextDate.slice(5).replace("-", "月")}日 · {today.nextDay}日</div>
          <div className="calendar-wrap">
            <Calendar history={planState.history} onBackfill={(d) => setBackfillDate(d)} />
          </div>
        </div>
      )}

      {(isTraining || isDone) && (
        <>
          <div className="today">{isDone ? "今天已完成" : `今天 · ${plan.name}`}</div>
          <div className="sub">{plan.focus} · {plan.exercises.length} 个动作</div>
          {tomorrowText && <div className="next-hint">{tomorrowText}</div>}

          <div className="progress-label">已完成 {todayDone.length} / {plan.exercises.length}</div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${(todayDone.length / plan.exercises.length) * 100}%` }} /></div>

          <div className="calendar-wrap">
            <Calendar history={planState.history} onBackfill={(d) => setBackfillDate(d)} />
          </div>

          <div className="section-head">热身</div>
          {renderRoutine(plan.warmup, "wu")}

          <div className="section-head">正式动作</div>
          {plan.exercises.map((ex) => {
            const k = `ex:${ex.name}`;
            const checked = todayDone.includes(ex.name);
            return (
              <div key={k} className={`card ${open === k ? "open" : ""} ${checked ? "done" : ""}`}>
                <div className="card-top" onClick={() => setOpen(open === k ? null : k)}>
                  <span className="check" onClick={(e) => { if (isDone) return; e.stopPropagation(); toggle(ex.name); }}>
                    {checked && <svg viewBox="0 0 24 24" fill="none" stroke="#06230f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                  </span>
                  <span className="ex-name">{ex.name}</span>
                  <span className="sets">{ex.sets}</span>
                </div>
                <div className="machine">{ex.machine}</div>
                {open === k && renderTips(ex.tips)}
              </div>
            );
          })}

          <div className="section-head">拉伸</div>
          {renderRoutine(plan.stretch, "st")}

          <div className="footer">
            {isTraining && (
              <button className="btn" disabled={todayDone.length < plan.exercises.length} onClick={complete}>
                完成训练
              </button>
            )}
            {isTraining && (
              <button className="btn ghost" onClick={deferToday}>今天不练，推迟一天</button>
            )}
            {isDone && <div className="done-note">今天的训练已完成 ✓</div>}
            <div className="hint">点卡片看要点 · 点圆圈打卡 · 点日历缺勤日补签</div>
          </div>
        </>
      )}

      {finished && (
        <div className="overlay" onClick={() => setFinished(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div className="modal-title">今天训练完成</div>
            <div className="modal-sub">{plan.name} · {plan.exercises.length} 个动作全部完成</div>
            <button className="btn" onClick={() => setFinished(false)}>收工</button>
          </div>
        </div>
      )}

      {backfillDate && (
        <div className="overlay" onClick={() => setBackfillDate(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">补签 · {backfillDate.slice(5).replace("-", "月")}日</div>
            {existing ? (
              <>
                <div className="modal-sub">这天已记录为 {existing.day} 日</div>
                <button className="btn ghost" onClick={() => removeEntry(backfillDate)}>删除这次记录</button>
                <button className="btn ghost" onClick={() => setBackfillDate(null)}>取消</button>
              </>
            ) : (
              <>
                <div className="modal-sub">这天你练了哪个？</div>
                <button className="btn" onClick={() => backfill(backfillDate, "A")}>练了 A 日 · {plans.A.focus}</button>
                <button className="btn ghost" onClick={() => backfill(backfillDate, "B")}>练了 B 日 · {plans.B.focus}</button>
                <button className="btn ghost" onClick={() => setBackfillDate(null)}>取消</button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
