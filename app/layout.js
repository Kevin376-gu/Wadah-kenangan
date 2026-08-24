import "./globals.css";

export const metadata = {
  title: "Wadah Kenangan",
  description: "Simpan dan bagikan foto/video keluarga dengan aman",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
