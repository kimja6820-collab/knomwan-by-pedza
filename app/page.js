import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>ยินดีต้อนรับสู่ร้าน knomwan (ขนมหวาน) 🍧</h1>
      <p>ระบบสั่งอาหารบุฟเฟต์ผ่าน QR Code</p>
      
      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        <Link 
          href="/generate-qr" 
          style={{ padding: '0.5rem 1rem', background: '#0070f3', color: '#fff', borderRadius: '5px', textDecoration: 'none' }}
        >
          สร้าง QR Code (พนักงาน)
        </Link>
        <Link 
          href="/kitchen" 
          style={{ padding: '0.5rem 1rem', background: '#10b981', color: '#fff', borderRadius: '5px', textDecoration: 'none' }}
        >
          หน้าจอห้องครัว (Kitchen)
        </Link>
      </div>
    </main>
  );
}
