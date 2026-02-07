export default function Home() {
  return (
    <main>
      <h1>LogTide Next.js Test App</h1>
      <p data-testid="status">Ready</p>
      <a href="/api/test-log" data-testid="log-link">Send Log</a>
      <a href="/api/test-error" data-testid="error-link">Trigger Error</a>
    </main>
  );
}
