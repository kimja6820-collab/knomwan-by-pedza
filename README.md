# knomwan - ระบบสั่งอาหารร้านบุฟเฟต์

โปรเจกต์ Next.js (App Router, JavaScript) สำหรับจัดการการสั่งอาหารร้านบุฟเฟต์ "knomwan" เชื่อมต่อกับ Supabase และรองรับการ Deploy บน Vercel

## 🗄️ โครงสร้างตารางฐานข้อมูล (Supabase Reference)

- **sessions**: `id`, `table_number`, `adult_count`, `child_count`, `status`, `created_at`
- **menu_categories**: `id`, `name`, `sort_order`
- **menu_items**: `id`, `category_id`, `name`
- **orders**: `id`, `session_id`, `table_number`, `items` (jsonb), `status`, `created_at`

## ⚠️ ข้อควรระวังสำคัญสำหรับ Next.js App Router เวอร์ชันใหม่

โปรเจกต์นี้ใช้ Next.js เวอร์ชันล่าสุด โดย **`params` ใน Dynamic Route จะเป็น Promise** เสมอ

เมื่อสร้าง Dynamic Route (เช่น `app/order/[sessionId]/page.js`) **ต้อง unwrap `params` ด้วย hook `use()` จาก React** ดังนี้:

```javascript
'use client';
import { use } from 'react';

export default function OrderPage({ params }) {
  // Unwrap params ด้วย use() ก่อนนำไปใช้งาน
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;

  return <div>Session ID: {sessionId}</div>;
}
