import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Users, Shield, GitMerge, ArrowRight, Terminal, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../store/useEditorStore';
import { useTheme } from '../hooks/useTheme';

export function LandingPage() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const { theme, toggle } = useTheme();

  const handleCTA = () => navigate(token ? '/docs' : '/auth');

  return (
    <div className="landing">
      {/* Hero */}
      <nav className="landing-nav">
        <div className="landing-logo"><Zap size={22} /> CollabEdit</div>
        <div className="landing-nav-actions">
          <button className="btn btn-ghost btn-sm theme-toggle-btn" onClick={toggle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/auth')}>Sign In</button>
          <button className="btn btn-primary" onClick={handleCTA}>Get Started <ArrowRight size={15} /></button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-badge">
          <Terminal size={14} /> Powered by Operational Transformation
        </div>
        <h1 className="hero-title">
          Edit Together,<br />
          <span className="gradient-text">In Real Time</span>
        </h1>
        <p className="hero-sub">
          A production-grade collaborative editor that resolves concurrent edits
          at the character level — even when two users type at the exact same position simultaneously.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary btn-lg" onClick={handleCTA}>
            Start Editing Free <ArrowRight size={18} />
          </button>
        </div>

        {/* Fake editor preview */}
        <div className="hero-editor-preview">
          <div className="preview-topbar">
            <div className="preview-dot" style={{ background: '#333' }} />
            <div className="preview-dot" style={{ background: '#444' }} />
            <div className="preview-dot" style={{ background: '#555' }} />
            <span className="preview-title">project-notes.md</span>
            <div className="preview-users">
              <div className="preview-avatar" style={{ background: '#333' }}>A</div>
              <div className="preview-avatar" style={{ background: '#444' }}>B</div>
              <div className="preview-avatar" style={{ background: '#555' }}>C</div>
            </div>
          </div>
          <div className="preview-body">
            <div className="preview-line"><span className="preview-hash">#</span> Meeting Notes</div>
            <div className="preview-line preview-line-cursor preview-cursor-pink">
              <span>Alice is typing here</span>
              <span className="preview-caret" style={{ background: '#666' }} />
            </div>
            <div className="preview-line">- Deploy new feature by Friday</div>
            <div className="preview-line preview-line-cursor preview-cursor-teal">
              <span>Bob is collaborating</span>
              <span className="preview-caret" style={{ background: '#888' }} />
            </div>
            <div className="preview-line">- Review PRs from last sprint</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <h2 className="section-title">Built Different</h2>
        <div className="features-grid">
          {[
            { icon: <GitMerge size={24} />, title: 'Operational Transformation', desc: 'Custom OT engine that resolves concurrent edits at the character level. No conflicts, ever.' },
            { icon: <Zap size={24} />, title: 'Optimistic Updates', desc: 'Your keystrokes render instantly. OT sync happens asynchronously in the background.' },
            { icon: <Users size={24} />, title: 'Live Presence', desc: 'See who\'s in the document, their cursors, and what they\'re typing in real time.' },
            { icon: <Shield size={24} />, title: 'Persistent & Safe', desc: 'Auto-saved to SQLite via Prisma. Your work is never lost even if the server restarts.' },
          ].map((f, i) => (
            <div className="feature-card" key={i}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <p>Built with ❤️ · OT Algorithm · Node.js · React · CodeMirror 6</p>
      </footer>
    </div>
  );
}
