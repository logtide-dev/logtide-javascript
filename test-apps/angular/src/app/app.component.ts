import { Component } from '@angular/core';
import { hub } from '@logtide/core';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <h1>LogTide Angular Test App</h1>
    <p data-testid="status">Ready</p>
    <button data-testid="log-button" (click)="sendLog()">Send Log</button>
    <button data-testid="span-button" (click)="sendSpan()">Send Span</button>
    <p data-testid="result">{{ result }}</p>
  `,
})
export class AppComponent {
  result = '';

  sendLog() {
    const client = hub.getClient();
    client?.captureLog('info', 'manual log from angular', { route: '/test-log' });
    hub.flush();
    this.result = 'Log sent';
  }

  sendSpan() {
    const client = hub.getClient();
    const span = client?.startSpan({
      name: 'GET /api/test-log',
      attributes: { 'http.method': 'GET', 'http.target': '/api/test-log' },
    });
    if (span) {
      client?.finishSpan(span.spanId, 'ok');
    }
    hub.flush();
    this.result = 'Span sent';
  }
}
