export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Monash Association of Coding
      </p>
      <h1 className="mt-4 text-[clamp(2.75rem,12vw,5.5rem)] font-extrabold leading-none">
        Best Dressed
      </h1>
      <p className="mt-6 text-muted-foreground">
        Waiting for host to start a session
      </p>
    </main>
  );
}
