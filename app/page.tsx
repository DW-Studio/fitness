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

const flip = (d: "A" | "B") => (d === "A" ? "B" : "A");

function computeToday(history: HistoryEntry[], defer: Defer | null, started: boolean): TodayStatus {
  const today = todayStr();
  if (defer) {
    const d = diffDaysStr(defer.date, today);
    if (d >= 0) return { kind: "train", day: defer.day };
    return { kind: "rest", nextDate: defer.date, nextDay: defer.day };
  }
  const last = history.length ? history[history.length - 1] : null;
  if (!last) return started ? { kind: "train", day: "A" } : { kind: "first" };
  const diff = diffDaysStr(last.date, today);
  if (diff === 0) return { kind: "done", day: last.day };
  if (diff % 2 === 0) {
    return { kind: "train", day: diff % 4 === 0 ? last.day : flip(last.day) };
  }
  const nextDate = addDaysStr(today, 1);
  const nextDay = (diff + 1) % 4 === 0 ? last.day : flip(last.day);
  return { kind: "rest", nextDate, nextDay };
}

// ---------- 日历 ----------
function formatShort(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const week = ["日", "一", "二", "三", "四", "五", "六"];
  return { wd: week[new Date(y, m - 1, d).getDay()], d };
}

function Calendar({ history, today }: { history: HistoryEntry[]; today: TodayStatus }) {
  const todayS = todayStr();
  const anchor = history[0];
  const cells = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDaysStr(todayS, -i);
    const entry = history.find((h) => h.date === date);
    const { wd, d } = formatShort(date);
    const isToday = i === 0;
    let status: "rest" | "a" | "b" | "miss" | "pending" | "none" = "none";
    if (anchor) {
      const diff = diffDaysStr(anchor.date, date);
      if (diff < 0) {
        status = "none";
      } else if (diff % 2 === 1) {
        status = "rest";
      } else {
        if (entry) {
          status = entry.day === "A" ? "a" : "b";
        } else if (isToday && today.kind === "train") {
          status = "pending";
        } else if (date < todayS) {
          status = "miss";
        } else {
          status = "none";
        }
      }
    } else if (isToday && today.kind === "train") {
      status = "pending";
    }
    cells.push({ date, wd, d, status, isToday });
  }
  return (
    <div className="calendar">
      {cells.map((c) => (
        <div key={c.date} className={`cal-cell ${c.isToday ? "cal-today" : ""}`}>
          <div className="cal-wd">{c.wd}</div>
          <div className={`cal-d cal-${c.status}`}>{c.d}</div>
          <div className="cal-mark">
            {c.status === "a" ? "A" : c.status === "b" ? "B" : c.status === "miss" ? "缺" : c.status === "pending" ? "今" : ""}
          </div>
        </div>
      ))}
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

  const today = computeToday(planState.history, planState.defer, planState.started);
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
          <div className="onboard-sub">告诉我上次练了什么，我好按练一休一算今天该干嘛</div>
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
            <Calendar history={planState.history} today={today} />
          </div>
        </div>
      )}

      {(isTraining || isDone) && (
        <>
          <div className="today">{isDone ? "今天已完成" : `今天 · ${plan.name}`}</div>
          <div className="sub">{plan.focus} · {plan.exercises.length} 个动作</div>

          <div className="progress-label">已完成 {todayDone.length} / {plan.exercises.length}</div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${(todayDone.length / plan.exercises.length) * 100}%` }} /></div>

          <div className="calendar-wrap">
            <Calendar history={planState.history} today={today} />
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
            <div className="hint">点卡片看要点 · 点圆圈打卡</div>
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
    </main>
  );
}
