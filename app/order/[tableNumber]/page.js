'use client';

import { use, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
export default function OrderPage({ params }) {
  // ข้อกำหนดสำคัญ: Unwrap params (Promise) ด้วย use() จาก React เสมอ
  const resolvedParams = use(params);
  const tableNumber = parseInt(resolvedParams.tableNumber, 10);

  // Core Data States
  const [session, setSession] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Status & UI States
  const [loading, setLoading] = useState(true);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [cart, setCart] = useState([]); // Array of { id, name, quantity }
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState('');

  // Payment Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [closingPayment, setClosingPayment] = useState(false);

  // 1. ตรวจสอบ Session และ ดึงข้อมูลเมนู
  useEffect(() => {
    async function initData() {
      if (!tableNumber || isNaN(tableNumber)) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // 1.1 เช็ค session ของโต๊ะนี้ที่มี status = 'open'
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .select('id, table_number, adult_count, child_count, status')
          .eq('table_number', tableNumber)
          .eq('status', 'open')
          .maybeSingle();

        if (sessionError) throw sessionError;

        if (sessionData) {
          setSession(sessionData);

          // 1.2 ดึงข้อมูล หมวดหมู่เมนู (เรียงตาม sort_order)
          const { data: catData, error: catError } = await supabase
            .from('menu_categories')
            .select('id, name, sort_order')
            .order('sort_order', { ascending: true });

          if (catError) throw catError;
          setCategories(catData || []);
          if (catData && catData.length > 0) {
            setSelectedCategory(catData[0].id);
          }

          // 1.3 ดึงข้อมูล รายการเมนูทั้งหมด
          const { data: itemData, error: itemError } = await supabase
            .from('menu_items')
            .select('id, category_id, name');

          if (itemError) throw itemError;
          setMenuItems(itemData || []);
        }
      } catch (err) {
        console.error('Error initializing order page:', err);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [tableNumber]);

  // การจัดการตะกร้าสินค้า (เพิ่มรายการ)
  const handleAddToCart = (item) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((cartItem) => cartItem.id === item.id);
      
      // ตรวจสอบจำนวนชิ้นรวมในตะกร้า (จำกัดไม่เกิน 10 รายการต่อการสั่ง 1 ครั้ง)
      const totalQuantity = prevCart.reduce((sum, i) => sum + i.quantity, 0);

      if (existingItem) {
        if (existingItem.quantity >= 5) {
          alert('แต่ละรายการสามารถสั่งได้สูงสุด 5 จานต่อครั้ง');
          return prevCart;
        }
        if (totalQuantity >= 10) {
          alert('สามารถสั่งได้สูงสุดรวมไม่เกิน 10 รายการต่อการส่ง 1 ครั้ง');
          return prevCart;
        }
        return prevCart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      } else {
        if (totalQuantity >= 10) {
          alert('สามารถสั่งได้สูงสุดรวมไม่เกิน 10 รายการต่อการส่ง 1 ครั้ง');
          return prevCart;
        }
        return [...prevCart, { id: item.id, name: item.name, quantity: 1 }];
      }
    });
  };

  // ลดจำนวน หรือลบรายการออกจากตะกร้า
  const handleRemoveFromCart = (itemId) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === itemId);
      if (existingItem.quantity === 1) {
        return prevCart.filter((item) => item.id !== itemId);
      }
      return prevCart.map((item) =>
        item.id === itemId ? { ...item, quantity: item.quantity - 1 } : item
      );
    });
  };

  // จำนวนชิ้นรวมในตะกร้า
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // 2. ส่งออเดอร์เข้าห้องครัว
  const handleSubmitOrder = async () => {
    if (cart.length === 0 || !session) return;

    setSubmittingOrder(true);
    setOrderSuccessMsg('');

    try {
      // แปลงโครงสร้างส่งเฉพาะ { name, quantity } ลง jsonb
      const orderItems = cart.map((item) => ({
        name: item.name,
        quantity: item.quantity,
      }));

      const { error } = await supabase.from('orders').insert([
        {
          session_id: session.id,
          table_number: session.table_number,
          items: orderItems,
          status: 'received',
        },
      ]);

      if (error) throw error;

      // ส่งสำเร็จ
      setCart([]);
      setOrderSuccessMsg('✅ ส่งออเดอร์ไปยังห้องครัวเรียบร้อยแล้ว!');
      setTimeout(() => setOrderSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error submitting order:', err);
      alert('ไม่สามารถส่งออเดอร์ได้: ' + err.message);
    } finally {
      setSubmittingOrder(false);
    }
  };

  // 3. ยืนยันเรียกเก็บเงินและปิด Session
  const handleConfirmPayment = async () => {
    if (!session) return;
    setClosingPayment(true);

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', session.id)
        .eq('status', 'open');

      if (error) throw error;

      setShowPaymentModal(false);
      setSessionClosed(true);
    } catch (err) {
      console.error('Error closing payment:', err);
      alert('เกิดข้อผิดพลาดในการเช็คบิล: ' + err.message);
    } finally {
      setClosingPayment(false);
    }
  };

  // คำนวณราคายอดรวมบุฟเฟต์ (ผู้ใหญ่ 289.- / เด็ก 145.-)
  const calculateTotalBill = () => {
    if (!session) return 0;
    const adultTotal = (session.adult_count || 0) * 289;
    const childTotal = (session.child_count || 0) * 145;
    return adultTotal + childTotal;
  };

  // Render Page State: กำลังโหลด
  if (loading) {
    return (
      <div style={styles.fullscreenCenter}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: '16px', fontSize: '1.2rem', color: '#64748b' }}>
          กำลังโหลดข้อมูลโต๊ะ...
        </p>
      </div>
    );
  }

  // Render Page State: เช็คบิลสำเร็จแล้ว (ขอบคุณที่ใช้บริการ)
  if (sessionClosed) {
    return (
      <div style={styles.fullscreenCenter}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🍧</div>
        <h1 style={{ fontSize: '2rem', color: '#16a34a', margin: '0 0 12px 0' }}>
          ขอบคุณที่ใช้บริการ!
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#475569', textAlign: 'center', padding: '0 20px' }}>
          เช็คบิลเรียบร้อยแล้ว หวังว่าคุณจะประทับใจความอร่อยของร้าน knomwan
        </p>
      </div>
    );
  }

  // Render Page State: โต๊ะยังไม่เปิดใช้งาน (ไม่เจอ Session status = 'open')
  if (!session) {
    return (
      <div style={styles.fullscreenCenter}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '1.8rem', color: '#dc2626', margin: '0 0 12px 0', textAlign: 'center' }}>
          โต๊ะนี้ยังไม่เปิดใช้งาน
        </h2>
        <p style={{ fontSize: '1.2rem', color: '#64748b', textAlign: 'center' }}>
          กรุณาแจ้งพนักงานหน้าร้านเพื่อทำการเปิดโต๊ะ {tableNumber}
        </p>
      </div>
    );
  }

  // กรองรายการเมนูตามหมวดหมู่ที่เลือก
  const filteredMenuItems = menuItems.filter(
    (item) => item.category_id === selectedCategory
  );

  return (
    <div style={styles.container}>
      {/* Top Navigation Bar */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>knomwan 🍧</h1>
          <span style={styles.tableBadge}>โต๊ะ {session.table_number}</span>
        </div>
        <button
          onClick={() => setShowPaymentModal(true)}
          style={styles.billBtn}
        >
          💳 เรียกเก็บเงิน
        </button>
      </header>

      {/* ข้อความแจ้งเตือนเมื่อส่งออเดอร์สำเร็จ */}
      {orderSuccessMsg && (
        <div style={styles.successToast}>{orderSuccessMsg}</div>
      )}

      {/* แท็บเลือกหมวดหมู่เมนู (แนวนอน เลื่อนได้) */}
      <div style={styles.categoryBar}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            style={
              selectedCategory === cat.id
                ? styles.categoryTabActive
                : styles.categoryTab
            }
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* รายการเมนูในหมวดหมู่ที่เลือก */}
      <main style={styles.menuList}>
        {filteredMenuItems.length === 0 ? (
          <p style={styles.emptyText}>ไม่มีรายการอาหารในหมวดหมู่นี้</p>
        ) : (
          filteredMenuItems.map((item) => {
            const cartItem = cart.find((i) => i.id === item.id);
            const quantity = cartItem ? cartItem.quantity : 0;

            return (
              <div key={item.id} style={styles.menuCard}>
                <div style={styles.menuInfo}>
                  <span style={styles.menuName}>{item.name}</span>
                </div>

                {/* Control ปุ่มเพิ่ม/ลด จำนวน */}
                <div style={styles.qtyControls}>
                  {quantity > 0 && (
                    <>
                      <button
                        onClick={() => handleRemoveFromCart(item.id)}
                        style={styles.qtyBtnMinus}
                      >
                        -
                      </button>
                      <span style={styles.qtyText}>{quantity}</span>
                    </>
                  )}
                  <button
                    onClick={() => handleAddToCart(item)}
                    style={styles.qtyBtnPlus}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* ตะกร้าลอยด้านล่างจอ (แสดงเมื่อมีของในตะกร้า) */}
      {cart.length > 0 && (
        <div style={styles.floatingCart}>
          <div style={styles.cartSummary}>
            <span style={styles.cartCountBadge}>{totalCartCount}</span>
            <span style={styles.cartText}>รายการที่เลือก</span>
          </div>
          <button
            onClick={handleSubmitOrder}
            disabled={submittingOrder}
            style={styles.submitOrderBtn}
          >
            {submittingOrder ? 'กำลังส่ง...' : '🚀 ส่งออเดอร์'}
          </button>
        </div>
      )}

      {/* Modal หน้าต่างยืนยันเรียกเก็บเงิน */}
      {showPaymentModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>💳 สรุปรายการเรียกเก็บเงิน</h2>
            <p style={styles.modalSubTitle}>โต๊ะ {session.table_number}</p>

            <div style={styles.billDetails}>
              <div style={styles.billRow}>
                <span>ผู้ใหญ่ ({session.adult_count} ท่าน × 289.-)</span>
                <strong>{(session.adult_count || 0) * 289} บาท</strong>
              </div>
              {session.child_count > 0 && (
                <div style={styles.billRow}>
                  <span>เด็ก ({session.child_count} ท่าน × 145.-)</span>
                  <strong>{session.child_count * 145} บาท</strong>
                </div>
              )}
              <hr style={styles.divider} />
              <div style={styles.totalRow}>
                <span>ยอดรวมทั้งสิ้น</span>
                <span style={styles.totalAmount}>
                  {calculateTotalBill().toLocaleString()} บาท
                </span>
              </div>
            </div>

            <p style={styles.modalNote}>
              * กรุณาตรวจสอบยอดชำระและแจ้งพนักงานเพื่อรับชำระเงิน
            </p>

            <div style={styles.modalActions}>
              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={closingPayment}
                style={styles.cancelModalBtn}
              >
                ย้อนกลับ
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={closingPayment}
                style={styles.confirmPaymentBtn}
              >
                {closingPayment ? 'กำลังบันทึก...' : 'ยืนยันการชำระเงิน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Styles ดีไซน์สไตล์มือถือ ตัวหนังสือและปุ่มกดง่ายด้วยนิ้วโป้ง
const styles = {
  container: {
    maxWidth: '500px',
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    paddingBottom: '100px', // เผื่อพื้นที่ให้ตะกร้าลอย
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#0f172a',
    position: 'relative',
  },
  fullscreenCenter: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#ffffff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: '1.4rem',
    fontWeight: 'bold',
    margin: 0,
    color: '#0f172a',
  },
  tableBadge: {
    display: 'inline-block',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    padding: '2px 8px',
    borderRadius: '6px',
    marginTop: '2px',
  },
  billBtn: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    border: 'none',
    padding: '10px 14px',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  successToast: {
    backgroundColor: '#16a34a',
    color: '#ffffff',
    padding: '12px 20px',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: '0.95rem',
  },
  categoryBar: {
    display: 'flex',
    overflowX: 'auto',
    padding: '12px 16px',
    gap: '8px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    scrollbarWidth: 'none',
  },
  categoryTab: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    fontSize: '0.95rem',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  categoryTabActive: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid #2563eb',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  menuList: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  menuCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: '16px',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  menuInfo: {
    flex: 1,
    paddingRight: '12px',
  },
  menuName: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#1e293b',
  },
  qtyControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  qtyBtnMinus: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '1.4rem',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  qtyBtnPlus: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '1.4rem',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  qtyText: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    minWidth: '20px',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: '40px',
    fontSize: '1rem',
  },

  /* Floating Cart Bar */
  floatingCart: {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 32px)',
    maxWidth: '468px',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    borderRadius: '16px',
    padding: '12px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
    zIndex: 50,
  },
  cartSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  cartCountBadge: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.95rem',
    fontWeight: 'bold',
  },
  cartText: {
    fontSize: '1rem',
    fontWeight: '500',
  },
  submitOrderBtn: {
    backgroundColor: '#22c55e',
    color: '#ffffff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '10px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  /* Modal */
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
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '24px',
    maxWidth: '400px',
    width: '100%',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
  },
  modalTitle: {
    margin: '0 0 4px 0',
    fontSize: '1.4rem',
    color: '#0f172a',
  },
  modalSubTitle: {
    margin: '0 0 16px 0',
    color: '#64748b',
    fontSize: '1rem',
  },
  billDetails: {
    backgroundColor: '#f8fafc',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    marginBottom: '16px',
  },
  billRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '1rem',
    marginBottom: '8px',
    color: '#334155',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #cbd5e1',
    margin: '12px 0',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#0f172a',
  },
  totalAmount: {
    fontSize: '1.4rem',
    color: '#2563eb',
  },
  modalNote: {
    fontSize: '0.85rem',
    color: '#64748b',
    marginBottom: '20px',
    textAlign: 'center',
  },
  modalActions: {
    display: 'flex',
    gap: '10px',
  },
  cancelModalBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#334155',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  confirmPaymentBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#16a34a',
    color: '#ffffff',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #2563eb',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
