'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function GenerateQRPage() {
  // Form states
  const [tableNumber, setTableNumber] = useState('');
  const [adultCount, setAdultCount] = useState('1');
  const [childCount, setChildCount] = useState('0');

  // App UI states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Existing session warning states
  const [existingSession, setExistingSession] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [closingSession, setClosingSession] = useState(false);

  // Success QR states
  const [generatedSession, setGeneratedSession] = useState(null);
  const [copied, setCopied] = useState(false);

  // คำนวณเวลาที่เปิดโต๊ะค้างไว้ (เป็นนาที)
  const getElapsedMinutes = (createdAt) => {
    if (!createdAt) return 0;
    const diffMs = new Date() - new Date(createdAt);
    return Math.floor(diffMs / (1000 * 60));
  };

  // จัดการการกดปุ่ม "เปิดโต๊ะ"
  const handleOpenTable = async (e) => {
    e.preventDefault();
    if (!tableNumber || parseInt(tableNumber, 10) <= 0) {
      setErrorMessage('กรุณากรอกเลขโต๊ะให้ถูกต้อง');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setExistingSession(null);
    setGeneratedSession(null);

    const tableNum = parseInt(tableNumber, 10);
    const adultNum = parseInt(adultCount, 10) || 0;
    const childNum = parseInt(childCount, 10) || 0;

    try {
      // 1. เช็คก่อนว่ามี session status = 'open' ของโต๊ะนี้อยู่แล้วหรือไม่
      const { data: openSessions, error: checkError } = await supabase
        .from('sessions')
        .select('id, table_number, adult_count, child_count, status, created_at')
        .eq('table_number', tableNum)
        .eq('status', 'open');

      if (checkError) throw checkError;

      if (openSessions && openSessions.length > 0) {
        // พบ session ค้าง -> แสดงกล่องเตือน
        setExistingSession(openSessions[0]);
        setLoading(false);
        return;
      }

      // 2. ถ้าไม่มี session ค้าง -> Insert session ใหม่
      const { data: newSession, error: insertError } = await supabase
        .from('sessions')
        .insert([
          {
            table_number: tableNum,
            adult_count: adultNum,
            child_count: childNum,
            status: 'open',
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      // สร้างสำเร็จ
      setGeneratedSession(newSession);
    } catch (err) {
      console.error('Error opening table:', err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  // ยืนยันปิดโต๊ะเดิม
  const handleConfirmCloseExistingSession = async () => {
    if (!existingSession) return;
    setClosingSession(true);

    try {
      // Update status เป็น 'closed' โดยเช็คว่า status ยังเป็น 'open' อยู่เพื่อกันกดซ้ำ
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', existingSession.id)
        .eq('status', 'open');

      if (error) throw error;

      // เมื่อปิดสำเร็จ: ปิด Modal ยืนยัน, ลบกล่องเตือนออก
      setShowConfirmModal(false);
      setExistingSession(null);
      alert(`ปิดออเดอร์เดิมของโต๊ะ ${existingSession.table_number} เรียบร้อยแล้ว กรุณากด "เปิดโต๊ะ" อีกครั้ง`);
    } catch (err) {
      console.error('Error closing session:', err);
      alert('ไม่สามารถปิดออเดอร์เดิมได้: ' + err.message);
    } finally {
      setClosingSession(false);
    }
  };

  // กดเปิดโต๊ะใหม่ (ล้างข้อมูลเริ่มใหม่)
  const handleReset = () => {
    setGeneratedSession(null);
    setExistingSession(null);
    setTableNumber('');
    setAdultCount('1');
    setChildCount('0');
    setErrorMessage('');
    setCopied(false);
  };

  // คัดลอกลิงก์
  const handleCopyLink = (targetUrl) => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // คำนวณ URL และ QR Code URL
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const orderUrl = generatedSession ? `${origin}/order/${generatedSession.table_number}` : '';
  const qrImageUrl = generatedSession
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(orderUrl)}`
    : '';

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>knomwan 🍧</h1>
        <p style={styles.subtitle}>ระบบเปิดโต๊ะและสร้าง QR Code สำหรับพนักงาน</p>
      </header>

      {/* ข้อความ Error ทั่วไป */}
      {errorMessage && <div style={styles.errorBox}>{errorMessage}</div>}

      {/* 1. กรณีสร้าง QR Code สำเร็จ */}
      {generatedSession ? (
        <div style={styles.qrCard}>
          <div style={styles.badgeSuccess}>เปิดโต๊ะสำเร็จ!</div>
          <h2 style={styles.qrTitle}>โต๊ะ {generatedSession.table_number}</h2>
          
          <p style={styles.summaryText}>
            ผู้ใหญ่ <strong>{generatedSession.adult_count}</strong> ท่าน · เด็ก <strong>{generatedSession.child_count}</strong> ท่าน
          </p>

          <div style={styles.qrImageWrapper}>
            <img
              src={qrImageUrl}
              alt={`QR Code โต๊ะ ${generatedSession.table_number}`}
              style={styles.qrImage}
            />
          </div>

          <p style={styles.urlLabel}>ลิงก์สำหรับสั่งอาหาร:</p>
          <div style={styles.urlBox}>
            <span style={styles.urlText}>{orderUrl}</span>
            <button
              onClick={() => handleCopyLink(orderUrl)}
              style={copied ? styles.copyBtnSuccess : styles.copyBtn}
            >
              {copied ? 'คัดลอกแล้ว! ✓' : 'คัดลอกลิงก์'}
            </button>
          </div>

          <button onClick={handleReset} style={styles.resetBtn}>
            + เปิดโต๊ะใหม่
          </button>
        </div>
      ) : (
        /* 2. ฟอร์มปกติ & กล่องเตือน */
        <div style={styles.formCard}>
          {/* กล่องเตือนเมื่อมี Session ค้างอยู่ */}
          {existingSession && (
            <div style={styles.warningBox}>
              <div style={styles.warningIcon}>⚠️</div>
              <h3 style={styles.warningTitle}>
                โต๊ะ {existingSession.table_number} มีลูกค้าอยู่ระหว่างทานอาหาร
              </h3>
              <p style={styles.warningDesc}>กรุณาปิดออเดอร์เดิมก่อน จึงจะเปิดโต๊ะใหม่ได้</p>
              <button
                onClick={() => setShowConfirmModal(true)}
                style={styles.closeOldSessionBtn}
              >
                ปิดออเดอร์เดิม
              </button>
            </div>
          )}

          {/* ฟอร์มกรอกข้อมูล */}
          <form onSubmit={handleOpenTable}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>เลขโต๊ะ *</label>
              <input
                type="number"
                min="1"
                required
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="ระบุเลขโต๊ะ (เช่น 7)"
                style={styles.inputBig}
              />
            </div>

            <div style={styles.row}>
              <div style={{ ...styles.inputGroup, flex: 1 }}>
                <label style={styles.label}>ผู้ใหญ่ (คน)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adultCount}
                  onChange={(e) => setAdultCount(e.target.value)}
                  style={styles.inputMedium}
                />
              </div>

              <div style={{ ...styles.inputGroup, flex: 1 }}>
                <label style={styles.label}>เด็ก (คน)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={childCount}
                  onChange={(e) => setChildCount(e.target.value)}
                  style={styles.inputMedium}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={loading ? styles.submitBtnDisabled : styles.submitBtn}
            >
              {loading ? 'กำลังตรวจสอบ...' : '🚀 เปิดโต๊ะ'}
            </button>
          </form>
        </div>
      )}

      {/* Modal ยืนยันการปิดออเดอร์เดิม */}
      {showConfirmModal && existingSession && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>⚠️ ยืนยันปิดโต๊ะเดิม</h3>
            <p style={styles.modalText}>
              คุณกำลังจะปิด Session ของ <strong>โต๊ะ {existingSession.table_number}</strong>
            </p>

            <div style={styles.sessionDetails}>
              <p>• จำนวนผู้ใหญ่: <strong>{existingSession.adult_count}</strong> ท่าน</p>
              <p>• จำนวนเด็ก: <strong>{existingSession.child_count}</strong> ท่าน</p>
              <p>
                • เปิดมาแล้ว:{' '}
                <strong style={{ color: '#dc2626' }}>
                  {getElapsedMinutes(existingSession.created_at)} นาที
                </strong>
              </p>
            </div>

            <div style={styles.modalActions}>
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={closingSession}
                style={styles.cancelBtn}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmCloseExistingSession}
                disabled={closingSession}
                style={styles.confirmCloseBtn}
              >
                {closingSession ? 'กำลังปิด...' : 'ยืนยันปิดโต๊ะเดิม'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Styles เน้นตัวหนังสือใหญ่ คมชัด ใช้งานง่ายหน้าร้าน
const styles = {
  container: {
    maxWidth: '540px',
    margin: '0 auto',
    padding: '20px 16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1f2937',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: 'bold',
    color: '#0f172a',
    margin: '0 0 4px 0',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#64748b',
    margin: 0,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0',
  },
  row: {
    display: 'flex',
    gap: '12px',
  },
  inputGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '1.1rem',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#334155',
  },
  inputBig: {
    width: '100%',
    padding: '16px',
    fontSize: '1.8rem',
    fontWeight: 'bold',
    borderRadius: '12px',
    border: '2px solid #cbd5e1',
    boxSizing: 'border-box',
    textAlign: 'center',
    outline: 'none',
  },
  inputMedium: {
    width: '100%',
    padding: '14px',
    fontSize: '1.4rem',
    fontWeight: 'bold',
    borderRadius: '12px',
    border: '2px solid #cbd5e1',
    boxSizing: 'border-box',
    textAlign: 'center',
    outline: 'none',
  },
  submitBtn: {
    width: '100%',
    padding: '18px',
    fontSize: '1.4rem',
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    marginTop: '8px',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
  },
  submitBtnDisabled: {
    width: '100%',
    padding: '18px',
    fontSize: '1.4rem',
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#94a3b8',
    border: 'none',
    borderRadius: '12px',
    cursor: 'not-allowed',
    marginTop: '8px',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontWeight: '600',
    border: '1px solid #fecaca',
  },
  
  /* Warning Card Style */
  warningBox: {
    backgroundColor: '#fff7ed',
    border: '2px solid #f97316',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    textAlign: 'center',
  },
  warningIcon: {
    fontSize: '2.5rem',
    lineHeight: '1',
    marginBottom: '8px',
  },
  warningTitle: {
    margin: '0 0 8px 0',
    fontSize: '1.25rem',
    color: '#c2410c',
    fontWeight: 'bold',
  },
  warningDesc: {
    margin: '0 0 16px 0',
    color: '#9a3412',
    fontSize: '1rem',
  },
  closeOldSessionBtn: {
    backgroundColor: '#ea580c',
    color: '#ffffff',
    border: 'none',
    padding: '12px 24px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    borderRadius: '8px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(234, 88, 12, 0.3)',
  },

  /* QR Result Card Style */
  qrCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '28px 20px',
    textAlign: 'center',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
    border: '2px solid #22c55e',
  },
  badgeSuccess: {
    display: 'inline-block',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    padding: '6px 16px',
    borderRadius: '20px',
    fontWeight: 'bold',
    fontSize: '0.95rem',
    marginBottom: '12px',
  },
  qrTitle: {
    fontSize: '2.5rem',
    margin: '0 0 4px 0',
    color: '#0f172a',
  },
  summaryText: {
    fontSize: '1.2rem',
    color: '#475569',
    margin: '0 0 20px 0',
  },
  qrImageWrapper: {
    display: 'inline-block',
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    marginBottom: '20px',
  },
  qrImage: {
    width: '260px',
    height: '260px',
    display: 'block',
  },
  urlLabel: {
    fontSize: '0.95rem',
    color: '#64748b',
    marginBottom: '6px',
    fontWeight: '600',
  },
  urlBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#f1f5f9',
    padding: '10px 12px',
    borderRadius: '10px',
    marginBottom: '24px',
  },
  urlText: {
    flex: 1,
    fontSize: '0.9rem',
    color: '#0f172a',
    wordBreak: 'break-all',
    textAlign: 'left',
    fontFamily: 'monospace',
  },
  copyBtn: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  copyBtnSuccess: {
    backgroundColor: '#16a34a',
    color: '#ffffff',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  resetBtn: {
    width: '100%',
    padding: '16px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    cursor: 'pointer',
  },

  /* Modal Style */
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    maxWidth: '400px',
    width: '100%',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
  },
  modalTitle: {
    margin: '0 0 12px 0',
    fontSize: '1.4rem',
    color: '#b91c1c',
  },
  modalText: {
    fontSize: '1.1rem',
    margin: '0 0 16px 0',
    color: '#334155',
  },
  sessionDetails: {
    backgroundColor: '#f8fafc',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #e2e8f0',
    lineHeight: '1.6',
    fontSize: '1rem',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
  },
  cancelBtn: {
    flex: 1,
    padding: '12px',
    fontSize: '1rem',
    fontWeight: 'bold',
    backgroundColor: '#e2e8f0',
    color: '#334155',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  confirmCloseBtn: {
    flex: 1,
    padding: '12px',
    fontSize: '1rem',
    fontWeight: 'bold',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
};
