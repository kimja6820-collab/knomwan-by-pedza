export const metadata = {
  title: 'knomwan - Buffet Order System',
  description: 'ระบบสั่งอาหารร้านขนมหวาน',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
