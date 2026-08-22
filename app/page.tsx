"use client";

import { useState, useEffect } from "react";
import { plans } from "../plan";

function todayText() {
  const d = new Date();
  const week = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getMonth() + 1}月${d.getDate()}日 · 周${week[d.getDay()]}`;
}

export default function Home() {
  const [day, setDay] = useState<"A" | "B">("A");
  const [done, setDone] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [finished, setFinished] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // 水合后从 localStorage 恢复上次状态
  useEffect(() => {
    try {
      const t = localStorage.getItem("fitness-theme");
      if (t === "dark" || t === "light") setTheme(t);
      const d = localStorage.getItem("fitness-day");
      if (d === "A" || d === "B") setDay(d);
      const s = localStorage.getItem("fitness-done");
      if (s) {
        const data = JSON.parse(s);
        if (data.date === new Date().toDateString()) setDone(data.done || []);
      }
    } catch {}
    setLoaded(true);
  }, []);

  // 持久化（恢复完成后再写，避免首次挂载用默认值覆盖）
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("fitness-theme", theme);
    localStorage.setItem("fitness-day", day);
    localStorage.setItem("fitness-done", JSON.stringify({ date: new Date().toDateString(), done }));
  }, [loaded, theme, day, done]);

  const plan = plans[day];

  function switchDay(d: "A" | "B") {
    setDay(d);
    setDone([]);
    setOpen(null);
    setFinished(false);
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

  return (
    <main className="phone">
      <div className="topbar">
        <div className="top-date">{todayText()}</div>
        <button className="theme-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>

      <div className="today">今天 · {plan.name}</div>
      <div className="sub">{plan.focus} · {plan.exercises.length} 个动作</div>

      <div className="progress-label">已完成 {done.length} / {plan.exercises.length}</div>
      <div className="progress-bar"><div className="progress-fill" style={{ width: `${(done.length / plan.exercises.length) * 100}%` }} /></div>

      <div className="section-head">热身</div>
      {plan.warmup.map((sec, si) => (
        <div key={sec.title}>
          <div className="section-sub">{sec.title}</div>
          {sec.items.map((item, ii) => {
            const k = `wu:${si}:${ii}`;
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
      ))}

      <div className="section-head">正式动作</div>
      {plan.exercises.map((ex) => {
        const k = `ex:${ex.name}`;
        return (
          <div key={k} className={`card ${open === k ? "open" : ""} ${done.includes(ex.name) ? "done" : ""}`}>
            <div className="card-top" onClick={() => setOpen(open === k ? null : k)}>
              <span className="check" onClick={(e) => { e.stopPropagation(); toggle(ex.name); }}>
                {done.includes(ex.name) && <svg viewBox="0 0 24 24" fill="none" stroke="#06230f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
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
      {plan.stretch.map((sec, si) => (
        <div key={sec.title}>
          <div className="section-sub">{sec.title}</div>
          {sec.items.map((item, ii) => {
            const k = `st:${si}:${ii}`;
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
      ))}

      <div className="footer">
        <button className="btn" disabled={done.length < plan.exercises.length} onClick={() => setFinished(true)}>
          完成训练
        </button>
        <div className="hint">点卡片看要点 · 点圆圈打卡</div>
      </div>

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
