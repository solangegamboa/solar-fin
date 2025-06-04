export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <main className="w-full max-w-md">
        {children}
      </main>
    </div>
  );
}
