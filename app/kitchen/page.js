'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. โหลดข้อมูลออเดอร์เริ่มต้นที่ status เป็น 'received' หรือ 'cooking'
  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['received', 'cooking'])
        .order('created_at', { ascending: true }); // เรียงจากเก่าไปใหม่ (ออเดอร์มาก่อนทำก่อน)

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching kitchen orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // 2. ตั้งค่า Supabase Realtime ฟังการ INSERT และ UPDATE ตาราง orders
    const channel = supabase
      .channel('kitchen-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // ฟังทั้ง INSERT และ UPDATE
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const { eventType, new: newRecord } = payload;

          if (eventType === 'INSERT') {
            // มีออเดอร์ใหม่เข้ามา -> เพิ่มลงในการ์ดถ้ารับออเดอร์แล้ว
            if (newRecord.status === 'received' || newRecord.status === 'cooking') {
              setOrders((prevOrders) => {
                // กันกรณีออเดอร์ซ้ำ
                if (prevOrders.some((o) => o.id === newRecord.id)) return prevOrders;
                return [...prevOrders, newRecord];
              });
            }
          } else if (eventType === 'UPDATE') {
            // มีการอัปเดตสถานะ
            if (newRecord.status === 'served' || newRecord.status === 'closed') {
              // ถ้าเสิร์ฟแล้ว -> ดึงการ์ดออกจากหน้าจอทันที
              setOrders((prevOrders) =>
                prevOrders.filter((o) => o.id !== newRecord.id)
              );
            } else {
              // ถ้าเปลี่ยน status เป็นอย่างอื่น (เช่น cooking) -> อัปเดตข้อมูลการ์ด
              setOrders((prevOrders) =>
                prevOrders.map((o) => (o.id === newRecord.id ? newRecord : o))
              );
            }
          }
        }
      )
      .subscribe();

    // Clean up subscription เมื่อปิดหน้าจอ
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. เปลี่ยนสถานะออเดอร์เป็น 'cooking'
  const handleStartCooking = async (orderId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cooking' })
        .eq('id', orderId);

      if (error) throw error;
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('ไม่สามารถอัปเดตสถานะเป็นกำลังทำได้');
    }
  };

  // 4. เปลี่ยนสถานะออเดอร์เป็น 'served' (ลบออกจากจอ)
  const handleMarkServed = async (orderId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'served' })
        .eq('id', orderId);

      if (error) throw error;
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('ไม่สามารถอัปเดตสถานะเป็นเสิร์ฟแล้วได้');
    }
  };

  // แปลงเวลา created_at เป็นรูปแบบอ่านง่าย (HH:mm น.)
  const formatTime = (timeString) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    }) + ' น.';
  };

  return (
    <div style={styles.container}>
      {/* Header จอครัว */}
      <header style={styles.header}>
        <div style={styles.headerTitleGroup}>
          <h1 style={styles.title}>👨‍🍳 จอห้องครัว (Kitchen KDS)</h1>
          <span style={styles.liveBadge}>● Realtime Active</span>
        </div>
        <div style={styles.orderCountBadge}>
          รอดำเนินการ: <strong>{orders.length}</strong> ออเดอร์
        </div>
      </header>

      {/* Loading State */}
      {loading ? (
        <div style={styles.loadingBox}>
          <div style={styles.spinner}></div>
          <p style={{ marginTop: '16px', fontSize: '1.4rem' }}>กำลังโหลดออเดอร์...</p>
        </div>
      ) : orders.length === 0 ? (
        /* Empty State */
        <div style={styles.emptyBox}>
          <div style={{ fontSize: '5rem', marginBottom: '16px' }}>✨</div>
          <h2 style={{ fontSize: '2rem', color: '#10b981', margin: 0 }}>ไม่มีออเดอร์ค้างในขณะนี้</h2>
          <p style={{ fontSize: '1.2rem', color: '#64748b' }}>ออเดอร์ใหม่จากลูกค้าจะเข้ามาที่จอนี้อัตโนมัติ</p>
        </div>
      ) : (
        /* Grid Display การ์ดออเดอร์ */
        <main style={styles.gridContainer}>
          {orders.map((order) => {
            const isCooking = order.status === 'cooking';
            // Parse รายการอาหารจาก jsonb
            const items = Array.isArray(order.items) ? order.items : [];

            return (
              <div
                key={order.id}
                style={isCooking ? styles.cardCooking : styles.cardReceived}
              >
                {/* ส่วนหัวการ์ด: เลขโต๊ะ + เวลา */}
                <div style={styles.cardHeader}>
                  <span style={styles.tableNumber}>โต๊ะ {order.table_number}</span>
                  <span style={styles.orderTime}>{formatTime(order.created_at)}</span>
                </div>

                {/* สถานะออเดอร์ */}
                <div style={styles.statusBadgeWrapper}>
                  <span style={isCooking ? styles.badgeCooking : styles.badgeReceived}>
                    {isCooking ? '🔥 กำลังปรุง' : '📥 ออเดอร์ใหม่'}
                  </span>
                </div>

                {/* รายการอาหารทั้งหมด */}
                <div style={styles.itemList}>
                  {items.map((item, index) => (
                    <div key={index} style={styles.itemRow}>
                      <span style={styles.itemName}>{item.name}</span>
                      <span style={styles.itemQty}>x{item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* ปุ่ม action ด้านล่างการ์ด */}
                <div style={styles.cardActions}>
                  {!isCooking ? (
                    <button
                      onClick={() => handleStartCooking(order.id)}
                      style={styles.btnCooking}
                    >
                      🔥 เริ่มทำ
                    </button>
                  ) : null}
                  <button
                    onClick={() => handleMarkServed(order.id)}
                    style={styles.btnServed}
                  >
                    ✅ จัดเสิร์ฟแล้ว
                  </button>
                </div>
              </div>
            );
          })}
        </main>
      )}
    </div>
  );
}

// Inline Styles เน้นตัวหนังสือใหญ่ คอนทราสต์สูง อ่านง่ายจากระยะไกลในครัว
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f172a', // ธีมเข้มถนอมสายตาสำหรับจอทีวี/ครัว
    color: '#f8fafc',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    borderBottom: '2px solid #334155',
    paddingBottom: '16px',
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    margin: 0,
    color: '#f8fafc',
  },
  liveBadge: {
    backgroundColor: '#065f46',
    color: '#34d399',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
  orderCountBadge: {
    fontSize: '1.4rem',
    backgroundColor: '#1e293b',
    padding: '10px 20px',
    borderRadius: '12px',
    border: '1px solid #475569',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '20px',
    alignItems: 'start',
  },

  /* การ์ดสถานะ ออเดอร์ใหม่ (สีขาว-เทาขอบฟ้า) */
  cardReceived: {
    backgroundColor: '#1e293b',
    borderRadius: '16px',
    border: '3px solid #3b82f6',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
  },

  /* การ์ดสถานะ กำลังปรุง (สีส้ม/เหลืองเด่น) */
  cardCooking: {
    backgroundColor: '#271c19',
    borderRadius: '16px',
    border: '3px solid #f97316',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
  },

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  tableNumber: {
    fontSize: '2.2rem',
    fontWeight: '900',
    color: '#ffffff',
  },
  orderTime: {
    fontSize: '1.2rem',
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  statusBadgeWrapper: {
    marginBottom: '16px',
  },
  badgeReceived: {
    backgroundColor: '#1d4ed8',
    color: '#ffffff',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  badgeCooking: {
    backgroundColor: '#c2410c',
    color: '#ffffff',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: 'bold',
  },

  /* รายการอาหาร */
  itemList: {
    backgroundColor: '#0f172a',
    borderRadius: '10px',
    padding: '14px',
    marginBottom: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    border: '1px solid #334155',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px dashed #334155',
    paddingBottom: '8px',
  },
  itemName: {
    fontSize: '1.4rem',
    fontWeight: 'bold',
    color: '#f8fafc',
    flex: 1,
    paddingRight: '12px',
  },
  itemQty: {
    fontSize: '1.6rem',
    fontWeight: '900',
    color: '#facc15', // สีเหลืองเด่นสำหรับจำนวน
    backgroundColor: '#1e293b',
    padding: '2px 10px',
    borderRadius: '8px',
  },

  /* ปุ่มกด */
  cardActions: {
    display: 'flex',
    gap: '10px',
    marginTop: 'auto',
  },
  btnCooking: {
    flex: 1,
    backgroundColor: '#ea580c',
    color: '#ffffff',
    border: 'none',
    padding: '14px',
    borderRadius: '10px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  btnServed: {
    flex: 1,
    backgroundColor: '#16a34a',
    color: '#ffffff',
    border: 'none',
    padding: '14px',
    borderRadius: '10px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  /* Empty & Loading State */
  emptyBox: {
    textAlign: 'center',
    padding: '80px 20px',
    backgroundColor: '#1e293b',
    borderRadius: '20px',
    border: '2px dashed #334155',
    marginTop: '40px',
  },
  loadingBox: {
    textAlign: 'center',
    padding: '80px 20px',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '5px solid #334155',
    borderTop: '5px solid #3b82f6',
    borderRadius: '50%',
    margin: '0 auto',
  },
};
