'use client';

import React, { useState, useEffect } from 'react';

interface TimelineItem {
  date: string;
  decisionId: string;
  actionType: string;
  predicted: string;
  actual: string | number;
  errorPct: string;
  status: string;
  lessonLearned: string;
}

export default function AILearningTimelinePage() {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTimeline() {
      try {
        setLoading(true);
        const res = await fetch('/api/merchant/ai/learning/timeline', {
          headers: { 'x-merchant-id': 'default_merchant' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.timeline) setTimeline(data.timeline);
        }
      } catch (err) {
        console.error('Failed to load learning timeline:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTimeline();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      color: '#f0f6fc',
      padding: '32px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Navigation & Header */}
        <div style={{ marginBottom: '24px' }}>
          <a href="/merchant" style={{ color: '#58a6ff', fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            ← Back to Merchant Command Center
          </a>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 700, background: 'linear-gradient(90deg, #58a6ff, #bc8cff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Merchant AI Learning & Closed-Loop Timeline
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#8b949e' }}>
            Audit trail of AI decisions, predictions, empirical outcome realizations, and mathematical model updates.
          </p>
        </div>

        {/* Timeline Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#8b949e' }}>Loading learning audit trail...</div>
        ) : timeline.length === 0 ? (
          <div style={{ background: '#161b22', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#8b949e', border: '1px solid rgba(255,255,255,0.08)' }}>
            No evaluated outcomes recorded yet. Decisions will appear here once empirical outcomes mature.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {timeline.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(22, 27, 34, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', background: 'rgba(88, 166, 255, 0.15)', color: '#58a6ff', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                      {item.actionType}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f6fc' }}>
                      Decision #{item.decisionId}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#8b949e' }}>
                    {new Date(item.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '6px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#8b949e' }}>PREDICTED</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#c9d1d9' }}>{item.predicted}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#8b949e' }}>REALIZED OUTCOME</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: item.status === 'EVALUATED' ? '#3fb950' : '#d29922' }}>
                      {item.actual}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#8b949e' }}>VARIANCE ERROR</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: item.errorPct.includes('15') || item.errorPct.includes('10') ? '#3fb950' : '#f85149' }}>
                      {item.errorPct}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '13px', color: '#c9d1d9', lineHeight: 1.4 }}>
                  <strong>💡 Lesson Learned:</strong> {item.lessonLearned}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
